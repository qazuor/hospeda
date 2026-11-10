/**
 * AI Listing Questions Retention Job (HOS-2101)
 *
 * Hard-deletes the AI chat questions (and their answers) older than 12 months,
 * the retention the owner set for the host AI questions panel. See
 * `services/ai-listing-questions-retention.ts` for the exact scope.
 *
 * Schedule: daily at 3:45 Buenos Aires time, inside the off-peak maintenance
 * band and 15 minutes after `entity-views-purge`.
 *
 * @module cron/jobs/ai-listing-questions-retention
 */

import type { CronJobDefinition } from '../types.js';

/** Job definition. */
export const aiListingQuestionsRetentionJob: CronJobDefinition = {
    name: 'ai-listing-questions-retention',
    description: 'Hard-delete AI chat questions and answers older than 12 months (HOS-2101)',
    schedule: '45 3 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        if (dryRun) {
            logger.info('Dry run mode - skipping AI chat question purge');
            return {
                success: true,
                message: 'Dry run - no records purged',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            // Lazy import keeps the DB singleton out of module top-level (Vitest
            // fork contamination, same as entity-views-purge).
            const { purgeExpiredChatQuestions } = await import(
                '../../services/ai-listing-questions-retention.js'
            );
            const { deletedMessages, deletedConversations, cutoff } =
                await purgeExpiredChatQuestions({ now: startedAt });

            logger.info('AI chat question purge completed', {
                deletedMessages,
                deletedConversations,
                cutoff: cutoff.toISOString()
            });

            return {
                success: true,
                message: `Purged ${deletedMessages} AI chat messages and ${deletedConversations} empty conversations older than 12 months`,
                processed: deletedMessages + deletedConversations,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { deletedMessages, deletedConversations, cutoff: cutoff.toISOString() }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('AI chat question purge failed', { error: errorMessage });
            return {
                success: false,
                message: `AI chat question purge failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
