import { MOBILE_DOCK_MEDIA_QUERY } from './mobile-dock-measure';

/** Minimum scroll position before downward movement may hide the dock. */
export const MOBILE_DOCK_HIDE_MIN_SCROLL_Y = 120 as const;
/** Minimum movement in CSS pixels required to change the hidden state. */
export const MOBILE_DOCK_SCROLL_DELTA = 8 as const;
/** Bottom-edge tolerance in CSS pixels for restoring the dock at page end. */
export const MOBILE_DOCK_BOTTOM_TOLERANCE = 2 as const;
/** Attribute applied to the dock while it is translated out of view. */
export const MOBILE_DOCK_HIDDEN_ATTR = 'data-dock-hidden' as const;

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
    // A selected comparison bar contains user choices that must stay in view.
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
 * matches. Focus and a visible comparison item keep the dock available; media
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

    const update = (): void => {
        frameId = null;
        if (cleanedUp || !media.matches) return;

        const currentY = win.scrollY;
        const aboveSlot = dock.querySelector<HTMLElement>('[data-mobile-dock-slot="above"]');
        const isPinned =
            aboveSlot !== null &&
            [...aboveSlot.querySelectorAll<HTMLElement>('[data-dock-item]')].some(
                (item) => item.getClientRects().length > 0
            );
        const result = resolveDockHidden({
            isHidden,
            previousY,
            currentY,
            viewportHeight: win.innerHeight,
            documentHeight: win.document.documentElement.scrollHeight,
            hasFocusWithin: dock.matches(':focus-within'),
            isPinned
        });

        isHidden = result.hidden;
        dock.toggleAttribute(MOBILE_DOCK_HIDDEN_ATTR, isHidden);
        previousY = currentY;
    };

    const onScroll = (): void => {
        if (cleanedUp || !media.matches || frameId !== null || !requestFrame) return;
        frameId = requestFrame(update);
    };

    const onFocusIn = (): void => {
        isHidden = false;
        dock.removeAttribute(MOBILE_DOCK_HIDDEN_ATTR);
    };

    const onMediaChange = (event: MediaQueryListEvent): void => {
        if (!event.matches) {
            isHidden = false;
            dock.removeAttribute(MOBILE_DOCK_HIDDEN_ATTR);
            if (frameId !== null) {
                cancelFrame?.(frameId);
                frameId = null;
            }
            return;
        }
        previousY = win.scrollY;
    };

    win.addEventListener('scroll', onScroll, { passive: true });
    dock.addEventListener('focusin', onFocusIn);
    media.addEventListener('change', onMediaChange);
    if (!media.matches) dock.removeAttribute(MOBILE_DOCK_HIDDEN_ATTR);

    return {
        cleanup: () => {
            cleanedUp = true;
            win.removeEventListener('scroll', onScroll);
            dock.removeEventListener('focusin', onFocusIn);
            media.removeEventListener('change', onMediaChange);
            if (frameId !== null) cancelFrame?.(frameId);
            frameId = null;
            isHidden = false;
            dock.removeAttribute(MOBILE_DOCK_HIDDEN_ATTR);
        }
    };
}
