import { moderateText } from '@repo/content-moderation';
import { AccommodationModel, ConversationModel, MessageModel } from '@repo/db';
import type { SelectMessage } from '@repo/db';
import {
    ConversationStatusEnum,
    MessageSenderTypeEnum,
    NotificationRecipientSideEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { withServiceTransaction } from '../../utils/transaction.js';
import { NotificationScheduleService } from './notification-schedule.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard maximum body length enforced by Zod and DB CHECK constraint. */
const MAX_BODY_LENGTH = 5000;

/** Default number of messages per cursor page. */
const DEFAULT_PAGE_LIMIT = 50;

/** Maximum allowed cursor page limit. */
const MAX_PAGE_LIMIT = 100;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const CreateMessageInputSchema = z.object({
    conversationId: z.string().uuid(),
    senderType: z.nativeEnum(MessageSenderTypeEnum),
    body: z.string().min(1),
    userId: z.string().uuid().optional()
});

const CreateSystemMessageInputSchema = z.object({
    conversationId: z.string().uuid(),
    body: z.string().min(1),
    actorId: z.string().uuid().optional()
});

const GetMessagesInputSchema = z.object({
    conversationId: z.string().uuid(),
    cursor: z.date().optional(),
    limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional()
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result shape returned by {@link MessageService.getMessages}.
 * Messages are ordered `created_at ASC` within the page.
 * `nextCursor` is present only when there are older messages to load.
 */
export interface GetMessagesResult {
    /** Page of messages in ascending chronological order. */
    messages: SelectMessage[];
    /** `created_at` of the oldest message in this page, used to fetch the next older page. */
    nextCursor: Date | undefined;
}

// ---------------------------------------------------------------------------
// State-machine helper
// ---------------------------------------------------------------------------

/**
 * Computes the next conversation status after a new message is inserted.
 *
 * Transition table (BLOCKED always rejected before this is reached):
 *
 * | senderType | currentStatus         | nextStatus       |
 * |------------|-----------------------|------------------|
 * | GUEST      | OPEN                  | PENDING_OWNER    |
 * | GUEST      | PENDING_GUEST         | PENDING_OWNER    |
 * | GUEST      | PENDING_OWNER         | PENDING_OWNER    |
 * | GUEST      | CLOSED                | PENDING_OWNER    |
 * | GUEST      | PENDING_VERIFICATION  | PENDING_OWNER    |
 * | OWNER      | OPEN                  | PENDING_GUEST    |
 * | OWNER      | PENDING_OWNER         | PENDING_GUEST    |
 * | OWNER      | PENDING_GUEST         | PENDING_GUEST    |
 * | OWNER      | CLOSED                | PENDING_GUEST    |
 * | OWNER      | PENDING_VERIFICATION  | PENDING_GUEST    |
 * | SYSTEM     | (any)                 | (unchanged)      |
 *
 * @param senderType - Who is sending the message.
 * @param currentStatus - Current conversation status.
 * @returns Next status to apply to the conversation.
 */
function computeNextStatus(
    senderType: MessageSenderTypeEnum,
    currentStatus: ConversationStatusEnum
): ConversationStatusEnum {
    if (senderType === MessageSenderTypeEnum.SYSTEM) {
        return currentStatus;
    }
    if (senderType === MessageSenderTypeEnum.GUEST) {
        return ConversationStatusEnum.PENDING_OWNER;
    }
    // senderType === OWNER
    return ConversationStatusEnum.PENDING_GUEST;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages message creation, content moderation, conversation metrics update,
 * and notification scheduling for the guest-owner messaging system (SPEC-085).
 *
 * Every {@link createMessage} call runs inside a single database transaction
 * that atomically:
 *  1. Validates the conversation exists and its accommodation is not soft-deleted.
 *  2. Rejects if conversation is BLOCKED.
 *  3. Runs content moderation (length + blocklist checks).
 *  4. Inserts the message row.
 *  5. Updates conversation metrics (counters, timestamps, status).
 *  6. Schedules/cancels notification tasks (skipped for SYSTEM messages).
 *
 * @example
 * ```ts
 * const svc = new MessageService({ logger });
 * const result = await svc.createMessage(
 *   actor,
 *   { conversationId, senderType: MessageSenderTypeEnum.GUEST, body: 'Hello!' }
 * );
 * if (result.data) console.log('Created message:', result.data.id);
 * ```
 */
export class MessageService extends BaseService {
    static readonly ENTITY_NAME = 'message';

    protected override readonly entityName = MessageService.ENTITY_NAME;

    private readonly messageModel: MessageModel;
    private readonly conversationModel: ConversationModel;
    private readonly accommodationModel: AccommodationModel;
    private readonly notificationScheduleSvc: NotificationScheduleService;

    /**
     * Creates a new MessageService instance.
     *
     * @param config - Service configuration (logger, etc.).
     * @param messageModel - Optional MessageModel for dependency injection / testing.
     * @param conversationModel - Optional ConversationModel for dependency injection / testing.
     * @param accommodationModel - Optional AccommodationModel for dependency injection / testing.
     * @param notificationScheduleSvc - Optional NotificationScheduleService for dependency injection / testing.
     */
    constructor(
        config: ServiceConfig,
        messageModel?: MessageModel,
        conversationModel?: ConversationModel,
        accommodationModel?: AccommodationModel,
        notificationScheduleSvc?: NotificationScheduleService
    ) {
        super(config, MessageService.ENTITY_NAME);
        this.messageModel = messageModel ?? new MessageModel();
        this.conversationModel = conversationModel ?? new ConversationModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
        this.notificationScheduleSvc =
            notificationScheduleSvc ?? new NotificationScheduleService(config);
    }

    // -------------------------------------------------------------------------
    // Permission helpers
    // -------------------------------------------------------------------------

    /**
     * Verifies the actor holds a write permission for conversation messages.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks sufficient permissions.
     */
    private _requireWriteAccess(actor: Actor): void {
        const allowed =
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY);

        if (!actor.id || !allowed) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create messages'
            );
        }
    }

    /**
     * Verifies the actor holds read access to conversation messages.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks sufficient permissions.
     */
    private _requireReadAccess(actor: Actor): void {
        const allowed =
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN);

        if (!actor.id || !allowed) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to read messages'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Content moderation
    // -------------------------------------------------------------------------

    /**
     * Validates message body against length and configurable blocklist rules.
     *
     * The length check is performed inline (not delegated to
     * `@repo/content-moderation`) because it is a structural DB constraint,
     * not a content-moderation concern. The word/domain scan is delegated to
     * `moderateText` from `@repo/content-moderation`, which reads blocklists
     * from `HOSPEDA_MESSAGING_BLOCKED_WORDS` and `HOSPEDA_MESSAGING_BLOCKED_DOMAINS`.
     *
     * @param body - Message body to validate.
     * @throws {ServiceError} VALIDATION_ERROR with reason `MESSAGE_TOO_LONG` if body exceeds 5000 chars.
     * @throws {ServiceError} VALIDATION_ERROR with reason `MESSAGE_CONTENT_BLOCKED` if body contains
     *   a blocked word or domain.
     */
    private async _validateMessageContent(body: string): Promise<void> {
        if (body.length > MAX_BODY_LENGTH) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Message body exceeds the maximum allowed length of ${MAX_BODY_LENGTH} characters`,
                undefined,
                'MESSAGE_TOO_LONG'
            );
        }

        const moderationResult = await moderateText({ text: body, context: 'message' });
        if (moderationResult.matchedTerms.length > 0) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Message body contains content that is not allowed',
                undefined,
                'MESSAGE_CONTENT_BLOCKED'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Creates a new message in a conversation, updating metrics and scheduling
     * notifications atomically inside a single database transaction.
     *
     * Pipeline (all steps within one transaction):
     * 1. Load conversation (reject if not found → CONVERSATION_NOT_FOUND).
     * 2. Load accommodation (reject if soft-deleted → ACCOMMODATION_DELETED, HTTP 410).
     * 3. Reject if conversation is BLOCKED → CONVERSATION_BLOCKED.
     * 4. Validate body content (length + blocklist → MESSAGE_TOO_LONG / MESSAGE_CONTENT_BLOCKED).
     * 5. Compute next conversation status via state machine.
     * 6. Insert message row.
     * 7. Update conversation metrics (counters, timestamps, status).
     * 8. Schedule/cancel notifications (skipped for SYSTEM senderType).
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ conversationId, senderType, body, userId? }`.
     * @param ctx - Optional service context for callers that already own a transaction.
     * @returns ServiceOutput wrapping the newly inserted message row.
     *
     * @example
     * ```ts
     * const result = await svc.createMessage(actor, {
     *   conversationId: 'uuid',
     *   senderType: MessageSenderTypeEnum.GUEST,
     *   body: 'Hello, is this place available in July?',
     *   userId: actor.id
     * });
     * ```
     */
    public async createMessage(
        actor: Actor,
        input: {
            conversationId: string;
            senderType: MessageSenderTypeEnum;
            body: string;
            userId?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectMessage>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createMessage',
            input: { actor, ...input },
            schema: CreateMessageInputSchema,
            ctx,
            execute: async (validated, validatedActor, _execCtx) => {
                this._requireWriteAccess(validatedActor);

                // Run the entire pipeline in a single transaction. If a caller-provided
                // ctx.tx is present, we still wrap in withServiceTransaction — this creates
                // an independent transaction (see withServiceTransaction docs), which is
                // acceptable here since MessageService owns its own boundary.
                return withServiceTransaction(async (txCtx) => {
                    const { conversationId, senderType, body, userId } = validated;

                    // ---- Step 1: Load conversation -----------------------------------------------
                    const conversation = await this.conversationModel.findById(
                        conversationId,
                        txCtx.tx
                    );
                    if (!conversation) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `Conversation not found: ${conversationId}`,
                            undefined,
                            'CONVERSATION_NOT_FOUND'
                        );
                    }

                    // ---- Step 2: Check accommodation soft-delete ---------------------------------
                    const accommodation = await this.accommodationModel.findById(
                        conversation.accommodationId,
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );
                    // Even a soft-deleted accommodation returns its row from findById because
                    // AccommodationModel.findById queries WITHOUT filtering deletedAt.
                    // We check deletedAt manually, matching SPEC-085 discriminator logic.
                    // Using != null (loose equality) to catch both null and undefined.
                    if (!accommodation || accommodation.deletedAt != null) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            `Accommodation has been removed: ${conversation.accommodationId}`,
                            undefined,
                            'ACCOMMODATION_DELETED'
                        );
                    }

                    // ---- Step 3: Reject BLOCKED conversations ------------------------------------
                    if (conversation.status === ConversationStatusEnum.BLOCKED) {
                        throw new ServiceError(
                            ServiceErrorCode.FORBIDDEN,
                            'This conversation has been blocked',
                            undefined,
                            'CONVERSATION_BLOCKED'
                        );
                    }

                    // ---- Step 4: Content moderation ----------------------------------------------
                    await this._validateMessageContent(body);

                    // ---- Step 5: Determine next conversation status ------------------------------
                    const currentStatus = conversation.status as ConversationStatusEnum;
                    const nextStatus = computeNextStatus(senderType, currentStatus);

                    // ---- Step 6: Insert message row ----------------------------------------------
                    const now = new Date();
                    const newMessage = await this.messageModel.create(
                        {
                            conversationId,
                            senderType,
                            userId: userId ?? null,
                            body,
                            status: 'VISIBLE',
                            createdAt: now,
                            updatedAt: now,
                            createdById: userId ?? null,
                            updatedById: userId ?? null,
                            deletedAt: null,
                            deletedById: null
                        },
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );

                    // ---- Step 7: Update conversation metrics -------------------------------------
                    const isSystem = senderType === MessageSenderTypeEnum.SYSTEM;
                    const isGuest = senderType === MessageSenderTypeEnum.GUEST;
                    const isOwner = senderType === MessageSenderTypeEnum.OWNER;

                    const metricsUpdate: Record<string, unknown> = {
                        lastActivityAt: now,
                        updatedAt: now
                    };

                    if (!isSystem) {
                        if (isGuest) {
                            metricsUpdate.lastGuestMessageAt = now;
                            if (!conversation.firstGuestMessageAt) {
                                metricsUpdate.firstGuestMessageAt = now;
                            }
                            metricsUpdate.guestMessageCount =
                                (conversation.guestMessageCount ?? 0) + 1;
                        } else if (isOwner) {
                            metricsUpdate.lastOwnerMessageAt = now;
                            if (!conversation.firstOwnerReplyAt) {
                                metricsUpdate.firstOwnerReplyAt = now;
                            }
                            metricsUpdate.ownerMessageCount =
                                (conversation.ownerMessageCount ?? 0) + 1;
                        }
                    }

                    if (nextStatus !== currentStatus) {
                        metricsUpdate.status = nextStatus;
                        if (nextStatus === ConversationStatusEnum.CLOSED) {
                            metricsUpdate.closedAt = now;
                        } else if (nextStatus === ConversationStatusEnum.BLOCKED) {
                            metricsUpdate.blockedAt = now;
                        }
                    }

                    await this.conversationModel.update(
                        { id: conversationId },
                        metricsUpdate,
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );

                    // ---- Step 8: Notification scheduling (skip for SYSTEM) ----------------------
                    if (!isSystem) {
                        const recipientSide = isGuest
                            ? NotificationRecipientSideEnum.OWNER
                            : NotificationRecipientSideEnum.GUEST;
                        const senderSide = isGuest
                            ? NotificationRecipientSideEnum.GUEST
                            : NotificationRecipientSideEnum.OWNER;

                        // Upsert schedule for the recipient (they have new unread messages)
                        await this.notificationScheduleSvc.upsertForMessage(
                            validatedActor,
                            { conversationId, recipientSide },
                            txCtx
                        );

                        // Cancel sender's pending notification (they just took action)
                        await this.notificationScheduleSvc.cancelForRecipient(
                            validatedActor,
                            { conversationId, recipientSide: senderSide },
                            // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                            txCtx.tx!
                        );
                    }

                    return newMessage;
                });
            }
        });
    }

    /**
     * Creates an automated SYSTEM message in a conversation.
     *
     * SYSTEM messages do not trigger notification scheduling, do not increment
     * guest/owner message counters, and do not update `last_{guest,owner}_message_at`.
     * The conversation status is unchanged.
     *
     * Typical use cases: "Conversation closed by owner", "Conversation reopened", etc.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ conversationId, body, actorId? }`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns ServiceOutput wrapping the newly inserted system message row.
     *
     * @example
     * ```ts
     * await svc.createSystemMessage(actor, {
     *   conversationId,
     *   body: 'Conversation closed by owner'
     * });
     * ```
     */
    public async createSystemMessage(
        actor: Actor,
        input: { conversationId: string; body: string; actorId?: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectMessage>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createSystemMessage',
            input: { actor, ...input },
            schema: CreateSystemMessageInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                this._requireWriteAccess(validatedActor);

                const { conversationId, body, actorId } = validated;
                const result = await this.createMessage(
                    validatedActor,
                    {
                        conversationId,
                        senderType: MessageSenderTypeEnum.SYSTEM,
                        body,
                        userId: actorId
                    },
                    ctx
                );

                if (result.error) {
                    throw result.error;
                }

                // biome-ignore lint/style/noNonNullAssertion: data is always present when error is absent
                return result.data!;
            }
        });
    }

    /**
     * Loads a cursor-based page of messages for a conversation thread.
     *
     * Pagination semantics (backward scroll, oldest at top):
     * - No `cursor` → return the most recent `limit` messages.
     * - `cursor` provided → return up to `limit` messages with `created_at < cursor`.
     * - Messages within a page are ordered `created_at ASC` (oldest first).
     * - `nextCursor` is the `created_at` of the oldest message in the page; it is
     *   `undefined` when no older messages exist.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_VIEW_OWN or higher).
     * @param input - `{ conversationId, cursor?, limit? }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `{ messages, nextCursor? }`.
     *
     * @example
     * ```ts
     * // Initial load — most recent page
     * const { data } = await svc.getMessages(actor, { conversationId });
     *
     * // Load next older page
     * const { data: older } = await svc.getMessages(actor, {
     *   conversationId,
     *   cursor: data!.nextCursor
     * });
     * ```
     */
    public async getMessages(
        actor: Actor,
        input: { conversationId: string; cursor?: Date; limit?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<GetMessagesResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getMessages',
            input: { actor, ...input },
            schema: GetMessagesInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireReadAccess(validatedActor);

                const { conversationId, cursor, limit } = validated;
                const safeLimit = Math.min(limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

                // Fetch one extra row to detect whether there are older messages
                const rows = await this.messageModel.findByConversationId(
                    conversationId,
                    { cursor, limit: safeLimit + 1 },
                    execCtx?.tx
                );

                const hasMore = rows.length > safeLimit;
                const page = hasMore ? rows.slice(0, safeLimit) : rows;
                // Oldest message in the page provides the cursor for the next request
                const nextCursor = hasMore && page.length > 0 ? page[0]?.createdAt : undefined;

                return { messages: page, nextCursor };
            }
        });
    }
}
