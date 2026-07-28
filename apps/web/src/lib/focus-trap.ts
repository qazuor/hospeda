/**
 * @file focus-trap.ts
 * @description Shared keyboard focus-trap primitives for modal-like surfaces
 * (dialogs, bottom-sheets, drawers). Single source of truth — consumers import
 * from here instead of re-implementing the selector list or the Tab cycling.
 */

/**
 * CSS selector that matches all keyboard-focusable elements.
 * Used to enumerate the focus ring of a modal-like container.
 */
export const FOCUSABLE_SELECTORS =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container element while a modal-like surface
 * is open. Cycles focus between the first and last focusable descendants on
 * Tab/Shift+Tab, and pulls focus back in whenever it has escaped the container
 * entirely.
 *
 * The "escaped" branch is not a nicety — it is what makes this an actual trap.
 * Cycling only on `first`/`last` leaves Tab unprevented from every other
 * position, and focus reaches those other positions routinely:
 *
 *   - The focused control becomes `disabled` (a stepper hitting its bound, a
 *     button that turns into a spinner). Per the HTML spec the browser then
 *     runs the unfocusing steps and `document.activeElement` falls back to
 *     `<body>` — outside the container, matching neither `first` nor `last`.
 *   - The user taps a non-focusable part of the surface (a panel background
 *     with no `tabindex`), which also lands focus on `<body>`.
 *
 * From `<body>` an unprevented Tab advances to the first focusable element in
 * the DOCUMENT, i.e. page content sitting behind an opaque backdrop (WCAG
 * 2.4.3). Pulling focus back to the container's first focusable closes that
 * hole.
 *
 * When the container holds no focusable descendants nothing is prevented:
 * trapping Tab with nowhere to send it would be a real keyboard trap.
 *
 * @param container - The element that should contain focus.
 * @param event     - The keydown event to handle.
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    // Focus is no longer inside the trapped subtree (disabled control, tap on
    // a non-focusable background, …). Anywhere but `first`/`last`, so the
    // cycling branches below would let the Tab through to the page behind.
    if (!container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
    }

    if (event.shiftKey) {
        if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
    } else {
        if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
}
