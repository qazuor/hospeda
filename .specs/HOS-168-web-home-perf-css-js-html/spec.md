---
title: "Web home performance: cut lab PageSpeed via CSS purge + JS code-split + island deferral + HTML weight"
linear: HOS-168
statusSource: linear
created: 2026-07-15
updated: 2026-07-15
type: perf
areas:
  - web
  - devops
related:
  - HOS-160
  - HOS-164
  - HOS-128
---

# Web home performance: cut lab PageSpeed via CSS purge + JS code-split + island deferral + HTML weight

> **Status**: SCOPED — Phase-1 spec only, **not implemented**. Produced by the
> HOS-164 spike, which measured a data-backed lever map with `pnpm lighthouse`
> (lhci). Low priority: the **field CWV is already "Good"** (real-user LCP
> 1.0-1.3 s) and prod traffic is ~zero, so this is a **lab-score** improvement —
> whether to pursue it is a business decision, not a bug fix.

## 1. Origin

The HOS-160 investigation shipped levers A (i18n single-locale), C (`/_image`
immutable) and D (`/auth/me` dedup) and moved the mobile PageSpeed score only
35 → 39. HOS-164 was a spike to evaluate "Lever B" (hash-based `style-src` to
inline critical CSS). The spike concluded (see the HOS-164 close-out comment):

- Astro's native hash-based `security.csp` is **incompatible with `<ClientRouter />`**
  (removed upstream in commit `76c5480` / #13914, Jun 2025; documented in
  `apps/web/docs/seo/rendering-strategy.md`; HOS-124 canceled for this reason).
- The one viable CSS variant — `style-src 'unsafe-inline'` + `inlineStylesheets:auto`
  — is soft-nav-safe and verified working, **but does not move LCP** (LCP is not
  CSS-bound).
- Empirical PoCs surfaced the **real** levers, captured below.

## 2. Baseline (lhci median, 5 runs, mobile simulated throttle — mirrors PageSpeed)

| Metric | Value |
|---|---|
| Performance score | **31** (matches HOS-160's mobile 35) |
| FCP | 9.2 s |
| LCP | 11.6 s |
| TBT | 1331 ms (matches HOS-160 exactly) |
| Speed Index | 9.2 s |
| TTI | ~16 s |

## 3. Validated lever map (each measured with lhci)

| Change (cumulative) | Score | FCP | LCP | TBT |
|---|---|---|---|---|
| Baseline | 31 | 9.2 s | 11.6 s | 1331 ms |
| + reduce island JS (SSR-only header/hero/sections) | 34 | 8.3 s | 10.4 s | 1034 ms |
| + reduce HTML (drop below-fold sections) | 39 | 6.9 s | 7.8 s | 867 ms |

**No silver bullet** — each lever is worth +3/+5. The dominant ceiling is **FCP
(~7 s)**, driven by render-blocking CSS + total download weight. SSR TTFB is
healthy (~300 ms), so the origin is not the problem.

## 4. Proposed work — prioritized by measured impact

### T-1 — Purge / split render-blocking CSS (biggest FCP lever)

`global.css` (80 KB) + `BaseLayout.css` (69 KB) = **149 KB critical CSS**, not
inlined (Astro only inlines `<4 KB`), with **86 KB unused** (lhci
`unused-css-rules`). Tree-shake/purge dead rules; split above-the-fold critical
CSS from the rest and defer the remainder.

### T-2 — Code-split `src.js` (472 KB single chunk)

One 472 KB chunk lands in the client bundle (hurts TBT / TTI ~16 s). Identify
what it contains (likely a vendor/deps barrel — cross-check the SPEC-269 bundle
analyzer, `pnpm build:analyze`) and split so the home only ships what it renders.

### T-3 — Defer / remove non-critical islands (−22% TBT measured)

Move `client:load` → `client:idle`/`client:visible`, or convert to static Astro
where no interactivity is needed. **Caveat proven in the spike:** `client:idle`
alone does NOT reduce module *evaluation* (only postpones `.hydrate()`), so real
gains need removing/deferring the island, not just changing the directive. React
is embedded in ~50 island components (a `FavoriteButton` per card,
`CompareCardSelect`, `MobileMenu`), so eliminating React from the critical path is
non-trivial and only partially achievable incrementally.

### T-4 — Shrink the 1 MB HTML document

Below-fold sections are **not** the bulk (removing 8 sections cut only 177 KB);
the weight is hero + featured + base overhead (36 KB inline CSS, serialized island
props, JSON-LD). Consider server-island / lazy loading for below-fold content and
trimming inline serialized data.

## 5. Measurement method (mandatory)

Measure with **`pnpm lighthouse` (lhci)** — it averages runs and matches
PageSpeed. Serve the prod build on a **CORS-clean origin the API trusts** (e.g.
`:4426`, already in `API_CORS_ORIGINS`) so client-side fetches don't fail and skew
the run.

**Do NOT** use single-run Chrome DevTools MCP traces: the spike proved they are
pure noise here — `v8.evaluateModule` *rose* as code dropped (2133 → 2436 ms with
fewer modules) and LCP clustered ~4700 ms regardless of build. Treat near-zero
variation across substantive changes as a measurement smell.

## 6. Non-goals / caveats

- This is a **lab-score** project. Field CWV is already "Good"; prod traffic ~zero.
  Confirm the business wants the lab number before investing.
- The `unsafe-inline` CSS path from HOS-164 is a **security concession** (contained
  to styles; `script-src` stays strict). Only bundle it in if T-1 needs inlining,
  and get sign-off — it's flagged by the automated security review.
- Related: HOS-128 (edge-cache anonymous catalog) and HOS-165 (soft-nav CSP
  console noise) touch the same surface; coordinate.

## 7. Open questions

- OQ-1: Is the score-80 lab target actually required, or is "field Good" enough?
  (Determines whether this spec is worth implementing at all.)
- OQ-2: What exactly is in the 472 KB `src.js` chunk? (Blocks T-2 sizing.)
