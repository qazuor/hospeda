/**
 * Zod runtime configuration, applied as an import side effect.
 *
 * Zod 4 decides once, the first time it builds an object schema, whether it
 * may compile validators with `new Function`. In a browser under a strict CSP
 * (no `unsafe-eval`) that probe is blocked and reported as a
 * `securitypolicyviolation` even though Zod catches the exception (HOS-2558).
 * Setting `jitless` makes Zod skip the probe and use its interpreter path.
 *
 * Browser-only on purpose: servers keep the compiled fast path, and the CSP
 * is a browser concept. This module MUST be the first import of the package
 * entry, before any schema is constructed, because the probe result is cached.
 *
 * @module zod-runtime-config
 */
import { z } from 'zod';

// Read through a typed view of `globalThis`: this package compiles without the DOM lib, so a
// bare `window`/`document` reference fails its declaration build.
const runtime = globalThis as { readonly window?: unknown; readonly document?: unknown };

if (typeof runtime.window !== 'undefined' && typeof runtime.document !== 'undefined') {
    z.config({ jitless: true });
}
