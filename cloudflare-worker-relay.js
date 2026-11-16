/**
 * Cloudflare Worker Outbound Relay for Tulusy (tulusy.cc)
 * -------------------------------------------------------------------
 * Purpose: Masks your VPS origin IP on all outbound Load Tester & DA Checker requests.
 * Target websites will ONLY see Cloudflare's Edge IP (104.x.x.x / 172.64.x.x), never your VPS IP.
 *
 * Deployment (100% Free - 100,000 requests/day on Cloudflare Workers):
 * 1. Go to Cloudflare Dashboard -> Workers & Pages -> Create Worker
 * 2. Paste this code and click Deploy
 * 3. (Optional) Add an environment variable `RELAY_SECRET` in Worker Settings -> Variables
 * 4. Set `CF_WORKER_RELAY_URL=https://your-worker.your-subdomain.workers.dev`
 *    and `CF_WORKER_SECRET=your_secret` in your VPS backend environment.
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Target-URL, X-Target-Method, X-Relay-Secret',
        },
      });
    }

    // Verify optional shared secret so only your backend can use this relay
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
    const targetUrl = request.headers.get('X-Target-URL') || urlObj.searchParams.get('url');
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return new Response(JSON.stringify({ error: 'Missing or invalid X-Target-URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetMethod = (request.headers.get('X-Target-Method') || request.method || 'GET').toUpperCase();

    // Build clean outbound headers with zero origin/VPS metadata
    const cleanHeaders = new Headers();
    cleanHeaders.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    cleanHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    cleanHeaders.set('Accept-Language', 'en-US,en;q=0.9');

    try {
      const init = {
        method: targetMethod,
        headers: cleanHeaders,
        redirect: 'follow',
      };

      if (targetMethod === 'POST' || targetMethod === 'PUT') {
        init.body = await request.arrayBuffer();
      }

      const response = await fetch(targetUrl, init);
      const outHeaders = new Headers(response.headers);
      outHeaders.set('X-Relayed-Status', String(response.status));
      outHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        headers: outHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream connection failed' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
