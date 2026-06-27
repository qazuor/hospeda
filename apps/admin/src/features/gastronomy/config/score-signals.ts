/**
 * @file score-signals.ts
 * Quality-score signal definitions for gastronomy listings (SPEC-239 T-059).
 *
 * Mirrors `createEventSignals` — the caller passes resolved feature flags so
 * the config stays pure and trivially testable.  Weights sum to 100 for the
 * main (non-premium) set.
 *
 * Signal breakdown:
 *   - featuredImage    16 pts  — featured image uploaded
 *   - galleryPhotos    12 pts  — ≥3 gallery photos
 *   - photosAlt         4 pts  — alt text on every photo
 *   - description      18 pts  — description ≥150 chars
 *   - summary           6 pts  — short summary set
 *   - contact           8 pts  — at least one contact channel
 *   - cuisine          14 pts  — type (cuisine) field set
 *   - operatingHours   14 pts  — at least one day of opening hours
 *   - capacity          8 pts  — priceRange set (used as capacity proxy)
 *                     ----
 *                     100 pts  total (non-premium)
 */

import type { SignalConfig } from '@/components/quality-score/types';

/** Minimum gallery photos for the "well-illustrated" signal. */
const GALLERY_MIN_PHOTOS = 3;

/** Minimum description length for the "detailed" signal. */
const DESCRIPTION_MIN_CHARS = 150;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the quality signal config for a gastronomy listing.
 *
 * @returns Read-only array of `SignalConfig` for use with `computeScore`.
 */
export function createGastronomySignals(): readonly SignalConfig<Record<string, unknown>>[] {
    return [
        // ----------------------------------------------------------------
        // Featured image
        // ----------------------------------------------------------------
        {
            id: 'featured-image',
            labelKey: 'admin-entities.qualityScore.signals.featuredImage.label',
            weight: 16,
            sectionId: 'commerce-operational',
            check: (entity) => {
                const url = readPath(entity, 'media.featuredImage.url');
                return isNonEmptyString(url) ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // ≥3 gallery photos
        // ----------------------------------------------------------------
        {
            id: 'gallery-photos',
            labelKey: 'admin-entities.qualityScore.signals.galleryPhotos.label',
            weight: 12,
            sectionId: 'commerce-operational',
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
        // Every photo has alt text
        // ----------------------------------------------------------------
        {
            id: 'photos-alt',
            labelKey: 'admin-entities.qualityScore.signals.photosAlt.label',
            weight: 4,
            sectionId: 'commerce-operational',
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
        // Description — long-form text
        // ----------------------------------------------------------------
        {
            id: 'description',
            labelKey: 'admin-entities.qualityScore.signals.description.label',
            weight: 18,
            sectionId: 'commerce-identity',
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
        // Summary — short marketing text
        // ----------------------------------------------------------------
        {
            id: 'summary',
            labelKey: 'admin-entities.qualityScore.signals.summary.label',
            weight: 6,
            sectionId: 'commerce-identity',
            check: (entity) =>
                isNonEmptyString(entity.summary) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Contact — phone / email / website
        // ----------------------------------------------------------------
        {
            id: 'contact',
            labelKey: 'admin-entities.qualityScore.signals.contact.label',
            weight: 8,
            sectionId: 'commerce-operational',
            check: (entity) => {
                const channels = [
                    'contactInfo.personalEmail',
                    'contactInfo.mobilePhone',
                    'contactInfo.website'
                ];
                const filled = channels.some((path) => isNonEmptyString(readPath(entity, path)));
                return filled ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Cuisine — gastronomy type (RESTAURANT, BAR, CAFE, …)
        // ----------------------------------------------------------------
        {
            id: 'cuisine',
            labelKey: 'admin-entities.qualityScore.signals.cuisine.label',
            weight: 14,
            sectionId: 'gastronomy-specific',
            check: (entity) =>
                isNonEmptyString(entity.type) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Operating hours — at least one day defined in openingHours
        // ----------------------------------------------------------------
        {
            id: 'operatingHours',
            labelKey: 'admin-entities.qualityScore.signals.operatingHours.label',
            weight: 14,
            sectionId: 'commerce-operational',
            check: (entity) => {
                const hours = entity.openingHours;
                if (!hours || typeof hours !== 'object') return { status: 'pending' };
                const dayValues = Object.values(hours as Record<string, unknown>);
                const hasSomeDefined = dayValues.some(
                    (day) =>
                        day !== null &&
                        day !== undefined &&
                        typeof day === 'object' &&
                        ((day as Record<string, unknown>).open !== undefined ||
                            (day as Record<string, unknown>).is24h !== undefined)
                );
                return hasSomeDefined ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Capacity proxy — priceRange set (signals completeness of listing)
        // ----------------------------------------------------------------
        {
            id: 'capacity',
            labelKey: 'admin-entities.qualityScore.signals.capacity.label',
            weight: 8,
            sectionId: 'gastronomy-specific',
            check: (entity) =>
                isNonEmptyString(entity.priceRange) ? { status: 'done' } : { status: 'pending' }
        }
    ];
}
