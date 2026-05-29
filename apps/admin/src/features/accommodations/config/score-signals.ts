import type { SignalConfig } from '@/components/quality-score/types';

/**
 * Minimum number of gallery photos that count as "well-illustrated" per spec §4.9.
 * Below this the signal awards partial credit so the score climbs as the host
 * adds the first photo.
 */
const GALLERY_MIN_PHOTOS = 5;

/**
 * Description length above which we consider the field "complete enough" to
 * help conversion. Below this the signal is pending. Mirrors the soft target
 * the web hero copy uses.
 */
const DESCRIPTION_MIN_CHARS = 200;

/**
 * Helpers — kept local because they're only meaningful in the context of
 * accommodation signals. If destination/event/post score gets built later,
 * each feature folder owns its own helpers.
 */

function isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
    if (!path.includes('.')) return source[path];
    let current: unknown = source;
    for (const part of path.split('.')) {
        if (current === null || current === undefined) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function countTruthyKeys(source: Record<string, unknown>, keys: readonly string[]): number {
    let count = 0;
    for (const key of keys) {
        if (source[key] === true) count++;
    }
    return count;
}

/**
 * Quality signals for accommodation (spec §4.9).
 *
 * Premium signals live behind the host's plan. The caller passes the
 * resolved entitlement flag (from `useMyEntitlements` + the staff-bypass
 * helper) so this config stays pure and trivially testable. When more
 * premium signals come online (virtual tour, calendar sync, etc.) extend
 * the input object rather than reaching into a hook from here.
 */
export function createAccommodationSignals({
    hasVideoGalleryFeature
}: {
    readonly hasVideoGalleryFeature: boolean;
}): readonly SignalConfig<Record<string, unknown>>[] {
    return [
        // ----------------------------------------------------------------
        // Featured image (gallery)
        // ----------------------------------------------------------------
        {
            id: 'featured-image',
            labelKey: 'admin-entities.qualityScore.signals.featuredImage.label',
            weight: 18,
            sectionId: 'gallery',
            check: (entity) => {
                const url = readPath(entity, 'media.featuredImage.url');
                return isNonEmptyString(url) ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // ≥5 gallery photos — partial credit while ramping up
        // ----------------------------------------------------------------
        {
            id: 'gallery-photos',
            labelKey: 'admin-entities.qualityScore.signals.galleryPhotos.label',
            weight: 16,
            sectionId: 'gallery',
            check: (entity) => {
                const gallery = readPath(entity, 'media.gallery');
                const count = Array.isArray(gallery) ? gallery.length : 0;
                if (count >= GALLERY_MIN_PHOTOS) return { status: 'done' };
                return {
                    status: 'pending',
                    progress: count / GALLERY_MIN_PHOTOS,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.galleryPhotos.hint',
                        params: { current: count, target: GALLERY_MIN_PHOTOS }
                    }
                };
            }
        },
        // ----------------------------------------------------------------
        // Every photo has alt text — A11Y + SEO
        // ----------------------------------------------------------------
        {
            id: 'photos-alt',
            labelKey: 'admin-entities.qualityScore.signals.photosAlt.label',
            weight: 6,
            sectionId: 'gallery',
            check: (entity) => {
                const featuredAlt = readPath(entity, 'media.featuredImage.caption');
                const gallery = readPath(entity, 'media.gallery');
                const galleryArr = Array.isArray(gallery)
                    ? (gallery as Array<Record<string, unknown>>)
                    : [];

                const hasFeaturedAlt = isNonEmptyString(featuredAlt);
                const missing = galleryArr.filter((item) => !isNonEmptyString(item.caption)).length;
                const total = galleryArr.length + (hasFeaturedAlt !== undefined ? 1 : 0);

                if (total === 0) return { status: 'pending', progress: 0 };
                if (missing === 0 && hasFeaturedAlt) return { status: 'done' };

                const covered = galleryArr.length - missing + (hasFeaturedAlt ? 1 : 0);
                return {
                    status: 'pending',
                    progress: total === 0 ? 0 : covered / total,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.photosAlt.hint',
                        params: { missing: missing + (hasFeaturedAlt ? 0 : 1) }
                    }
                };
            }
        },
        // ----------------------------------------------------------------
        // Description (long-form / rich text)
        // ----------------------------------------------------------------
        {
            id: 'description',
            labelKey: 'admin-entities.qualityScore.signals.description.label',
            weight: 14,
            sectionId: 'basic-info',
            check: (entity) => {
                const desc = entity.description;
                if (!isNonEmptyString(desc)) return { status: 'pending', progress: 0 };
                const length = (desc as string).trim().length;
                if (length >= DESCRIPTION_MIN_CHARS) return { status: 'done' };
                return {
                    status: 'pending',
                    progress: length / DESCRIPTION_MIN_CHARS,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.description.hint',
                        params: { current: length, target: DESCRIPTION_MIN_CHARS }
                    }
                };
            }
        },
        // ----------------------------------------------------------------
        // Summary (short text shown in cards / OG)
        // ----------------------------------------------------------------
        {
            id: 'summary',
            labelKey: 'admin-entities.qualityScore.signals.summary.label',
            weight: 6,
            sectionId: 'basic-info',
            check: (entity) =>
                isNonEmptyString(entity.summary) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Location pinned on map (improves search ranking)
        // ----------------------------------------------------------------
        {
            id: 'location-pin',
            labelKey: 'admin-entities.qualityScore.signals.locationPin.label',
            weight: 10,
            sectionId: 'location-info',
            check: (entity) => {
                const coords = readPath(entity, 'location.coordinates') as
                    | { lat?: number; long?: number; lng?: number }
                    | undefined;
                if (!coords) return { status: 'pending' };
                const lat = coords.lat;
                const lng = coords.long ?? coords.lng;
                if (typeof lat === 'number' && typeof lng === 'number') return { status: 'done' };
                return { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // At least one contact channel reachable
        // ----------------------------------------------------------------
        {
            id: 'contact',
            labelKey: 'admin-entities.qualityScore.signals.contact.label',
            weight: 8,
            sectionId: 'contact-info',
            check: (entity) => {
                const channels = ['email', 'phone', 'whatsapp', 'website'];
                const filled = channels.some((key) => isNonEmptyString(entity[key]));
                return filled ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Services / amenities filled
        // ----------------------------------------------------------------
        {
            id: 'services',
            labelKey: 'admin-entities.qualityScore.signals.services.label',
            weight: 8,
            sectionId: 'amenities',
            check: (entity) => {
                const amenityFlags = [
                    'hasWifi',
                    'hasAirConditioning',
                    'hasParking',
                    'hasPool',
                    'hasKitchen',
                    'hasPetFriendly',
                    'hasGym',
                    'hasBreakfast'
                ] as const;
                const filled = countTruthyKeys(entity, amenityFlags);
                if (filled >= 3) return { status: 'done' };
                return {
                    status: 'pending',
                    progress: filled / 3,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.services.hint',
                        params: { current: filled, target: 3 }
                    }
                };
            }
        },
        // ----------------------------------------------------------------
        // Price set (mandatory to drive conversion)
        // ----------------------------------------------------------------
        {
            id: 'price',
            labelKey: 'admin-entities.qualityScore.signals.price.label',
            weight: 14,
            sectionId: 'basic-info',
            check: (entity) => {
                const price = readPath(entity, 'price.price');
                return typeof price === 'number' && price > 0
                    ? { status: 'done' }
                    : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Premium — video gallery (gated by EntitlementKey.CAN_EMBED_VIDEO).
        // When the feature is unlocked the signal flips to a regular
        // done/pending pair driven by `media.videos`. The field lives in
        // `sections/gallery.consolidated.ts` (VIDEO_GALLERY type) so unlocked
        // hosts can add YouTube/Vimeo URLs and watch this flip to "done".
        // ----------------------------------------------------------------
        {
            id: 'video-gallery',
            labelKey: 'admin-entities.qualityScore.signals.videoGallery.label',
            weight: 0,
            sectionId: 'gallery',
            check: (entity) => {
                if (!hasVideoGalleryFeature) return { status: 'premium' };
                const videos = readPath(entity, 'media.videos');
                return Array.isArray(videos) && videos.length > 0
                    ? { status: 'done' }
                    : { status: 'pending' };
            }
        }
    ];
}
