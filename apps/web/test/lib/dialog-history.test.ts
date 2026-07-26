/**
 * @file dialog-history.test.ts
 * @description Unit tests for the modal back-button history manager (HOS-310).
 *
 * The bug being pinned: with a modal open, the system back button navigated
 * away from the page instead of closing the modal.
 *
 * The subtler half of the fix is that the claimed entry must not make Astro's
 * `<ClientRouter />` refetch and swap the document — that would wipe every
 * island on the page, which is the very loss the issue is about. Two things
 * cover that here: the suite installs the router's meta tag and injects a real
 * `navigate` into the shared stub, so the production routed path is the one
 * under test; and `the shape ClientRouter needs` drives a stand-in of the real
 * `onPopState`/`transition()` to prove the resulting entry is one the router
 * lets through.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    acquireDialogHistoryEntry,
    resetDialogHistoryForTests
} from '../../src/lib/dialog-history';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_PATH = '/es/alojamientos/casa/';
const PAGE_URL = `http://localhost:3000${PAGE_PATH}`;

/**
 * Stands in for the router's `navigate()` on its hash fast path: push the
 * entry, merging the caller's state the way `moveToLocation` does.
 *
 * Injected through the shared stub rather than `vi.mock`, which does not
 * intercept the `astro:transitions/client` → stub resolve alias.
 */
const routerMock = (() => {
    let index = 0;
    const calls: Array<{ href: string; state?: Record<string, unknown> }> = [];
    return {
        calls,
        reset(): void {
            index = 0;
            calls.length = 0;
        },
        navigate(href: string, options?: unknown): void {
            const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
            calls.push({ href, state });
            index += 1;
            window.history.pushState({ ...state, index, scrollX: 0, scrollY: 0 }, '', href);
        }
    };
})();

/** Resolves on the next `popstate`, which jsdom dispatches asynchronously. */
function nextPopState(): Promise<PopStateEvent> {
    return new Promise((resolve) => {
        window.addEventListener('popstate', (event) => resolve(event as PopStateEvent), {
            once: true
        });
    });
}

/** Lets the module's queued unwind (and any pending claim) settle. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Waits long enough for a queued unwind AND the `popstate` it produces to be
 * delivered, so no stray traversal leaks into the next test.
 */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

/** Idempotent: repeated calls must not stack duplicate meta elements. */
function enableClientRouter(): void {
    disableClientRouter();
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'astro-view-transitions-enabled');
    document.head.appendChild(meta);
}

function disableClientRouter(): void {
    for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
        meta.remove();
    }
}

