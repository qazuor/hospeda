/**
 * Conversation Token Reminder — Token Resolution (HOS-129)
 *
 * Read-only helper for `conversation-token-reminder.job.ts`'s phase 1: turns
 * one due access-token row into everything needed to send its expiry
 * reminder email (recipient email, accommodation name, locale). No write
 * transaction and no advisory lock are ever open while this runs — see the
 * module doc-comment on the job file for the full two-phase rationale.
 *
 * @module cron/jobs/conversation-token-reminder.resolve
 */

import { type AccommodationModel, conversations, type getDb } from '@repo/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { CronJobContext } from '../types.js';

/** Everything needed to send one token's expiry reminder email. */
export interface ResolvedTokenReminder {
    readonly recipientEmail: string;
    readonly accommodationName: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/** Dependencies for `resolveTokenContext`, grouped RO-RO style. */
export interface ResolveTokenContextInput {
    readonly tokenId: string;
    readonly conversationId: string;
    readonly db: ReturnType<typeof getDb>;
    readonly accommodationModel: AccommodationModel;
    readonly logger: CronJobContext['logger'];
}

/**
 * Resolves a single due token into everything needed to send its expiry
 * reminder email. Read-only — no write transaction, no advisory lock.
 *
 * Returns `null` (already logged at `warn`) when the token cannot be
 * resolved: the conversation was deleted or missing, the conversation has no
 * `anonymousEmail`, or the accommodation is missing. The caller counts a
 * `null` result as an `errors` increment, same as the original single-phase
 * loop.
 *
 * @param input - Token/conversation ids plus the read-only db/model dependencies.
 * @returns The resolved reminder data, or `null` if unresolvable.
 */
export async function resolveTokenContext(
    input: ResolveTokenContextInput
): Promise<ResolvedTokenReminder | null> {
    const { tokenId, conversationId, db, accommodationModel, logger } = input;

    const convRows = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), isNull(conversations.deletedAt)))
        .limit(1);

    const conversation = convRows[0];
    if (!conversation) {
        logger.warn('Conversation not found or deleted — skipping token reminder', {
            tokenId,
            conversationId
        });
        return null;
    }

    const recipientEmail = conversation.anonymousEmail;
    if (!recipientEmail) {
        logger.warn('No anonymous email on conversation — skipping token reminder', {
            tokenId,
            conversationId
        });
        return null;
    }

    const accommodation = await accommodationModel.findById(conversation.accommodationId);
    if (!accommodation) {
        logger.warn('Accommodation not found — skipping token reminder', {
            tokenId,
            accommodationId: conversation.accommodationId
        });
        return null;
    }

    return {
        recipientEmail,
        accommodationName: accommodation.name ?? accommodation.slug,
        locale: (conversation.locale as 'es' | 'en' | 'pt' | undefined) ?? 'es'
    };
}
