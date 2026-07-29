/**
 * @file Dialog.focus-trap.test.tsx
 * @description Regression tests for the shared `Dialog`'s focus trap.
 *
 * `Dialog.client.tsx` used to carry its own byte-equivalent copy of
 * `FOCUSABLE_SELECTORS` + `trapFocus`, so the "single source of truth" in
 * `@/lib/focus-trap` was a claim the codebase did not honour — and the copy
 * carried the same hole: Tab was only ever prevented when
 * `document.activeElement` was exactly the first or last focusable. From
 * anywhere else, notably `<body>`, Tab walked out of the modal and into the
 * page underneath the overlay (WCAG 2.4.3).
 *
 * These assertions read `defaultPrevented` on a real cancelable `KeyboardEvent`
 * rather than watching `document.activeElement`: jsdom never moves focus on
 * Tab, so "focus stayed put" cannot tell an engaged trap from a no-op.
 *
 * @module test/components/Dialog.focus-trap
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, DialogBody, DialogHeader } from '../../src/components/shared/ui/Dialog.client';
import { FOCUSABLE_SELECTORS } from '../../src/lib/focus-trap';

/** Dispatches a real cancelable Tab keydown on `document`. */
function dispatchTab(options: { readonly shiftKey?: boolean } = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        shiftKey: options.shiftKey ?? false,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(event);
    return event;
}

function renderOpenDialog() {
    const onClose = vi.fn();
    render(
        <>
            <button type="button">page control behind the overlay</button>
            <Dialog
                isOpen={true}
                onClose={onClose}
                ariaLabel="Test dialog"
            >
                <DialogHeader onClose={onClose}>Title</DialogHeader>
                <DialogBody>
                    <button type="button">first action</button>
                    <button type="button">second action</button>
                </DialogBody>
            </Dialog>
        </>
    );
    return { onClose };
}

describe('Dialog focus trap', () => {
    it('prevents Tab and pulls focus back in when focus has escaped to <body>', async () => {
        renderOpenDialog();

        const panel = screen.getByRole('dialog', { name: 'Test dialog' });
        await waitFor(() => expect(panel).toHaveFocus());

        // The state a disabled-on-click button or a tap on dead space leaves
        // behind. The old copy did not prevent Tab here, so the browser moved
        // focus to the page control rendered outside the dialog.
        (document.activeElement as HTMLElement).blur();
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(panel.contains(document.activeElement)).toBe(true);
    });

    it('still cycles Tab between the first and last focusable', async () => {
        renderOpenDialog();

        const panel = screen.getByRole('dialog', { name: 'Test dialog' });
        await waitFor(() => expect(panel).toHaveFocus());

        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
        expect(focusables.length).toBeGreaterThan(1);
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        last.focus();
        const forward = dispatchTab();
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(first);

        first.focus();
        const backward = dispatchTab({ shiftKey: true });
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);
    });
});
