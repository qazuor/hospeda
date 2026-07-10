/**
 * Conversation Notification — Schedule Resolution (HOS-112)
 *
 * Read-only helper for `conversation-notification.job.ts`'s phase 1: turns one
 * due `conversation_notification_schedules` row into everything needed to
 * send its notification email (recipient, template, subject). No write
 * transaction and no advisory lock are ever open while this runs — see the
 * module doc-comment on the job file for the full three-phase rationale.
 *
 * @module cron/jobs/conversation-notification.resolve
 */

import {
    type AccommodationModel,
    conversations,
    type getDb,
    messages,
    type SelectConversationNotificationSchedule,
    type UserModel
} from '@repo/db';
import { ConversationNewMessage, ConversationNewMessageAnon } from '@repo/notifications';
import { NotificationRecipientSideEnum } from '@repo/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { env } from '../../utils/env.js';
import type { CronJobContext } from '../types.js';

/** Maximum number of recent message excerpts included in the email body. */
const MAX_MESSAGE_EXCERPTS = 3;

/**
 * Rendered email template type, inferred from the notification templates
 * themselves rather than importing `ReactElement` from `react` directly —
 * `apps/api` has no `@types/react` of its own (this is a server package;
 * `@repo/notifications` and `@repo/email` carry that dependency).
 */
type EmailTemplate = ReturnType<typeof ConversationNewMessage>;

/** Everything needed to send one schedule's notification email. */
export interface ResolvedNotification {
    readonly scheduleId: string;
    readonly streakCount: number;
    readonly recipientSide: SelectConversationNotificationSchedule['recipientSide'];
    readonly recipientEmail: string;
    readonly subject: string;
    readonly emailTemplate: EmailTemplate;
}

/** Dependencies for `resolveNotification`, grouped RO-RO style. */
export interface ResolveNotificationInput {
    readonly schedule: SelectConversationNotificationSchedule;
    readonly db: ReturnType<typeof getDb>;
    readonly accommodationModel: AccommodationModel;
    readonly userModel: UserModel;
    readonly logger: CronJobContext['logger'];
}

/**
 * Resolves a single due schedule into everything needed to send its
 * notification email. Read-only — no write transaction, no advisory lock.
 *
 * Returns `null` (already logged at `warn`) when the schedule cannot be
 * resolved: the conversation was deleted, the accommodation is missing, an
 * anonymous guest has no email, an owner recipient has no `ownerId`, or no
 * recipient email could be found at all. The caller counts a `null` result
 * as an `errors` increment, same as the original single-phase loop.
 *
 * @param input - Schedule row plus the read-only model/db dependencies.
 * @returns The resolved notification data, or `null` if unresolvable.
 */
export async function resolveNotification(
    input: ResolveNotificationInput
): Promise<ResolvedNotification | null> {
    const { schedule, db, accommodationModel, userModel, logger } = input;
    const scheduleId = schedule.id;

    // Fetch conversation (skip if soft-deleted)
    const convRows = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, schedule.conversationId), isNull(conversations.deletedAt)))
        .limit(1);

    const conversation = convRows[0];
    if (!conversation) {
        logger.warn('Conversation not found or deleted — skipping schedule', {
            scheduleId,
            conversationId: schedule.conversationId
        });
        return null;
    }

    // Fetch accommodation
    const accommodation = await accommodationModel.findById(conversation.accommodationId);
    if (!accommodation) {
        logger.warn('Accommodation not found for conversation', {
            scheduleId,
            accommodationId: conversation.accommodationId
        });
        return null;
    }

    const accommodationName = accommodation.name ?? accommodation.slug;

    // Fetch recent message excerpts
    const recentMessages = await db
        .select({ body: messages.body, createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.conversationId, schedule.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(MAX_MESSAGE_EXCERPTS);

    const messageExcerpts = recentMessages.reverse().map((m) => ({
        excerpt: m.body,
        timestamp: m.createdAt.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    }));

    // Determine recipient email and CTA URL
    const isGuestRecipient = schedule.recipientSide === NotificationRecipientSideEnum.GUEST;

    let recipientEmail: string | null = null;
    let guestIdentity: string;
    let ctaUrl: string;
    let isAnonymous = false;

    if (isGuestRecipient) {
        if (conversation.userId) {
            // Authenticated guest
            const user = await userModel.findById(conversation.userId);
            recipientEmail = user?.email ?? null;
            guestIdentity = user?.displayName ?? user?.email ?? 'Invitado';
            ctaUrl = `${env.HOSPEDA_SITE_URL}/es/mensajes/${schedule.conversationId}`;
        } else if (conversation.anonymousEmail) {
            // Anonymous guest
            isAnonymous = true;
            recipientEmail = conversation.anonymousEmail;
            guestIdentity = conversation.anonymousName ?? conversation.anonymousEmail;
            ctaUrl = `${env.HOSPEDA_SITE_URL}/guest/messages/${schedule.conversationId}`;
        } else {
            logger.warn('Anonymous guest has no email — skipping schedule', { scheduleId });
            return null;
        }
    } else {
        // Owner recipient — use accommodation owner
        const ownerId = accommodation.ownerId;
        if (!ownerId) {
            logger.warn('Accommodation has no ownerId — skipping schedule', {
                scheduleId,
                accommodationId: conversation.accommodationId
            });
            return null;
        }
        const owner = await userModel.findById(ownerId);
        recipientEmail = owner?.email ?? null;
        guestIdentity = conversation.anonymousName ?? conversation.anonymousEmail ?? 'Huésped';
        ctaUrl = `${env.HOSPEDA_SITE_URL}/es/mensajes/${schedule.conversationId}`;
    }

    if (!recipientEmail) {
        logger.warn('No recipient email resolved — skipping schedule', {
            scheduleId,
            conversationId: schedule.conversationId,
            recipientSide: schedule.recipientSide
        });
        return null;
    }

    // Build email template
    const locale = (conversation.locale as 'es' | 'en' | 'pt' | undefined) ?? 'es';
    const emailTemplate = isAnonymous
        ? ConversationNewMessageAnon({
              accommodationName,
              guestIdentity,
              messages: messageExcerpts,
              ctaUrl,
              locale
          })
        : ConversationNewMessage({
              accommodationName,
              guestIdentity,
              messages: messageExcerpts,
              ctaUrl,
              locale
          });

    return {
        scheduleId,
        streakCount: schedule.streakCount,
        recipientSide: schedule.recipientSide,
        recipientEmail,
        subject: `Nuevo mensaje sobre ${accommodationName}`,
        emailTemplate
    };
}
