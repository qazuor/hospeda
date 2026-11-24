/** Media query that defines when the mobile dock participates in layout. */
export const MOBILE_DOCK_MEDIA_QUERY = '(max-width: 767px)' as const;

/** Root custom property used to reserve space for the measured mobile dock. */
export const MOBILE_DOCK_HEIGHT_VAR = '--mobile-dock-height' as const;

/** Input used to resolve the dock's occupied height. */
export interface ResolveDockHeightInput {
    readonly isMobile: boolean;
    readonly hasVisibleItem: boolean;
    readonly measuredHeight: number;
}

/** Resolved height in CSS pixels; desktop and empty docks reserve no space. */
export interface ResolveDockHeightResult {
    readonly heightPx: number;
}

/**
 * Returns a non-negative integer height only when a visible dock item exists
 * on a mobile viewport. Rounding up prevents fractional CSS pixels from
 * leaving a sliver of content under the fixed dock.
 */
export function resolveDockHeight({
    isMobile,
    hasVisibleItem,
    measuredHeight
}: ResolveDockHeightInput): ResolveDockHeightResult {
    if (!isMobile || !hasVisibleItem) return { heightPx: 0 };
    return { heightPx: Math.ceil(Math.max(0, measuredHeight)) };
}

/** Arguments for attaching the observers that publish mobile dock height. */
export interface InitMobileDockOptions {
    readonly dock: HTMLElement;
    readonly root: HTMLElement;
    readonly matchMedia: (query: string) => MediaQueryList;
}

/** Cleanup handle for a measured dock. */
export interface MobileDockCleanup {
    readonly cleanup: () => void;
}

/**
 * Measures visible dock items and publishes the reserved height on the root.
 * Resize, subtree changes, and breakpoint changes all re-run the same update.
 */
export function initMobileDock({
    dock,
    root,
    matchMedia
}: InitMobileDockOptions): MobileDockCleanup {
    const media = matchMedia(MOBILE_DOCK_MEDIA_QUERY);
    const update = (): void => {
        const allItems = [...dock.querySelectorAll<HTMLElement>('[data-dock-item]')];
        const row = dock.querySelector<HTMLElement>('.mobile-dock__row');
        const rowItems = row ? [...row.querySelectorAll<HTMLElement>('[data-dock-item]')] : [];
        const hasVisibleItem = allItems.some((item) => item.getClientRects().length > 0);
        const rowHasVisibleItem = rowItems.some((item) => item.getClientRects().length > 0);
        const { heightPx } = resolveDockHeight({
            isMobile: media.matches,
            hasVisibleItem,
            measuredHeight: dock.getBoundingClientRect().height
        });

        dock.toggleAttribute('data-empty', !hasVisibleItem);
        dock.toggleAttribute('data-row-empty', !rowHasVisibleItem);
        root.style.setProperty(MOBILE_DOCK_HEIGHT_VAR, `${heightPx}px`);
    };

    const resizeObserver =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resizeObserver?.observe(dock);
    const mutationObserver =
        typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
    mutationObserver?.observe(dock, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'hidden']
    });
    media.addEventListener('change', update);
    update();

    return {
        cleanup: () => {
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            media.removeEventListener('change', update);
            root.style.removeProperty(MOBILE_DOCK_HEIGHT_VAR);
        }
    };
}
