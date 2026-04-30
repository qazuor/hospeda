import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SYSTEM_USER_ID, TagModel } from '@repo/db';
import { TagTypeEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Shape of one internal-*.json seed file.
 *
 * Matches the tag-seeds.md canonical content spec and the `tags` table
 * columns used during seeding (no `slug` — INTERNAL tags never expose slugs).
 *
 * @internal
 */
export interface InternalTagJsonShape {
    name: string;
    description: string;
    color: string;
    lifecycleState: string;
}

/**
 * Minimal interface for the tag model operations used by this seed.
 *
 * Using a port (interface) instead of the concrete `TagModel` allows unit
 * tests to inject an in-memory stub without requiring a live database
 * connection, following the same pattern as `systemUser.seed.ts`.
 *
 * @internal
 */
export interface TagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Reads all `internal-*.json` files from the given directory and returns their
 * parsed contents in sorted order (alphabetical, which equals numeric order
 * because filenames are zero-padded).
 *
 * @param dataDir - Absolute path to `packages/seed/src/data/tag/`
 * @returns Array of parsed INTERNAL tag JSON objects
 *
 * @internal
 */
async function loadInternalTagFiles(dataDir: string): Promise<InternalTagJsonShape[]> {
    const entries = await readdir(dataDir);
    const internalFiles = entries.filter((f) => f.startsWith('internal-') && f.endsWith('.json'));
    internalFiles.sort();

    const results: InternalTagJsonShape[] = [];
    for (const file of internalFiles) {
        const raw = await readFile(join(dataDir, file), 'utf-8');
        results.push(JSON.parse(raw) as InternalTagJsonShape);
    }
    return results;
}

/**
 * Seeds all INTERNAL tags into the `tags` table (SPEC-086 R-2).
 *
 * INTERNAL tags are admin-only operational labels (e.g., "Revisar contenido",
 * "Contenido sospechoso"). They are never visible to regular users and are
 * managed exclusively through the admin panel.
 *
 * Reads every `internal-*.json` file from `packages/seed/src/data/tag/`,
 * inserts one `tags` row per file, and skips any tag that already exists
 * by matching `(type, name)` — making this seed fully idempotent.
 *
 * Invariants enforced at insert time:
 *   - `type = INTERNAL`
 *   - `ownerId = NULL`
 *   - `createdById = SYSTEM_USER_ID`
 *   - No `slug` column is set (INTERNAL tags have no public slug — D-002)
 *
 * The system user (SPEC-086 R-1) must be present before calling this seed
 * because `createdById` references `SYSTEM_USER_ID`.
 *
 * @param tagModelOverride - Optional model override for dependency injection in tests.
 *   Pass a mock `TagModelPort` to avoid needing a live database connection.
 * @param dataDirOverride - Optional override for the data directory path (used in tests).
 * @returns Promise that resolves when all INTERNAL tags have been seeded
 *
 * @throws {Error} When the database insert fails for a reason other than idempotency
 *
 * @example
 * ```ts
 * await seedInternalTags();
 * // Inserts 25 INTERNAL tags with type=INTERNAL, ownerId=NULL, createdById=SYSTEM_USER_ID
 * ```
 */
export async function seedInternalTags(
    tagModelOverride?: TagModelPort,
    dataDirOverride?: string
): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING INTERNAL TAGS (SPEC-086 R-2)`);

    const tagModel: TagModelPort = tagModelOverride ?? new TagModel();
    const dataDir = dataDirOverride ?? resolve(import.meta.dirname, '../data/tag');

    try {
        const tagDefs = await loadInternalTagFiles(dataDir);

        logger.info(
            `${STATUS_ICONS.Info} Found ${tagDefs.length} INTERNAL tag definition(s) to process`
        );

        let created = 0;
        let skipped = 0;

        for (const tagDef of tagDefs) {
            // Idempotency guard: check by (type, name) combination
            const existing = await tagModel.findOne({
                type: TagTypeEnum.INTERNAL,
                name: tagDef.name
            });

            if (existing) {
                logger.info(
                    `${STATUS_ICONS.Skip} INTERNAL tag "${tagDef.name}" already exists, skipping.`
                );
                skipped++;
                continue;
            }

            await tagModel.create({
                name: tagDef.name,
                description: tagDef.description,
                color: tagDef.color,
                lifecycleState: tagDef.lifecycleState,
                type: TagTypeEnum.INTERNAL,
                ownerId: null,
                createdById: SYSTEM_USER_ID
            });

            logger.info(`${STATUS_ICONS.Success} Created INTERNAL tag: "${tagDef.name}"`);
            created++;
        }

        logger.info(
            `${STATUS_ICONS.Success} INTERNAL tags done — created: ${created}, skipped: ${skipped}`
        );
        summaryTracker.trackSuccess('Internal Tags');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed INTERNAL tags: ${message}`);
        summaryTracker.trackError('Internal Tags', 'internal-tags', message);
        throw error;
    }
}
