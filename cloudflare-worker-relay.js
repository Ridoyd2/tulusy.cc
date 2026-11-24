/**
 * Cloudflare Worker Outbound Relay for Tulusy (tulusy.cc)
 * -------------------------------------------------------------------
 * Purpose: Masks your VPS origin IP on all outbound Load Tester & DA Checker requests.
 * Target websites will ONLY see Cloudflare's Edge IP (104.x.x.x / 172.64.x.x), never your VPS IP.
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'tulusy.cc',
  'www.tulusy.cc',
  'tulusy.com',
  'www.tulusy.com',
  'toolsy4u.com',
  'www.toolsy4u.com',
  'metadata.google.internal',
]);

const STRIPPED_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip',
  'forwarded',
  'via',
  'x-forwarded-host',
  'x-forwarded-proto',
  'content-length',
  'transfer-encoding',
  'connection',
  'x-target-url',
  'x-target-method',
  'x-relay-secret',
  'x-relay-headers',
]);

function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(a || '');
  const bufB = enc.encode(b || '');
  const maxLen = Math.max(bufA.length, bufB.length);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < bufA.length ? bufA[i] : 0;
    const byteB = i < bufB.length ? bufB[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true; // Link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function hextetsToIPv4(hi, lo) {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function parseIPv6Hextets(raw) {
  const halves = raw.split('::');
  if (halves.length > 2) return null;

  const parseSide = (side, allowIPv4Tail) => {
    if (!side) return [];
    const parts = side.split(':');
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) return null;
      if (part.includes('.')) {
        if (!allowIPv4Tail || i !== parts.length - 1) return null;
        const v4 = part.split('.');
        if (v4.length !== 4) return null;
        const octets = v4.map((o) => (/^\d{1,3}$/.test(o) ? Number(o) : NaN));
        if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
        out.push(((octets[0] << 8) | octets[1]) >>> 0);
        out.push(((octets[2] << 8) | octets[3]) >>> 0);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };

  if (halves.length === 2) {
    const left = parseSide(halves[0], false);
    const right = parseSide(halves[1], true);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    return [...left, ...Array(missing).fill(0), ...right];
  }

  const all = parseSide(halves[0], true);
  if (!all || all.length !== 8) return null;
  return all;
}

function isPrivateIPv6(h) {
  // ::/96 (unspecified ::, loopback ::1, deprecated IPv4-compatible ::w.x.y.z)
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return true;
  }
  // ::ffff:0:0/96 (IPv4-mapped) and ::ffff:0:0:0/96 (IPv4-translated RFC 2765)
  if (
    h[0] === 0 &&
    h[1] === 0 &&
    h[2] === 0 &&
    h[3] === 0 &&
    ((h[4] === 0 && h[5] === 0xffff) || (h[4] === 0xffff && h[5] === 0))
  ) {
    return isPrivateIPv4(hextetsToIPv4(h[6], h[7]));
  }
  // 64:ff9b::/96 (NAT64 well-known) and 64:ff9b:1::/48 (NAT64 local-use)
  if (
    h[0] === 0x0064 &&
    h[1] === 0xff9b &&
    (h[2] === 0x0001 || (h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0))
  ) {
    return true;
  }
  // 100::/64 (RFC 6666 discard-only)
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) {
    return true;
  }
  // 2002::/16 (6to4 carrying embedded IPv4 in h[1], h[2])
  if (h[0] === 0x2002 && isPrivateIPv4(hextetsToIPv4(h[1], h[2]))) {
    return true;
  }
  // 2001:db8::/32 (documentation), 2001:0::/32 (Teredo), 2001:2::/48 (benchmarking),
  // 2001:10::/28 and 2001:20::/28 (ORCHID / ORCHIDv2)
  if (h[0] === 0x2001) {
    if (
      h[1] === 0x0db8 ||
      h[1] === 0x0000 ||
      (h[1] === 0x0002 && h[2] === 0x0000) ||
      (h[1] & 0xfff0) === 0x0010 ||
      (h[1] & 0xfff0) === 0x0020
    ) {
      return true;
    }
  }
  // fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10 (site-local), ff00::/8 (multicast)
  if (
    (h[0] & 0xfe00) === 0xfc00 ||
    (h[0] & 0xffc0) === 0xfe80 ||
    (h[0] & 0xffc0) === 0xfec0 ||
    (h[0] & 0xff00) === 0xff00
  ) {
    return true;
  }
  return false;
}

function isPrivateOrBlockedHost(hostname) {
  const host = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (
    host.endsWith('.tulusy.cc') ||
    host.endsWith('.tulusy.com') ||
    host.endsWith('.toolsy4u.com') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }
  if (isPrivateIPv4(host)) {
    return true;
  }
  if (host.includes(':')) {
    const hextets = parseIPv6Hextets(host);
    if (!hextets) {
      return true; // Fail closed on malformed IPv6 literal
    }
    return isPrivateIPv6(hextets);
  }
  return false;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'https://tulusy.cc',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Target-URL, X-Target-Method, X-Relay-Secret, X-Relay-Headers',
        },
      });
    }

    if (!env?.RELAY_SECRET) {
      return new Response(JSON.stringify({ error: 'Relay secret not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const provided = request.headers.get('X-Relay-Secret') || '';
    if (!constantTimeEqual(provided, env.RELAY_SECRET)) {
      return new Response(JSON.stringify({ error: 'Unauthorized relay request' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const urlObj = new URL(request.url);
    const targetUrl = request.headers.get('X-Target-URL') || urlObj.searchParams.get('url');
    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl || '');
    } catch {
      return new Response(JSON.stringify({ error: 'Missing or invalid X-Target-URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only HTTP and HTTPS targets allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isPrivateOrBlockedHost(parsedTarget.hostname)) {
      return new Response(JSON.stringify({ error: 'Target host blocked by relay SSRF policy' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawMethod = (request.headers.get('X-Target-Method') || request.method || 'GET').toUpperCase();
    const targetMethod = ['GET', 'POST', 'HEAD', 'PUT'].includes(rawMethod) ? rawMethod : 'GET';

    const cleanHeaders = new Headers();
    cleanHeaders.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    cleanHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    cleanHeaders.set('Accept-Language', 'en-US,en;q=0.9');

    const extraHdrs = request.headers.get('X-Relay-Headers');
    if (extraHdrs) {
      try {
        const parsed = JSON.parse(extraHdrs);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (!STRIPPED_HEADERS.has(k.toLowerCase().trim()) && typeof v === 'string') {
              try {
                cleanHeaders.set(k.trim(), v);
              } catch {
                // Skip invalid header name/value without dropping valid headers
              }
            }
          }
        }
      } catch {
        // Ignore malformed custom header JSON
      }
    }

    try {
      const init = {
        method: targetMethod,
        headers: cleanHeaders,
        // Return 3xx manually so the FastAPI backend checks every redirect target for SSRF
        redirect: 'manual',
      };

      if (targetMethod === 'POST' || targetMethod === 'PUT') {
        init.body = await request.arrayBuffer();
      }

      const response = await fetch(parsedTarget.toString(), init);
      const outHeaders = new Headers(response.headers);
      const upstreamEncoding = response.headers.get('content-encoding');
      if (upstreamEncoding) {
        outHeaders.set('X-Original-Content-Encoding', upstreamEncoding);
      }
      outHeaders.delete('content-encoding');
      outHeaders.delete('content-length');
      outHeaders.delete('set-cookie');
      outHeaders.set('X-Relayed-Status', String(response.status));

      const isNullBody =
        response.status === 101 ||
        response.status === 204 ||
        response.status === 205 ||
        response.status === 304;
      return new Response(isNullBody ? null : response.body, {
        status: response.status,
        headers: outHeaders,
      });
    } catch (err) {
      const msg = String(err && err.message ? err.message : '').toLowerCase();
      const isTls = msg.includes('tls') || msg.includes('ssl') || msg.includes('certificate');
      return new Response(JSON.stringify({ error: isTls ? 'TLS verification failed' : 'Upstream connection failed' }), {
        status: isTls ? 526 : 502,
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Error': isTls ? 'tls' : 'upstream',
        },
      });
    }
  },
};
