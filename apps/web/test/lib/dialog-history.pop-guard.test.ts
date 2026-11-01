/**
 * @file dialog-history.pop-guard.test.ts
 * @description HOS-1927. The router's `popstate` listener is registered BEFORE
 * `dialog-history` loads, and on `window` Chromium fires listeners in
 * registration order (a capture flag does not reorder them). The raw claim must
 * therefore be kept from the router by a listener that registered first: the
 * inline guard from `BaseLayout`. The older raw-claim tests register their fake
 * router AFTER the module, which is the one order where the bug cannot show.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DIALOG_POP_GUARD_SNIPPET,
    POP_GUARD_KEY
} from '../../src/lib/dialog-history.pop-guard.snippet';

const PAGE_URL = 'http://localhost:3000/es/alojamientos/';
const FILTERED_URL = `${PAGE_URL}?destinationIds=a%2Cb`;
const BASE_LAYOUT_SOURCE = readFileSync(
    resolve(__dirname, '../../src/layouts/BaseLayout.astro'),
    'utf8'
);

let dialogHistory: typeof import('../../src/lib/dialog-history');

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

/** Runs the inline snippet exactly as the browser would, once per realm. */
function installGuard(): void {
    if ((window as unknown as Record<string, unknown>)[POP_GUARD_KEY]) return;
    new Function(DIALOG_POP_GUARD_SNIPPET)();
}

describe('dialog-history pop guard (HOS-1927)', () => {
    const routerPopState = vi.fn();

    beforeEach(async () => {
        vi.resetModules();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        // Page-load order: guard (inline, in <head>) first, router next, and only
        // then, on first open, the module under test.
        installGuard();
        routerPopState.mockClear();
        window.addEventListener('popstate', routerPopState);
        dialogHistory = await import('../../src/lib/dialog-history');
        await settle();
    });

    afterEach(async () => {
        window.removeEventListener('popstate', routerPopState);
        dialogHistory.resetDialogHistoryForTests();
        await settle();
    });

    it('keeps the router from seeing Back after the listing rewrote the claimed URL', async () => {
        const onPopped = vi.fn();
        dialogHistory.acquireDialogHistoryEntry({ onPopped, tolerateRouterDrift: true });
        window.dispatchEvent(
            new CustomEvent(dialogHistory.LISTING_URL_COMMIT_EVENT, {
                cancelable: true,
                detail: { url: FILTERED_URL }
            })
        );

        window.history.back();
        await settle();

        expect(onPopped).toHaveBeenCalledTimes(1);
        expect(routerPopState).not.toHaveBeenCalled();
        expect(window.location.href).toBe(FILTERED_URL);
    });

    it('delegates to the early guard instead of registering a capture listener', () => {
        // jsdom (unlike Chromium) fires capture listeners first on `window`, so the
        // behavioural test above cannot tell the two mechanisms apart. This one
        // pins the mechanism: the order-proof guard must be the one in use.
        const addSpy = vi.spyOn(window, 'addEventListener');

        dialogHistory.acquireDialogHistoryEntry({ onPopped: vi.fn(), tolerateRouterDrift: true });

        const capturePopstate = addSpy.mock.calls.filter(
            ([type, , options]) => type === 'popstate' && options === true
        );
        expect(capturePopstate).toHaveLength(0);
        const guard = (window as unknown as Record<string, { handler: unknown }>)[POP_GUARD_KEY];
        expect(typeof guard?.handler).toBe('function');
        addSpy.mockRestore();
    });

    it('includes the inline pop guard before Astro ClientRouter', () => {
        const guardScript =
            /^[\t ]*<script\s+is:inline\s+set:html=\{DIALOG_POP_GUARD_SNIPPET\}\s*\/>/m;
        const clientRouter = /^[\t ]*<ClientRouter\s*\/>/m;
        const guardMatch = guardScript.exec(BASE_LAYOUT_SOURCE);
        const routerMatch = clientRouter.exec(BASE_LAYOUT_SOURCE);

        expect(guardMatch).not.toBeNull();
        expect(routerMatch).not.toBeNull();
        expect(guardMatch!.index).toBeLessThan(routerMatch!.index);
    });

    it('lets the router see an ordinary traversal when no claim is involved', async () => {
        window.history.pushState({ index: 1, scrollX: 0, scrollY: 0 }, '', `${PAGE_URL}?x=1`);

        window.history.back();
        await settle();

        expect(routerPopState).toHaveBeenCalledTimes(1);
    });
});
