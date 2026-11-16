/**
 * @file dialog-history.claim-popstate.test.ts
 * @description Regression: on Firefox 160 every routed dialog closed the same
 * instant it opened. The URL gained `#hospeda-dialog-N`, then the surface shut.
 *
 * Astro 7.3.1's `moveToLocation()` (`astro/dist/transitions/router.js`) runs
 * synchronously for a same-page hash: `history.pushState(...)`, then
 * `location.href = to.href`, then — when `history.state` came back null —
 * `history.replaceState(savedState)` plus a synthetic `popstate`. Firefox 160
 * fires a TRUSTED `popstate` with `state === null` DURING `location.href = …`,
 * while `history.state` is null. Our listener saw an entry that was not the
 * top dialog's and treated it as a back press: it popped the entry and called
 * `onPopped()`. Firefox 159 fires no such event; Chromium fires it but keeps
 * the pushed state, so neither broke.
 *
 * The fake router below reproduces the Firefox 160 sequence exactly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_PATH = '/es/alojamientos/casa/';
const PAGE_URL = `http://localhost:3000${PAGE_PATH}`;

let routerIndex = 0;
/** `history.state` as seen by each `popstate` listener call during `navigate`. */
const statesSeenDuringNavigate: unknown[] = [];

/**
 * Stand-in for Astro's `navigate()` on its hash fast path, reproducing what
 * Firefox 160 does inside `moveToLocation()`.
 */
function firefox160Navigate(href: string, options?: unknown): void {
    const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
    routerIndex += 1;
    window.history.pushState({ ...state, index: routerIndex, scrollX: 0, scrollY: 0 }, '', href);

    // `const savedState = history.state; location.href = to.href;`
    const savedState = window.history.state;
    // Firefox 160: the same-URL hash assignment leaves `history.state` null and
    // synchronously fires a trusted `popstate` carrying `state: null`.
    window.history.replaceState(null, '', href);
    statesSeenDuringNavigate.push(window.history.state);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    // `if (!history.state) { history.replaceState(savedState, ''); if (intraPage) dispatch }`
    if (!window.history.state) {
        window.history.replaceState(savedState, '');
        window.dispatchEvent(new PopStateEvent('popstate'));
    }
}

function enableClientRouter(): void {
    for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
        meta.remove();
    }
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'astro-view-transitions-enabled');
    document.head.appendChild(meta);
}

/** Pristine module copy, with the Firefox 160 router injected into its stub. */
async function loadFreshModule() {
    vi.resetModules();
    const stub = await import('../stubs/astro-transitions-client');
    stub.__setNavigateImpl(firefox160Navigate);
    return import('../../src/lib/dialog-history');
}

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

function nextPopState(): Promise<void> {
    return new Promise((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
    });
}

describe('dialog-history — popstate fired by our own claim (Firefox 160)', () => {
    let mod: Awaited<ReturnType<typeof loadFreshModule>>;

    beforeEach(async () => {
        enableClientRouter();
        routerIndex = 0;
        statesSeenDuringNavigate.length = 0;
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        mod = await loadFreshModule();
        mod.resetDialogHistoryForTests();
    });

    afterEach(async () => {
        mod.resetDialogHistoryForTests();
        __setNavigateImpl(null);
        await settle();
    });

    it('keeps the dialog open when the claim itself fires a null-state popstate', async () => {
        // Arrange: warm `navigate`, so the claim is synchronous as in production.
        mod.acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
        await settle();
        statesSeenDuringNavigate.length = 0;
        const onPopped = vi.fn();

        // Act
        mod.acquireDialogHistoryEntry({ onPopped });

        // Assert: the Firefox 160 shape really happened...
        expect(statesSeenDuringNavigate).toEqual([null]);
        // ...and did not close anything.
        expect(onPopped).not.toHaveBeenCalled();
        expect(window.location.hash).toMatch(/^#hospeda-dialog-\d+$/);
        expect(window.history.state).toMatchObject({ __hospedaDialog: expect.any(Number) });
    });

    it('still closes the dialog on a genuine back after the claim', async () => {
        // Arrange
        mod.acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
        await settle();
        const onPopped = vi.fn();
        mod.acquireDialogHistoryEntry({ onPopped });
        expect(onPopped).not.toHaveBeenCalled();

        // Act
        const popped = nextPopState();
        window.history.back();
        await popped;

        // Assert
        expect(onPopped).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe(PAGE_PATH);
        expect(window.location.hash).toBe('');
    });

    it('keeps the dialog open on the first open, whose claim lands after the async import', async () => {
        // Arrange: a copy loaded in this very continuation, so its `navigate`
        // warm-up has not resolved yet (the hooks' awaits would let it).
        mod = await loadFreshModule();
        const onPopped = vi.fn();

        // Act
        mod.acquireDialogHistoryEntry({ onPopped });
        // Proves the deferred path: nothing was claimed synchronously.
        expect(statesSeenDuringNavigate).toEqual([]);
        await settle();

        // Assert: the deferred claim ran inside `.then` and survived its own popstate.
        expect(statesSeenDuringNavigate).toEqual([null]);
        expect(onPopped).not.toHaveBeenCalled();
        expect(window.location.hash).toMatch(/^#hospeda-dialog-\d+$/);

        // A genuine back still closes it.
        const popped = nextPopState();
        window.history.back();
        await popped;
        expect(onPopped).toHaveBeenCalledTimes(1);
    });
});