describe('dialog-history', () => {
    // Warm the module's cached `navigate` once, so every claim below is
    // synchronous — as it is in production, where the warm-up runs at island
    // hydration long before anyone opens a modal. The cache deliberately
    // survives `resetDialogHistoryForTests`, so one pass covers the file.
    beforeAll(async () => {
        __setNavigateImpl(routerMock.navigate);
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
        await settle();
    });

    beforeEach(async () => {
        enableClientRouter();
        // Baseline: a page entry shaped like the one Astro's router installs.
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        routerMock.reset();
        await settle();
    });

    afterEach(() => {
        resetDialogHistoryForTests();
        disableClientRouter();
    });

    afterAll(() => {
        __setNavigateImpl(null);
    });

    it('claims a fragment-bearing entry through the router when a modal opens', () => {
        const lengthBefore = window.history.length;

        acquireDialogHistoryEntry({ onPopped: vi.fn() });

        // Routed, not hand-pushed: only `navigate()` advances the router's
        // private `originalLocation`, which is what keeps the back press off
        // the document-swapping path.
        expect(routerMock.calls).toHaveLength(1);
        expect(routerMock.calls[0]?.href).toContain('#hospeda-dialog-');
        expect(routerMock.calls[0]?.state).toMatchObject({ __hospedaDialog: 1 });
        // Stamped per document load so an entry abandoned by a previous load
        // cannot be mistaken for one of this load's.
        expect(routerMock.calls[0]?.state?.__hospedaDialogSession).toEqual(expect.any(String));
        expect(window.history.length).toBe(lengthBefore + 1);
        expect(window.location.pathname).toBe(PAGE_PATH);
    });

    it('closes the modal on back instead of navigating', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped });

        const popped = nextPopState();
        window.history.back();
        await popped;

        expect(onPopped).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe(PAGE_PATH);
        expect(window.location.hash).toBe('');
    });

    it('unwinds its entry when the modal closes through the UI', async () => {
        const onPopped = vi.fn();
        const { release } = acquireDialogHistoryEntry({ onPopped });

        const popped = nextPopState();
        release();
        await popped;

        // Walking back was ours, not the user's: no close callback fires, and
        // the fragment is gone, so the next back press leaves the page.
        expect(onPopped).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('');
    });

    it('is idempotent when release runs twice', async () => {
        const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });
        const popped = nextPopState();
        release();
        await popped;

        const spy = vi.spyOn(window.history, 'go');
        release();
        await flush();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('does not walk history back when the back gesture already consumed the entry', async () => {
        const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });

        const popped = nextPopState();
        window.history.back();
        await popped;

        // What the React effect cleanup does right after the consumer's state
        // flips — it must not eat a second entry.
        const spy = vi.spyOn(window.history, 'go');
        release();
        await flush();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('gives each nested modal its own entry, unwound innermost first', async () => {
        const outerPopped = vi.fn();
        const innerPopped = vi.fn();

        acquireDialogHistoryEntry({ onPopped: outerPopped });
        acquireDialogHistoryEntry({ onPopped: innerPopped });
        expect(window.location.hash).toBe('#hospeda-dialog-2');

        let popped = nextPopState();
        window.history.back();
        await popped;

        expect(innerPopped).toHaveBeenCalledTimes(1);
        expect(outerPopped).not.toHaveBeenCalled();
        expect(window.location.hash).toBe('#hospeda-dialog-1');

        popped = nextPopState();
        window.history.back();
        await popped;

        expect(outerPopped).toHaveBeenCalledTimes(1);
        expect(window.location.hash).toBe('');
    });

    it('unwinds both levels in one traversal when nested modals close together', async () => {
        const outer = acquireDialogHistoryEntry({ onPopped: vi.fn() });
        const inner = acquireDialogHistoryEntry({ onPopped: vi.fn() });

        const goSpy = vi.spyOn(window.history, 'go');
        const popped = nextPopState();
        // OUTER FIRST — React destroys sibling effects in declaration order, so
        // this is the order the codebase actually produces (the nested pair in
        // `MoveToCollectionModal` renders the sub-modal as a sibling AFTER the
        // outer `Dialog`). Deciding ownership per release rather than per batch
        // abandoned the outer entry here and stranded its fragment in the URL.
        outer.release();
        inner.release();
        await popped;

        expect(goSpy).toHaveBeenCalledTimes(1);
        expect(goSpy).toHaveBeenCalledWith(-2);
        expect(window.location.hash).toBe('');
        goSpy.mockRestore();
    });

    it('ignores a forward traversal back onto a dismissed entry', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped });

        let popped = nextPopState();
        window.history.back();
        await popped;
        expect(onPopped).toHaveBeenCalledTimes(1);

        popped = nextPopState();
        window.history.forward();
        await popped;

        expect(onPopped).toHaveBeenCalledTimes(1);
    });

    it('does not close the OUTER modal when the user presses forward', async () => {
        const outerPopped = vi.fn();
        const innerPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped: outerPopped });
        acquireDialogHistoryEntry({ onPopped: innerPopped });

        let popped = nextPopState();
        window.history.back();
        await popped;
        expect(innerPopped).toHaveBeenCalledTimes(1);

        // Forward lands on the inner modal's abandoned entry. Reading only the
        // top of the stack, that mismatch used to dismiss the outer modal.
        popped = nextPopState();
        window.history.forward();
        await popped;

        expect(outerPopped).not.toHaveBeenCalled();
    });

    it('does not mistake an in-modal anchor link for the modal entry', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped });

        // An `<a href="#terminos">` inside the modal: a browser-created entry
        // with no state at all.
        window.history.pushState(null, '', `${PAGE_URL}#terminos`);
        const popped = nextPopState();
        window.history.back();
        await popped;

        expect(onPopped).not.toHaveBeenCalled();
        expect(window.history.state).toMatchObject({ __hospedaDialog: 1 });
    });

    it('stops calling back into modals whose React tree a page swap destroyed', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped });

        document.dispatchEvent(new Event('astro:before-swap'));

        const popped = nextPopState();
        window.history.back();
        await popped;

        expect(onPopped).not.toHaveBeenCalled();
    });

    describe('refuses to claim when the router cannot be trusted', () => {
        it('skips when app code moved the URL behind the router', () => {
            // What `ListingLayout`'s partial swap does on every filter apply,
            // and what the `?calendarSync=` / post-login query strips do.
            window.history.pushState({}, '', `${PAGE_URL}?type=cabin`);

            const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });

            // Claiming here would leave `samePage(originalLocation, to)` false
            // and send the router down the full refetch-and-swap path — while
            // merely OPENING a modal. Skipping costs the back gesture; that is
            // the pre-feature behaviour, not a regression.
            expect(routerMock.calls).toHaveLength(0);
            expect(window.location.hash).toBe('');
            expect(() => release()).not.toThrow();
        });

        it('claims again once a real router navigation re-syncs both views', () => {
            window.history.pushState({}, '', `${PAGE_URL}?type=cabin`);
            // This first call is also what attaches the module's lifecycle
            // listeners — `resetDialogHistoryForTests` detaches them, so events
            // dispatched before any acquire would land on nothing and the
            // assertions below would pass for the wrong reason.
            acquireDialogHistoryEntry({ onPopped: vi.fn() });
            expect(routerMock.calls).toHaveLength(0);

            // A real router navigation: a swap actually happened.
            document.dispatchEvent(new Event('astro:before-swap'));
            document.dispatchEvent(new Event('astro:page-load'));

            acquireDialogHistoryEntry({ onPopped: vi.fn() });
            expect(routerMock.calls).toHaveLength(1);
        });

        it("does not re-sync on ListingLayout's partial swap, which never runs the router", () => {
            window.history.pushState({}, '', `${PAGE_URL}?type=cabin`);
            acquireDialogHistoryEntry({ onPopped: vi.fn() });
            expect(routerMock.calls).toHaveLength(0);

            // The partial-swap script hand-dispatches exactly these two,
            // without ever going through the router — so `originalLocation` is
            // still stale and trusting them is how a swap slips past the guard.
            // It never forges `astro:before-swap`, which is why that is the
            // event the re-sync is gated on.
            document.dispatchEvent(new Event('astro:after-swap'));
            document.dispatchEvent(new Event('astro:page-load'));

            acquireDialogHistoryEntry({ onPopped: vi.fn() });

            expect(routerMock.calls).toHaveLength(0);
        });

        it('does not re-sync after a navigation that started and then aborted', () => {
            acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
            routerMock.reset();

            // A navigation begins, is aborted, and fires no further lifecycle
            // events. A flag cleared only by `astro:page-load` would stay set
            // and let the partial swap's forged event through afterwards.
            document.dispatchEvent(new Event('astro:before-preparation'));
            window.history.pushState({}, '', `${PAGE_URL}?type=cabin`);
            document.dispatchEvent(new Event('astro:after-swap'));
            document.dispatchEvent(new Event('astro:page-load'));

            acquireDialogHistoryEntry({ onPopped: vi.fn() });

            expect(routerMock.calls).toHaveLength(0);
        });

        it('does not claim while a router navigation is in flight', () => {
            acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
            routerMock.reset();

            // `navigate()` starts by aborting whatever is in flight, so a modal
            // opened mid-navigation would silently kill the link the user just
            // tapped.
            document.dispatchEvent(new Event('astro:before-preparation'));

            acquireDialogHistoryEntry({ onPopped: vi.fn() });

            expect(routerMock.calls).toHaveLength(0);
        });

        it('declines the entry when the router does not actually push it', async () => {
            const onPopped = vi.fn();
            // A real claim first, so the current position carries a dialog id.
            // Without it the assertions below would pass through the unrelated
            // "no id on this entry" branch and prove nothing.
            acquireDialogHistoryEntry({ onPopped: vi.fn() });

            __setNavigateImpl(() => undefined);
            try {
                acquireDialogHistoryEntry({ onPopped });
            } finally {
                __setNavigateImpl(routerMock.navigate);
            }

            // The unlanded claim owns nothing, so the back gesture must reach
            // the modal below it rather than the one that never got an entry.
            const popped = nextPopState();
            window.history.back();
            await popped;

            expect(onPopped).not.toHaveBeenCalled();
        });

        it('ignores an entry stamped by a previous document load', async () => {
            // The entry the user will land on was claimed by an EARLIER load:
            // ids restart at 1 on every fresh document while history state
            // survives, so it carries the same id this load is about to reuse.
            // Without the stamp it would read as the modal's own entry and the
            // back press would be swallowed.
            window.history.replaceState(
                { __hospedaDialog: 1, __hospedaDialogSession: 'a-previous-load' },
                '',
                PAGE_URL
            );
            const onPopped = vi.fn();
            acquireDialogHistoryEntry({ onPopped });

            const popped = nextPopState();
            window.history.back();
            await popped;

            expect(onPopped).toHaveBeenCalledTimes(1);
        });

        it('closes on back even when an abandoned entry sits directly below', async () => {
            const onPopped = vi.fn();
            // What is left behind after the user navigates away from an open
            // modal and comes back: an entry this module claimed, abandoned,
            // and can still recognise.
            acquireDialogHistoryEntry({ onPopped: vi.fn() });
            document.dispatchEvent(new Event('astro:before-swap'));

            acquireDialogHistoryEntry({ onPopped });
            const popped = nextPopState();
            window.history.back();
            await popped;

            // Reading "is this id still in my stack?" made this press inert.
            expect(onPopped).toHaveBeenCalledTimes(1);
        });

        it('does not unwind when something else pushed on top of the claim', async () => {
            const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });

            // `ListingLayout` applies a filter on a 500ms debounce, which can
            // land after a modal opened. `go(-1)` would then take the user to
            // the pre-filter URL rather than closing anything.
            window.history.pushState({}, '', `${PAGE_URL}?type=cabin`);

            const spy = vi.spyOn(window.history, 'go');
            release();
            await flush();

            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('skips on pages that do not mount ClientRouter', () => {
            disableClientRouter();

            const { release } = acquireDialogHistoryEntry({ onPopped: vi.fn() });

            expect(routerMock.calls).toHaveLength(0);
            expect(window.location.hash).toBe('');
            expect(() => release()).not.toThrow();
        });

        it('gives up quietly when the document has no parseable URL', () => {
            const original = Object.getOwnPropertyDescriptor(window, 'location');
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: { ...window.location, href: '' }
            });

            try {
                // Claiming runs inside a React passive effect; a throw here
                // would unmount the whole island rather than merely lose the
                // back gesture.
                expect(() =>
                    acquireDialogHistoryEntry({ onPopped: vi.fn() }).release()
                ).not.toThrow();
            } finally {
                if (original) Object.defineProperty(window, 'location', original);
            }
        });
    });

    describe('the shape ClientRouter needs', () => {
        /**
         * Stand-in for `astro/dist/transitions/router.js` → `onPopState` plus
         * the early exits of `transition()`. jsdom never loads the real
         * router, so this is the only way to assert the invariant the whole
         * design rests on: a traversal on or off a claimed entry must never
         * reach `doPreparation`, which is what refetches and swaps.
         *
         * `originalLocation` is the router's private view of where it thinks
         * it is. It advances only through `navigate()` — which is exactly why
         * `acquireDialogHistoryEntry` routes through it, and why it refuses to
         * claim when something else has moved the URL.
         */
        function makeRouterProbe(startHref: string) {
            let originalLocation = new URL(startHref);
            let currentHistoryIndex = 0;
            const swaps: string[] = [];

            const samePage = (a: URL, b: URL): boolean =>
                a.pathname === b.pathname && a.search === b.search;

            return {
                swaps,
                /** Mirrors what `moveToLocation` does to the router's state. */
                noteNavigate(href: string): void {
                    originalLocation = new URL(href);
                    currentHistoryIndex++;
                },
                onPopState(event: PopStateEvent): void {
                    if (event.state === null) return;
                    const state = event.state as { index?: number };
                    const nextIndex = state.index ?? 0;
                    const direction = nextIndex > currentHistoryIndex ? 'forward' : 'back';
                    currentHistoryIndex = nextIndex;
                    const to = new URL(window.location.href);
                    const from = originalLocation;
                    if (samePage(from, to)) {
                        if (
                            (direction !== 'back' && to.hash) ||
                            (direction === 'back' && from.hash)
                        ) {
                            originalLocation = to;
                            return; // moveToLocation: no fetch, no swap
                        }
                    }
                    swaps.push(`${direction}:${to.href}`);
                    originalLocation = to;
                }
            };
        }

        it('a routed claim keeps the router out of a swap in BOTH directions', async () => {
            const probe = makeRouterProbe(PAGE_URL);
            // The real module drives this: its `navigate()` produces the entry,
            // and the probe mirrors the bookkeeping that call performs.
            acquireDialogHistoryEntry({ onPopped: vi.fn() });
            probe.noteNavigate(window.location.href);
            window.addEventListener('popstate', probe.onPopState);

            try {
                let popped = nextPopState();
                window.history.back();
                await popped;
                expect(probe.swaps).toEqual([]);

                popped = nextPopState();
                window.history.forward();
                await popped;
                expect(probe.swaps).toEqual([]);
            } finally {
                window.removeEventListener('popstate', probe.onPopState);
            }
        });

        it('an UNROUTED entry makes the router swap on back — the regression guarded against', async () => {
            const probe = makeRouterProbe(PAGE_URL);

            // A hand-rolled `pushState`: same entry, but the router's
            // `originalLocation` never learns about the fragment.
            window.history.pushState(
                { index: 1, scrollX: 0, scrollY: 0, __hospedaDialog: 99 },
                '',
                `${PAGE_URL}#hospeda-dialog-99`
            );
            window.addEventListener('popstate', probe.onPopState);

            try {
                const popped = nextPopState();
                window.history.back();
                await popped;

                // `from.hash` is empty, so `transition()` falls through and the
                // whole document is refetched.
                expect(probe.swaps).toEqual([`back:${PAGE_URL}`]);
            } finally {
                window.removeEventListener('popstate', probe.onPopState);
            }
        });
    });
});
