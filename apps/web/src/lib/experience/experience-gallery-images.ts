/**
 * @file experience-gallery-images.ts
 * @description The image list of the experience detail gallery, built from the
 * raw public payload (moved out of `experiencias/[slug].astro`, HOS-2579).
 *
 * The gallery comes from `media.gallery` on the RAW API response: the detail
 * transform does not carry it. Without a gallery, the featured image stands in,
 * unless it is the placeholder. Entries without a URL are dropped.
 */

/** One image of the detail gallery. */
export interface ExperienceGalleryImage {
    readonly url: string;
    readonly alt: string;
    readonly caption?: string;
    readonly description?: string;
}

/** Raw gallery entry as the public payload carries it. */
interface RawGalleryEntry {
    readonly url?: string;
    readonly caption?: string;
    readonly description?: string;
}

/**
 * Builds the gallery images of an experience detail page.
 *
 * @param input.media - The raw `media` field of the public payload (unknown shape).
 * @param input.name - The experience name, the alt text fallback.
 * @param input.featuredImage - The transformed featured image.
 * @returns The gallery images, `[]` when there is nothing to show.
 */
export function buildExperienceGalleryImages(input: {
    readonly media: unknown;
    readonly name: string;
    readonly featuredImage: { readonly url: string; readonly caption?: string };
}): { readonly images: readonly ExperienceGalleryImage[] } {
    const gallery =
        (input.media as { readonly gallery?: readonly RawGalleryEntry[] } | undefined)?.gallery ??
        [];
    if (gallery.length > 0) {
        return {
            images: gallery
                .filter((entry) => entry.url)
                .map((entry) => ({
                    url: String(entry.url),
                    alt: entry.caption ?? input.name,
                    caption: entry.caption,
                    description: entry.description
                }))
        };
    }
    const { url, caption } = input.featuredImage;
    if (url && !url.includes('placeholder')) {
        return { images: [{ url, alt: caption ?? input.name, caption }] };
    }
    return { images: [] };
}
