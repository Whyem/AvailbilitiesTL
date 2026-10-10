// Morocco: Ministry of Habous and Islamic Affairs.
// The "API" returns an HTML fragment with *today's* times only (Morocco local time).
// Requests for the day before/after are served from today's times: around
// midnight the viewer's "today" can differ from Morocco's, and times shift by
// only a minute or two per day.
import https from 'node:https';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { cached } from '../cache.js';

const BASE_URL = 'https://habous.gov.ma/prieres/horaire-api.php';

// habous.gov.ma doesn't send its intermediate certificate, so normal TLS
// verification fails. Trust the (public) Sectigo intermediate explicitly
// instead of disabling verification.
const agent = new https.Agent({
  ca: [...tls.rootCertificates, readFileSync(new URL('../certs/sectigo-dv-r36.pem', import.meta.url))],
});

const LABELS = {
  'الفجر': 'fajr',
  'الشروق': 'sunrise',
  'الظهر': 'dhuhr',
  'العصر': 'asr',
  'المغرب': 'maghrib',
  'العشاء': 'isha',
};

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, timeout: 15_000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Habous responded ${res.statusCode}`));
      }
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('Habous request timed out')));
    req.on('error', reject);
  });
}

export function parseHabous(html) {
  const table = html.match(/<table class="horaire"[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error('Habous: prayer table not found');

  const text = table.replace(/<[^>]+>/g, ' ');
  const prayers = {};
  for (const [, label, time] of text.matchAll(/(\p{L}+)\s*:\s*(\d{1,2}:\d{2})/gu)) {
    if (LABELS[label]) prayers[LABELS[label]] = time.padStart(5, '0');
  }

  const missing = Object.values(LABELS).filter((k) => !prayers[k]);
  if (missing.length) throw new Error(`Habous: missing ${missing.join(', ')}`);
  return prayers;
}

export async function getHabousPrayers({ ville, timeZone }, date) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(Date.now());
  const dayDiff = Math.abs(Date.parse(date) - Date.parse(today)) / 86_400_000;
  if (!(dayDiff <= 1)) {
    throw new Error(`Habous only provides today's times (${today} in ${timeZone})`);
  }
  return cached(`habous:${ville}:${today}`, 60 * 60_000, async () =>
    parseHabous(await get(`${BASE_URL}?ville=${encodeURIComponent(ville)}`))
  );
}
