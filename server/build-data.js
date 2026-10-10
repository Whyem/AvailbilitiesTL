// Writes static prayer data for GitHub Pages:
//   <outDir>/data/YYYY-MM-DD.json  for yesterday, today and tomorrow (UTC)
//   <outDir>/data/latest.json      copy of today's file, used as a fallback
// Usage: node server/build-data.js dist
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prayersFor } from './prayers.js';

const outDir = join(process.argv[2] ?? 'dist', 'data');
await mkdir(outDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const shift = (days) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);

let failures = 0;
let total = 0;
for (const date of [shift(-1), today, shift(1)]) {
  const countries = await prayersFor(date);
  failures += countries.filter((c) => !c.prayers).length;
  total += countries.length;
  const body = JSON.stringify({ date, generatedAt: new Date().toISOString(), countries });
  await writeFile(join(outDir, `${date}.json`), body);
  if (date === today) await writeFile(join(outDir, 'latest.json'), body);
  console.log(`${date}: ${countries.map((c) => `${c.id}=${c.prayers ? 'ok' : 'error'}`).join(', ')}`);
}

// Fail the build only if nothing could be fetched at all.
if (failures === total) {
  console.error('No prayer times could be fetched.');
  process.exit(1);
}
