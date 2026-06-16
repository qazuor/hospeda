import { getDb, hostTrades } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Raw shape of a hostTrade seed JSON file.
 *
 * Fields `$schema` and `id` are seed-only metadata — they are excluded from
 * the DB insert. `destinationId` and `createdById` are seed IDs (e.g.
 * `"011-destination-concepcion-del-uruguay"`) that the idMapper resolves to
 * real UUIDs at runtime.
 */
interface HostTradeSeedData {
    readonly $schema?: string;
    readonly id: string;
    readonly name: string;
    readonly slug?: string;
    readonly category: string;
    readonly contact: string;
    readonly benefit: string;
    readonly destinationId: string;
    readonly is24h: boolean;
    readonly scheduleText?: string | null;
    readonly isActive: boolean;
    readonly createdById?: string;
}

/**
 * Generates a URL-safe slug from a trade name.
 *
 * Lowercases, removes diacritics via `normalize('NFD')`, strips combining
 * characters, replaces non-alphanumeric sequences with hyphens, and trims
 * leading/trailing hyphens.
 *
 * @param name - Display name to slugify
 * @returns URL-safe slug string
 */
const slugify = (name: string): string =>
    name
        .normalize('NFD')
        .replace(/\p{Mn}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/**
 * Seeds host-trade directory entries for the example dataset.
 *
 * This seeder inserts directly via the `@repo/db` Drizzle client rather than
 * going through a service class, because `HostTradeService` is not yet
 * available in `@repo/service-core` at the time this task (T-009) runs.
 * The approach mirrors `userTags.seed.ts`.
 *
 * Ordering constraint: MUST run after destinations and users have been seeded
 * so that the idMapper already holds `destinations.*` and `users.*` mappings.
 *
 * @param context - Seed context providing the idMapper and actor
 */
export async function seedHostTrades(context: SeedContext): Promise<void> {
    const entityName = 'HostTrades';
    context.currentEntity = entityName;

    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }

    const files = exampleManifest.hostTrades;

    if (!files || files.length === 0) {
        logger.warn(`${STATUS_ICONS.Warning} No host trade files declared in manifest — skipping.`);
        return;
    }

    logger.info(`${STATUS_ICONS.Seed} Seeding ${entityName} (${files.length} entries)...`);

    const items = (await loadJsonFiles(
        'src/data/hostTrade',
        files
    )) as unknown as HostTradeSeedData[];

    const db = getDb();
    let successCount = 0;
    let errorCount = 0;

    // Set actor to SUPER_ADMIN with HOST_TRADE_CREATE permission for the duration of this seed.
    // The caller (runExampleSeeds) is responsible for saving/restoring context.actor if needed.
    context.actor = {
        id: context.actor.id,
        role: RoleEnum.SUPER_ADMIN,
        permissions: [PermissionEnum.HOST_TRADE_CREATE] as PermissionEnum[]
    };

    for (const [index, item] of items.entries()) {
        context.currentFile = files[index];

        try {
            // Resolve destinationId seed ID → real UUID
            const realDestinationId = context.idMapper.getMappedDestinationId(item.destinationId);
            if (!realDestinationId) {
                throw new Error(`No mapping found for destination ID: ${item.destinationId}`);
            }

            // Resolve createdById seed ID → real UUID (fall back to context actor)
            let realCreatedById: string | null = context.actor.id;
            if (item.createdById) {
                const mapped = context.idMapper.getMappedUserId(item.createdById);
                if (mapped) {
                    realCreatedById = mapped;
                }
                // If mapping not found, keep context.actor.id as fallback
            }

            // Build the insert row — omit $schema, id (seed-only), createdById from raw data
            const slug = item.slug ?? slugify(item.name);

            const row = {
                slug,
                name: item.name,
                category: item.category as (typeof hostTrades.$inferInsert)['category'],
                contact: item.contact,
                benefit: item.benefit,
                destinationId: realDestinationId,
                is24h: item.is24h,
                scheduleText: item.scheduleText ?? null,
                isActive: item.isActive,
                createdById: realCreatedById
            };

            const [inserted] = await db
                .insert(hostTrades)
                .values(row)
                .onConflictDoNothing()
                .returning({ id: hostTrades.id });

            const realId = inserted?.id;

            if (realId) {
                // Register the mapping so downstream seeders can reference this entry
                context.idMapper.setMapping(entityName.toLowerCase(), item.id, realId, item.name);

                logger.debug(
                    `  ${STATUS_ICONS.Success} [${index + 1}/${items.length}] "${item.name}" (${item.category}) → ${item.destinationId}`
                );
            } else {
                // onConflictDoNothing fired — slug already exists, skip silently
                logger.debug(
                    `  ${STATUS_ICONS.Info} [${index + 1}/${items.length}] "${item.name}" already exists — skipped`
                );
            }

            summaryTracker.trackSuccess(entityName);
            successCount++;
        } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(
                `  ${STATUS_ICONS.Error} [${index + 1}/${items.length}] Failed to seed "${item.name}": ${msg}`
            );

            if (!context.continueOnError) {
                throw error;
            }
        }
    }

    logger.info(
        `${STATUS_ICONS.Success} ${entityName}: ${successCount} seeded, ${errorCount} errors.`
    );
}
