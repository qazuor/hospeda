/**
 * Media Orphan Cleanup Cron Job
 *
 * Weekly housekeeping that removes leftover Cloudinary assets stored under
 * the disposable `hospeda/preview/` and `hospeda/test/` prefixes. These
 * prefixes are populated by preview deploys and integration test runs;
 * neither should ever appear in production data, so it is safe to wipe
 * them in bulk on a schedule.
 *
 * SPEC-078-GAPS GAP-078-231.
 *
 * Production guard:
 *   The handler refuses to run when `NODE_ENV === 'production'`. Production
 *   uploads use the `hospeda/prod/...` namespace, so cleaning preview/test
 *   prefixes there is at best a no-op and at worst a foot-gun if a misconfigured
 *   service ever wrote to them. The job stays registered (so admins can
 *   inspect it from the cron dashboard) but the handler short-circuits with
 *   a no-op result.
 *
 * @module cron/jobs/media-orphan-cleanup
 */

import { getMediaProvider } from '../../services/media.js';
import { env } from '../../utils/env.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Cloudinary folder prefixes considered safe to wipe weekly.
 *
 * Both prefixes are populated only by ephemeral environments (preview
 * deploys, CI integration tests) and must not contain any production data.
 */
const ORPHAN_PREFIXES = ['hospeda/preview/', 'hospeda/test/'] as const;

/**
 * Media orphan cleanup cron job definition.
 *
 * Schedule: Weekly on Sunday at 00:00 UTC.
 * Purpose: Bulk-delete preview and test Cloudinary assets to keep storage
 * costs bounded.
 */
export const mediaOrphanCleanupJob: CronJobDefinition = {
    name: 'media-orphan-cleanup',
    description:
        'Weekly cleanup of disposable Cloudinary prefixes (hospeda/preview/, hospeda/test/)',
    schedule: '0 0 * * 0', // Sundays at 00:00 UTC
    enabled: true,
    timeoutMs: 60_000, // 1 minute is plenty for two delete-by-prefix calls

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting media orphan cleanup job', {
            dryRun,
            startedAt: startedAt.toISOString(),
            prefixes: [...ORPHAN_PREFIXES]
        });

        if (env.NODE_ENV === 'production') {
            logger.warn(
                'Media orphan cleanup skipped: NODE_ENV is production - preview/test prefixes are not used in prod'
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
            logger.warn('Media orphan cleanup skipped: media provider not configured');
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
            logger.info('Dry run mode - skipping actual deletion');
            return {
                success: true,
                message: 'Dry run - no prefixes deleted',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true, prefixes: [...ORPHAN_PREFIXES] }
            };
        }

        let processed = 0;
        let errors = 0;
        const failures: Array<{ prefix: string; error: string }> = [];

        for (const prefix of ORPHAN_PREFIXES) {
            try {
                await provider.deleteByPrefix({ prefix });
                processed += 1;
                logger.info('Deleted orphan prefix', { prefix });
            } catch (error) {
                errors += 1;
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ prefix, error: message });
                logger.error('Failed to delete orphan prefix', { prefix, error: message });
            }
        }

        const durationMs = Date.now() - startedAt.getTime();
        const success = errors === 0;

        logger.info('Media orphan cleanup job completed', {
            processed,
            errors,
            durationMs,
            success
        });

        return {
            success,
            message: success
                ? `Cleaned ${processed} orphan prefix(es)`
                : `Cleaned ${processed} prefix(es) with ${errors} failure(s)`,
            processed,
            errors,
            durationMs,
            details: {
                prefixes: [...ORPHAN_PREFIXES],
                failures: failures.length > 0 ? failures : undefined
            }
        };
    }
};
