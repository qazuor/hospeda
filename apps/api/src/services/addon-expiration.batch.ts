/**
 * Addon Expiration — Batch Processing
 *
 * Extracted from addon-expiration.service.ts to keep that module under 500 lines.
 * Implements the batch orchestration loop that processes a page of expired
 * addon purchases in a single cron run.
 *
 * @module services/addon-expiration.batch
 */

import { apiLogger } from '../utils/logger.js';
import { BATCH_SIZE, findExpiredAddons } from './addon-expiration.queries.js';
import type { ServiceResult } from './addon.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of processing a batch of expired add-ons.
 */
export interface ProcessExpiredAddonsResult {
    /** Number of add-ons successfully processed in this batch. */
    processed: number;
    /** Number of add-ons that failed to process. */
    failed: number;
    /** Details of failed add-ons (purchase ID and error message). */
    errors: Array<{
        purchaseId: string;
        error: string;
    }>;
}

/**
 * Callback type for expiring a single addon purchase.
 * Matches the signature of `AddonExpirationService.expireAddon`.
 */
export type ExpireAddonFn = (input: {
    purchaseId: string;
}) => Promise<
    ServiceResult<{ purchaseId: string; customerId: string; addonSlug: string; expiredAt: Date }>
>;

// ─── Batch processor ─────────────────────────────────────────────────────────

/**
 * Processes up to {@link BATCH_SIZE} expired addon purchases in a single call.
 *
 * This function:
 * 1. Calls `findExpiredAddons()` to get the current page of expired add-ons.
 * 2. For each add-on, invokes `expireAddonFn` (per-item error isolation).
 * 3. Returns a summary with counts and per-failure details.
 *
 * Idempotent: Already-expired add-ons are skipped in `findExpiredAddons()`.
 * Safe for concurrent execution: each add-on is processed with idempotent ops.
 *
 * @param expireAddonFn - Function to call for expiring a single addon purchase.
 * @returns Processing summary with counts and errors.
 *
 * @example
 * ```ts
 * const service = new AddonExpirationService(billing);
 * const result = await processExpiredAddonsBatch(
 *   (input) => service.expireAddon(input)
 * );
 * ```
 */
export async function processExpiredAddonsBatch(
    expireAddonFn: ExpireAddonFn
): Promise<ServiceResult<ProcessExpiredAddonsResult>> {
    try {
        const findResult = await findExpiredAddons();

        if (!findResult.success) {
            return { success: false, error: findResult.error };
        }

        const toProcess = findResult.data ?? [];

        if (toProcess.length === 0) {
            apiLogger.info('No expired add-ons to process');
            return {
                success: true,
                data: { processed: 0, failed: 0, errors: [] }
            };
        }

        apiLogger.info(
            {
                batchSize: toProcess.length,
                batchLimit: BATCH_SIZE
            },
            'Starting batch processing of expired add-ons'
        );

        let processed = 0;
        let failed = 0;
        const errors: Array<{ purchaseId: string; error: string }> = [];

        for (const addon of toProcess) {
            try {
                const expireResult = await expireAddonFn({ purchaseId: addon.id });

                if (expireResult.success) {
                    processed++;
                } else {
                    failed++;
                    errors.push({
                        purchaseId: addon.id,
                        error: expireResult.error?.message ?? 'Unknown error'
                    });
                    apiLogger.warn(
                        {
                            purchaseId: addon.id,
                            customerId: addon.customerId,
                            addonSlug: addon.addonSlug,
                            error: expireResult.error
                        },
                        'Failed to expire add-on in batch'
                    );
                }
            } catch (error) {
                failed++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push({ purchaseId: addon.id, error: errorMessage });
                apiLogger.error(
                    {
                        error: errorMessage,
                        purchaseId: addon.id,
                        customerId: addon.customerId,
                        addonSlug: addon.addonSlug
                    },
                    'Exception while expiring add-on in batch'
                );
            }
        }

        apiLogger.info(
            { total: toProcess.length, processed, failed, errorCount: errors.length },
            'Completed batch processing of expired add-ons'
        );

        return { success: true, data: { processed, failed, errors } };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error({ error: errorMessage }, 'Failed to process expired add-ons batch');
        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to process expired add-ons' }
        };
    }
}
