/**
 * Integration test for the accommodation_media backfill data-migration
 * (SPEC-204 T-010).
 *
 * Verifies that `packages/db/src/migrations/extras/019-accommodation-media-backfill.data-migration.sql`
 * correctly populates the `accommodation_media` table from the legacy
 * `accommodations.media` JSONB column, preserving all field values, correct
 * sort_order assignments, and idempotency.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) rather than `withTestTransaction`
 * because the backfill SQL is wrapped in a `DO $$` block that commits its
 * writes as part of its own implicit statement — a rollback-only transaction
 * cannot observe mid-block changes, so we use the full TRUNCATE approach.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { accommodationMedia } from '../../src/schemas/accommodation/accommodation_media.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestDb, testData, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the migration file under test. */
const MIGRATION_PATH = join(
    __dirname,
    '../../src/migrations/extras/019-accommodation-media-backfill.data-migration.sql'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads the backfill SQL from disk. */
async function readBackfillSql(): Promise<string> {
    return readFile(MIGRATION_PATH, 'utf-8');
}

/**
 * Applies the backfill DO $$ block against the current test DB.
 * `db.execute(sql.raw(...))` passes the statement straight to the pg driver.
 */
async function applyBackfill(): Promise<void> {
    const db = getTestDb();
    const content = await readBackfillSql();
    await db.execute(sql.raw(content));
}

/**
 * Minimal accommodation row that satisfies all NOT NULL constraints.
 * `media` is set per-test.
 */
function accommodationFixture(
    ownerId: string,
    destinationId: string,
    mediaJson: Record<string, unknown>,
    slug?: string
): typeof accommodations.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: slug ?? `backfill-test-${uid}`,
        name: 'Backfill Test Accommodation',
        summary: 'Short summary',
        type: 'HOTEL' as const,
        description: 'Test description',
        ownerId,
        destinationId,
        media: mediaJson as (typeof accommodations.$inferInsert)['media'],
        lifecycleState: 'ACTIVE' as const
    };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    // Wire @repo/db's module-level getDb() to the ephemeral test pool.
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('019-accommodation-media-backfill.data-migration — T-010', () => {
    /**
     * AC-1: featuredImage → sort_order=0, is_featured=true, state='visible'.
     *       gallery[0] → sort_order=1 (when featured exists), state='visible'.
     *       gallery[1] → sort_order=2, state='visible'.
     *       archivedGallery[0] → sort_order=0, state='archived', archived_at IS NOT NULL.
     * Also verifies publicId, alt, caption, attribution, moderationState PRESERVED.
     */
    it('maps featuredImage, gallery, and archivedGallery to correct rows', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const acc = accommodationFixture(user.id, dest.id, {
                featuredImage: {
                    url: 'https://cdn.example.com/featured.jpg',
                    caption: 'The featured photo',
                    alt: 'Alt text for featured',
                    publicId: 'hospeda/dev/featured',
                    moderationState: 'APPROVED',
                    attribution: { photographer: 'Jane Photographer' }
                },
                gallery: [
                    {
                        url: 'https://cdn.example.com/gallery-0.jpg',
                        caption: 'Gallery photo zero',
                        moderationState: 'APPROVED'
                    },
                    {
                        url: 'https://cdn.example.com/gallery-1.jpg',
                        publicId: 'hospeda/dev/gallery-1',
                        moderationState: 'PENDING'
                    }
                ],
                archivedGallery: [
                    {
                        url: 'https://cdn.example.com/archived-0.jpg',
                        caption: 'Archived photo',
                        moderationState: 'REJECTED'
                    }
                ]
            });
            await db.insert(accommodations).values(acc);

            // Act
            await applyBackfill();

            // Assert: total rows for this accommodation
            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(
                    and(
                        eq(accommodationMedia.accommodationId, acc.id),
                        isNull(accommodationMedia.deletedAt)
                    )
                )
                .orderBy(accommodationMedia.sortOrder);

            // 1 featured + 2 gallery + 1 archived = 4
            expect(rows).toHaveLength(4);

            // Featured image row
            const featured = rows.find((r) => r.isFeatured);
            expect(featured).toBeDefined();
            expect(featured?.sortOrder).toBe(0);
            expect(featured?.state).toBe('visible');
            expect(featured?.url).toBe('https://cdn.example.com/featured.jpg');
            expect(featured?.caption).toBe('The featured photo');
            expect(featured?.alt).toBe('Alt text for featured');
            expect(featured?.publicId).toBe('hospeda/dev/featured');
            expect(featured?.moderationState).toBe('APPROVED');
            // Attribution must be preserved
            const attr = featured?.attribution as Record<string, unknown> | null;
            expect(attr?.photographer).toBe('Jane Photographer');

            // Gallery photo 0 → sort_order 1 (featured holds 0)
            const gal0 = rows.find((r) => r.url === 'https://cdn.example.com/gallery-0.jpg');
            expect(gal0?.sortOrder).toBe(1);
            expect(gal0?.state).toBe('visible');
            expect(gal0?.isFeatured).toBe(false);
            expect(gal0?.caption).toBe('Gallery photo zero');
            expect(gal0?.moderationState).toBe('APPROVED');

            // Gallery photo 1 → sort_order 2
            const gal1 = rows.find((r) => r.url === 'https://cdn.example.com/gallery-1.jpg');
            expect(gal1?.sortOrder).toBe(2);
            expect(gal1?.publicId).toBe('hospeda/dev/gallery-1');
            expect(gal1?.moderationState).toBe('PENDING');

            // Archived photo → state='archived', archived_at IS NOT NULL, sort_order=0
            const arch = rows.find((r) => r.url === 'https://cdn.example.com/archived-0.jpg');
            expect(arch?.state).toBe('archived');
            expect(arch?.isFeatured).toBe(false);
            expect(arch?.sortOrder).toBe(0);
            expect(arch?.archivedAt).not.toBeNull();
            expect(arch?.moderationState).toBe('REJECTED');
        });
    });

    /**
     * AC-2: gallery without featuredImage → gallery[0] gets sort_order=0.
     * This tests the `has_featured=false` offset branch.
     */
    it('assigns sort_order starting at 0 for gallery when no featuredImage', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const acc = accommodationFixture(user.id, dest.id, {
                gallery: [
                    { url: 'https://cdn.example.com/no-feat-0.jpg', moderationState: 'APPROVED' },
                    { url: 'https://cdn.example.com/no-feat-1.jpg', moderationState: 'APPROVED' }
                ]
            });
            await db.insert(accommodations).values(acc);

            await applyBackfill();

            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, acc.id))
                .orderBy(accommodationMedia.sortOrder);

            expect(rows).toHaveLength(2);
            // sort_order 0-based when no featured
            expect(rows[0]?.sortOrder).toBe(0);
            expect(rows[0]?.url).toBe('https://cdn.example.com/no-feat-0.jpg');
            expect(rows[1]?.sortOrder).toBe(1);
            expect(rows[1]?.url).toBe('https://cdn.example.com/no-feat-1.jpg');
            // No row should be featured
            expect(rows.every((r) => !r.isFeatured)).toBe(true);
        });
    });

    /**
     * AC-3: accommodation with no media photos is skipped (no rows inserted).
     */
    it('skips accommodations with empty media (only videos key, or null)', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const accNoMedia = accommodationFixture(user.id, dest.id, {
                videos: [{ url: 'https://cdn.example.com/video.mp4' }]
            });
            await db.insert(accommodations).values(accNoMedia);

            await applyBackfill();

            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accNoMedia.id));

            expect(rows).toHaveLength(0);
        });
    });

    /**
     * AC-4: Idempotency — running the backfill a second time against an
     * accommodation that already has rows must NOT insert duplicates.
     */
    it('is idempotent — second run inserts no additional rows', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const acc = accommodationFixture(user.id, dest.id, {
                featuredImage: {
                    url: 'https://cdn.example.com/idempotent-featured.jpg',
                    moderationState: 'APPROVED'
                },
                gallery: [
                    {
                        url: 'https://cdn.example.com/idempotent-gal.jpg',
                        moderationState: 'APPROVED'
                    }
                ]
            });
            await db.insert(accommodations).values(acc);

            // First run
            await applyBackfill();

            const firstRunRows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, acc.id));
            expect(firstRunRows).toHaveLength(2); // featured + 1 gallery

            // Second run — idempotency guard should prevent any new inserts
            await applyBackfill();

            const secondRunRows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, acc.id));
            expect(secondRunRows).toHaveLength(2); // unchanged
        });
    });

    /**
     * AC-5: moderationState defaults to 'PENDING' when the JSON key is absent.
     */
    it('defaults moderationState to PENDING when absent from the JSONB', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const acc = accommodationFixture(user.id, dest.id, {
                featuredImage: {
                    // No moderationState key
                    url: 'https://cdn.example.com/no-mod-state.jpg'
                }
            });
            await db.insert(accommodations).values(acc);

            await applyBackfill();

            const rows = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, acc.id));

            expect(rows).toHaveLength(1);
            expect(rows[0]?.moderationState).toBe('PENDING');
        });
    });

    /**
     * AC-6: multiple accommodations in a single run — each gets its own rows,
     * one with media and one without.
     */
    it('handles multiple accommodations in a single run', async () => {
        await withCleanSlate(async (db) => {
            const user = testData.user();
            const dest = testData.destination();
            await db.insert(users).values(user);
            await db.insert(destinations).values(dest);

            const accWithMedia = accommodationFixture(user.id, dest.id, {
                featuredImage: {
                    url: 'https://cdn.example.com/multi-featured.jpg',
                    moderationState: 'APPROVED'
                }
            });
            const accNoPhotos = accommodationFixture(user.id, dest.id, {
                videos: [{ url: 'https://cdn.example.com/vid.mp4' }]
            });

            await db.insert(accommodations).values(accWithMedia);
            await db.insert(accommodations).values(accNoPhotos);

            await applyBackfill();

            const rowsWithMedia = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accWithMedia.id));
            expect(rowsWithMedia).toHaveLength(1);

            const rowsNoMedia = await db
                .select()
                .from(accommodationMedia)
                .where(eq(accommodationMedia.accommodationId, accNoPhotos.id));
            expect(rowsNoMedia).toHaveLength(0);
        });
    });
});
