import type { MediaPreset } from '@repo/media';
import { getMediaUrl, stripCloudinaryTransform } from '@repo/media';

/** Mobile image gate; keep in sync with ImageGalleryMobileTrack.module.css. */
export const MOBILE_GALLERY_MEDIA = '(max-width: 767px)';

/** Legacy-compatible negation, including fractional widths above 767px. */
export const DESKTOP_GALLERY_MEDIA = `not all and ${MOBILE_GALLERY_MEDIA}`;

const RESPONSIVE_CELLS = {
    galleryFeatured: { widths: [640, 1000, 1400], sizes: '(max-width: 640px) 100vw, 66vw' },
    galleryHalf: { widths: [400, 640, 900], sizes: '(max-width: 640px) 100vw, 50vw' },
    galleryQuarter: { widths: [200, 400, 600], sizes: '(max-width: 640px) 50vw, 33vw' }
} as const;

/** Applies the requested cell crop to a Cloudinary URL; other URLs pass through. */
export function buildCellUrl({
    url,
    preset
}: {
    readonly url: string;
    readonly preset: MediaPreset;
}) {
    return { src: getMediaUrl(stripCloudinaryTransform(url), { preset }) };
}

/** Returns the mosaic's role-specific source and responsive candidates for any gallery presentation. */
export function buildCellSources({
    url,
    preset,
    sizesOverride
}: {
    readonly url: string;
    readonly preset: keyof typeof RESPONSIVE_CELLS;
    readonly sizesOverride?: string;
}) {
    const baseUrl = stripCloudinaryTransform(url);
    const src = getMediaUrl(baseUrl, { preset });
    try {
        // Width overrides only work on Cloudinary. Do not emit identical candidates
        // for external assets, and require an exact hostname, not a substring.
        if (new URL(url).hostname !== 'res.cloudinary.com') return { src };
    } catch {
        return { src };
    }
    const { widths, sizes } = RESPONSIVE_CELLS[preset];
    const srcSet = widths
        .map((width) => `${getMediaUrl(baseUrl, { preset, width })} ${width}w`)
        .join(', ');
    return { src, srcSet, sizes: sizesOverride ?? sizes };
}
