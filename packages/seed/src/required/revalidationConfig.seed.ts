import { RevalidationConfigModel } from '@repo/db';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Shape of each entry in the defaults JSON file.
 */
interface RevalidationConfigEntry {
    entityType: string;
    autoRevalidateOnChange: boolean;
    cronIntervalMinutes: number;
    debounceSeconds: number;
    enabled: boolean;
}

/**
 * Seeds the revalidation configuration for all known entity types.
 *
 * For each entry in the defaults JSON file, this function checks whether a
 * config record already exists for that entity type. If it does, the existing
 * record is left untouched (idempotent upsert). If it does not exist, a new
 * record is created with the default values.
 *
 * This seed is intentionally independent of any actor-based permissions — it
 * operates directly on the database model because revalidation config has no
 * service-layer auth requirements at seed time.
 *
 * @param context - Seed context with configuration and utilities
 */
export async function seedRevalidationConfig(context: SeedContext): Promise<void> {
    const entityName = 'RevalidationConfig';

    logger.info(`Seeding ${entityName}...`);

    try {
        const entries = await loadJsonFiles<RevalidationConfigEntry[]>(
            'src/data/revalidationConfig',
            ['001-revalidation-config-defaults.json']
        );

        // loadJsonFiles returns an array of parsed file contents; the first item
        // is our array of config entries since the JSON is an array at the top level.
        const configs = entries[0];

        if (!configs || configs.length === 0) {
            logger.warn(`No config data found for ${entityName}, skipping`);
            return;
        }

        const model = new RevalidationConfigModel();
        let createdCount = 0;
        let skippedCount = 0;

        for (const entry of configs) {
            const existing = await model.findByEntityType(entry.entityType);

            if (existing) {
                logger.info(`  ${entityName} "${entry.entityType}" already exists, skipping`);
                skippedCount++;
                continue;
            }

            await model.create({
                entityType: entry.entityType,
                autoRevalidateOnChange: entry.autoRevalidateOnChange,
                cronIntervalMinutes: entry.cronIntervalMinutes,
                debounceSeconds: entry.debounceSeconds,
                enabled: entry.enabled,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            logger.info(`  ${entityName} "${entry.entityType}" created`);
            createdCount++;
            summaryTracker.trackSuccess(entityName);
        }

        logger.success({
            msg: `${entityName} seeded: ${createdCount} created, ${skippedCount} already existed`
        });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error seeding ${entityName}: ${errorMsg}`);
        summaryTracker.trackError(entityName, '001-revalidation-config-defaults.json', errorMsg);

        if (!context.continueOnError) {
            throw error;
        }
    }
}
