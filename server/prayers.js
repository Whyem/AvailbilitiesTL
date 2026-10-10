// Shared by the dev API (index.js) and the static data build (build-data.js).
import { COUNTRIES } from './config.js';
import { getHabousPrayers } from './sources/habous.js';
import { getMawaqitPrayers } from './sources/mawaqit.js';

const SOURCES = {
  habous: getHabousPrayers,
  mawaqit: getMawaqitPrayers,
};

/** [{ id, label, timeZone, source, prayers | null, error? }] for one date. */
export async function prayersFor(date) {
  return Promise.all(
    COUNTRIES.map(async (country) => {
      const { id, label, timeZone, source } = country;
      try {
        const prayers = await SOURCES[source](country, date);
        return { id, label, timeZone, source, prayers };
      } catch (err) {
        console.error(`[${id}] ${err.message}`);
        return { id, label, timeZone, source, prayers: null, error: err.message };
      }
    })
  );
}
