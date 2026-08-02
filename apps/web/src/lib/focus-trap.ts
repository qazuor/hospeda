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
 * True when nothing owns keyboard focus any more — the browser parked it on
 * `<body>`/`<html>` because the focused node was removed or disabled.
 *
 * This is deliberately NOT "focus is outside my container". Those two are very
 * different situations and conflating them is what turns a trap into a bug:
 * when focus sits on some other real element, that element OWNS it (a modal
 * opened on top, a global shortcut popped a panel), and stealing it back is
 * hostile. Only genuinely lost focus is up for grabs.
 */
function isFocusLost(): boolean {
    const active = document.activeElement;
    return active === null || active === document.body || active === document.documentElement;
}

/**
 * Traps keyboard focus within a container element while a modal-like surface
 * is open. Cycles focus between the first and last focusable descendants on
 * Tab/Shift+Tab, and recovers focus that was LOST while the surface was open.
 *
 * Recovering lost focus is not a nicety — it is what makes this an actual trap.
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
 * 2.4.3). Pulling focus back into the container closes that hole.
 *
 * CRITICAL — why recovery is gated on {@link isFocusLost} and not on
 * `!container.contains(activeElement)`: consumers register this on `document`
 * (see `Dialog.client.tsx` and `SearchBar.client.tsx`), so several traps can be
 * live at once. A global shortcut can stack a second overlay over any surface
 * at any time — `Ctrl+Shift+F` opens the feedback modal from `BaseLayout` on
 * every page, with no "a modal is already open" guard. With a containment
 * check, EVERY live trap would cancel EVERY Tab in the document and yank focus
 * back to its own first element, so the newly opened overlay becomes
 * unreachable by keyboard: a WCAG 2.1.2 keyboard trap, strictly worse than the
 * escape it was written to prevent. Reacting only to lost focus keeps each
 * trap out of the others' way, because at most one of them is missing focus.
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

    if (!container.contains(document.activeElement)) {
        // Someone else legitimately holds focus — leave them alone.
        if (!isFocusLost()) return;
        event.preventDefault();
        // Honour the direction of travel: Shift+Tab means "backwards", so
        // re-entering at `first` would send the user the way they did not ask
        // to go.
        (event.shiftKey ? last : first).focus();
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
