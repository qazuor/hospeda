/**
 * Cloudinary E2E Cleanup Cron Job
 *
 * Weekly housekeeping that removes leftover Cloudinary assets stored under
 * the `hospeda/e2e/` prefix. SPEC-092 E2E runs upload to
 * `hospeda/e2e/{run-id}/` and clean up in the test's `afterAll` hook.
 * Runs that crash before cleanup leave orphan assets behind; this cron
 * sweeps them weekly so the Cloudinary account never accumulates them.
 *
 * Operates on the entire `hospeda/e2e/` namespace because:
 *   - No production code writes to this prefix.
 *   - E2E runs never last longer than 1 hour, so weekly sweeps cannot
 *     delete an in-flight run unless the run is already long-broken.
 *
 * Production guard:
 *   The handler refuses to run when `NODE_ENV === 'production'`. Production
 *   uploads use `hospeda/prod/...`, so cleaning an e2e prefix there is
 *   either a no-op or a foot-gun if a service mis-wrote.
 *
 * SPEC-092 T-038.
 *
 * @module cron/jobs/cloudinary-e2e-cleanup
 */

import { getMediaProvider } from '../../services/media.js';
import { env } from '../../utils/env.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Cloudinary folder prefix swept by this cron.
 *
 * Populated only by SPEC-092 E2E runs (see apps/e2e/fixtures/cloudinary-client.ts
 * `buildE2eFolderRoot()`). Must NOT contain any data outside test runs.
 */
const E2E_PREFIX = 'hospeda/e2e/' as const;

/**
 * Cloudinary E2E cleanup cron job definition.
 *
 * Schedule: Weekly on Sunday at 02:00 UTC (after media-orphan-cleanup at 00:00).
 * Purpose: Bulk-delete leftover E2E Cloudinary assets when test cleanup
 * hooks failed to run.
 */
export const cloudinaryE2eCleanupJob: CronJobDefinition = {
    name: 'cloudinary-e2e-cleanup',
    description: 'Weekly cleanup of leftover SPEC-092 E2E Cloudinary assets (hospeda/e2e/)',
    schedule: '0 2 * * 0',
    enabled: true,
    timeoutMs: 60_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting Cloudinary E2E cleanup job', {
            dryRun,
            startedAt: startedAt.toISOString(),
            prefix: E2E_PREFIX
        });

        if (env.NODE_ENV === 'production') {
            logger.warn(
                'Cloudinary E2E cleanup skipped: NODE_ENV is production — hospeda/e2e/ is not used in prod'
            );
            return {
                success: true,
                message: 'Skipped in production environment',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { skipped: true, reason: 'production' }
            };
        }

        const provider = getMediaProvider();
        if (!provider) {
            logger.warn('Cloudinary E2E cleanup skipped: media provider not configured');
            return {
                success: true,
                message: 'Skipped: media provider not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { skipped: true, reason: 'no-provider' }
            };
        }

        if (dryRun) {
            logger.info('Dry-run: would delete prefix', { prefix: E2E_PREFIX });
            return {
                success: true,
                message: `Dry-run: would delete prefix ${E2E_PREFIX}`,
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true, prefix: E2E_PREFIX }
            };
        }

        let errors = 0;
        try {
            await provider.deleteByPrefix({ prefix: E2E_PREFIX });
            logger.info('Deleted E2E prefix successfully', { prefix: E2E_PREFIX });
        } catch (error) {
            errors += 1;
            logger.error('Failed to delete E2E prefix', {
                prefix: E2E_PREFIX,
                error: error instanceof Error ? error.message : String(error)
            });
        }

        const durationMs = Date.now() - startedAt.getTime();
        return {
            success: errors === 0,
            message:
                errors === 0
                    ? `Cleaned ${E2E_PREFIX} successfully`
                    : `Cleanup encountered ${errors} error(s)`,
            processed: errors === 0 ? 1 : 0,
            errors,
            durationMs,
            details: { prefix: E2E_PREFIX }
        };
    }
};
