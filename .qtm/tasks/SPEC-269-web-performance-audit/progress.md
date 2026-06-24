# SPEC-269 — Web performance audit & improvements — Progress

**Status**: in-progress (0/13)
**Created**: 2026-06-24
**Tags**: performance, web, audit, core-web-vitals, lcp, inp, cls, bundle, images

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| core (baseline + bundle instrument) | T-269-01, T-269-02a, T-269-02b | 0/3 |
| integration (LCP, CLS, hydration, images) | T-269-03a, T-269-03b, T-269-04, T-269-05, T-269-06, T-269-07, T-269-08, T-269-09 | 0/8 |
| ci (Lighthouse CI job) | T-269-10 | 0/1 |
| testing (post-fix validation) | T-269-11 | 0/1 |

## Critical Path

T-269-01 → T-269-11 (baseline gates the final re-run)
T-269-02a → T-269-02b → T-269-11 (bundle instrumentation gates chunk-splitting, which gates final validation)

All fix tasks (T-269-03a through T-269-10) run in parallel and converge at T-269-11.

Longest sequential chain: T-269-02a → T-269-02b → T-269-11 (3 steps).

## Parallel Tracks

```
Track A (baseline):     T-269-01 ──────────────────────────────→ T-269-11 (convergence)
Track B (bundle):       T-269-02a → T-269-02b ─────────────────→ T-269-11
Track C (hero LCP):     T-269-03a (preload) ────────────────────→ T-269-11
                        T-269-03b (SSR first-frame) ────────────→ T-269-11
Track D (gallery LCP):  T-269-04 ───────────────────────────────→ T-269-11
Track E (CLS):          T-269-05 ───────────────────────────────→ T-269-11
Track F (hydration):    T-269-06 ───────────────────────────────→ T-269-11
Track G (leaflet):      T-269-07 ───────────────────────────────→ T-269-11
Track H (fetchpriority):T-269-08 ───────────────────────────────→ T-269-11
Track I (INP):          T-269-09 ───────────────────────────────→ T-269-11
Track J (CI):           T-269-10 ───────────────────────────────→ T-269-11
```

All of Track C–J are independent and can run concurrently. The only sequential dependency is T-269-02a before T-269-02b.

## Model Fit Notes (MIXTO)

- **BÁSICO tasks** (mechanical, file:line known, pattern to copy): T-269-01, T-269-02a, T-269-03a, T-269-04, T-269-05, T-269-06, T-269-07, T-269-08, T-269-09, T-269-10, T-269-11.
- **POTENTE tasks** (architectural, require judgment): T-269-02b (manualChunks tuning loop), T-269-03b (hero SSR + hydration without flicker).

**Execution recommendation**: a smaller model can handle all BÁSICO tasks in one pass. Assign T-269-02b and T-269-03b to a more capable model or review carefully before merging.

## Key Decisions (Resolved — owner 2026-06-23)

| # | Decision | Resolution |
|---|---|---|
| D-1 | Hero LCP fix | Static first-frame SSR + rotator hydrates on top (T-269-03b) |
| D-2 | Lighthouse CI | Report-only first; promote to blocking gate in follow-up (T-269-10) |
| D-3 | Bundle scope | Full chunk-splitting to 0 chunks >500KB, ONLY apps/web (admin out of scope) |
| D-4 | Fonts (F11) | Deferred — Google Fonts already `display=swap`, self-hosting optional follow-up |
| D-5 | Admin performance | Out of scope — admin had SPEC-190; this spec is apps/web only |

## Execution Order (Recommended)

1. Start T-269-01 (baseline) and T-269-02a (visualizer) in parallel — no blockers.
2. Once T-269-02a completes, start T-269-02b (chunk-splitting).
3. All fix tasks (T-269-03a through T-269-10) can start immediately in any order — no inter-dependencies.
4. T-269-11 starts only after ALL other tasks complete.

## Findings Reference (from spec §3 recon)

| Finding | Severity | Fix Task |
|---|---|---|
| F1 — Hero LCP blocked by hydration | HIGH | T-269-03b |
| F2 — Gallery LCP deferred by client:visible | HIGH | T-269-04 |
| F3 — 2 chunks >500KB, no manualChunks | HIGH | T-269-02a + T-269-02b |
| F4 — Leaflet static import in 2 map islands | MEDIUM | T-269-07 |
| F5 — FavoriteButton client:load in event cards | MEDIUM | T-269-06 |
| F6 — Avatar img without width/height (CLS) | MEDIUM | T-269-05 |
| F7 — Hero home without preload hint | MEDIUM | T-269-03a |
| F8 — Destination hero without fetchpriority=high | LOW | T-269-08 |
| F9 — Lighthouse CI dead | MEDIUM | T-269-10 |
| F10 — No bundle-size guard | MEDIUM | T-269-02a |
| F11 — Google Fonts (deferred) | LOW | out of scope v1 |
| F12 — Lightbox img without dimensions | LOW | T-269-05 |

## Owner Actions Required

- None at this time — all decisions resolved (owner 2026-06-23).
- PR review + merge to staging after T-269-11 passes.
- Promote Lighthouse CI to a blocking gate in a follow-up spec (after baselines stabilise).

## Notes

- T-269-01 and T-269-02a are the two natural starting points (unblocked, parallel).
- T-269-03b (hero SSR) is the highest-complexity task — read `HeroSection.astro:69-84` and `HeroImageRotator.client.tsx:108-114` carefully before starting.
- T-269-02b depends on T-269-02a; all other integration fixes are independent.
- Positive findings that must NOT be changed: GLightbox lazy, Cloudinary presets (`q_auto,f_auto,dpr_auto`), OG image caching, prefetch hover config, tiptap/recharts are auth-only (don't affect public LCP).
