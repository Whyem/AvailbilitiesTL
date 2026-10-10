// GET /api/prayers?date=YYYY-MM-DD
//   → { date, countries: [{ id, label, timeZone, source, prayers | null, error? }] }
// Prayer times are "HH:mm" strings in each country's own local time.
import http from 'node:http';
import { PORT } from './config.js';
import { prayersFor } from './prayers.js';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/prayers') {
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'date must be YYYY-MM-DD' });
    return send(res, 200, { date, countries: await prayersFor(date) });
  }

  if (url.pathname === '/api/health') return send(res, 200, { ok: true });

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`Prayer API listening on http://localhost:${PORT}`));
