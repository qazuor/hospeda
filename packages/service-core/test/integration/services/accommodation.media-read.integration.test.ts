/**
 * Integration test for the SPEC-204 T-013 read switch (T-015).
 *
 * Validates that reading accommodation media from the relational
 * `accommodation_media` table (via `attachComposedMedia`) yields a `Media`
 * shape that is byte-identical to what was written through the write-both
 * `syncAccommodationMedia` path — i.e. the JSONB → table → compose round-trip
 * is lossless and shape-stable. This is the golden guard for the ~21 read-sites
 * that consume `accommodation.media`.
 *
 * Like the T-011 media-sync test, this calls the helpers directly with a real
 * `AccommodationMediaModel` + a real transaction (rollback-on-exit) instead of
 * instantiating the full AccommodationService.
 */
import { AccommodationMediaModel } from '@repo/db';
import type { Accommodation, Media } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachComposedMedia } from '../../../src/services/accommodation/accommodation.media-read';
import { syncAccommodationMedia } from '../../../src/services/accommodation/accommodation.media-sync';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function img(url: string, caption?: string) {
    return { url, caption, moderationState: 'APPROVED' as const };
}

/** Featured + 2 gallery + 1 archived + 1 video. */
const FULL_MEDIA: Media = {
    featuredImage: {
        url: 'https://cdn.example.com/featured.jpg',
        caption: 'Featured photo',
        alt: 'Alt text for featured',
        publicId: 'hospeda/dev/featured',
        moderationState: 'APPROVED'
    },
    gallery: [
        img('https://cdn.example.com/gal-0.jpg', 'Gallery 0'),
        img('https://cdn.example.com/gal-1.jpg', 'Gallery 1')
    ],
    archivedGallery: [img('https://cdn.example.com/archived-0.jpg', 'Archived 0')],
    videos: [
        {
            url: 'https://cdn.example.com/tour.mp4',
            caption: 'Property tour',
            moderationState: 'APPROVED'
        }
    ]
} as unknown as Media;

const mediaModel = new AccommodationMediaModel();

/** Builds a minimal accommodation entity carrying only id + media (videos). */
function entityFor(accommodationId: string, media: Media | null): Accommodation {
    return { id: accommodationId, media } as unknown as Accommodation;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    if (!dbAvailable) return;
    getServiceTestDb();
});

afterAll(async () => {
    if (!dbAvailable) return;
    await closeServiceTestPool();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('accommodation media read switch — T-015 (golden shape stability)', () => {
    it.skipIf(!dbAvailable)(
        'T-015-a: round-trips featured + gallery (ordered) + archived from the table',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                // Read entity carries only videos in JSONB; photos come from the table.
                const entity = entityFor(accommodationId, { videos: FULL_MEDIA.videos } as Media);
                const result = await attachComposedMedia({ entity, mediaModel, tx });

                expect(result?.media?.featuredImage).toEqual({
                    url: 'https://cdn.example.com/featured.jpg',
                    caption: 'Featured photo',
                    alt: 'Alt text for featured',
                    publicId: 'hospeda/dev/featured',
                    moderationState: 'APPROVED'
                });
                // Gallery preserves write order via sort_order.
                expect(result?.media?.gallery?.map((g) => g.url)).toEqual([
                    'https://cdn.example.com/gal-0.jpg',
                    'https://cdn.example.com/gal-1.jpg'
                ]);
                // Archived gallery composed from archived rows.
                expect(result?.media?.archivedGallery?.map((g) => g.url)).toEqual([
                    'https://cdn.example.com/archived-0.jpg'
                ]);
                // Videos carried from JSONB unchanged.
                expect(result?.media?.videos).toEqual(FULL_MEDIA.videos);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'T-015-b: gallery is sourced from the table, NOT the stale JSONB media',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                // Entity JSONB claims a different (stale) gallery — must be IGNORED.
                const staleMedia = {
                    gallery: [img('https://stale.example.com/WRONG.jpg', 'stale')],
                    videos: FULL_MEDIA.videos
                } as Media;
                const result = await attachComposedMedia({
                    entity: entityFor(accommodationId, staleMedia),
                    mediaModel,
                    tx
                });

                const urls = result?.media?.gallery?.map((g) => g.url) ?? [];
                expect(urls).toEqual([
                    'https://cdn.example.com/gal-0.jpg',
                    'https://cdn.example.com/gal-1.jpg'
                ]);
                expect(urls).not.toContain('https://stale.example.com/WRONG.jpg');
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'T-015-c: videos-only (no photo rows) composes only videos from JSONB',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                // No syncAccommodationMedia → zero rows in the table.
                const result = await attachComposedMedia({
                    entity: entityFor(accommodationId, { videos: FULL_MEDIA.videos } as Media),
                    mediaModel,
                    tx
                });

                expect(result?.media?.videos).toEqual(FULL_MEDIA.videos);
                expect(result?.media?.featuredImage).toBeUndefined();
                expect(result?.media?.gallery).toBeUndefined();
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'T-015-d: no rows + null media preserves null (fidelity guard, no null→{} drift)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                const result = await attachComposedMedia({
                    entity: entityFor(accommodationId, null),
                    mediaModel,
                    tx
                });

                // Composed is empty → original (null) preserved, not coerced to {}.
                expect(result?.media).toBeNull();
            });
        }
    );
});

describe('enforcePhotoLimit row-count — T-016', () => {
    // enforcePhotoLimit (apps/api) counts `findByAccommodation({state:'visible'}).total`.
    // These tests guard the semantics that count depends on: archived rows are
    // excluded, featured + gallery are both counted as visible. The at-cap / over-cap
    // decision itself lives in billing `checkLimit` and is covered there — here we
    // only validate the COUNT that feeds it (the part SPEC-204 T-014 changed).

    it.skipIf(!dbAvailable)(
        'T-016-a: visible count includes featured + gallery and EXCLUDES archived',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                // FULL_MEDIA = 1 featured + 2 gallery (visible) + 1 archived.
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                const visible = await mediaModel.findByAccommodation({
                    accommodationId,
                    state: 'visible',
                    tx
                });
                const archived = await mediaModel.findByAccommodation({
                    accommodationId,
                    state: 'archived',
                    tx
                });
                const all = await mediaModel.findByAccommodation({ accommodationId, tx });

                // featured (1) + gallery (2) = 3 visible; archived NOT counted.
                expect(visible.total).toBe(3);
                expect(archived.total).toBe(1);
                expect(all.total).toBe(4);
            });
        }
    );

    it.skipIf(!dbAvailable)('T-016-b: empty gallery yields a visible count of 0', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { accommodationId } = await seedAccommodation(tx);
            const visible = await mediaModel.findByAccommodation({
                accommodationId,
                state: 'visible',
                tx
            });
            expect(visible.total).toBe(0);
        });
    });

    it.skipIf(!dbAvailable)(
        'T-016-c: gallery-only (no featured) counts every gallery photo as visible',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                const galleryOnly = {
                    gallery: [
                        img('https://cdn.example.com/g0.jpg'),
                        img('https://cdn.example.com/g1.jpg'),
                        img('https://cdn.example.com/g2.jpg')
                    ]
                } as Media;
                await syncAccommodationMedia({
                    accommodationId,
                    media: galleryOnly,
                    mediaModel,
                    tx
                });

                const visible = await mediaModel.findByAccommodation({
                    accommodationId,
                    state: 'visible',
                    tx
                });
                expect(visible.total).toBe(3);
            });
        }
    );
});
