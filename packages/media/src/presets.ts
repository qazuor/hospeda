/**
 * Named transform presets for Cloudinary URL building.
 *
 * Each preset maps to a Cloudinary transform string that is inserted
 * between `/upload/` and the version/path segment in the URL.
 *
 * All presets include `q_auto` (automatic quality) and `f_auto` (automatic
 * format selection, e.g. WebP/AVIF when supported by the browser).
 *
 * @example
 * ```ts
 * import { MEDIA_PRESETS } from '@repo/media';
 *
 * const transform = MEDIA_PRESETS.card;
 * // 'w_400,h_300,c_fill,g_auto,q_auto,f_auto'
 *
 * const url = `https://res.cloudinary.com/demo/image/upload/${transform}/sample.jpg`;
 * ```
 */
export const MEDIA_PRESETS = {
    /** 200x200 thumbnail with automatic gravity and cropping. */
    thumbnail: 'w_200,h_200,c_thumb,g_auto,q_auto,f_auto',
    /** 400x300 card image with fill crop and automatic gravity. */
    card: 'w_400,h_300,c_fill,g_auto,q_auto,f_auto',
    /** 1200x600 hero banner with fill crop and automatic gravity. */
    hero: 'w_1200,h_600,c_fill,g_auto,q_auto,f_auto',
    /** 800px-wide gallery image, no height constraint. */
    gallery: 'w_800,q_auto,f_auto',
    /** 150x150 avatar with face-detection gravity. */
    avatar: 'w_150,h_150,c_thumb,g_face,q_auto,f_auto',
    /** Original dimensions with automatic quality and format only. */
    full: 'q_auto,f_auto',
    /** 1200x630 Open Graph image (Facebook/Twitter card standard). */
    og: 'w_1200,h_630,c_fill,q_auto,f_auto'
} as const;

/**
 * A valid preset key for use with `getMediaUrl()`.
 */
export type MediaPreset = keyof typeof MEDIA_PRESETS;
