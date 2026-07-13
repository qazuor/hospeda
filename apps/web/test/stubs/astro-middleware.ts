/**
 * Stub for `astro:middleware` used in Vitest.
 *
 * The real virtual module is provided by Astro's vite plugins at build/dev
 * time; `src/middleware.ts` never runs through that pipeline in unit tests,
 * so we provide minimal identity implementations sufficient to import and
 * exercise `onRequest` directly (see `test/middleware.test.ts`).
 */

/** Matches Astro's real signature closely enough for test purposes: an identity wrapper. */
export function defineMiddleware<T>(handler: T): T {
    return handler;
}

/**
 * Real Astro chains multiple middlewares. Not used by this app's single
 * `onRequest` today (no test imports it), so this stub only needs to exist
 * to satisfy the module shape if some future consumer imports it.
 */
export function sequence<T>(...handlers: readonly T[]): T | undefined {
    return handlers[0];
}
