/**
 * @file auth-client.session-teardown.test.ts
 * @description HOS-718 regression test.
 *
 * `authClient.useSession()` (better-auth/react) mounts a nanostores atom.
 * nanostores debounces the atom's "last listener unsubscribed" cleanup by
 * `STORE_UNMOUNT_DELAY` (1000ms, see `nanostores/lifecycle`) so a quick
 * remount doesn't thrash. That delayed cleanup is what better-auth uses to
 * remove its `window`-bound `storage`/focus/online listeners
 * (`session-refresh.mjs` `cleanup()` -> `broadcast-channel.mjs`
 * `cleanupBroadcastSetup`).
 *
 * In `hospeda-web`'s vitest run, a component using `useSession()` can unmount
 * near the end of a test FILE. If Vitest tears down that file's jsdom
 * `window` before the 1000ms debounce elapses, the orphaned `setTimeout`
 * fires against a `window` that no longer exists:
 *
 *   ReferenceError: window is not defined
 *     at Object.cleanupBroadcastSetup  better-auth/dist/client/broadcast-channel.mjs:35:4
 *     at Object.cleanup                better-auth/dist/client/session-refresh.mjs:109:10
 *     at                                better-auth/dist/client/session-atom.mjs:144:19
 *     at Timeout._onTimeout            nanostores/lifecycle/index.js:139:55
 *
 * Because the throw happens inside an orphaned `Timeout`, it belongs to no
 * test — vitest reports it under `Errors`, not as a test failure, yet the
 * process still exits 1 and tumbles a random `hospeda-web` CI shard.
 *
 * `test/setup.ts` now runs `cleanStores(authClient.$store.atoms.session)` in
 * a global `afterEach`, which forces nanostores to run that cleanup
 * synchronously (while `window` is still alive) instead of leaving it
 * debounced. Both tests below use fake timers to force the debounced
 * cleanup to fire deterministically, instead of relying on real 1-second
 * timing and a lucky/unlucky CI scheduling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, renderHook } from '@testing-library/react';
import { atom, cleanStores, onMount, STORE_UNMOUNT_DELAY } from 'nanostores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient, useSession } from '../../src/lib/auth-client';

/** Delete `window` from the global object, simulating Vitest's jsdom teardown for a test file. */
function deleteGlobalWindow(): Window & typeof globalThis {
    const originalWindow = globalThis.window;
    delete (globalThis as { window?: Window }).window;
    return originalWindow;
}

describe('nanostores STORE_UNMOUNT_DELAY footgun (HOS-718)', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('pins the raw mechanism: an onMount cleanup that touches `window` throws if it fires after teardown', () => {
        vi.useFakeTimers();

        // Minimal store reproducing the exact shape better-auth's session atom
        // uses: an onMount cleanup that unconditionally touches `window`,
        // exactly like `cleanupBroadcastSetup` does.
        const $store = atom(0);
        onMount($store, () => {
            return () => {
                window.removeEventListener('storage', () => {});
            };
        });

        const unsubscribe = $store.listen(() => {});
        unsubscribe();

        const originalWindow = deleteGlobalWindow();
        try {
            expect(() => {
                vi.advanceTimersByTime(STORE_UNMOUNT_DELAY);
            }).toThrow(/window is not defined/);
        } finally {
            globalThis.window = originalWindow;
        }
    });
});

describe('authClient session store teardown safety (HOS-718 fix)', () => {
    beforeEach(() => {
        // authClient's session atom fetches `/get-session` on mount
        // (session-atom.mjs). Stub it so the test never makes a real network
        // call regardless of how far fake timers get advanced.
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => null
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('cleanStores(session) — the exact call test/setup.ts now runs — prevents the crash for the real authClient session atom', () => {
        vi.useFakeTimers();

        const { unmount } = renderHook(() => useSession());
        unmount();

        // This is exactly what `test/setup.ts`'s global `afterEach` now does
        // for every test, before Vitest can tear down jsdom for the file.
        cleanStores(authClient.$store.atoms.session);

        const originalWindow = deleteGlobalWindow();
        try {
            expect(() => {
                vi.advanceTimersByTime(STORE_UNMOUNT_DELAY);
            }).not.toThrow();
        } finally {
            globalThis.window = originalWindow;
        }
    });
});

describe('test/setup.ts wiring (HOS-718)', () => {
    it('registers the cleanStores(session) teardown fix globally', () => {
        const setupSource = readFileSync(resolve(__dirname, '../setup.ts'), 'utf8');

        expect(setupSource).toMatch(/cleanStores\(\s*authClient\.\$store\.atoms\.session\s*\)/);
    });
});
