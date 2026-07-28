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
 * Tab/Shift+Tab.
 *
 * @param container - The element that should contain focus.
 * @param event     - The keydown event to handle.
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    if (event.key === 'Tab') {
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
}
