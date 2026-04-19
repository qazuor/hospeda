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
export const MEDIA_PRESETS = {
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
    og: 'w_1200,h_630,c_fill,q_auto,f_auto,dpr_auto'
} as const;

/**
 * A valid preset key for use with `getMediaUrl()`.
 */
export type MediaPreset = keyof typeof MEDIA_PRESETS;
