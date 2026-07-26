/**
 * @file Dialog.history-back.test.tsx
 * @description Regression tests for HOS-310 at the component seam: with a
 * dialog open, the system back button must close the dialog instead of
 * navigating away from the page.
 *
 * The router-level invariant (a claimed entry must never make ClientRouter
 * swap the document) is pinned in `test/lib/dialog-history.test.ts`, which can
 * drive a stand-in of the real router. Here the concern is the React contract:
 * claim on open, release on close, re-claim when the consumer vetoes.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogHeader } from '../../src/components/shared/ui/Dialog.client';
import {
    acquireDialogHistoryEntry,
    resetDialogHistoryForTests
} from '../../src/lib/dialog-history';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

const PAGE_URL = 'http://localhost:3000/es/cuenta/';

/**
 * Minimal stand-in for the router's `navigate()` on its hash fast path.
 * Injected through the shared stub because `vitest.config.ts` resolves
 * `astro:transitions/client` through an alias that `vi.mock` cannot intercept.
 * Without it the module refuses to claim and none of these tests mean anything.
 */
let routerIndex = 0;
function fakeNavigate(href: string, options?: unknown): void {
    const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
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

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

/**
 * Minimal harness mirroring how consumers drive the shared `Dialog`.
 *
 * `vetoClose` reproduces the shape used by `CreateEditCollectionModal`,
 * `MoveToCollectionModal` and `PlanChangeFlow`: an `onClose` that refuses
 * while work is in flight.
 */
function DialogHarness({
    onClosed,
    vetoClose = false
}: {
    readonly onClosed?: () => void;
    readonly vetoClose?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
            >
                open
            </button>
            <Dialog
                isOpen={isOpen}
                onClose={() => {
                    if (vetoClose) return;
                    setIsOpen(false);
                    onClosed?.();
                }}
                ariaLabel="test dialog"
            >
                <DialogHeader onClose={() => setIsOpen(false)}>Title</DialogHeader>
                <input aria-label="draft" />
            </Dialog>
        </>
    );
}

function nextPopState(): Promise<void> {
    return new Promise((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
    });
}

describe('Dialog — back button (HOS-310)', () => {
    // Warm the module's cached `navigate` once so claims are synchronous, as
    // they are in production where the warm-up runs at island hydration.
    beforeAll(async () => {
        __setNavigateImpl(fakeNavigate);
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
        await settle();
    });

    beforeEach(async () => {
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        await settle();
    });

    afterEach(() => {
        resetDialogHistoryForTests();
    });

    afterAll(() => {
        __setNavigateImpl(null);
        for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
            meta.remove();
        }
    });

    it('closes the dialog on back instead of leaving the page', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);

        await user.click(screen.getByRole('button', { name: 'open' }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(window.location.hash).toBe('#hospeda-dialog-1');

        const popped = nextPopState();
        window.history.back();
        await popped;

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(window.location.pathname).toBe('/es/cuenta/');
        expect(window.location.hash).toBe('');
    });

    it('leaves no leftover entry when the dialog is closed through its own UI', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);

        await user.click(screen.getByRole('button', { name: 'open' }));
        await screen.findByRole('dialog');

        const popped = nextPopState();
        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        await popped;

        // The claimed entry has been walked back, so one more back press
        // leaves the page — exactly as if the dialog had never opened.
        expect(window.location.hash).toBe('');
    });

    it('does not re-claim an entry on every re-render caused by an inline onClose', async () => {
        const user = userEvent.setup();
        render(<DialogHarness />);

        await user.click(screen.getByRole('button', { name: 'open' }));
        await screen.findByRole('dialog');
        const lengthWhileOpen = window.history.length;

        // Typing re-renders the consumer, handing `Dialog` a brand-new inline
        // `onClose` each time. If the effect depended on that identity it
        // would churn one history entry per keystroke.
        await user.type(screen.getByLabelText('draft'), 'hello');

        expect(window.history.length).toBe(lengthWhileOpen);
        expect(window.location.hash).toBe('#hospeda-dialog-1');
    });

    it('re-claims an entry when the consumer refuses to close', async () => {
        const user = userEvent.setup();
        render(<DialogHarness vetoClose />);

        await user.click(screen.getByRole('button', { name: 'open' }));
        await screen.findByRole('dialog');
        expect(window.location.hash).toBe('#hospeda-dialog-1');

        const popped = nextPopState();
        window.history.back();
        await popped;

        // The veto kept the dialog open. Without a replacement entry its back
        // protection would be silently gone and the NEXT press would leave the
        // page mid-operation.
        await waitFor(() => expect(window.location.hash).toBe('#hospeda-dialog-2'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the page mounted on back — the loss the back button used to cause', async () => {
        const user = userEvent.setup();
        const onClosed = vi.fn();
        render(<DialogHarness onClosed={onClosed} />);

        await user.click(screen.getByRole('button', { name: 'open' }));
        await screen.findByRole('dialog');
        await user.type(screen.getByLabelText('draft'), 'half-filled form');

        const popped = nextPopState();
        window.history.back();
        await popped;

        await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
        // The page itself was never navigated: the trigger is still mounted.
        expect(screen.getByRole('button', { name: 'open' })).toBeInTheDocument();
    });
});
