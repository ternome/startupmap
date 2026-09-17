# StartupMap

StartupMap is a map-first global startup directory for discovering companies by
place and sector. The MVP is intentionally a **curated launch collection**, not
a comprehensive startup census: it currently contains 27 source-backed profiles
across 18 countries and 8 regions.

## What the MVP includes

- interactive world map with marker clustering and same-location spidering;
- keyboard-accessible result list synchronized with map selection;
- search across company, city, country, region, sector, and description;
- sector and region filters, result counts, reset, and empty states;
- profile drawer with public sources, verification date, website, correction,
  copy-link, and native-share actions;
- stable profile links such as `/?startup=mistral-ai`, including browser
  Back/Forward behavior;
- a validated submission form that opens a prefilled public GitHub issue;
- responsive layouts, semantic landmarks, modal focus management, visible focus
  styles, and reduced-motion support;
- static SEO metadata, JSON-LD, `robots.txt`, sitemap, web manifest, and icon.

No ranking or directory fact is paid for. Inclusion is editorial and is not an
endorsement.

## Architecture

The site is a static Vite application using vanilla JavaScript, Leaflet, and
Leaflet.markercluster. Startup records live in
[`src/data/startups.js`](src/data/startups.js), separate from rendering code.
The world outline is bundled locally from `world-atlas` (Natural Earth-derived,
public-domain geography), so the core map needs no API key, hosted tile service,
cookie, font request, backend, or environment variable.

The data contract and curation rules are documented in
[`docs/DATA_SCHEMA.md`](docs/DATA_SCHEMA.md). Runtime and build-time validation
rejects invalid URLs, dates, coordinates, regions, duplicates, and insufficient
coverage. Text from records is inserted with DOM `textContent`; outbound links
are limited by validation to HTTPS and use safe external-link attributes.

## Local development

Requirements: Node.js 18.18 or newer and npm.

```bash
npm ci
npm run dev
```

Vite prints the local URL, normally <http://localhost:5173>.

## Validation and tests

```bash
npm run validate:data  # dataset schema and coverage
npm run lint           # ESLint
npm test               # pure search/filter/deep-link/issue URL tests
npm run build          # validated production build in dist/
npm run check          # all four checks above
```

For the production-style Chromium smoke tests:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

The smoke suite covers desktop and 390px mobile discovery, filtering, profile
dialogs, stable deep links, GitHub submission UI, local map rendering, and
browser console/runtime errors.

Preview the built site with:

```bash
npm run preview
```

## Data contributions

Use **Add a startup** in the product or open the repository's **Suggest a
startup** issue template. A record needs a canonical name, HTTPS website, city,
country, approximate city coordinates, broad sector, concise factual
description, at least one public source, and a verification date. Omit uncertain
funding or founding facts rather than guessing.

Corrections can be opened directly from every profile. They remain public for
transparent review; no form claims a submission succeeded before GitHub receives
it.

## External requests and privacy

StartupMap includes no analytics, trackers, remote fonts, or hosted map tiles.
The initial application works without third-party requests. A request leaves the
site only when a visitor chooses an external company website, public source, or
GitHub submission/correction link. Those destinations have their own privacy
policies.

## Deployment

The app is configured for a static Vercel deployment with no environment
variables:

```bash
npm ci
npm run build
npx vercel --prod --yes
```

See [`DEPLOY.md`](DEPLOY.md) for dashboard import, CLI, smoke-check, canonical
URL, and troubleshooting details.

## Product research

- [WARMAP analysis](docs/research/warmap-analysis-2026-09-03.md)
- [WARMAP public-state summary](docs/research/warmap-state-summary-2026-09-03.json)
