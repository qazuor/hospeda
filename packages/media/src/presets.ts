/**
 * Named transform presets for Cloudinary URL building.
 *
 * Each preset maps to a Cloudinary transform string that is inserted
 * between `/upload/` and the version/path segment in the URL.
 *
 * All presets include:
 *   - `q_auto`   automatic quality (compression/encoder selection).
 *   - `f_auto`   automatic format (WebP/AVIF when supported by the browser).
 *   - `dpr_auto` automatic device-pixel-ratio handling so Retina/HiDPI
 *                screens receive 2x or 3x resolution variants without the
 *                caller having to encode the DPR into the URL itself
 *                (SPEC-078-GAPS GAP-078-133).
 *
 * @example
 * ```ts
 * import { MEDIA_PRESETS } from '@repo/media';
 *
 * const transform = MEDIA_PRESETS.card;
 * // 'w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto'
 *
 * const url = `https://res.cloudinary.com/demo/image/upload/${transform}/sample.jpg`;
 * ```
 */
export const MEDIA_PRESETS = Object.freeze({
    /** 200x200 thumbnail with automatic gravity, cropping, and DPR. */
    thumbnail: 'w_200,h_200,c_thumb,g_auto,q_auto,f_auto,dpr_auto',
    /** 400x300 card image with fill crop, automatic gravity, and DPR. */
    card: 'w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto',
    /** 1200x600 hero banner with fill crop, automatic gravity, and DPR. */
    hero: 'w_1200,h_600,c_fill,g_auto,q_auto,f_auto,dpr_auto',
    /** 800px-wide gallery image, no height constraint, with automatic DPR. */
    gallery: 'w_800,q_auto,f_auto,dpr_auto',
    /** 150x150 avatar with face-detection gravity and automatic DPR. */
    avatar: 'w_150,h_150,c_thumb,g_face,q_auto,f_auto,dpr_auto',
    /** Original dimensions with automatic quality, format, and DPR. */
    full: 'q_auto,f_auto,dpr_auto',
    /** 1200x630 Open Graph image (Facebook/Twitter card standard) with automatic DPR. */
    og: 'w_1200,h_630,c_fill,q_auto,f_auto,dpr_auto',
    /**
     * Gallery featured / cover cell — 16:10 aspect ratio at 1000px wide.
     *
     * Used for the primary (largest) cell in both the `detail` variant
     * (featured image) and the `cover-plus-grid` variant (cover cell).
     * `c_fill` + `g_auto` ensures the CDN crops to the cell's fixed ratio
     * so no client-side crop is needed and CLS is eliminated.
     *
     * `srcset` width candidates: 640 / 1000 / 1400 (override via `width` option).
     *
     * @see SPEC-186 §7
     */
    galleryFeatured: 'w_1000,ar_16:10,c_fill,g_auto,q_auto,f_auto,dpr_auto',
    /**
     * Gallery half-width cell — 4:3 aspect ratio at 640px wide.
     *
     * Used for cells that span half the row in the `detail` (2-image layout)
     * and `cover-plus-grid` (2–3 extras) variants, and for every cell in the
     * `/fotos` all-photos sub-page.
     * `c_fill` + `g_auto` delivers a server-side crop matching the 4:3 ratio.
     *
     * `srcset` width candidates: 400 / 640 / 900 (override via `width` option).
     *
     * @see SPEC-186 §7
     */
    galleryHalf: 'w_640,ar_4:3,c_fill,g_auto,q_auto,f_auto,dpr_auto',
    /**
     * Gallery quarter / small-thumbnail cell — 1:1 aspect ratio at 400px wide.
     *
     * Used for cells in the thumbnail column (3/4/5+ image `detail` variant)
     * and the extras row (4/5+ image `cover-plus-grid` variant), including
     * the `+N más` overlay trigger cell.
     * Square crop via `c_fill` + `g_auto`.
     *
     * `srcset` width candidates: 200 / 400 / 600 (override via `width` option).
     *
     * @see SPEC-186 §7
     */
    galleryQuarter: 'w_400,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto',
    /**
     * Gallery lightbox-strip thumbnail — 1:1 aspect ratio at 120px wide.
     *
     * Used for the thumbnail strip inside the lightbox dialog. Intentionally
     * small to minimize payload for the strip row; square crop via `c_fill`.
     *
     * @see SPEC-186 §7
     */
    galleryThumb: 'w_120,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto'
} as const);

/**
 * A valid preset key for use with `getMediaUrl()`.
 */
export type MediaPreset = keyof typeof MEDIA_PRESETS;
