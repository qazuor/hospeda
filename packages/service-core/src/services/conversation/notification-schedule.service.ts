import type { DrizzleClient } from '@repo/db';
import { NotificationScheduleModel } from '@repo/db';
import type { SelectConversationNotificationSchedule } from '@repo/db';
import { NotificationRecipientSideEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Initial notification delay after a new message: 30 minutes in milliseconds. */
const INITIAL_DELAY_MS = 30 * 60 * 1000;

/** Delay before the second notification (streak 2): 24 hours from streak start. */
const STREAK_2_OFFSET_MS = 24 * 60 * 60 * 1000;

/** Delay before the third notification (streak 3): 72 hours from streak start. */
const STREAK_3_OFFSET_MS = 72 * 60 * 60 * 1000;

/** Maximum streak count. At this value the schedule is cancelled after dispatch. */
const MAX_STREAK = 3;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const UpsertForMessageInputSchema = z.object({
    conversationId: z.string().uuid(),
    recipientSide: z.nativeEnum(NotificationRecipientSideEnum)
});

const CancelForRecipientInputSchema = z.object({
    conversationId: z.string().uuid(),
    recipientSide: z.nativeEnum(NotificationRecipientSideEnum)
});

const CancelAllInputSchema = z.object({
    conversationId: z.string().uuid()
});

const FindDueInputSchema = z.object({
    now: z.date()
});

const AdvanceScheduleInputSchema = z.object({
    scheduleId: z.string().uuid(),
    currentStreakCount: z.number().int().min(1).max(MAX_STREAK)
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result of an `advanceSchedule` call.
 * `null` indicates the schedule was cancelled (streak 3 dispatched).
 */
export type AdvanceScheduleResult = SelectConversationNotificationSchedule | null;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages notification schedules for the guest-owner conversation messaging system.
 *
 * Each `(conversation_id, recipient_side)` pair has at most one active
 * (non-cancelled) schedule at a time, enforced by a partial unique index in the DB.
 *
 * Notification streak model (per AC-006-05, AC-006-06):
 * - Streak 1: dispatch after `now + 30 min`.
 * - Streak 2: dispatch at `streakStartedAt + 24h` (next email is 24h after first unread).
 * - Streak 3: dispatch at `streakStartedAt + 72h` (final email 72h after first unread).
 * - After streak 3: `cancelled_at = now`, no further emails until new activity.
 * - New activity (guest or owner sends a message): streak resets to 1 unconditionally.
 *
 * @example
 * ```ts
 * const svc = new NotificationScheduleService({ logger });
 * // On new message from guest to owner:
 * await svc.upsertForMessage(actor, { conversationId, recipientSide: NotificationRecipientSideEnum.OWNER }, ctx);
 * ```
 */
export class NotificationScheduleService extends BaseService {
    static readonly ENTITY_NAME = 'conversationNotificationSchedule';

    protected override readonly entityName = NotificationScheduleService.ENTITY_NAME;

    private readonly model: NotificationScheduleModel;

    /**
     * Creates a new NotificationScheduleService instance.
     *
     * @param config - Service configuration (logger, etc.).
     * @param model - Optional NotificationScheduleModel for dependency injection / testing.
     */
    constructor(config: ServiceConfig, model?: NotificationScheduleModel) {
        super(config, NotificationScheduleService.ENTITY_NAME);
        this.model = model ?? new NotificationScheduleModel();
    }

    // -------------------------------------------------------------------------
    // Permission helpers
    // -------------------------------------------------------------------------

    /**
     * Verifies the actor holds a conversation-level write permission.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks sufficient permissions.
     */
    private _requireWriteAccess(actor: Actor): void {
        const allowed =
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY);

        if (!actor.id || !allowed) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions for notification schedule operations'
            );
        }
    }

    /**
     * Verifies the actor holds admin-level conversation access.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks CONVERSATION_VIEW_ANY.
     */
    private _requireAdminAccess(actor: Actor): void {
        if (!actor.id || !actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: CONVERSATION_VIEW_ANY required for schedule administration'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Creates or resets the notification schedule for a recipient when a new
     * message arrives.
     *
     * Always resets the streak to 1 and sets `pending_notification_at = now + 30 min`,
     * even if the existing schedule already has `streak_count >= 3`. This implements
     * AC-006-06: new activity unconditionally restarts the notification cycle.
     *
     * The upsert is handled by `model.upsertSchedule` which issues an
     * `INSERT … ON CONFLICT DO UPDATE` to respect the partial unique index.
     *
     * Must be called inside the same transaction as the message insert.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ conversationId, recipientSide }`.
     * @param ctx - Optional service context — `ctx.tx` is required in production
     *   to keep the schedule upsert atomic with the message insert.
     * @returns ServiceOutput wrapping the upserted schedule row.
     *
     * @example
     * ```ts
     * // Inside a transaction after inserting a guest message:
     * await svc.upsertForMessage(actor, {
     *   conversationId,
     *   recipientSide: NotificationRecipientSideEnum.OWNER
     * }, ctx);
     * ```
     */
    public async upsertForMessage(
        actor: Actor,
        input: { conversationId: string; recipientSide: NotificationRecipientSideEnum },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversationNotificationSchedule>> {
        return this.runWithLoggingAndValidation({
            methodName: 'upsertForMessage',
            input: { actor, ...input },
            schema: UpsertForMessageInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireWriteAccess(validatedActor);

                if (!execCtx?.tx) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'upsertForMessage requires a transaction context (ctx.tx)'
                    );
                }

                const scheduledAt = new Date(Date.now() + INITIAL_DELAY_MS);

                return this.model.upsertSchedule(
                    validated.conversationId,
                    validated.recipientSide,
                    scheduledAt,
                    execCtx.tx
                );
            }
        });
    }

    /**
     * Cancels the active notification schedule for one recipient side.
     *
     * Called when the target recipient reads the conversation or sends a reply,
     * clearing their unread streak without affecting the other side.
     *
     * Sets `cancelled_at = now` on the row; the row is retained for audit purposes.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ conversationId, recipientSide }`.
     * @param tx - Required Drizzle transaction client — cancellation must be atomic
     *   with the read/reply operation that triggers it.
     * @returns ServiceOutput wrapping `{ count }` — 0 if no active schedule existed, 1 otherwise.
     *
     * @example
     * ```ts
     * // When owner reads the conversation:
     * await svc.cancelForRecipient(actor, {
     *   conversationId,
     *   recipientSide: NotificationRecipientSideEnum.OWNER
     * }, tx);
     * ```
     */
    public async cancelForRecipient(
        actor: Actor,
        input: { conversationId: string; recipientSide: NotificationRecipientSideEnum },
        tx: DrizzleClient
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancelForRecipient',
            input: { actor, ...input },
            schema: CancelForRecipientInputSchema,
            execute: async (validated, validatedActor) => {
                this._requireWriteAccess(validatedActor);
                const count = await this.model.cancelForSide(
                    validated.conversationId,
                    validated.recipientSide,
                    tx
                );
                return { count };
            }
        });
    }

    /**
     * Cancels all active notification schedules for a conversation.
     *
     * Called on BLOCK transition, admin soft-delete cascade, or any event that
     * permanently silences notifications for the entire conversation.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ conversationId }`.
     * @param tx - Required Drizzle transaction client.
     * @returns ServiceOutput wrapping `{ count }` — number of schedules cancelled.
     *
     * @example
     * ```ts
     * await svc.cancelAllForConversation(actor, { conversationId }, tx);
     * ```
     */
    public async cancelAllForConversation(
        actor: Actor,
        input: { conversationId: string },
        tx: DrizzleClient
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancelAllForConversation',
            input: { actor, ...input },
            schema: CancelAllInputSchema,
            execute: async (validated, validatedActor) => {
                this._requireAdminAccess(validatedActor);
                const count = await this.model.cancelForConversation(validated.conversationId, tx);
                return { count };
            }
        });
    }

    /**
     * Finds all notification schedules that are due for email dispatch.
     *
     * A schedule is due when:
     * - `pending_notification_at <= now`
     * - `cancelled_at IS NULL`
     *
     * Used by the notification cron job (runs every 5 minutes).
     *
     * @param actor - Actor performing the query (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ now }` — reference timestamp (typically `new Date()`).
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping an array of due schedule rows.
     *
     * @example
     * ```ts
     * const { data } = await svc.findDue(actor, { now: new Date() });
     * for (const schedule of data ?? []) {
     *   await dispatchNotificationEmail(schedule);
     * }
     * ```
     */
    public async findDue(
        actor: Actor,
        input: { now: Date },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversationNotificationSchedule[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findDue',
            input: { actor, ...input },
            schema: FindDueInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireAdminAccess(validatedActor);
                return this.model.findDue(validated.now, execCtx?.tx);
            }
        });
    }

    /**
     * Advances a notification schedule to the next streak step after an email is dispatched.
     *
     * Streak progression:
     * - Streak 1 → 2: `pending_notification_at = streakStartedAt + 24h`, `streak_count = 2`
     * - Streak 2 → 3: `pending_notification_at = streakStartedAt + 72h`, `streak_count = 3`
     * - Streak 3 → terminal: `cancelled_at = now` — no further emails until new activity
     *
     * Returns `null` when the schedule is cancelled (streak 3 was the last dispatch).
     *
     * @param actor - Actor performing the advance (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ scheduleId, currentStreakCount }`.
     * @param ctx - Optional service context — `ctx.tx` recommended for atomicity with
     *   the email dispatch confirmation.
     * @returns ServiceOutput wrapping the updated row, or `null` if cancelled.
     *
     * @example
     * ```ts
     * await dispatchEmail(schedule);
     * const result = await svc.advanceSchedule(actor, {
     *   scheduleId: schedule.id,
     *   currentStreakCount: schedule.streakCount
     * }, ctx);
     * // result.data === null means no more emails until new activity
     * ```
     */
    public async advanceSchedule(
        actor: Actor,
        input: { scheduleId: string; currentStreakCount: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AdvanceScheduleResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'advanceSchedule',
            input: { actor, ...input },
            schema: AdvanceScheduleInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireAdminAccess(validatedActor);

                // Fetch the current schedule row to read streakStartedAt
                const schedule = await this.model.findById(validated.scheduleId, execCtx?.tx);
                if (!schedule) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Notification schedule not found: ${validated.scheduleId}`
                    );
                }

                const now = new Date();

                if (validated.currentStreakCount >= MAX_STREAK) {
                    // Terminal: cancel the schedule after the 3rd notification is dispatched
                    const cancelled = await this.model.update(
                        { id: validated.scheduleId },
                        { cancelledAt: now, updatedAt: now },
                        execCtx?.tx
                    );
                    // Return null to signal the caller that no more notifications will be sent
                    void cancelled; // cancelled row is irrelevant to the caller
                    return null;
                }

                const nextStreakCount = validated.currentStreakCount + 1;
                const streakStartMs = schedule.streakStartedAt.getTime();

                let nextPendingAt: Date;
                if (nextStreakCount === 2) {
                    // Second notification: 24h after streak started
                    nextPendingAt = new Date(streakStartMs + STREAK_2_OFFSET_MS);
                } else {
                    // Third notification: 72h after streak started
                    nextPendingAt = new Date(streakStartMs + STREAK_3_OFFSET_MS);
                }

                const updated = await this.model.update(
                    { id: validated.scheduleId },
                    {
                        streakCount: nextStreakCount,
                        pendingNotificationAt: nextPendingAt,
                        updatedAt: now
                    },
                    execCtx?.tx
                );

                return updated;
            }
        });
    }
}
