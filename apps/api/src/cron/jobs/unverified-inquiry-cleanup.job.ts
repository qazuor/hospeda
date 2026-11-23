import { purgeUnverifiedInquiries } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Hard-deletes anonymous inquiries whose email was not confirmed within 7 days (HOS-2571).
 *
 * The rows hold unverified personal data, including the held message text. Verified
 * conversations are never touched.
 */
export const unverifiedInquiryCleanupJob: CronJobDefinition = {
    name: 'unverified-inquiry-cleanup',
    description: 'Delete anonymous inquiries left unverified for more than 7 days.',
    schedule: '15 3 * * *',
    enabled: true,
    timeoutMs: 60_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping unverified inquiry cleanup');
            return {
                success: true,
                message: 'Dry run',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const { deleted } = await purgeUnverifiedInquiries({ clock: getClock().clock });
            logger.info('Unverified inquiry cleanup completed', { deleted });
            return {
                success: true,
                message: `Deleted ${deleted} unverified inquiries`,
                processed: deleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { deleted }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Unverified inquiry cleanup failed', { error: message });
            return {
                success: false,
                message: `Unverified inquiry cleanup failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
