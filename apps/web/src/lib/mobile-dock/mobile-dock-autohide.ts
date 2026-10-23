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
