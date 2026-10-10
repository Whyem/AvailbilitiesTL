# Prayer Timelines

Daily prayer times for several countries on one shared, timezone-aware timeline,
with the free time between prayers.

- Morocco: [Habous](https://habous.gov.ma/prieres/) (today only)
- Germany: [mawaqit.net](https://mawaqit.net) via a self-hosted [mawaqit-api](https://mrsofiane.me/mawaqit-api)

## Run locally

```bash
docker compose up -d     # mawaqit-api on :8000
npm install
npm run server           # API on :3001
npm run dev              # app on :5173
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the site, starts mawaqit-api as a service
container, writes `data/<date>.json` with `npm run build:data`, and publishes
everything to GitHub Pages. It runs on every push to `main`, daily at 00:30 and
12:30 UTC, and manually from the Actions tab.

One-time setup: in the repository go to **Settings → Pages** and set
**Source** to **GitHub Actions**.

Configuration (`server/config.js`): `HABOUS_VILLE` (city id) and
`MAWAQIT_MOSQUE` (mosque slug) can be overridden with environment variables.
