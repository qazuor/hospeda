import type { SignalConfig } from '@/components/quality-score/types';

/**
 * Minimum number of gallery photos that count as "well-illustrated" for an
 * event. Lower threshold than accommodation (5) — events typically have
 * fewer photos but still benefit from a small gallery for the listing card.
 */
const GALLERY_MIN_PHOTOS = 3;

/**
 * Description length above which the description is considered "complete
 * enough" to drive conversion. Aligned with accommodation but slightly
 * relaxed for events (which tend to have shorter blurbs).
 */
const DESCRIPTION_MIN_CHARS = 150;

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

/**
 * Quality signals for events (SPEC-154 Phase 6 PR2).
 *
 * Mirrors the accommodation pattern (`createAccommodationSignals`) — the
 * caller passes resolved entitlement flags so the config stays pure and
 * trivially testable. Weights sum to 100 for the main set; premium
 * signals are weight 0 (status only, no contribution to the headline
 * score).
 */
export function createEventSignals({
    hasVideoGalleryFeature
}: {
    readonly hasVideoGalleryFeature: boolean;
}): readonly SignalConfig<Record<string, unknown>>[] {
    return [
        // ----------------------------------------------------------------
        // Featured image (contact-media section)
        // ----------------------------------------------------------------
        {
            id: 'featured-image',
            labelKey: 'admin-entities.qualityScore.signals.featuredImage.label',
            weight: 16,
            sectionId: 'contact-media',
            check: (entity) => {
                const url = readPath(entity, 'media.featuredImage.url');
                return isNonEmptyString(url) ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // ≥3 gallery photos — partial credit while ramping up
        // ----------------------------------------------------------------
        {
            id: 'gallery-photos',
            labelKey: 'admin-entities.qualityScore.signals.galleryPhotos.label',
            weight: 12,
            sectionId: 'contact-media',
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
        // Every photo has alt text — A11Y + SEO. Reads `alt` (persisted
        // since PR #1314, SPEC-154 Phase 3 followup).
        // ----------------------------------------------------------------
        {
            id: 'photos-alt',
            labelKey: 'admin-entities.qualityScore.signals.photosAlt.label',
            weight: 4,
            sectionId: 'contact-media',
            check: (entity) => {
                const featured = readPath(entity, 'media.featuredImage') as
                    | Record<string, unknown>
                    | undefined;
                const gallery = readPath(entity, 'media.gallery');
                const galleryArr = Array.isArray(gallery)
                    ? (gallery as Array<Record<string, unknown>>)
                    : [];

                const hasFeatured = featured && isNonEmptyString(featured.url);
                const featuredHasAlt = featured && isNonEmptyString(featured.alt);
                const missingGalleryAlts = galleryArr.filter(
                    (item) => !isNonEmptyString(item.alt)
                ).length;

                const total = galleryArr.length + (hasFeatured ? 1 : 0);
                if (total === 0) return { status: 'pending', progress: 0 };

                const totalCovered =
                    galleryArr.length - missingGalleryAlts + (featuredHasAlt ? 1 : 0);
                if (totalCovered === total) return { status: 'done' };

                const missingCount = missingGalleryAlts + (hasFeatured && !featuredHasAlt ? 1 : 0);
                return {
                    status: 'pending',
                    progress: totalCovered / total,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.photosAlt.hint',
                        params: { missing: missingCount }
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
        // Description (long-form text)
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
        // Category — events without a category don't show up in faceted
        // search, so this is core SEO surface.
        // ----------------------------------------------------------------
        {
            id: 'category',
            labelKey: 'admin-entities.qualityScore.signals.category.label',
            weight: 8,
            sectionId: 'basic-info',
            check: (entity) =>
                isNonEmptyString(entity.category) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Dates — at minimum `date.start`. The schema requires it on save,
        // but in-progress drafts may not have it yet (especially during
        // create→edit flow).
        // ----------------------------------------------------------------
        {
            id: 'dates',
            labelKey: 'admin-entities.qualityScore.signals.dates.label',
            weight: 12,
            sectionId: 'date-pricing',
            check: (entity) => {
                const start = readPath(entity, 'date.start');
                return start !== undefined && start !== null && start !== ''
                    ? { status: 'done' }
                    : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Price — events MUST declare either `isFree=true` or a positive
        // price/priceFrom. Either path counts as done.
        // ----------------------------------------------------------------
        {
            id: 'price',
            labelKey: 'admin-entities.qualityScore.signals.price.label',
            weight: 8,
            sectionId: 'date-pricing',
            check: (entity) => {
                const isFree = readPath(entity, 'pricing.isFree');
                if (isFree === true) return { status: 'done' };
                const price = readPath(entity, 'pricing.price');
                const priceFrom = readPath(entity, 'pricing.priceFrom');
                const hasPaid =
                    (typeof price === 'number' && price > 0) ||
                    (typeof priceFrom === 'number' && priceFrom > 0);
                return hasPaid ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Location — the assigned event-location (venue). Optional in the
        // schema but heavily recommended for SEO / map rendering.
        // ----------------------------------------------------------------
        {
            id: 'location',
            labelKey: 'admin-entities.qualityScore.signals.location.label',
            weight: 8,
            sectionId: 'relations',
            check: (entity) =>
                isNonEmptyString(entity.locationId) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Organizer — the entity behind the event.
        // ----------------------------------------------------------------
        {
            id: 'organizer',
            labelKey: 'admin-entities.qualityScore.signals.organizer.label',
            weight: 8,
            sectionId: 'relations',
            check: (entity) =>
                isNonEmptyString(entity.organizerId) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Contact channel — phone / email / website. At least one reachable.
        // ----------------------------------------------------------------
        {
            id: 'contact',
            labelKey: 'admin-entities.qualityScore.signals.contact.label',
            weight: 4,
            sectionId: 'contact-media',
            check: (entity) => {
                const channels = ['contact.email', 'contact.phone', 'contact.website'];
                const filled = channels.some((path) => isNonEmptyString(readPath(entity, path)));
                return filled ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Premium — video gallery (gated by EntitlementKey.CAN_EMBED_VIDEO).
        // Same shape as the accommodation video-gallery signal. Lives in the
        // contact-media section so the user finds it next to images.
        // ----------------------------------------------------------------
        {
            id: 'video-gallery',
            labelKey: 'admin-entities.qualityScore.signals.videoGallery.label',
            weight: 0,
            sectionId: 'contact-media',
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
