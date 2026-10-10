// Countries served by GET /api/prayers. Each entry picks a source and its options.
export const PORT = Number(process.env.PORT ?? 3001);

export const COUNTRIES = [
  {
    id: 'morocco',
    label: 'Morocco (Casablanca)',
    timeZone: 'Africa/Casablanca',
    source: 'habous',
    // City ids come from the dropdown on https://habous.gov.ma/prieres/ (58 = Casablanca).
    ville: Number(process.env.HABOUS_VILLE ?? 58),
  },
  {
    id: 'germany',
    label: 'Germany (Berlin)',
    timeZone: 'Europe/Berlin',
    source: 'mawaqit',
    // Mosque slug from its mawaqit.net URL, e.g. https://mawaqit.net/en/berlin-mosque-berlin-10713-germany
    mosque: process.env.MAWAQIT_MOSQUE ?? 'friedenmoschee-erlangen-germany',
  },
];

// Self-hosted mawaqit-api instance (see docker-compose.yml).
export const MAWAQIT_URL = process.env.MAWAQIT_URL ?? 'http://localhost:8000';
// Only needed if the mawaqit-api instance has ENABLE_AUTH=true.
export const MAWAQIT_TOKEN = process.env.MAWAQIT_TOKEN;
