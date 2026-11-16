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
  'x-target-url',
  'x-target-method',
  'x-relay-secret',
  'x-relay-headers',
]);

function isPrivateOrBlockedHost(hostname) {
  const host = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.tulusy.cc') || host.endsWith('.tulusy.com') || host.endsWith('.internal') || host.endsWith('.local')) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^0\./.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return true;
  }
  if (
    host.includes(':') &&
    (host === '::' ||
      host === '::1' ||
      /^(fc|fd)[0-9a-f]{0,2}:/.test(host) ||
      /^fe[89ab][0-9a-f]:/.test(host) ||
      /^::ffff:(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host))
  ) {
    return true;
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

    if (env.RELAY_SECRET) {
      const provided = request.headers.get('X-Relay-Secret') || '';
      if (provided !== env.RELAY_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized relay request' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const urlObj = new URL(request.url);
    const targetUrl = request.headers.get('X-Target-URL') || (env.RELAY_SECRET ? urlObj.searchParams.get('url') : null);
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
              cleanHeaders.set(k, v);
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
      outHeaders.set('X-Relayed-Status', String(response.status));

      return new Response(response.body, {
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
