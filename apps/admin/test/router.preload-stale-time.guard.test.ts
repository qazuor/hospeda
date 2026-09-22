/**
 * @file router.preload-stale-time.guard.test.ts
 * @description HOS-1153 guard — `defaultPreloadStaleTime` must not go back to 0.
 *
 * With `defaultPreload: 'intent'` the router runs a route's `beforeLoad` after
 * 100 ms of hover, WITHOUT a click. The `_authed` guard's `beforeLoad` calls
 * `fetchAuthSession()`, which issues TWO session reads. At
 * `defaultPreloadStaleTime: 0` nothing is reused, so every hover re-fetched:
 * one sweep of the sidebar (~10 links) cost ~20 API requests, and sweeping it
 * again cost 20 more. That multiplier is what turned a tight auth bucket into
 * a 429 within a handful of navigations.
 *
 * ## Why this reads the source
 *
 * Importing `router.tsx` pulls in `routeTree.gen.ts` → `__root.tsx` → every
 * route file and its module-scope side effects (`validateAdminEnv()`,
 * `initSentry()`, `initPostHog()`) — see `router.csp-nonce.test.ts`'s header
 * for the same reasoning. So this asserts on the single declaration line
 * instead, with an anchored per-line regex that captures the VALUE: a guard
 * that only checked the option were PRESENT would pass against `0`, which is
 * the exact regression it exists to catch.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/router.tsx');
const SOURCE = readFileSync(ROUTER_PATH, 'utf8');

/**
 * TanStack Router's own default, and the floor this guard enforces. Anything
 * lower re-fetches within the window a user spends moving the mouse across a
 * menu, which is precisely the multiplier HOS-1153 removed.
 */
const MIN_PRELOAD_STALE_TIME_MS = 30_000;

/** Anchored to the start of a line so a mention inside a comment cannot match. */
const STALE_TIME_DECLARATION = /^[ \t]*defaultPreloadStaleTime:[ \t]*([0-9_]+)[ \t]*,/gm;

describe('HOS-1153 guard — admin router preload stale time', () => {
    it('declares defaultPreloadStaleTime exactly once', () => {
        // Act
        const matches = [...SOURCE.matchAll(STALE_TIME_DECLARATION)];

        // Assert
        expect(
            matches,
            'Expected exactly one `defaultPreloadStaleTime: <number>,` declaration in router.tsx. If the option moved or is now computed, this guard no longer sees the value it claims to check and must be rewritten rather than deleted.'
        ).toHaveLength(1);
    });

    it("sets defaultPreloadStaleTime to at least TanStack Router's 30 s default", () => {
        // Arrange
        const match = [...SOURCE.matchAll(STALE_TIME_DECLARATION)][0];
        const declared = Number((match?.[1] ?? '').replaceAll('_', ''));

        // Act / Assert
        expect(Number.isFinite(declared)).toBe(true);
        expect(
            declared,
            `defaultPreloadStaleTime is ${declared} ms. Below ${MIN_PRELOAD_STALE_TIME_MS} ms every hover re-runs the _authed beforeLoad, and each of those issues two session reads against the API (HOS-1153).`
        ).toBeGreaterThanOrEqual(MIN_PRELOAD_STALE_TIME_MS);
    });

    it('still preloads on intent — the stale time is what bounds it, not a disabled preload', () => {
        // Arrange / Act / Assert: pinned so a future "fix" that simply turns
        // preloading off does not silently satisfy the guard above while
        // costing the navigation speed the option exists to buy.
        expect(SOURCE).toMatch(/^[ \t]*defaultPreload:[ \t]*'intent',/m);
    });
});
