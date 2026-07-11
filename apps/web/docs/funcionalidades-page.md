# Funcionalidades marketing page (HOS-119)

`/[lang]/funcionalidades/` (`apps/web/src/pages/[lang]/funcionalidades/index.astro`)
is a public "catalog" page listing everything the Hospeda platform offers,
organized by audience (Viajeros, Anfitriones, Gastronomía y experiencias,
Marcas) instead of by technical category. It replicates the owner-approved
brochure at `.specs/HOS-119-funcionalidades-page/docs/brochure-reference.html`
— see that spec for the full copy/layout source of truth.

## Public but intentionally unlinked

The page is **not** referenced from the header/footer nav (`nav.json`), from
any other page's internal links, or from the sitemap generator's link graph.
It is reachable by anyone who has the URL, but nothing in the app links to it.

- The owner shares the link **manually** with prospective hosts, restaurants,
  gastronomy/experience businesses, and sponsors during outreach — it is a
  sales/onboarding artifact, not a discoverable nav destination.
- It is **still indexable by default** (no `noindex` meta tag, unlike the
  hidden test pages under `/suscriptores/plan1` etc.) — search engines may
  crawl and rank it if they discover the URL some other way (e.g. an
  inbound link from an external site the owner shared it with). This is
  deliberate: the page is safe and correct to show up in search results, it
  is just not actively promoted through in-app navigation.
- This is a different pattern from a `noindex, nofollow` hidden page (see
  `apps/web/src/pages/[lang]/suscriptores/plan1.astro` for that pattern) —
  do not add `noindex` here without an explicit product decision, since that
  would contradict the "indexable by default" intent.

## Rendering

SSR (no `prerender`), matching the `/beneficios/` and `/nosotros/` pages —
see the page's own docblock (`@rendering`) for the exact rationale. There is
no Cloudflare-cache revalidation hook because nothing on this page depends on
mutable backend data (see below).

## Standalone — no site chrome

Unlike every other marketing page, this page does **not** use `BaseLayout`
(directly or via `MarketingLayout`, which itself wraps `BaseLayout`). It uses
`apps/web/src/layouts/StandaloneLayout.astro` — a minimal HTML shell that
renders NO site Header, Footer, nav, cookie-consent banner, feedback FAB,
announcements bar, or `ClientRouter` (view transitions). This is a deliberate
owner requirement: the page must look and feel self-contained, matching the
original approved brochure artifact, not like a normal Hospeda page with a
brochure embedded inside it.

The page builds its own minimal top bar (logo + wordmark + the audience
subnav + a theme toggle, reusing the site's `ThemeControl` island) instead of
the real `Header`. `StandaloneLayout` still loads fonts, dark-mode FOUC
prevention, and `global.css` (so tokens/dark-mode work identically to the
rest of the site) — see the layout's own docblock for the full list of what
it deliberately excludes and why.

## Content is fully static — no billing/plans API dependency

Every audience section, benefit list, plan-comparison table, addon card, and
"próximamente" item is sourced from a hardcoded TypeScript module,
`apps/web/src/lib/features-content.ts` — **not** from the billing plans API
(`packages/billing`, `billing_plans` table) or any other backend call. Copy
strings are resolved through i18n keys under the `features.*` namespace
(`packages/i18n/src/locales/{es,en,pt}/features.json`); the structural data
(row counts, cupos/limits, icons) lives in the content module itself.

This is a deliberate simplification for a marketing brochure: the numbers on
this page (favoritos, alojamientos publicables, etc.) are a snapshot of the
plan packaging at the time the page was written, not a live read of
`packages/billing`'s plan definitions. **If plan limits change** (e.g. a
future `packages/billing` recalibration), `features-content.ts` must be
updated by hand to match — there is no automated sync between the two. No
prices are shown anywhere on the page (Zod-schema style "cupos not prices"
by design — see the module's own JSDoc for the exact contract).

## Related test coverage

- `apps/web/test/pages/funcionalidades/index.test.ts` — page source-string
  assertions (layout, i18n usage, token-based colors, JSON-LD, sections).
- `apps/web/test/pages/funcionalidades/a11y.test.ts` — lightweight a11y
  guard rails (not the full axe sweep, which runs against a built site
  separately per SPEC-294).
- `apps/web/test/lib/features-content.test.ts` — content module unit tests,
  including an i18n-key-existence guard against `es/features.json`.
- `apps/web/test/components/features/FeaturesSubnav.test.tsx` — the
  `client:idle` scroll-spy island.
