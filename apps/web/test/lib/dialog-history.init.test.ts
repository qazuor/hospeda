/**
 * @file dialog-history.init.test.ts
 * @description Covers what `dialog-history` does on a FRESH module evaluation,
 * which the main suite cannot reach: `resetDialogHistoryForTests` re-syncs the
 * router baseline and warms the `navigate` cache, so every test there starts
 * from a state production only arrives at after a real swap.
 *
 * Two behaviours live here:
 *  - Lifecycle listeners must be attached at module evaluation. They are the
 *    only production re-sync of the agreement baseline, and the JS realm
 *    survives soft navigations — attaching them on first use meant every swap
 *    before the session's first modal went unobserved, leaving the baseline
 *    stale and the feature silently dead for the rest of the visit.
 *  - The very first claim runs before the `navigate` warm-up resolves, so it
 *    takes the deferred path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_URL = 'http://localhost:3000/es/';
const NEXT_URL = 'http://localhost:3000/es/alojamientos/casa/';

let routerIndex = 0;
const navigateCalls: string[] = [];

function fakeNavigate(href: string, options?: unknown): void {
    const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
    navigateCalls.push(href);
    routerIndex += 1;
    window.history.pushState({ ...state, index: routerIndex, scrollX: 0, scrollY: 0 }, '', href);
}

function enableClientRouter(): void {
    for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
        meta.remove();
    }
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'astro-view-transitions-enabled');
    document.head.appendChild(meta);
}

/**
 * Loads a pristine copy of the module, as a fresh document load would.
 *
 * `vi.resetModules()` also discards the stub, so the navigate implementation
 * has to be injected into the NEW copy — the one the fresh module will import.
 */
async function loadFreshModule() {
    vi.resetModules();
    const stub = await import('../stubs/astro-transitions-client');
    stub.__setNavigateImpl(fakeNavigate);
    return import('../../src/lib/dialog-history');
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('dialog-history — module initialisation', () => {
    beforeEach(() => {
        __setNavigateImpl(fakeNavigate);
        enableClientRouter();
        navigateCalls.length = 0;
        routerIndex = 0;
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
    });

    afterEach(() => {
        __setNavigateImpl(null);
    });

    it('observes a soft navigation that happens before the first modal ever opens', async () => {
        const { acquireDialogHistoryEntry } = await loadFreshModule();

        // The user lands on `/es/`, opens nothing, and taps a card. ClientRouter
        // swaps to the detail page: the module must see this, or its baseline
        // stays at `/es/` and every later claim is refused for the rest of the
        // visit — the feature dead on the most common journey.
        window.history.pushState({ index: 1, scrollX: 0, scrollY: 0 }, '', NEXT_URL);
        document.dispatchEvent(new Event('astro:before-swap'));
        document.dispatchEvent(new Event('astro:page-load'));

        acquireDialogHistoryEntry({ onPopped: vi.fn() });
        await flush();

        expect(navigateCalls).toHaveLength(1);
        expect(navigateCalls[0]).toContain('#hospeda-dialog-');
    });

    it('lands the very first claim even though it beats the navigate warm-up', async () => {
        const { acquireDialogHistoryEntry } = await loadFreshModule();

        const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });
        // Nothing yet: the module is still resolving `astro:transitions/client`.
        expect(navigateCalls).toHaveLength(0);

        await flush();

        expect(navigateCalls).toHaveLength(1);
        expect(window.location.hash).toBe('#hospeda-dialog-1');
        expect(() => release()).not.toThrow();
    });

    it('cancels a deferred claim that was released before it landed', async () => {
        const { acquireDialogHistoryEntry } = await loadFreshModule();

        const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });
        // Closed before the import resolved. Letting the claim land anyway
        // would strand a fragment nothing will ever unwind.
        release();
        await flush();

        expect(navigateCalls).toHaveLength(0);
        expect(window.location.hash).toBe('');
    });

    it('cancels a deferred claim when a page swap abandons the stack', async () => {
        const { acquireDialogHistoryEntry } = await loadFreshModule();

        acquireDialogHistoryEntry({ onPopped: vi.fn() });
        document.dispatchEvent(new Event('astro:before-swap'));
        await flush();

        // Pushing here would drop an entry into the middle of a swap.
        expect(navigateCalls).toHaveLength(0);
    });
});
