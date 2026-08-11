/**
 * @file index.ts
 * @description Module barrel for the CSP hash collector. Exposes
 * `collectCspHashes` for use by middleware.
 *
 * Historical note: this dir was originally `csp-nonce-injector`, planned as an
 * Astro 6 integration (Path A2 from research/astro-csp-options.md §6). Astro
 * does NOT expose a per-request HTML transformation hook — `astro:server:setup`
 * is dev-only Vite wiring and `astro:build:*` hooks are build-time. The wiring
 * therefore lives in `apps/web/src/middleware.ts` after `next()` (Path A1 with
 * a robust parse5 walker instead of regex), and this dir stays as a clean
 * module home for the walker logic.
 *
 * HOS-369 WB0-1 changed WHAT the walker does: it used to stamp a per-request
 * nonce onto the body; it now only READS the body and reports content hashes,
 * leaving the HTML byte-identical. A nonce that survives into the Cloudflare
 * cache is a public token for the whole TTL (spec §5.13 / D-9); a content hash
 * cannot desynchronize from the body it describes.
 *
 * @see research/astro-csp-options.md §3 (Path A1 vs A2)
 * @see .specs/HOS-369-web-performance-edge-cache/spec.md §5.13
 */

export { collectCspHashes } from './collect-csp-hashes';
