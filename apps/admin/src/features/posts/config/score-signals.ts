import type { SignalConfig } from '@/components/quality-score/types';

/**
 * Minimum number of gallery photos that count as "well-illustrated" for a
 * post. Lower threshold than events (3) and accommodation (5) — most blog
 * posts ship with a single featured image; the gallery is an extra polish.
 */
const GALLERY_MIN_PHOTOS = 2;

/**
 * Body length above which the post content is considered "complete enough"
 * for a meaningful read. Posts skew longer-form than accommodation /
 * event copy, so the target is higher.
 */
const CONTENT_MIN_CHARS = 500;

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
 * Quality signals for posts (SPEC-154 Phase 6 PR3).
 *
 * Mirrors the accommodation + event pattern. Posts are admin / editor
 * surfaces (no HOST involvement), so the score is a completeness indicator
 * for editors finishing their drafts before publish. Staff bypass via
 * SPEC-171 keeps the video-gallery signal usable for everyone.
 */
export function createPostSignals({
    hasVideoGalleryFeature
}: {
    readonly hasVideoGalleryFeature: boolean;
}): readonly SignalConfig<Record<string, unknown>>[] {
    return [
        // ----------------------------------------------------------------
        // Featured image — the card / OG image
        // ----------------------------------------------------------------
        {
            id: 'featured-image',
            labelKey: 'admin-entities.qualityScore.signals.featuredImage.label',
            weight: 16,
            sectionId: 'media',
            check: (entity) => {
                const url = readPath(entity, 'media.featuredImage.url');
                return isNonEmptyString(url) ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // ≥2 gallery photos for posts — softer threshold than accommodation
        // ----------------------------------------------------------------
        {
            id: 'gallery-photos',
            labelKey: 'admin-entities.qualityScore.signals.galleryPhotos.label',
            weight: 8,
            sectionId: 'media',
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
        // Alt text on every image — A11Y + SEO. Reads `alt` (persisted
        // since PR #1314).
        // ----------------------------------------------------------------
        {
            id: 'photos-alt',
            labelKey: 'admin-entities.qualityScore.signals.photosAlt.label',
            weight: 6,
            sectionId: 'media',
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
        // Summary (excerpt for cards + OG)
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
        // Content body — the heaviest signal. Posts ARE their content;
        // anything shorter than ~500 chars reads as a stub.
        // ----------------------------------------------------------------
        {
            id: 'content',
            labelKey: 'admin-entities.qualityScore.signals.content.label',
            weight: 26,
            sectionId: 'content',
            check: (entity) => {
                const content = entity.content;
                if (!isNonEmptyString(content)) return { status: 'pending', progress: 0 };
                const length = (content as string).trim().length;
                if (length >= CONTENT_MIN_CHARS) return { status: 'done' };
                return {
                    status: 'pending',
                    progress: length / CONTENT_MIN_CHARS,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.content.hint',
                        params: { current: length, target: CONTENT_MIN_CHARS }
                    }
                };
            }
        },
        // ----------------------------------------------------------------
        // Category — required for faceted search + tag-style browsing
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
        // Reading time — set by the editor (or auto-calculated). When
        // present the article card shows "X min read" which improves CTR.
        // ----------------------------------------------------------------
        {
            id: 'reading-time',
            labelKey: 'admin-entities.qualityScore.signals.readingTime.label',
            weight: 4,
            sectionId: 'content',
            check: (entity) => {
                const minutes = entity.readingTimeMinutes;
                return typeof minutes === 'number' && minutes > 0
                    ? { status: 'done' }
                    : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Author — required for byline + RSS + author pages
        // ----------------------------------------------------------------
        {
            id: 'author',
            labelKey: 'admin-entities.qualityScore.signals.author.label',
            weight: 10,
            sectionId: 'relations',
            check: (entity) =>
                isNonEmptyString(entity.authorId) ? { status: 'done' } : { status: 'pending' }
        },
        // ----------------------------------------------------------------
        // Related entity — at least one of accommodation / destination /
        // event / sponsorship linked. Signals topical relevance so the
        // post surfaces in the right cross-promotion slots.
        // ----------------------------------------------------------------
        {
            id: 'related-entity',
            labelKey: 'admin-entities.qualityScore.signals.relatedEntity.label',
            weight: 8,
            sectionId: 'relations',
            check: (entity) => {
                const candidates = [
                    'relatedAccommodationId',
                    'relatedDestinationId',
                    'relatedEventId',
                    'sponsorshipId'
                ];
                const linked = candidates.some((key) => isNonEmptyString(entity[key]));
                return linked ? { status: 'done' } : { status: 'pending' };
            }
        },
        // ----------------------------------------------------------------
        // Publish date set — admin-side signal. Posts with `publishedAt`
        // can be scheduled / surfaced in dated lists. The signal flips to
        // done as soon as a date is picked, even if `lifecycleState` is
        // still draft.
        // ----------------------------------------------------------------
        {
            id: 'published-at',
            labelKey: 'admin-entities.qualityScore.signals.publishedAt.label',
            weight: 8,
            sectionId: 'states-moderation',
            check: (entity) => {
                const publishedAt = entity.publishedAt;
                if (publishedAt === null || publishedAt === undefined || publishedAt === '') {
                    return { status: 'pending' };
                }
                return { status: 'done' };
            }
        },
        // ----------------------------------------------------------------
        // Premium — video gallery (gated by EntitlementKey.CAN_EMBED_VIDEO).
        // Same shape as accommodation/event. Staff bypass via SPEC-171.
        // ----------------------------------------------------------------
        {
            id: 'video-gallery',
            labelKey: 'admin-entities.qualityScore.signals.videoGallery.label',
            weight: 0,
            sectionId: 'media',
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
