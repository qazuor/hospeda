/**
 * @file dialog-history.raw-claim.test.ts
 * @description The raw claim used by the mobile filters drawer (HOS-1927): a
 * plain `pushState` entry whose `popstate` is kept from Astro's router, and
 * which lets the listing rewrite its URL under it instead of burying it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    acquireDialogHistoryEntry,
    LISTING_URL_COMMIT_EVENT,
    resetDialogHistoryForTests
} from '../../src/lib/dialog-history';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_URL = 'http://localhost:3000/es/alojamientos/';
const FILTERED_URL = `${PAGE_URL}?type=hotel`;

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

/** Stand-in for `<ClientRouter />`'s `onPopState`, registered AFTER the module's listener. */
const routerPopState = vi.fn();

/** Dispatches the commit event the way `ListingLayout` does; true when a claim took it. */
function commitUrl(url: string): boolean {
    return !window.dispatchEvent(
        new CustomEvent(LISTING_URL_COMMIT_EVENT, { cancelable: true, detail: { url } })
    );
}

describe('dialog-history raw claim (HOS-1927)', () => {
    beforeEach(async () => {
        // No ClientRouter state agreement: the drifted case the drawer lives in.
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        routerPopState.mockClear();
        window.addEventListener('popstate', routerPopState);
        await settle();
    });

    afterEach(async () => {
        window.removeEventListener('popstate', routerPopState);
        resetDialogHistoryForTests();
        await settle();
    });

    it('open pushes exactly one entry at the same URL', () => {
        const before = window.history.length;
        const onPopped = vi.fn();

        const { release } = acquireDialogHistoryEntry({ onPopped, tolerateRouterDrift: true });

        expect(window.history.length).toBe(before + 1);
        expect(window.location.href).toBe(PAGE_URL);
        expect(onPopped).not.toHaveBeenCalled();
        release();
    });

    it('is refused without the opt-in when the router cannot vouch for the page', () => {
        const before = window.history.length;

        acquireDialogHistoryEntry({ onPopped: vi.fn() });

        expect(window.history.length).toBe(before);
    });

    it('the back gesture closes once and the router never sees the traversal', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped, tolerateRouterDrift: true });

        window.history.back();
        await settle();

        expect(onPopped).toHaveBeenCalledTimes(1);
        expect(routerPopState).not.toHaveBeenCalled();
    });

    it('a programmatic close pops exactly once, without a loop', async () => {
        const onPopped = vi.fn();
        const goSpy = vi.spyOn(window.history, 'go');
        const { release } = acquireDialogHistoryEntry({ onPopped, tolerateRouterDrift: true });

        release();
        release();
        await settle();

        expect(goSpy).toHaveBeenCalledTimes(1);
        expect(goSpy).toHaveBeenCalledWith(-1);
        expect(onPopped).not.toHaveBeenCalled();
        expect(routerPopState).not.toHaveBeenCalled();
        // Back on the page's own entry, not on the claim.
        expect(
            (window.history.state as Record<string, unknown>).__hospedaDialogRaw
        ).toBeUndefined();
        goSpy.mockRestore();
    });

    it('a listing URL change is rewritten under the claim, not pushed on top', () => {
        const { release } = acquireDialogHistoryEntry({
            onPopped: vi.fn(),
            tolerateRouterDrift: true
        });
        const lengthWithClaim = window.history.length;

        const taken = commitUrl(FILTERED_URL);

        expect(taken).toBe(true);
        expect(window.location.href).toBe(FILTERED_URL);
        expect(window.history.length).toBe(lengthWithClaim);
        release();
    });

    it('does not take the URL change when nothing is open', () => {
        expect(commitUrl(FILTERED_URL)).toBe(false);
    });

    it('back after a rewrite closes the overlay and keeps the filtered URL', async () => {
        const onPopped = vi.fn();
        acquireDialogHistoryEntry({ onPopped, tolerateRouterDrift: true });
        commitUrl(FILTERED_URL);

        window.history.back();
        await settle();

        expect(onPopped).toHaveBeenCalledTimes(1);
        expect(window.location.href).toBe(FILTERED_URL);
    });

    it('closing by UI after a rewrite keeps the filtered entry and does not walk back', async () => {
        const goSpy = vi.spyOn(window.history, 'go');
        const { release } = acquireDialogHistoryEntry({
            onPopped: vi.fn(),
            tolerateRouterDrift: true
        });
        commitUrl(FILTERED_URL);

        release();
        await settle();

        expect(goSpy).not.toHaveBeenCalled();
        expect(window.location.href).toBe(FILTERED_URL);
        expect(
            (window.history.state as Record<string, unknown>).__hospedaDialogRaw
        ).toBeUndefined();
        goSpy.mockRestore();
    });
});

describe('dialog-history raw claim with the router agreeing (HOS-1927 review)', () => {
    const navigateCalls: string[] = [];

    beforeEach(async () => {
        __setNavigateImpl((href: string, options?: unknown) => {
            navigateCalls.push(href);
            const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
            window.history.pushState({ ...state, index: 1, scrollX: 0, scrollY: 0 }, '', href);
        });
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'astro-view-transitions-enabled');
        document.head.appendChild(meta);
        navigateCalls.length = 0;
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        await settle();
    });

    afterEach(async () => {
        for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
            meta.remove();
        }
        resetDialogHistoryForTests();
        await settle();
    });

    it('the first open is raw: no navigate(), no fragment', () => {
        acquireDialogHistoryEntry({ onPopped: vi.fn(), tolerateRouterDrift: true });

        expect(navigateCalls).toEqual([]);
        expect(window.location.hash).toBe('');
        expect((window.history.state as Record<string, unknown>).__hospedaDialogRaw).toBe(true);
    });

    it('filter, UI close, then back leaves no hash for the router fast path', async () => {
        const { release } = acquireDialogHistoryEntry({
            onPopped: vi.fn(),
            tolerateRouterDrift: true
        });
        commitUrl(FILTERED_URL);
        release();
        await settle();

        // The settled entry is plain: clean URL, filtered query, no claim fragment.
        expect(window.location.href).toBe(FILTERED_URL);
        expect(window.location.hash).toBe('');

        // Back goes to the unfiltered entry; the router (not swallowed) handles it.
        const routerSpy = vi.fn();
        window.addEventListener('popstate', routerSpy);
        window.history.back();
        await settle();
        window.removeEventListener('popstate', routerSpy);

        expect(window.location.href).toBe(PAGE_URL);
        expect(routerSpy).toHaveBeenCalledTimes(1);
    });

    it('a routed dialog does not adopt a listing URL commit', () => {
        acquireDialogHistoryEntry({ onPopped: vi.fn() });

        expect(commitUrl(FILTERED_URL)).toBe(false);
    });
});
