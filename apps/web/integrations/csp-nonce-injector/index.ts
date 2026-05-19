/**
 * @file index.ts
 * @description Module barrel for the CSP nonce injector. Exposes `injectNonce`
 * for use by middleware.
 *
 * Historical note: this dir was originally planned as an Astro 6 integration
 * (Path A2 from research/astro-csp-options.md §6). Astro 6 turns out to NOT
 * expose a per-request HTML transformation hook — `astro:server:setup` is
 * dev-only Vite wiring and `astro:build:*` hooks are build-time. The wiring
 * therefore lives in `apps/web/src/middleware.ts` after `next()` (Path A1 with
 * a robust parse5 walker instead of regex), and this dir stays as a clean
 * module home for the walker logic.
 *
 * If a future Astro release introduces a real per-response HTML hook, we can
 * reintroduce an AstroIntegration factory here and register it in
 * `astro.config.mjs` without touching callers.
 *
 * @see research/astro-csp-options.md §3 (Path A1 vs A2)
 */

export { injectNonce } from './inject-nonce';
