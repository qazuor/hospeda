/**
 * Integration test for the social_post_target_media backfill data-migration
 * (HOS-65 T-005).
 *
 * Verifies that
 * `packages/db/src/migrations/extras/027-social-post-target-media-backfill.data-migration.sql`
 * fans out every existing `social_post_media` row into one
 * `social_post_target_media` link row per `social_post_targets` row that
 * belongs to the same post — a genuine N-target fan-out, not a
 * single-vs-multi-target special case — while preserving each media row's
 * original `position` as the link row's initial position.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) rather than `withTestTransaction`
 * because the backfill SQL is wrapped in a `DO $$` block that commits its
 * writes as part of its own implicit statement — a rollback-only transaction
 * cannot observe mid-block changes, so we use the full TRUNCATE approach
 * (mirrors `accommodation-media-backfill.integration.test.ts`).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { socialAssets } from '../../src/schemas/social/social_assets.dbschema.ts';
import { socialPlatformFormats } from '../../src/schemas/social/social_platform_formats.dbschema.ts';
import { socialPostMedia } from '../../src/schemas/social/social_post_media.dbschema.ts';
import { socialPostTargetMedia } from '../../src/schemas/social/social_post_target_media.dbschema.ts';
import { socialPostTargets } from '../../src/schemas/social/social_post_targets.dbschema.ts';
import { socialPosts } from '../../src/schemas/social/social_posts.dbschema.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the migration file under test. */
const MIGRATION_PATH = join(
    __dirname,
    '../../src/migrations/extras/027-social-post-target-media-backfill.data-migration.sql'
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

/** Minimal `social_posts` row satisfying all NOT NULL constraints. */
function postFixture(): typeof socialPosts.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        draftId: `backfill-draft-${uid}`,
        title: 'Backfill Test Post',
        slug: `backfill-test-post-${uid}`,
        source: 'ADMIN' as const,
        captionBase: 'Test caption base'
    };
}

/** Minimal `social_platform_formats` row for a given platform. */
function platformFormatFixture(
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X'
): typeof socialPlatformFormats.$inferInsert {
    return {
        id: crypto.randomUUID(),
        platform,
        publishFormat: 'FEED_POST' as const,
        mediaType: 'IMAGE' as const
    };
}

/** Minimal `social_post_targets` row for a given post + platform format. */
function targetFixture(
    postId: string,
    platformFormatId: string,
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'X'
): typeof socialPostTargets.$inferInsert {
    return {
        id: crypto.randomUUID(),
        socialPostId: postId,
        platformFormatId,
        platform,
        publishFormat: 'FEED_POST' as const,
        mediaType: 'IMAGE' as const
    };
}

/** Minimal `social_assets` row. */
function assetFixture(): typeof socialAssets.$inferInsert {
    return {
        id: crypto.randomUUID(),
        source: 'MANUAL_UPLOAD' as const,
        mediaType: 'IMAGE' as const
    };
}

/** Minimal `social_post_media` row for a given post + asset + position. */
function mediaFixture(
    postId: string,
    assetId: string,
    position: number
): typeof socialPostMedia.$inferInsert {
    return {
        id: crypto.randomUUID(),
        socialPostId: postId,
        assetId,
        position
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

describe('027-social-post-target-media-backfill.data-migration — HOS-65 T-005', () => {
    /**
     * Core fan-out: a post with 2 targets and 2 media rows must produce
     * 2 * 2 = 4 link rows, one per (target, media) pair, each preserving
     * the media row's original `position`.
     */
    it('fans out every (target, media) pair and preserves position', async () => {
        await withCleanSlate(async (db) => {
            const post = postFixture();
            await db.insert(socialPosts).values(post);

            const igFormat = platformFormatFixture('INSTAGRAM');
            const fbFormat = platformFormatFixture('FACEBOOK');
            await db.insert(socialPlatformFormats).values([igFormat, fbFormat]);

            const igTarget = targetFixture(post.id, igFormat.id, 'INSTAGRAM');
            const fbTarget = targetFixture(post.id, fbFormat.id, 'FACEBOOK');
            await db.insert(socialPostTargets).values([igTarget, fbTarget]);

            const asset0 = assetFixture();
            const asset1 = assetFixture();
            await db.insert(socialAssets).values([asset0, asset1]);

            const media0 = mediaFixture(post.id, asset0.id, 0);
            const media1 = mediaFixture(post.id, asset1.id, 1);
            await db.insert(socialPostMedia).values([media0, media1]);

            // Act
            await applyBackfill();

            // Assert: 2 targets * 2 media = 4 link rows
            const rows = await db
                .select()
                .from(socialPostTargetMedia)
                .where(eq(socialPostTargetMedia.socialPostTargetId, igTarget.id));
            expect(rows).toHaveLength(2);

            const allRows = await db
                .select()
                .from(socialPostTargetMedia)
                .where(
                    sql`${socialPostTargetMedia.socialPostTargetId} IN (${igTarget.id}, ${fbTarget.id})`
                );
            expect(allRows).toHaveLength(4);

            // Every (target, media) pair exists exactly once with the correct position
            for (const target of [igTarget, fbTarget]) {
                for (const media of [media0, media1]) {
                    const [link] = await db
                        .select()
                        .from(socialPostTargetMedia)
                        .where(
                            and(
                                eq(socialPostTargetMedia.socialPostTargetId, target.id),
                                eq(socialPostTargetMedia.socialPostMediaId, media.id)
                            )
                        );
                    expect(link).toBeDefined();
                    expect(link?.position).toBe(media.position);
                }
            }
        });
    });

    /**
     * A post with no targets yields no link rows for its media (nothing to
     * fan out to).
     */
    it('skips media with no targets on its post', async () => {
        await withCleanSlate(async (db) => {
            const post = postFixture();
            await db.insert(socialPosts).values(post);

            const asset = assetFixture();
            await db.insert(socialAssets).values(asset);

            const media = mediaFixture(post.id, asset.id, 0);
            await db.insert(socialPostMedia).values(media);

            await applyBackfill();

            const rows = await db
                .select()
                .from(socialPostTargetMedia)
                .where(eq(socialPostTargetMedia.socialPostMediaId, media.id));
            expect(rows).toHaveLength(0);
        });
    });

    /**
     * Idempotency — running the backfill a second time must NOT insert
     * duplicate link rows (`ON CONFLICT ... DO NOTHING`).
     */
    it('is idempotent — second run inserts no additional rows', async () => {
        await withCleanSlate(async (db) => {
            const post = postFixture();
            await db.insert(socialPosts).values(post);

            const format = platformFormatFixture('X');
            await db.insert(socialPlatformFormats).values(format);

            const target = targetFixture(post.id, format.id, 'X');
            await db.insert(socialPostTargets).values(target);

            const asset = assetFixture();
            await db.insert(socialAssets).values(asset);

            const media = mediaFixture(post.id, asset.id, 0);
            await db.insert(socialPostMedia).values(media);

            // First run
            await applyBackfill();
            const firstRunRows = await db
                .select()
                .from(socialPostTargetMedia)
                .where(eq(socialPostTargetMedia.socialPostTargetId, target.id));
            expect(firstRunRows).toHaveLength(1);

            // Second run — idempotency guard should prevent any new inserts
            await applyBackfill();
            const secondRunRows = await db
                .select()
                .from(socialPostTargetMedia)
                .where(eq(socialPostTargetMedia.socialPostTargetId, target.id));
            expect(secondRunRows).toHaveLength(1);
        });
    });
});
