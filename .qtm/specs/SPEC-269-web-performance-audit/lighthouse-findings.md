# SPEC-269 — Lighthouse findings (T-269-01 baseline + T-269-11 gate)

Date: 2026-06-25 · Branch `spec/SPEC-269-web-performance-audit` (post all fixes).

## TL;DR

- The hero LCP work is **validated structurally**: the home LCP element is the
  preloaded hero `<img>` (`hero-playa-*.webp`), and CLS is excellent (0.004).
- **Absolute local Lighthouse performance scores are not trustworthy** in this
  environment and must NOT be used as a pass/fail number. The real ≥90 check
  belongs to a clean CI runner / production behind Cloudflare.
- Two pre-existing **CI harness bugs** were found and fixed (the Lighthouse CI
  job had never actually measured anything).

## Harness bugs fixed (both shipped this task)

1. `lighthouserc.json` had `settings.preset: "mobile"` — an **invalid** value.
   Lighthouse only accepts `perf` / `experimental` / `desktop`; mobile is the
   default form factor (no preset). Every run aborted with
   `Invalid values: Argument: preset, Given: "mobile"`. Removed the line.
2. `.github/workflows/lighthouse.yml` started the server with `pnpm preview`,
   which looks for `dist/server/entry.mjs`. The `@astrojs/node` **standalone**
   adapter (this version) emits `dist/server/index.js` instead, so preview
   never started; lhci then ran against nothing and `continue-on-error: true`
   masked it. Now the workflow starts `node ./dist/server/index.js`
   (HOST/PORT env) directly.

Net effect: before this task the report-only CI Lighthouse job was a no-op.

## Why local perf scores are noise here

Measured locally (standalone prod server on :4321, dead API → graceful empty
fallback, mirroring CI's `example.invalid` env), median of 3 mobile runs:

| URL | perf | a11y | bp | seo | LCP | CLS |
|---|---|---|---|---|---|---|
| `/es/` (home) | 35 | 88 | 96 | 92 | 9.0s | 0.004 |
| `/es/alojamientos/` | 39 | 93 | 93 | 92 | 6.3s | 0.024 |
| `/es/eventos/` | 40 | 88 | 93 | 92 | 7.1s | 0.024 |
| `/es/destinos/` | 48 | 91 | 93 | 92 | 4.8s | 0.009 |

The home showed **FCP 12s and LCP up to 18s on a static localhost page** — a
physical impossibility as a real metric. Cause: Lighthouse mobile applies
slow-4G + 4× CPU throttling (Lantern simulation), which amplifies on a machine
already under load (dev servers + a just-finished build). The
`render-blocking-resources` audit reported six local CSS files
(`global`, `BaseLayout`, `index`, SearchBar, glightbox) at ~3.6s each on
`localhost` — pure throttling-model inflation. Google Fonts was ruled out
(reachable in 0.15s).

Even on an idle machine, slow-4G over local HTTP/1 plus the render-blocking CSS
chain would keep local mobile perf well under 90. **A real ≥90 needs production
conditions (HTTP/2, CDN, real device) or a clean CI runner.**

## What IS validated (trustworthy)

- **LCP element = preloaded hero image** on the home → T-269-03a/03b correct.
- **CLS 0.004** home (and ≤0.024 on listings) → image-dimension work paid off.
- a11y 88–93, best-practices 93–96, SEO 92 across all four pages.
- Bundle deltas were already hard-quantified on-disk in earlier commits
  (i18n 1362→989KB, icons 247→37 per home page, leaflet lazy, vendor chunks) —
  see `memory/project_spec269_bundle_icons.md`.

Temporary public reports (may expire) from the post-fix run:

- home: <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1782359361377-80231.report.html>
- alojamientos: <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1782359362689-49592.report.html>
- eventos: <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1782359363331-29965.report.html>
- destinos: <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1782359364507-40093.report.html>

## Gate decision (owner-approved)

Hybrid, but **report-only for now**:

- `lighthouserc.json` uses a per-URL `assertMatrix`: home `performance` is the
  intended blocking gate (`error`, minScore **0.8**); a11y/bp/seo on home and
  every category on the listing pages stay advisory (`warn`).
- The workflow keeps `continue-on-error: true`, so nothing blocks PRs yet. The
  first PR against `staging` will run the now-working job and produce the first
  **trustworthy** CI score.

## Follow-ups (NOT in SPEC-269 scope)

1. **Promote the gate**: once a clean CI baseline confirms the real home perf,
   remove `continue-on-error: true` (and bump 0.8 → 0.9 if the score supports
   it, per owner note "use 90 if we're close"). One-line change.
2. **Render-blocking CSS chain**: six stylesheets block first paint. SPEC-269
   targeted JS/bundle/icons/hero-LCP, not CSS delivery. Candidate for a new
   spec (inline critical CSS / async non-critical / consolidate).
3. **Font self-hosting (F11)**: already deferred in the spec.
