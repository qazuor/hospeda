/**
 * Integration test for `syncAccommodationMedia` (SPEC-204 T-011).
 *
 * `syncAccommodationMedia` accepts `mediaModel` as a parameter, so it can be
 * tested directly with a real `AccommodationMediaModel` + a real transaction
 * WITHOUT instantiating the full `AccommodationService` or touching its 128 K
 * constructor.
 *
 * Test matrix:
 *   T-011-a  — CREATE: featured + gallery + archivedGallery → correct rows
 *   T-011-b  — UPDATE (full replace): changed gallery → rows replaced, no dups
 *   T-011-c  — no-op contract: media===undefined → existing rows UNTOUCHED
 *   T-011-d  — clear contract: media===null → all rows DELETED
 *   T-011-e  — gallery-only (no featured) → sort_order starts at 0
 *   T-011-f  — ≤1 featured invariant: only featuredImage row has isFeatured=true
 *
 * Each test runs inside `withServiceTestTransaction` (rollback-on-exit).
 */
import { AccommodationMediaModel, accommodationMedia, eq } from '@repo/db';
import type { Media } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

/**
 * Minimal image object with a URL and moderationState.
 */
function img(
    url: string,
    caption?: string
): {
    url: string;
    caption: string | undefined;
    moderationState: 'APPROVED';
} {
    return { url, caption, moderationState: 'APPROVED' };
}

/** Media object with a featured image + 2 gallery + 1 archived. */
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
    archivedGallery: [img('https://cdn.example.com/archived-0.jpg', 'Archived 0')]
} as unknown as Media;

/** Replacement media: 1 featured + 1 gallery (different URLs). */
const UPDATED_MEDIA: Media = {
    featuredImage: {
        url: 'https://cdn.example.com/new-featured.jpg',
        moderationState: 'APPROVED'
    },
    gallery: [img('https://cdn.example.com/new-gal-0.jpg', 'New Gallery 0')]
} as unknown as Media;

/** Gallery-only media (no featured). */
const GALLERY_ONLY_MEDIA: Media = {
    gallery: [
        img('https://cdn.example.com/gonly-0.jpg'),
        img('https://cdn.example.com/gonly-1.jpg')
    ]
} as unknown as Media;

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

