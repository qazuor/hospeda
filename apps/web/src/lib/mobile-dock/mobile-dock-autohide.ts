import { MOBILE_DOCK_MEDIA_QUERY } from './mobile-dock-measure';

/** Minimum scroll position before downward movement may hide the dock. */
export const MOBILE_DOCK_HIDE_MIN_SCROLL_Y = 120 as const;
/** Minimum movement in CSS pixels required to change the hidden state. */
export const MOBILE_DOCK_SCROLL_DELTA = 8 as const;
/** Bottom-edge tolerance in CSS pixels for restoring the dock at page end. */
export const MOBILE_DOCK_BOTTOM_TOLERANCE = 2 as const;
/** Attribute applied to the dock while it is translated out of view. */
export const MOBILE_DOCK_HIDDEN_ATTR = 'data-dock-hidden' as const;

const CONTACT_PIN_SELECTOR = '[data-mobile-dock-slot="contact"] [data-dock-item]';
const SCROLL_PIN_SELECTOR = `[data-mobile-dock-slot="above"] [data-dock-item], ${CONTACT_PIN_SELECTOR}`;

/** Inputs used to decide whether scroll movement should hide the dock. */
export interface ResolveDockHiddenInput {
    readonly isHidden: boolean;
    readonly previousY: number;
    readonly currentY: number;
    readonly viewportHeight: number;
    readonly documentHeight: number;
    readonly hasFocusWithin: boolean;
    readonly isPinned: boolean;
}

/** Hidden state resolved from the current scroll and dock interaction context. */
export interface ResolveDockHiddenResult {
    readonly hidden: boolean;
}

/**
 * Resolves the dock visibility without reading or changing browser state.
 * Focus keeps keyboard and assistive-technology controls on screen; a pinned
 * comparison selection stays visible; the top and page end restore access to
 * navigation controls. Small movements preserve state to filter iOS bounce,
 * while larger downward and upward movements hide and reveal the dock.
 */
export function resolveDockHidden({
    isHidden,
    previousY,
    currentY,
    viewportHeight,
    documentHeight,
    hasFocusWithin,
    isPinned
}: ResolveDockHiddenInput): ResolveDockHiddenResult {
    // Focused controls must remain visible for keyboard and screen-reader users.
    if (hasFocusWithin) return { hidden: false };
    // Comparison selections and listing contact controls must stay in view.
    if (isPinned) return { hidden: false };
    // Keep navigation available near the top of the page.
    if (currentY <= MOBILE_DOCK_HIDE_MIN_SCROLL_Y) return { hidden: false };
    // Restore pagination and the return-to-top control at the page end.
    if (currentY + viewportHeight >= documentHeight - MOBILE_DOCK_BOTTOM_TOLERANCE) {
        return { hidden: false };
    }
    // Ignore tiny movements so inertial bounce does not flash the dock.
    if (Math.abs(currentY - previousY) < MOBILE_DOCK_SCROLL_DELTA) {
        return { hidden: isHidden };
    }
    // Hide while moving down and reveal while moving up.
    return { hidden: currentY > previousY };
}

/** Dependencies for attaching mobile scroll handling to a dock element. */
export interface InitDockAutoHideOptions {
    readonly dock: HTMLElement;
    readonly win: Window;
    readonly matchMedia: (query: string) => MediaQueryList;
}

/** Cleanup operation returned by the dock auto-hide initializer. */
export interface DockAutoHideCleanup {
    readonly cleanup: () => void;
}

/**
 * Attaches passive, frame-batched scroll handling while the mobile breakpoint
 * matches. Focus and visible comparison or contact items keep the dock available; media
 * changes clear stale hidden state and reset the scroll baseline on return.
 */
export function initDockAutoHide({
    dock,
    win,
    matchMedia
}: InitDockAutoHideOptions): DockAutoHideCleanup {
    const media = matchMedia(MOBILE_DOCK_MEDIA_QUERY);
    const requestFrame =
        typeof win.requestAnimationFrame === 'function'
            ? win.requestAnimationFrame.bind(win)
            : null;
    const cancelFrame =
        typeof win.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame.bind(win) : null;
    let previousY = win.scrollY;
    let frameId: number | null = null;
    let isHidden = dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR);
    let cleanedUp = false;

    const hasVisiblePin = (selector: string): boolean => {
        const pinItems = dock.querySelectorAll<HTMLElement>(selector);
        return Array.from(pinItems).some((item) => item.getClientRects().length > 0);
    };

    const update = (): void => {
        frameId = null;
        if (cleanedUp || !media.matches) return;

        const currentY = win.scrollY;
        const result = resolveDockHidden({
            isHidden,
            previousY,
            currentY,
            viewportHeight: win.innerHeight,
            documentHeight: win.document.documentElement.scrollHeight,
            hasFocusWithin: dock.matches(':focus-within'),
            isPinned: hasVisiblePin(SCROLL_PIN_SELECTOR)
        });

        isHidden = result.hidden;
        dock.toggleAttribute(MOBILE_DOCK_HIDDEN_ATTR, isHidden);
        previousY = currentY;
    };

    const onScroll = (): void => {
        if (cleanedUp || !media.matches || frameId !== null || !requestFrame) return;
        frameId = requestFrame(update);
    };

    const reveal = (): void => {
        isHidden = false;
        dock.removeAttribute(MOBILE_DOCK_HIDDEN_ATTR);
    };

    // Reveal for late contact changes without changing comparison's scroll-only behavior.
    const reconcileContactPin = (): void => {
        if (media.matches && isHidden && hasVisiblePin(CONTACT_PIN_SELECTOR)) reveal();
    };
    const observer =
        typeof MutationObserver === 'undefined' ? null : new MutationObserver(reconcileContactPin);
    observer?.observe(dock, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style', 'data-dock-item']
    });

    const onMediaChange = (event: MediaQueryListEvent): void => {
        if (!event.matches) {
            reveal();
            if (frameId !== null) {
                cancelFrame?.(frameId);
                frameId = null;
            }
            return;
        }
        previousY = win.scrollY;
    };

    win.addEventListener('scroll', onScroll, { passive: true });
    dock.addEventListener('focusin', reveal);
    media.addEventListener('change', onMediaChange);
    if (media.matches) reconcileContactPin();
    else reveal();

    return {
        cleanup: () => {
            cleanedUp = true;
            win.removeEventListener('scroll', onScroll);
            dock.removeEventListener('focusin', reveal);
            media.removeEventListener('change', onMediaChange);
            observer?.disconnect();
            if (frameId !== null) cancelFrame?.(frameId);
            frameId = null;
            reveal();
        }
    };
}
