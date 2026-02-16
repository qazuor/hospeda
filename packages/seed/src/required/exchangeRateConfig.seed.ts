import { ExchangeRateConfigService } from '@repo/service-core';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Seeds the exchange rate configuration.
 *
 * Since ExchangeRateConfigService is a singleton that uses updateConfig
 * (not standard CRUD create), this seed manually loads the JSON config
 * and applies it via updateConfig instead of using createSeedFactory.
 *
 * @param context - Seed context with configuration and utilities
 */
export async function seedExchangeRateConfig(context: SeedContext): Promise<void> {
    const entityName = 'ExchangeRateConfig';

    logger.info(`Seeding ${entityName}...`);

    try {
        if (!context.actor) {
            throw new Error('Actor not available in context. Super admin must be loaded first.');
        }

        const actor = context.actor;

        // Load the default config JSON
        const configs = await loadJsonFiles<Record<string, unknown>>(
            'src/data/exchangeRateConfig',
            ['001-exchange-rate-config-default.json']
        );

        if (configs.length === 0) {
            logger.warn(`No config data found for ${entityName}, skipping`);
            return;
        }

        const configData = configs[0];

        // Remove metadata fields
        const { $schema: _schema, id: _id, ...cleanData } = configData;

        // Create service and apply config via updateConfig
        const serviceContext = {
            requestId: `seed-${entityName}`,
            userId: actor.id,
            permissions: actor.permissions
        };

        const service = new ExchangeRateConfigService(serviceContext);

        const result = await service.updateConfig({
            actor,
            data: cleanData
        });

        if (result.data) {
            const rateType =
                (cleanData as { defaultRateType?: string }).defaultRateType ?? 'unknown';
            logger.success({ msg: `${entityName} seeded: default=${rateType}` });
            summaryTracker.trackSuccess(entityName);
        } else {
            const errorMsg = result.error?.message ?? 'Unknown error';
            logger.error(`Failed to seed ${entityName}: ${errorMsg}`);
            summaryTracker.trackError(
                entityName,
                '001-exchange-rate-config-default.json',
                errorMsg
            );
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error seeding ${entityName}: ${errorMsg}`);
        summaryTracker.trackError(entityName, '001-exchange-rate-config-default.json', errorMsg);

        if (!context.continueOnError) {
            throw error;
        }
    }
}
