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

/** Input of {@link consumePendingGalleryTap}. */
export interface ConsumePendingGalleryTapInput {
    /** The gallery root rendered by the island. */
    readonly root: HTMLElement;
    /** Number of photos, to reject an index that no longer exists. */
    readonly count: number;
}

/**
 * Marks the root hydrated, then reads and clears the pending tap and the loading
 * state the inline script left. Runs once per mount; a second call finds nothing.
 *
 * @param input - The gallery root and the photo count.
 * @returns `{ index }` of the photo to open, or `null` when there was no valid tap.
 */
export function consumePendingGalleryTap({ root, count }: ConsumePendingGalleryTapInput): {
    readonly index: number | null;
} {
    root.setAttribute(GALLERY_HYDRATED_ATTR, '');
    const raw = root.getAttribute(GALLERY_PENDING_ATTR);
    root.removeAttribute(GALLERY_PENDING_ATTR);
    for (const button of Array.from(root.querySelectorAll(`[${GALLERY_LOADING_ATTR}]`))) {
        button.removeAttribute(GALLERY_LOADING_ATTR);
        button.removeAttribute('aria-busy');
    }
    if (raw === null || !/^\d+$/.test(raw)) return { index: null };
    const index = Number(raw);
    return { index: index < count ? index : null };
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
