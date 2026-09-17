# StartupMap MVP handoff

**Prepared:** 2026-09-17

**Branch:** `codex/mvp`

**Implementation commit:** `a05bcdea7e8c14747805b24f58d4fdd1174f2be0`

**Deployment:** repository ready; Vercel credentials were not present

## Delivered

- Replaced the eight fictional demo records with 27 curated, public-source-backed
  profiles across 18 countries and 8 regions.
- Added a documented schema plus build-time/runtime validation for required
  fields, safe URLs, dates, coordinates, uniqueness, size, and regional breadth.
- Added a locally bundled Natural Earth world outline, clustered Leaflet markers,
  overlap spidering, synchronized result cards, marker/card selection, and a
  complete non-map discovery path.
- Added broad search, sector/region filters, live result counts, reset, empty
  states, and a map-independent offline/external-network path.
- Added accessible profile and submission dialogs, verification/source details,
  safe website links, stable `?startup=slug` deep links, Back/Forward support,
  copy/share fallbacks, and per-profile correction issues.
- Replaced the alert-only submission action with validated, prefilled, public
  GitHub issue creation plus repository issue templates and a plain-link fallback.
- Added responsive desktop/mobile styling, semantic structure, keyboard support,
  focus restoration, visible focus states, 44px controls, and reduced motion.
- Added SEO/share metadata, JSON-LD, favicon/manifest, robots, sitemap, and Vercel
  security headers.
- Added pinned dependencies, lockfile, linting, unit tests, data validation,
  production builds, and Playwright smoke tests.

## Architecture and data limitations

This remains a static Vite/vanilla JavaScript app. Leaflet renders a locally
bundled low-resolution world outline and Leaflet.markercluster manages dense or
same-city markers. There is no backend and no private secret.

The dataset is a deliberately limited launch collection, not an exhaustive or
real-time directory. Coordinates are approximate city centroids. Public-company
and acquired-company startup-origin examples are included. Facts can become
stale after the displayed `lastVerified` date, so every profile exposes its
evidence and a correction path. Funding stages and founding years were omitted
where current verification was not strong enough.

## Verification

Final commands and results:

- `npm audit --audit-level=moderate` — passed, 0 vulnerabilities.
- `npm run check` — passed on 2026-09-17: 27 records validated, ESLint clean,
  all 8 unit tests passed, and the production build completed.
- `npm run test:e2e` — passed: 3 Chromium tests covering desktop, 390px mobile,
  search/filter/reset, profiles, direct links, submission UI, local map rendering,
  no-external-network behavior, and console/runtime errors.
- Production bundle at last check: about 320 kB JavaScript / 101 kB gzip and
  32 kB CSS / 11 kB gzip.
- Desktop and mobile screenshots were visually inspected; the fixed-height
  desktop list scroll, mobile profile sheet, and map fallback were corrected.

An independent read-only UX/accessibility review was completed before
implementation and its P0/P1 findings were incorporated. The requested final
review was superseded by the instruction to stop product refinements and finish
the delivery sequence.

## Git and deployment status

- Implementation commit: `a05bcdea7e8c14747805b24f58d4fdd1174f2be0`
  (`Build credible StartupMap MVP`).
- Push: succeeded to `origin/codex/mvp`. GitHub offered the pull-request URL
  <https://github.com/ternome/startupmap/pull/new/codex/mvp>.
- Vercel: production deployment was not attempted because the required
  non-interactive identity check (`npx --yes vercel@39.4.2 whoami`) returned
  `No existing credentials found`. No login flow was opened and no token was
  requested or exposed.
- Authenticated one-command next step:

  ```bash
  npm ci && npm run check && npx vercel --prod --yes
  ```

- Dashboard alternative: import `ternome/startupmap`, select branch
  `codex/mvp` (or merge it first), choose Vite, build with `npm run build`, and
  publish `dist`. No environment variables are required. See
  [`DEPLOY.md`](../DEPLOY.md) for the full smoke checklist and canonical-domain
  follow-up.
