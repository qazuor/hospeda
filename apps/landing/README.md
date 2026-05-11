# Hospeda Landing

Pre-launch coming-soon page served at `https://hospeda.com.ar` while the
real app sits behind `https://staging.hospeda.com.ar` with `X-Robots-Tag:
noindex` until official launch.

Stack: Astro 5 (static output), nginx alpine, Coolify on the VPS.

## Why this exists

MercadoPago is in PRODUCTION mode (Phase 16.3). Until the app finishes
beta hardening, exposing `hospeda.com.ar` to organic traffic risks real
transactions on a pre-beta product. This landing closes that gap with a
zero-functionality placeholder + newsletter signup.

See [`docs/migration/vps-deployment-spec.md`](../../docs/migration/vps-deployment-spec.md)
Paso 17.1 and the engram observation `vps-migration/pre-launch-landing-strategy`
for the full decision context.

## Local development

```bash
# From repo root
pnpm install
pnpm --filter hospeda-landing dev
# → http://localhost:4322
```

Build:

```bash
pnpm --filter hospeda-landing build
pnpm --filter hospeda-landing preview
```

## Phase status

- **Phase 1 (in this commit)** — skeleton: hero with image rotation,
  newsletter visual placeholder (form disabled), footer, full SEO meta.
  Build target: `hospeda.com.ar` + `www.hospeda.com.ar`.
- **Phase 2 (next)** — refine copy + sections, wire newsletter form to
  `POST /api/v1/public/newsletter` (Brevo integration), add `/gracias`,
  JSON-LD, sitemap. Requires `HOSPEDA_BREVO_NEWSLETTER_LIST_ID` env var
  on the API side.

## Deploy on Coolify

1. **New Resource** → **Application from Git** → repo `hospeda` → branch
   `chore/vps-migration` (eventually `main` after merge).
2. **Build pack**: Dockerfile.
3. **Base directory**: `/` (the Dockerfile copies the whole monorepo to
   resolve workspace deps; `Dockerfile location` should point to
   `apps/landing/Dockerfile`).
4. **Build args** (Coolify → Configuration → Build):
   - `HOSPEDA_LANDING_SITE_URL=https://hospeda.com.ar`
5. **Domains**: `hospeda.com.ar`, `www.hospeda.com.ar`.
6. **Healthcheck**: HTTP `/`, port 80, path `/`. Container exposes 80.
7. Disable auto-deploy (consistent with the other prod apps; manual
   deploys only — see Paso 17.7).

Verify post-deploy:

```bash
curl -I https://hospeda.com.ar/
curl -I https://www.hospeda.com.ar/
# → 200 OK with Cache-Control headers
```

## Files

```
apps/landing/
├── Dockerfile               nginx alpine multi-stage build
├── nginx.conf               server config (cache headers, fallback)
├── astro.config.mjs         static output, trailingSlash always
├── package.json             minimal deps (just astro)
├── public/                  favicons, logo (served as-is by nginx)
└── src/
    ├── pages/index.astro    composition entry
    ├── layouts/Layout.astro head, fonts, OG/Twitter meta
    ├── components/
    │   ├── Hero.astro       cross-fade image rotator + tagline + CTA
    │   ├── NewsletterPlaceholder.astro
    │   └── Footer.astro
    ├── styles/global.css    brand tokens (subset of apps/web)
    └── assets/              logo + 3 hero images (build-time optimized)
```

## Brand tokens

Synced manually with `apps/web/src/styles/global.css` (the source of
truth for the brand). When the brand evolves in `apps/web`, mirror the
changes here. Tokens kept here are intentionally a subset — the landing
does not need the full design system.
