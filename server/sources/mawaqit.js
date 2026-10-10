// Germany: mosque times from mawaqit.net via a self-hosted mawaqit-api
// (https://mrsofiane.me/mawaqit-api). The month calendar lets us serve any date.
import { MAWAQIT_TOKEN, MAWAQIT_URL } from '../config.js';
import { cached } from '../cache.js';

async function getMonth(mosque, month) {
  const url = `${MAWAQIT_URL}/api/v1/${encodeURIComponent(mosque)}/calendar/${month}`;
  const res = await fetch(url, {
    headers: MAWAQIT_TOKEN ? { Authorization: `Bearer ${MAWAQIT_TOKEN}` } : {},
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`mawaqit-api responded ${res.status} for ${mosque}`);
  return res.json();
}

export async function getMawaqitPrayers({ mosque }, date) {
  const [, month, day] = date.split('-').map(Number);
  const days = await cached(`mawaqit:${mosque}:${month}`, 12 * 60 * 60_000, () => getMonth(mosque, month));
  const t = days[day - 1];
  if (!t) throw new Error(`mawaqit-api has no entry for ${date}`);
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dohr,
    asr: t.asr,
    maghrib: t.maghreb,
    isha: t.icha,
  };
}
