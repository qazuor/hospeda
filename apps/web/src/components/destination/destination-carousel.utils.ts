/**
 * Pure utility functions extracted from DestinationCarousel.astro inline script.
 * Enables unit testing of carousel logic without DOM dependencies.
 */

/** Input for calculating the active carousel index from scroll position */
interface CalculateActiveIndexInput {
    /** Current horizontal scroll position in pixels */
    readonly scrollLeft: number;
    /** Width of a single item including gap in pixels */
    readonly itemWidth: number;
    /** Total number of items in the carousel */
    readonly itemCount: number;
}

/** Result of active index calculation */
interface CalculateActiveIndexResult {
    /** The zero-based index of the currently active item */
    readonly activeIndex: number;
}

/**
 * Calculate which carousel item is currently active based on scroll position.
 * Uses Math.round for snap-point rounding and clamps to valid range.
 *
 * @param input - Scroll position, item width, and item count
 * @returns The clamped active index
 */
export function calculateActiveIndex({
    scrollLeft,
    itemWidth,
    itemCount
}: CalculateActiveIndexInput): CalculateActiveIndexResult {
    if (itemCount <= 0 || itemWidth <= 0) {
        return { activeIndex: 0 };
    }

    const rawIndex = Math.round(scrollLeft / itemWidth);
    const activeIndex = Math.max(0, Math.min(rawIndex, itemCount - 1));

    return { activeIndex };
}

/** Input for resolving the target index after a keyboard navigation event */
interface ResolveKeyboardNavigationInput {
    /** The keyboard key that was pressed */
    readonly key: string;
    /** The currently active item index */
    readonly currentIndex: number;
    /** Total number of items in the carousel */
    readonly itemCount: number;
}

/** Result of keyboard navigation resolution */
interface ResolveKeyboardNavigationResult {
    /** The target index to navigate to, or null if the key is not a navigation key */
    readonly targetIndex: number | null;
}

/**
 * Resolve the target carousel index for a given keyboard event.
 * Supports ArrowRight/Down (next), ArrowLeft/Up (prev), Home (first), End (last).
 * Returns null for non-navigation keys.
 *
 * @param input - The key pressed, current index, and item count
 * @returns The target index or null if the key is not handled
 */
export function resolveKeyboardNavigation({
    key,
    currentIndex,
    itemCount
}: ResolveKeyboardNavigationInput): ResolveKeyboardNavigationResult {
    if (itemCount <= 0) {
        return { targetIndex: null };
    }

    switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
            return { targetIndex: Math.min(currentIndex + 1, itemCount - 1) };
        case 'ArrowLeft':
        case 'ArrowUp':
            return { targetIndex: Math.max(currentIndex - 1, 0) };
        case 'Home':
            return { targetIndex: 0 };
        case 'End':
            return { targetIndex: itemCount - 1 };
        default:
            return { targetIndex: null };
    }
}
