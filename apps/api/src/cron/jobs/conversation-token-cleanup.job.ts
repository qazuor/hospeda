/**
 * Conversation Token Cleanup Cron Job
 *
 * Revokes expired access tokens in the `conversation_access_tokens` table.
 *
 * A token is considered expired when `expires_at <= now` AND `revoked_at IS NULL`.
 * This job stamps `revoked_at = now` on all such tokens, marking them permanently
 * invalid without physically deleting the rows (retained for audit purposes).
 *
 * Design notes:
 * - Passive cleanup only — no emails sent.
 * - Uses a direct Drizzle UPDATE (not the AccessTokenService) because the
 *   service `revokeAllForConversation` is per-conversation and would require
 *   an N+1 loop. The cron issues a single bulk UPDATE with a WHERE clause.
 * - Advisory lock (ID 43022) prevents overlapping runs.
 *
 * Schedule: daily at 03:00 UTC (midnight Argentina time).
 * Advisory lock: 43022
 *
 * @module cron/jobs/conversation-token-cleanup
 */

import { conversationAccessTokens, getDb, sql, withTransaction } from '@repo/db';
import { and, isNull, lte } from 'drizzle-orm';
import type { CronJobDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PostgreSQL advisory lock ID reserved for this job. */
const ADVISORY_LOCK_ID = 43022;

// ---------------------------------------------------------------------------
// Discriminated union for withTransaction return
// ---------------------------------------------------------------------------

type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Conversation token cleanup cron job.
 *
 * Schedule: daily at 03:00 UTC
 * Advisory lock: 43022
 */
export const conversationTokenCleanupJob: CronJobDefinition = {
    name: 'conversation-token-cleanup',
    description: 'Revoke expired anonymous guest conversation access tokens',
    schedule: '0 3 * * *',
    enabled: true,
    timeoutMs: 60000, // 1 minute

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        let processed = 0;
        let errors = 0;

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                // Acquire advisory lock to prevent overlapping runs
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting conversation-token-cleanup cron', {
                    dryRun,
                    startedAt: startedAt.toISOString()
                });

                const now = new Date();

                if (dryRun) {
                    // In dry run, count how many tokens would be revoked without updating
                    const db = getDb();
                    const countResult = await db
                        .select({ id: conversationAccessTokens.id })
                        .from(conversationAccessTokens)
                        .where(
                            and(
                                lte(conversationAccessTokens.expiresAt, now),
                                isNull(conversationAccessTokens.revokedAt)
                            )
                        );

                    const count = countResult.length;

                    logger.info('Dry run — would revoke expired tokens', { count });

                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run: would revoke ${count} expired token(s)`,
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime(),
                        details: { dryRun: true, wouldRevoke: count }
                    };
                }

                // Bulk revoke: stamp revokedAt on all expired, non-revoked tokens
                const db = getDb();
                const updateResult = await db
                    .update(conversationAccessTokens)
                    .set({ revokedAt: now })
                    .where(
                        and(
                            lte(conversationAccessTokens.expiresAt, now),
                            isNull(conversationAccessTokens.revokedAt)
                        )
                    )
                    .returning({ id: conversationAccessTokens.id });

                processed = updateResult.length;

                const durationMs = Date.now() - startedAt.getTime();

                logger.info('conversation-token-cleanup cron completed', {
                    revokedCount: processed,
                    errors,
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: `Revoked ${processed} expired token(s)`,
                    processed,
                    errors,
                    durationMs,
                    details: { revokedCount: processed }
                };
            });

            if (cronResult.skipped) {
                logger.warn(
                    'conversation-token-cleanup cron: skipping — previous run holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped — another instance is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                ...(cronResult.details ? { details: cronResult.details } : {})
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('conversation-token-cleanup cron failed with unhandled error', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `Failed: ${errorMessage}`,
                processed,
                errors,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
