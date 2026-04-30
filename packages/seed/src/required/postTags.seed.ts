import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PostTagModel, SYSTEM_USER_ID } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Shape of one `NNN-{slug}.json` seed file under `data/postTag/`.
 *
 * Matches the tag-seeds.md canonical POST_TAG content spec and the `post_tags`
 * table columns used during seeding. PostTags include a `slug` field because
 * they are publicly exposed in URLs (e.g. `/blog?tag=guia-de-viaje`).
 *
 * @internal
 */
export interface PostTagJsonShape {
    name: string;
    slug: string;
    description: string;
    color: string;
    lifecycleState: string;
}

/**
 * Minimal interface for the PostTag model operations used by this seed.
 *
 * Using a port (interface) instead of the concrete `PostTagModel` allows unit
 * tests to inject an in-memory stub without requiring a live database
 * connection, following the same pattern as `internalTags.seed.ts` and
 * `systemTags.seed.ts` from T-037.
 *
 * @internal
 */
export interface PostTagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Reads all `NNN-{slug}.json` files from the given directory and returns their
 * parsed contents in sorted order (alphabetical, which equals numeric order
 * because filenames are zero-padded).
 *
 * Unlike INTERNAL/SYSTEM seeds which filter by prefix (`internal-*`, `system-*`),
 * PostTag files have no prefix — all `.json` files in the `postTag/` directory
 * are PostTag definitions.
 *
 * @param dataDir - Absolute path to `packages/seed/src/data/postTag/`
 * @returns Array of parsed PostTag JSON objects
 *
 * @internal
 */
async function loadPostTagFiles(dataDir: string): Promise<PostTagJsonShape[]> {
    const entries = await readdir(dataDir);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));
    jsonFiles.sort();

    const results: PostTagJsonShape[] = [];
    for (const file of jsonFiles) {
        const raw = await readFile(join(dataDir, file), 'utf-8');
        results.push(JSON.parse(raw) as PostTagJsonShape);
    }
    return results;
}

/**
 * Seeds all PostTags into the `post_tags` table (SPEC-086 R-4).
 *
 * PostTags are a public, SEO-driven thematic taxonomy for blog posts. They
 * drive public URL filters (e.g. `/blog?tag=guia-de-viaje`) and appear on
 * blog post pages in the web app. PostTags are completely separate from the
 * User-Tag subsystem (SPEC-086 D-001).
 *
 * Reads every `.json` file from `packages/seed/src/data/postTag/`, inserts
 * one `post_tags` row per file, and skips any PostTag that already exists by
 * matching `slug` — making this seed fully idempotent. Slug uniqueness is
 * enforced both at the DB level (`post_tags_slug_uq`) and by this guard.
 *
 * Invariants enforced at insert time:
 *   - `slug` populated from JSON (PostTags HAVE slug — D-018)
 *   - `createdById = SYSTEM_USER_ID`
 *   - `lifecycleState = ACTIVE` (from JSON)
 *
 * The system user (SPEC-086 R-1) must be present before calling this seed
 * because `createdById` references `SYSTEM_USER_ID`.
 *
 * @param postTagModelOverride - Optional model override for dependency injection in tests.
 *   Pass a mock `PostTagModelPort` to avoid needing a live database connection.
 * @param dataDirOverride - Optional override for the data directory path (used in tests).
 * @returns Promise that resolves when all PostTags have been seeded
 *
 * @throws {Error} When the database insert fails for a reason other than idempotency
 *
 * @example
 * ```ts
 * await seedPostTags();
 * // Inserts 34 PostTags with slug, name, description, color, lifecycleState=ACTIVE,
 * // createdById=SYSTEM_USER_ID
 * ```
 */
export async function seedPostTags(
    postTagModelOverride?: PostTagModelPort,
    dataDirOverride?: string
): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING POST TAGS (SPEC-086 R-4)`);

    const postTagModel: PostTagModelPort = postTagModelOverride ?? new PostTagModel();
    const dataDir = dataDirOverride ?? resolve(import.meta.dirname, '../data/postTag');

    try {
        const tagDefs = await loadPostTagFiles(dataDir);

        logger.info(
            `${STATUS_ICONS.Info} Found ${tagDefs.length} PostTag definition(s) to process`
        );

        let created = 0;
        let skipped = 0;

        for (const tagDef of tagDefs) {
            // Idempotency guard: PostTags are unique by slug (D-018, post_tags_slug_uq).
            // Checking by slug is the natural key for PostTags since it drives URLs.
            const existing = await postTagModel.findOne({ slug: tagDef.slug });

            if (existing) {
                logger.info(
                    `${STATUS_ICONS.Skip} PostTag "${tagDef.name}" (slug: "${tagDef.slug}") already exists, skipping.`
                );
                skipped++;
                continue;
            }

            await postTagModel.create({
                name: tagDef.name,
                slug: tagDef.slug,
                description: tagDef.description,
                color: tagDef.color,
                lifecycleState: tagDef.lifecycleState,
                createdById: SYSTEM_USER_ID
            });

            logger.info(
                `${STATUS_ICONS.Success} Created PostTag: "${tagDef.name}" (slug: "${tagDef.slug}")`
            );
            created++;
        }

        logger.info(
            `${STATUS_ICONS.Success} PostTags done — created: ${created}, skipped: ${skipped}`
        );
        summaryTracker.trackSuccess('Post Tags');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed PostTags: ${message}`);
        summaryTracker.trackError('Post Tags', 'post-tags', message);
        throw error;
    }
}
