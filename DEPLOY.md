# Deploy StartupMap

StartupMap is a static Vite project. It has no server functions, private
credentials, database, or environment variables.

## One-command CLI deployment

From the repository root:

```bash
npm ci && npm run check && npx vercel --prod --yes
```

The Vercel CLI will use `vercel.json`:

- framework: Vite
- build command: `npm run build`
- output directory: `dist`
- install command: Vercel default (`npm install`/`npm ci` from the lockfile)
- environment variables: none

If the repository has not been linked before, the CLI will ask for account and
project choices unless valid non-interactive credentials and defaults already
exist. Do not commit the generated `.vercel/` directory.

## Vercel dashboard import

1. In Vercel, choose **Add New → Project**.
2. Import `ternome/startupmap` from GitHub.
3. Confirm **Framework Preset: Vite**.
4. Confirm **Build Command: `npm run build`** and **Output Directory: `dist`**.
5. Leave environment variables empty and deploy.
6. Set the production branch to the merged default branch (normally `main`).

## After deployment

Smoke-check the homepage and a stable profile link:

```bash
curl --fail --silent --show-error --location https://YOUR-DOMAIN.example/
curl --fail --silent --show-error --location 'https://YOUR-DOMAIN.example/?startup=canva'
```

In a browser, check search, filters, one list-to-profile transition, marker
selection, Back/Forward, copy link, and the submission form at desktop and mobile
widths.

The runtime canonical link is set to the current origin. Before attaching a
custom domain, update the absolute host in `public/robots.txt` and
`public/sitemap.xml` from `https://startupmap.vercel.app` to the canonical
production domain, then redeploy.

## Local production preview

```bash
npm ci
npm run build
npm run preview
```

No hosted tile or font service is required. The world outline ships in the
JavaScript bundle, so a tile-provider outage cannot remove the geographic map.