describe('syncAccommodationMedia — T-011', () => {
    const mediaModel = new AccommodationMediaModel();

    // -------------------------------------------------------------------------
    // T-011-a: CREATE — full media payload → correct rows inserted
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-a: inserts featured, gallery, and archived rows with correct fields',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                // Act
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                // Assert
                const rows = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId))
                    .orderBy(accommodationMedia.sortOrder);

                // 1 featured + 2 gallery + 1 archived = 4 rows
                expect(rows).toHaveLength(4);

                // Featured row
                const featured = rows.find((r) => r.isFeatured);
                expect(featured).toBeDefined();
                expect(featured?.sortOrder).toBe(0);
                expect(featured?.state).toBe('visible');
                expect(featured?.url).toBe('https://cdn.example.com/featured.jpg');
                expect(featured?.caption).toBe('Featured photo');
                expect(featured?.alt).toBe('Alt text for featured');
                expect(featured?.publicId).toBe('hospeda/dev/featured');
                expect(featured?.moderationState).toBe('APPROVED');

                // Gallery photo 0 → sort_order 1 (featured holds 0)
                const gal0 = rows.find((r) => r.url === 'https://cdn.example.com/gal-0.jpg');
                expect(gal0?.sortOrder).toBe(1);
                expect(gal0?.state).toBe('visible');
                expect(gal0?.isFeatured).toBe(false);

                // Gallery photo 1 → sort_order 2
                const gal1 = rows.find((r) => r.url === 'https://cdn.example.com/gal-1.jpg');
                expect(gal1?.sortOrder).toBe(2);
                expect(gal1?.state).toBe('visible');

                // Archived photo → state='archived', archivedAt IS NOT NULL
                const arch = rows.find((r) => r.url === 'https://cdn.example.com/archived-0.jpg');
                expect(arch?.state).toBe('archived');
                expect(arch?.isFeatured).toBe(false);
                expect(arch?.sortOrder).toBe(0);
                expect(arch?.archivedAt).not.toBeNull();
            });
        }
    );

    // -------------------------------------------------------------------------
    // T-011-b: UPDATE — second call replaces rows, no duplicates
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-b: second sync replaces all rows with no duplicates',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                // First sync: FULL_MEDIA (4 rows)
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                // Second sync: UPDATED_MEDIA (1 featured + 1 gallery = 2 rows)
                await syncAccommodationMedia({
                    accommodationId,
                    media: UPDATED_MEDIA,
                    mediaModel,
                    tx
                });

                const rows = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));

                // ONLY the updated rows remain — old rows were hard-deleted
                expect(rows).toHaveLength(2);

                const urls = rows.map((r) => r.url);
                expect(urls).toContain('https://cdn.example.com/new-featured.jpg');
                expect(urls).toContain('https://cdn.example.com/new-gal-0.jpg');
                // Old rows must be gone
                expect(urls).not.toContain('https://cdn.example.com/featured.jpg');
                expect(urls).not.toContain('https://cdn.example.com/gal-0.jpg');
                expect(urls).not.toContain('https://cdn.example.com/archived-0.jpg');
            });
        }
    );

    // -------------------------------------------------------------------------
    // T-011-c: no-op contract — media===undefined → existing rows UNTOUCHED
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-c: media===undefined leaves existing rows untouched',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                // Seed some rows first
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                const rowsBefore = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));
                expect(rowsBefore).toHaveLength(4);

                // Call with undefined — must be a no-op
                await syncAccommodationMedia({
                    accommodationId,
                    media: undefined,
                    mediaModel,
                    tx
                });

                const rowsAfter = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));

                // Row count unchanged, IDs unchanged
                expect(rowsAfter).toHaveLength(4);
                const beforeIds = new Set(rowsBefore.map((r) => r.id));
                const afterIds = new Set(rowsAfter.map((r) => r.id));
                expect([...afterIds].every((id) => beforeIds.has(id))).toBe(true);
            });
        }
    );

    // -------------------------------------------------------------------------
    // T-011-d: clear contract — media===null → all rows deleted
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-d: media===null deletes all rows for the accommodation',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                // Seed some rows first
                await syncAccommodationMedia({
                    accommodationId,
                    media: FULL_MEDIA,
                    mediaModel,
                    tx
                });

                const rowsBefore = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));
                expect(rowsBefore).toHaveLength(4);

                // Call with null — all rows must be hard-deleted
                await syncAccommodationMedia({
                    accommodationId,
                    media: null,
                    mediaModel,
                    tx
                });

                const rowsAfter = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));

                expect(rowsAfter).toHaveLength(0);
            });
        }
    );

    // -------------------------------------------------------------------------
    // T-011-e: gallery-only (no featuredImage) → sort_order starts at 0
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-e: gallery-only media assigns sort_order starting at 0',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                await syncAccommodationMedia({
                    accommodationId,
                    media: GALLERY_ONLY_MEDIA,
                    mediaModel,
                    tx
                });

                const rows = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId))
                    .orderBy(accommodationMedia.sortOrder);

                expect(rows).toHaveLength(2);
                // No featured row
                expect(rows.every((r) => !r.isFeatured)).toBe(true);
                // sort_order 0, 1 (not 1, 2 — because no featured image)
                expect(rows[0]?.sortOrder).toBe(0);
                expect(rows[0]?.url).toBe('https://cdn.example.com/gonly-0.jpg');
                expect(rows[1]?.sortOrder).toBe(1);
                expect(rows[1]?.url).toBe('https://cdn.example.com/gonly-1.jpg');
            });
        }
    );

    // -------------------------------------------------------------------------
    // T-011-f: ≤1 featured invariant — only the featuredImage row is featured
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)('T-011-f: only the featuredImage row has isFeatured=true', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { accommodationId } = await seedAccommodation(tx);

            await syncAccommodationMedia({
                accommodationId,
                media: FULL_MEDIA,
                mediaModel,
                tx
            });

            const rows = await tx
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accommodationId));

            const featuredRows = rows.filter((r) => r.isFeatured);
            // Exactly one featured row
            expect(featuredRows).toHaveLength(1);
            expect(featuredRows[0]?.url).toBe('https://cdn.example.com/featured.jpg');
        });
    });

    // -------------------------------------------------------------------------
    // T-011-g: empty media object (no photos keys) → no rows inserted
    // -------------------------------------------------------------------------
    it.skipIf(!dbAvailable)(
        'T-011-g: media with no photo keys inserts no rows (only videos etc.)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);

                const emptyMedia = {} as unknown as Media;

                await syncAccommodationMedia({
                    accommodationId,
                    media: emptyMedia,
                    mediaModel,
                    tx
                });

                const rows = await tx
                    .select()
                    .from(accommodationMedia)
                    .where(eq(accommodationMedia.accommodationId, accommodationId));

                expect(rows).toHaveLength(0);
            });
        }
    );
});
