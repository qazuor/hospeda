/**
 * @file MobileDrawer.focus-trap.test.tsx
 * @description Regression tests for `MobileDrawer`'s focus trap (HOS-350).
 *
 * `MobileDrawer` used to carry its own private copy of the focusable-selector
 * list and Tab-cycling loop, bound to the PANEL element rather than
 * `document`. That was worse than the boundary-only bug the shared
 * `@/lib/focus-trap` helper already fixed elsewhere: once focus fell out to
 * `<body>` (a disabled control, a tap on non-focusable panel background), a
 * panel-scoped `keydown` listener never even runs, because `<body>` is not a
 * descendant of the panel. Migrating to the shared `trapFocus` (bound to
 * `document`, like every other consumer) fixes both defects at once.
 *
 * These assertions read `defaultPrevented` on a real cancelable
 * `KeyboardEvent` rather than watching `document.activeElement`: jsdom never
 * moves focus on Tab, so "focus stayed put" cannot tell an engaged trap from
 * a no-op.
 *
 * @module test/components/shared/filters/MobileDrawer.focus-trap
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileDrawer } from '../../../../src/components/shared/filters/components/MobileDrawer';
import { FOCUSABLE_SELECTORS } from '../../../../src/lib/focus-trap';

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

function renderOpenDrawer() {
    render(
        <>
            <button type="button">page control behind the overlay</button>
            <MobileDrawer
                isOpen={true}
                onClose={() => undefined}
                ariaLabel="Filtros"
            >
                <button type="button">first action</button>
                <button type="button">second action</button>
            </MobileDrawer>
        </>
    );
}

describe('MobileDrawer focus trap (HOS-350 — migrated to shared helper)', () => {
    it('prevents Tab and pulls focus back in when focus has escaped to <body>', async () => {
        renderOpenDrawer();

        const dialog = screen.getByRole('dialog', { hidden: true });
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
        await waitFor(() => expect(document.activeElement).toBe(focusables[0]));

        // The state a disabled-on-click button or a tap on dead space leaves
        // behind. The old private copy did not react at all here — its
        // listener was bound to the panel, and <body> is outside it.
        (document.activeElement as HTMLElement).blur();
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('still cycles Tab between the first and last focusable', async () => {
        renderOpenDrawer();

        const dialog = screen.getByRole('dialog', { hidden: true });
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
        expect(focusables.length).toBeGreaterThan(1);
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        await waitFor(() => expect(document.activeElement).toBe(first));

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
