/**
 * @file gallery-hydration-bridge.ts
 * @description The island's half of the pre-hydration tap bridge (owner smoke,
 * HOS-2520). Before the gallery island hydrates (2s on desktop, up to 12s on a slow
 * phone), a tap on a photo used to do nothing. The inline script in
 * `GalleryTapBridge.astro` now records that tap on the gallery root and shows a
 * spinner on the tapped photo; on mount, the island calls
 * {@link consumePendingGalleryTap} to open the lightbox at that photo once.
 *
 * The attribute names below are the contract with that script, which is a static
 * `is:inline` body and cannot import them. A unit test holds the two in sync.
 */

/** Marks the element that owns one gallery; pending state is keyed by it. */
export const GALLERY_ROOT_ATTR = 'data-gallery-root' as const;

/** Set by the island on mount: from then on the inline script ignores this root. */
export const GALLERY_HYDRATED_ATTR = 'data-gallery-hydrated' as const;

/** Photo index (0-based) of a pre-hydration tap, set on the root by the script. */
export const GALLERY_PENDING_ATTR = 'data-gallery-pending' as const;

/** Photo index a button opens; the script reads it to know what was tapped. */
export const GALLERY_INDEX_ATTR = 'data-gallery-index' as const;

/** Set by the script on the tapped button while the island loads (CSS spinner). */
export const GALLERY_LOADING_ATTR = 'data-gallery-loading' as const;

/** Time of the pre-hydration tap (`Date.now()` ms), set on the root by the script. */
export const GALLERY_PENDING_AT_ATTR = 'data-gallery-pending-at' as const;

/** `window.scrollY` (px) at the pre-hydration tap, set on the root by the script. */
export const GALLERY_PENDING_SCROLL_ATTR = 'data-gallery-pending-scroll' as const;

/** A tap older than this when the island hydrates is not replayed (ms). */
export const GALLERY_REPLAY_MAX_AGE_MS = 8000 as const;

/** A tap is not replayed once the page scrolled more than this since it (px). */
export const GALLERY_REPLAY_MAX_SCROLL_PX = 200 as const;

/**
 * After this long without hydration the inline script clears the spinner and the
 * pending tap on its own (a dead island, HOS-2578). Mirrored in the script (ms).
 */
export const GALLERY_LOADING_TIMEOUT_MS = 15000 as const;

/** Input of {@link consumePendingGalleryTap}. */
export interface ConsumePendingGalleryTapInput {
    /** The gallery root rendered by the island. */
    readonly root: HTMLElement;
    /** Number of photos, to reject an index that no longer exists. */
    readonly count: number;
    /** Current time in ms; defaults to `Date.now()`. */
    readonly now?: number;
    /** Current scroll offset in px; defaults to `window.scrollY`. */
    readonly scrollY?: number;
}

/** Reads a non-negative integer attribute, or `null` when absent or malformed. */
function readIntAttr({ root, name }: { readonly root: HTMLElement; readonly name: string }): {
    readonly value: number | null;
} {
    const raw = root.getAttribute(name);
    return { value: raw !== null && /^\d+$/.test(raw) ? Number(raw) : null };
}

/**
 * Marks the root hydrated, then reads and clears the pending tap and the loading
 * state the inline script left. Runs once per mount; a second call finds nothing.
 *
 * A tap is replayed only while it is still what the visitor wants: made at most
 * {@link GALLERY_REPLAY_MAX_AGE_MS} ago, with the page scrolled at most
 * {@link GALLERY_REPLAY_MAX_SCROLL_PX} since. Otherwise (or without a recorded time
 * and scroll) it is discarded and only the loading state is cleared: opening a
 * lightbox over content the visitor has moved on to would be worse than nothing.
 *
 * @param input - The gallery root, the photo count and optional clock/scroll reads.
 * @returns `{ index }` of the photo to open, or `null` when there is nothing to replay.
 */
export function consumePendingGalleryTap({
    root,
    count,
    now = Date.now(),
    scrollY = typeof window === 'undefined' ? 0 : window.scrollY
}: ConsumePendingGalleryTapInput): {
    readonly index: number | null;
} {
    root.setAttribute(GALLERY_HYDRATED_ATTR, '');
    const { value: index } = readIntAttr({ root, name: GALLERY_PENDING_ATTR });
    const { value: at } = readIntAttr({ root, name: GALLERY_PENDING_AT_ATTR });
    const { value: tapScroll } = readIntAttr({ root, name: GALLERY_PENDING_SCROLL_ATTR });
    for (const name of [
        GALLERY_PENDING_ATTR,
        GALLERY_PENDING_AT_ATTR,
        GALLERY_PENDING_SCROLL_ATTR
    ]) {
        root.removeAttribute(name);
    }
    for (const button of Array.from(root.querySelectorAll(`[${GALLERY_LOADING_ATTR}]`))) {
        button.removeAttribute(GALLERY_LOADING_ATTR);
        button.removeAttribute('aria-busy');
    }
    if (index === null || at === null || tapScroll === null || index >= count) {
        return { index: null };
    }
    const age = now - at;
    if (age < 0 || age > GALLERY_REPLAY_MAX_AGE_MS) return { index: null };
    if (Math.abs(scrollY - tapScroll) > GALLERY_REPLAY_MAX_SCROLL_PX) return { index: null };
    return { index };
}

/**
 * The URL of a photo the page has ALREADY painted (a mosaic cell or a mobile slide),
 * for the lightbox to show at once while its full-size image loads. Only an image
 * that finished loading with real pixels qualifies; a cell hidden by a media query
 * (its `<picture>` has no matching source) has `naturalWidth === 0` and is skipped.
 *
 * @param input - The gallery root and the photo index.
 * @returns `{ src }` (the browser's chosen candidate), or `undefined` when none is loaded.
 */
export function findLoadedCellSrc({
    root,
    index
}: {
    readonly root: HTMLElement;
    readonly index: number;
}): { readonly src: string | undefined } {
    for (const trigger of Array.from(root.querySelectorAll(`[${GALLERY_INDEX_ATTR}="${index}"]`))) {
        // The "+N" overlay button holds no <img>: the photo behind it is the
        // previous one, not the one it opens, so it never lends a placeholder.
        const img = trigger.querySelector('img');
        if (!img?.complete || img.naturalWidth === 0) continue;
        const src = img.currentSrc || img.src;
        if (src) return { src };
    }
    return { src: undefined };
}
