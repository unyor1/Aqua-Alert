// Vercel serverless function to proxy Overpass API requests.
// Accepts POST with JSON { query: string } or raw text body.
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let query: string | undefined;
    if (req.method === 'POST') {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        query = req.body && req.body.query;
      } else if (typeof req.body === 'string') {
        query = req.body;
      } else if (req.rawBody) {
        query = req.rawBody.toString();
      }
    } else {
      query = (req.query && req.query.q) || '';
    }

    if (!query) return res.status(400).json({ error: 'Missing query' });

    // simple in-memory cache to reduce repeated requests on warm instances
    (global as any)._overpassCache = (global as any)._overpassCache || new Map();
    const cache: Map<string, any> = (global as any)._overpassCache;
    const cacheKey = query;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.ts) < 60 * 1000) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }

    // Try multiple Overpass interpreters in order until one succeeds.
    const interpreters = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    let lastErr: any = null;
    for (const url of interpreters) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Accept': 'application/json',
            'User-Agent': 'FloodAlertApp/1.0 (contact@yourdomain.com)'
          },
          body: query,
        });

        const text = await r.text();
        if (r.ok) {
          cache.set(cacheKey, { ts: now, body: text });
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).send(text);
        } else {
          // record non-OK and try next interpreter
          lastErr = { status: r.status, body: text, url };
          console.warn('Overpass interpreter returned non-OK', lastErr);
          continue;
        }
      } catch (err) {
        lastErr = { error: String(err), url };
        console.warn('Overpass interpreter fetch error', lastErr);
        continue;
      }
    }

    // If none succeeded, return last error info.
    console.error('All Overpass interpreters failed', lastErr);
    return res.status(502).json({ error: 'All Overpass interpreters failed', detail: lastErr });
  } catch (err: any) {
    console.error('Overpass proxy error', err);
    return res.status(500).json({ error: String(err) });
  }
}
