# HOS-117 — SEO/AEO on-page hardening — Closeout

Closed 2026-07-10. 16 tasks completed, 5 cancelled (Wave 1, obsolete after the
example-data purge decision), 0 pending.

## What shipped

- **Wave 0 — credibility bugs** (PR #2217, tests #2226): SSR the stat counters'
  final value (kill "0+"); `noindex` + sitemap-exclude thin/empty destinations;
  BreadcrumbJsonLd on gastronomy/experience + CI guard extended 4→6 entities.
- **T-022 — 410 Gone** (PR #2225): deleted PUBLIC entity URLs return HTTP 410 so
  crawlers/LLM fetchers deindex fast; deleted PRIVATE/DRAFT → 404 uniform
  (anti-enumeration preserved).
- **T-014 — FAQ i18n support + destination SEO parity** (PR #2237): additive
  nullable `question_i18n`/`answer_i18n` I18nText columns on all 4 FAQ tables
  (migration 0050) + `BaseFaqSchema`; the 4 FAQ transforms resolve localized text
  with legacy-es fallback; honest FAQPage `inLanguage`; destination detail
  title/meta via `pickLocalizedSeo` + localized summary/description (names stay
  untranslated). Seed stays Spanish-only; translations authored later by the AI
  pipeline. Passed judgment-day (2 rounds; caught + fixed the accommodation
  read-path serialization gap and a cross-locale fallback bug).
- **T-013 — json-ld-audit.md** refreshed to the typed-component reality (#2226).
- **Wave 4 — rendering/CWV analysis** (docs PR #2243, `docs/seo/rendering-strategy.md`):
  CWV baseline measured (lab + PostHog field) — already "Good" across all page
  types (LCP 1.0–1.3 s, CLS ≈ 0, INP p75 64 ms). Documented the SSR-vs-prerender
  anti-myth, that Cloudflare caches no HTML (catalog 0% edge-cached, pricing
  `s-maxage` dead no-ops), and that prerender is blocked by the per-request CSP.
- **T-012 — programmatic landings** (docs PR #2247, `docs/seo/programmatic-landings.md`):
  only the 13 by-type landings are indexed; unique-intro-prose requirement
  recorded (deferred to real content); geo×type = NO-GO (deferred).

## Deferred / follow-ups

- **HOS-128** (backlog) — edge-cache the anonymous catalog at Cloudflare. The
  viable scaling path; not urgent (CWV Good, ~zero traffic); traffic-gated.
- **HOS-124** (CANCELED) — migrate to Astro native `security.csp`. Not viable:
  native CSP doesn't support `<ClientRouter />` (Astro added then removed it,
  #13914). Would need the app off `<ClientRouter />` first.
- **Unique intro prose** for the 13 by-type landings + **FAQ translation
  authoring** — both deferred until real host content replaces the demo/seed data
  (the example-data purge that also obsoleted Wave 1).

## Off-page authority — out of scope (marketing / content-ops, NOT code)

The real competitive gap vs Booking/Trivago/Turismo Entre Ríos is **off-page**,
which no code change addresses:

- **Google Search Console** — not yet connected. Connecting it is the single
  highest-value next action (verify property, submit sitemap, watch coverage +
  the long-tail query data that would justify geo×type landings). Needs owner
  action (domain verification).
- **Backlinks / domain authority / domain age** — earned over time via real
  content, partnerships, and PR; not an engineering task.
- **Editorial long-tail content** — depends on real hosts/content post-purge.

## Notes

- No env vars or infra config changed by this spec. The only DB change is the
  additive nullable migration `0050` (FAQ i18n columns) — safe, no backfill, no
  drops; runs on staging/prod at deploy via `db:migrate`.
- No `status-needs-smoke-*` gate required: Wave 4/T-012 are documentation, T-014
  is covered by CI tests + judgment-day, T-022 shipped with integration tests.
