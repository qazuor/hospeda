/**
 * @file Dialog.two-overlays.test.tsx
 * @description Regression coverage for the case that let HOS-350's defects
 * ship unnoticed: TWO modal-like surfaces open AT THE SAME TIME. Every
 * existing focus-trap suite in this repo exercises a single, isolated
 * modal — which is exactly where the boundary-only Tab bug (fixed earlier in
 * `@/lib/focus-trap`) and the "Escape closes both overlays at once" bug both
 * lived unexamined.
 *
 * The pairing is not theoretical: `Ctrl+Shift+F` opens the feedback modal
 * from `BaseLayout` on ANY page, and its shortcut hook
 * (`packages/feedback/src/hooks/useKeyboardShortcut.ts`) has no "a modal is
 * already open" guard — only an input/textarea/select focus check. So two
 * overlays stacked is reachable from every page in the app, not a contrived
 * edge case. Two real `Dialog` instances stand in for that pairing here,
 * since `Dialog` is the shared helper's own reference consumer and needs no
 * extra mocking to render.
 *
 * The Escape assertion exercises the REAL `dialog-history` stack (router
 * transitions enabled + a routed `navigate` stub), the same setup
 * `test/lib/dialog-history.test.ts` uses — a stubbed `isTopmost` would only
 * prove the component reads a prop correctly, not that the shared module-level
 * stack actually arbitrates two live claims.
 *
 * @module test/components/Dialog.two-overlays
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../src/components/shared/ui/Dialog.client';
import { resetDialogHistoryForTests } from '../../src/lib/dialog-history';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_URL = 'http://localhost:3000/es/alojamientos/casa/';

/** Stands in for the router's `navigate()`, same shape as dialog-history.test.ts. */
const routerMock = (() => {
    let index = 0;
    return {
        reset(): void {
            index = 0;
        },
        navigate(href: string, options?: unknown): void {
            const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
            index += 1;
            window.history.pushState({ ...state, index, scrollX: 0, scrollY: 0 }, '', href);
        }
    };
})();

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

/** Lets the module's effects, rAF focus moves, and any queued unwind settle. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

describe('two stacked modal-like overlays (HOS-350)', () => {
    beforeAll(async () => {
        __setNavigateImpl(routerMock.navigate);
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        await settle();
    });

    beforeEach(async () => {
        enableClientRouter();
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

    it('Escape closes only the TOPMOST of two stacked dialogs, not both', async () => {
        const onCloseOuter = vi.fn();
        const onCloseInner = vi.fn();

        // Outer opens first — mirrors the real sequence: a surface is
        // already open when the global shortcut stacks a second one on top.
        const { rerender } = render(
            <Dialog
                isOpen={true}
                onClose={onCloseOuter}
                ariaLabel="Outer"
            >
                <button type="button">outer action</button>
            </Dialog>
        );
        await settle();

        rerender(
            <>
                <Dialog
                    isOpen={true}
                    onClose={onCloseOuter}
                    ariaLabel="Outer"
                >
                    <button type="button">outer action</button>
                </Dialog>
                <Dialog
                    isOpen={true}
                    onClose={onCloseInner}
                    ariaLabel="Inner"
                >
                    <button type="button">inner action</button>
                </Dialog>
            </>
        );
        await settle();

        fireEvent.keyDown(document, { key: 'Escape' });

        // The bug this pins: without `isTopmost`, BOTH `onClose` callbacks
        // fire off a single Escape press, because both dialogs listen on
        // `document` independently.
        expect(onCloseInner).toHaveBeenCalledTimes(1);
        expect(onCloseOuter).not.toHaveBeenCalled();
    });

    it("does not steal the OTHER dialog's legitimately-held focus (each trap reacts only to its own lost focus)", async () => {
        render(
            <>
                <Dialog
                    isOpen={true}
                    onClose={vi.fn()}
                    ariaLabel="Outer"
                >
                    <button type="button">outer action</button>
                </Dialog>
                <Dialog
                    isOpen={true}
                    onClose={vi.fn()}
                    ariaLabel="Inner"
                >
                    <button type="button">inner action</button>
                </Dialog>
            </>
        );

        const inner = screen.getByRole('dialog', { name: 'Inner' });
        await waitFor(() => expect(inner).toHaveFocus());

        // Both dialogs' traps see this keydown (both listen on `document`).
        // Only a trap whose OWN focus was lost may act; the outer dialog's
        // trap must leave the inner one's legitimately-held focus alone.
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);

        expect(inner.contains(document.activeElement)).toBe(true);
    });
});
