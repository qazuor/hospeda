import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SYSTEM_USER_ID, TagModel } from '@repo/db';
import { TagTypeEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Shape of one system-*.json seed file.
 *
 * Matches the tag-seeds.md canonical content spec and the `tags` table
 * columns used during seeding (no `slug` — SYSTEM tags never expose slugs).
 *
 * @internal
 */
export interface SystemTagJsonShape {
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
 * Reads all `system-*.json` files from the given directory and returns their
 * parsed contents in sorted order (alphabetical, which equals numeric order
 * because filenames are zero-padded).
 *
 * @param dataDir - Absolute path to `packages/seed/src/data/tag/`
 * @returns Array of parsed SYSTEM tag JSON objects
 *
 * @internal
 */
async function loadSystemTagFiles(dataDir: string): Promise<SystemTagJsonShape[]> {
    const entries = await readdir(dataDir);
    const systemFiles = entries.filter((f) => f.startsWith('system-') && f.endsWith('.json'));
    systemFiles.sort();

    const results: SystemTagJsonShape[] = [];
    for (const file of systemFiles) {
        const raw = await readFile(join(dataDir, file), 'utf-8');
        results.push(JSON.parse(raw) as SystemTagJsonShape);
    }
    return results;
}

/**
 * Seeds all SYSTEM tags into the `tags` table (SPEC-086 R-3).
 *
 * SYSTEM tags are generic platform tags that any authenticated admin-panel
 * user (HOST / EDITOR / ADMIN / SUPER_ADMIN) can apply for personal
 * organization within their workspace. Examples: "Favorito", "Urgente",
 * "Borrador". They are not visible in the public web.
 *
 * Reads every `system-*.json` file from `packages/seed/src/data/tag/`,
 * inserts one `tags` row per file, and skips any tag that already exists
 * by matching `(type, name)` — making this seed fully idempotent.
 *
 * Invariants enforced at insert time:
 *   - `type = SYSTEM`
 *   - `ownerId = NULL`
 *   - `createdById = SYSTEM_USER_ID`
 *   - No `slug` column is set (SYSTEM tags have no public slug — D-002)
 *
 * The system user (SPEC-086 R-1) must be present before calling this seed
 * because `createdById` references `SYSTEM_USER_ID`.
 *
 * @param tagModelOverride - Optional model override for dependency injection in tests.
 *   Pass a mock `TagModelPort` to avoid needing a live database connection.
 * @param dataDirOverride - Optional override for the data directory path (used in tests).
 * @returns Promise that resolves when all SYSTEM tags have been seeded
 *
 * @throws {Error} When the database insert fails for a reason other than idempotency
 *
 * @example
 * ```ts
 * await seedSystemTags();
 * // Inserts 30 SYSTEM tags with type=SYSTEM, ownerId=NULL, createdById=SYSTEM_USER_ID
 * ```
 */
export async function seedSystemTags(
    tagModelOverride?: TagModelPort,
    dataDirOverride?: string
): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING SYSTEM TAGS (SPEC-086 R-3)`);

    const tagModel: TagModelPort = tagModelOverride ?? new TagModel();
    const dataDir = dataDirOverride ?? resolve(import.meta.dirname, '../data/tag');

    try {
        const tagDefs = await loadSystemTagFiles(dataDir);

        logger.info(
            `${STATUS_ICONS.Info} Found ${tagDefs.length} SYSTEM tag definition(s) to process`
        );

        let created = 0;
        let skipped = 0;

        for (const tagDef of tagDefs) {
            // Idempotency guard: check by (type, name) combination
            const existing = await tagModel.findOne({
                type: TagTypeEnum.SYSTEM,
                name: tagDef.name
            });

            if (existing) {
                logger.info(
                    `${STATUS_ICONS.Skip} SYSTEM tag "${tagDef.name}" already exists, skipping.`
                );
                skipped++;
                continue;
            }

            await tagModel.create({
                name: tagDef.name,
                description: tagDef.description,
                color: tagDef.color,
                lifecycleState: tagDef.lifecycleState,
                type: TagTypeEnum.SYSTEM,
                ownerId: null,
                createdById: SYSTEM_USER_ID
            });

            logger.info(`${STATUS_ICONS.Success} Created SYSTEM tag: "${tagDef.name}"`);
            created++;
        }

        logger.info(
            `${STATUS_ICONS.Success} SYSTEM tags done — created: ${created}, skipped: ${skipped}`
        );
        summaryTracker.trackSuccess('System Tags');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed SYSTEM tags: ${message}`);
        summaryTracker.trackError('System Tags', 'system-tags', message);
        throw error;
    }
}
