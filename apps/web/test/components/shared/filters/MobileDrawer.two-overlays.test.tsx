/**
 * @file MobileDrawer.two-overlays.test.tsx
 * @description Regression coverage for the gap `Dialog.two-overlays.test.tsx`
 * does not cover: `MobileDrawer` (the mobile filters drawer) stacked under
 * another overlay (HOS-350).
 *
 * `MobileDrawer` never claims a browser-history entry — the listing page it
 * sits over rewrites its own URL on every filter tap, which would bury any
 * entry the drawer might claim (see `useIsTopmostOverlay`'s module doc). The
 * `isTopmost` signal `Dialog`/`AiChatWidget`/`AiSearchEntry` rely on used to
 * be computed from that same browser-history stack, so a drawer that can
 * never appear in it was invisible to arbitration: with the drawer open and
 * another overlay stacked on top, a single Escape press closed BOTH. This
 * pins the fix — a presence-only registry independent of history claiming —
 * against the real `dialog-history` module, the same way
 * `Dialog.two-overlays.test.tsx` does for two `Dialog` instances.
 *
 * @module test/components/shared/filters/MobileDrawer.two-overlays
 */

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileDrawer } from '../../../../src/components/shared/filters/components/MobileDrawer';
import { Dialog } from '../../../../src/components/shared/ui/Dialog.client';
import { resetDialogHistoryForTests } from '../../../../src/lib/dialog-history';

/** Lets the registration effects and rAF focus moves settle. */
function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

describe('MobileDrawer stacked under another overlay (HOS-350)', () => {
    beforeEach(() => {
        resetDialogHistoryForTests();
    });

    afterEach(() => {
        resetDialogHistoryForTests();
    });

    it('Escape closes only the Dialog opened on top, leaving the drawer open', async () => {
        const onCloseDrawer = vi.fn();
        const onCloseDialog = vi.fn();

        // The drawer opens first — mirrors the real sequence: a user opens
        // the filters drawer, then a global shortcut (e.g. Ctrl+Shift+F for
        // the feedback modal) stacks a second overlay on top.
        const { rerender } = render(
            <MobileDrawer
                isOpen={true}
                onClose={onCloseDrawer}
                ariaLabel="Filtros"
            >
                <button type="button">drawer action</button>
            </MobileDrawer>
        );
        await settle();

        rerender(
            <>
                <MobileDrawer
                    isOpen={true}
                    onClose={onCloseDrawer}
                    ariaLabel="Filtros"
                >
                    <button type="button">drawer action</button>
                </MobileDrawer>
                <Dialog
                    isOpen={true}
                    onClose={onCloseDialog}
                    ariaLabel="Overlay"
                >
                    <button type="button">overlay action</button>
                </Dialog>
            </>
        );
        await settle();

        fireEvent.keyDown(document, { key: 'Escape' });

        // The bug this pins: without arbitration, the drawer's own Escape
        // listener has no way to know a second overlay exists on top of it,
        // because the drawer can never appear in the browser-history stack
        // the old `isTopmost` was computed from.
        expect(onCloseDialog).toHaveBeenCalledTimes(1);
        expect(onCloseDrawer).not.toHaveBeenCalled();
    });

    it('Escape closes the drawer again once the overlay above it goes away', async () => {
        const onCloseDrawer = vi.fn();
        const onCloseDialog = vi.fn();

        const { rerender } = render(
            <>
                <MobileDrawer
                    isOpen={true}
                    onClose={onCloseDrawer}
                    ariaLabel="Filtros"
                >
                    <button type="button">drawer action</button>
                </MobileDrawer>
                <Dialog
                    isOpen={true}
                    onClose={onCloseDialog}
                    ariaLabel="Overlay"
                >
                    <button type="button">overlay action</button>
                </Dialog>
            </>
        );
        await settle();

        // The overlay closes on its own terms (not via Escape) — unmounting
        // it here stands in for its own `onClose` having flipped its `isOpen`
        // prop. The drawer's registration must not linger behind, or it would
        // never regain topmost status.
        rerender(
            <MobileDrawer
                isOpen={true}
                onClose={onCloseDrawer}
                ariaLabel="Filtros"
            >
                <button type="button">drawer action</button>
            </MobileDrawer>
        );
        await settle();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onCloseDrawer).toHaveBeenCalledTimes(1);
    });
});
