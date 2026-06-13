/**
 * @module conversation.service
 *
 * ConversationService — orchestrates the guest-owner messaging lifecycle.
 *
 * Responsibilities:
 * - Initiation for anonymous guests (email-verification flow)
 * - Initiation for authenticated guests (direct PENDING_OWNER creation)
 * - Thread retrieval with cursor-based pagination and read-receipt updates
 * - Inbox listing for guests and owners
 * - Lifecycle status transitions (state machine)
 * - Archive toggling
 * - Soft-delete cascade (conversation + messages + tokens + schedules)
 * - Accommodation-close cascade for when an accommodation is soft-deleted
 * - Unread count aggregation
 * - JWT-signed email verification (24h TTL)
 *
 * @see {@link AccessTokenService}
 * @see {@link NotificationScheduleService}
 * @see {@link conversation.permissions}
 */

import {
    AccommodationModel,
    ConversationModel,
    MessageModel,
    and,
    conversations,
    eq,
    getDb,
    isNotNull,
    isNull,
    messages
} from '@repo/db';
import type {
    DrizzleClient,
    InsertConversation,
    SelectConversation,
    SelectMessage
} from '@repo/db';
import type { HostConversationResponseRate } from '@repo/schemas';
import {
    ConversationStatusEnum,
    MessageSenderTypeEnum,
    NotificationRecipientSideEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { inArray } from 'drizzle-orm';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { withServiceTransaction } from '../../utils/transaction.js';
import { AccessTokenService } from './access-token.service.js';
import {
    checkCanDelete,
    checkCanUpdateStatus,
    checkCanViewConversation
} from './conversation.permissions.js';
import { MessageService } from './message.service.js';
import { NotificationScheduleService } from './notification-schedule.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default page size for thread loading (matches spec AC-002-04 / AC-003-03). */
const DEFAULT_THREAD_LIMIT = 50;

/** Hard cap on messages per thread page. */
const MAX_THREAD_LIMIT = 100;

/** Default page size for inbox lists. */
const DEFAULT_INBOX_PAGE_SIZE = 20;

/**
 * State machine: maps each status to the set of statuses it may transition to.
 *
 * Source of truth: `conversation-status.enum.ts` JSDoc and AC-003-05 through AC-003-08.
 */
const ALLOWED_TRANSITIONS: Readonly<
    Record<ConversationStatusEnum, readonly ConversationStatusEnum[]>
> = {
    [ConversationStatusEnum.PENDING_VERIFICATION]: [
        ConversationStatusEnum.PENDING_OWNER,
        ConversationStatusEnum.BLOCKED
    ],
    [ConversationStatusEnum.PENDING_OWNER]: [
        ConversationStatusEnum.OPEN,
        ConversationStatusEnum.CLOSED,
        ConversationStatusEnum.BLOCKED
    ],
    [ConversationStatusEnum.OPEN]: [
        ConversationStatusEnum.PENDING_GUEST,
        ConversationStatusEnum.PENDING_OWNER,
        ConversationStatusEnum.CLOSED,
        ConversationStatusEnum.BLOCKED
    ],
    [ConversationStatusEnum.PENDING_GUEST]: [
        ConversationStatusEnum.OPEN,
        ConversationStatusEnum.PENDING_OWNER,
        ConversationStatusEnum.CLOSED,
        ConversationStatusEnum.BLOCKED
    ],
    [ConversationStatusEnum.CLOSED]: [
        ConversationStatusEnum.OPEN,
        ConversationStatusEnum.PENDING_OWNER,
        ConversationStatusEnum.BLOCKED
    ],
    [ConversationStatusEnum.BLOCKED]: []
};

/** Fixed UUID for the internal system actor used in cascaded service calls. */
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Input schemas (Zod — internal only)
// ---------------------------------------------------------------------------

const InitiateAnonymousInputSchema = z.object({
    accommodationId: z.string().uuid(),
    guestName: z.string().min(1).max(100),
    guestEmail: z.string().email().max(255),
    guestPhone: z.string().max(50).optional(),
    message: z.string().min(1).max(5000),
    locale: z.string().max(10).optional()
});

const InitiateAuthenticatedInputSchema = z.object({
    accommodationId: z.string().uuid(),
    message: z.string().min(1).max(5000),
    locale: z.string().max(10).optional(),
    urlLang: z.string().max(10).optional()
});

const GetThreadInputSchema = z.object({
    conversationId: z.string().uuid(),
    actorSide: z.enum(['GUEST', 'OWNER']),
    cursor: z.date().optional(),
    limit: z.number().int().min(1).max(MAX_THREAD_LIMIT).optional()
});

const ListForGuestInputSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(DEFAULT_INBOX_PAGE_SIZE),
    archivedByGuest: z.boolean().optional(),
    accommodationId: z.string().uuid().optional()
});

const ListForOwnerInputSchema = z.object({
    userId: z.string().uuid(),
    accommodationIds: z.array(z.string().uuid()),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(DEFAULT_INBOX_PAGE_SIZE),
    status: z.string().optional(),
    search: z.string().optional()
});

const UpdateStatusInputSchema = z.object({
    conversationId: z.string().uuid(),
    status: z.nativeEnum(ConversationStatusEnum),
    blockReason: z.string().min(1).max(1000).optional()
});

const ArchiveInputSchema = z.object({
    conversationId: z.string().uuid(),
    side: z.enum(['GUEST', 'OWNER']),
    archived: z.boolean()
});

const SoftDeleteInputSchema = z.object({
    conversationId: z.string().uuid()
});

const GetUnreadCountInputSchema = z.object({
    actorId: z.string().uuid(),
    actorSide: z.enum(['GUEST', 'OWNER']),
    accommodationIds: z.array(z.string().uuid()).optional()
});

const VerifyEmailTokenInputSchema = z.object({
    verificationToken: z.string().min(1)
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result returned by `initiateAnonymous`.
 *
 * - `'pending_verification'` — new conversation created, verification email sent.
 * - `'resent'` — unverified duplicate found; email re-sent, no new row.
 * - `'conflict'` — verified duplicate already exists; a ServiceError is thrown.
 */
export interface InitiateAnonymousResult {
    readonly status: 'pending_verification' | 'resent';
    readonly conversationId: string;
}

/**
 * Result returned by `initiateAuthenticated`.
 *
 * `messageId` is always present: for new conversations it is the id of the
 * opening message inserted inside the creation transaction; for existing
 * conversations it is the id of the newly appended message.
 */
export interface InitiateAuthenticatedResult {
    readonly conversationId: string;
    readonly isNew: boolean;
    /** UUID of the message created or appended during this initiation. */
    readonly messageId: string;
}

/**
 * Thread page returned by `getThread`.
 */
export interface ConversationThreadResult {
    readonly conversation: SelectConversation;
    readonly messages: readonly SelectMessage[];
    readonly hasMore: boolean;
}

/**
 * Paginated list result for inbox endpoints.
 */
export interface ConversationListResult {
    readonly items: readonly SelectConversation[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}

/**
 * Result returned by `verifyEmailToken`.
 */
export interface VerifyEmailTokenResult {
    readonly conversationId: string;
    readonly rawToken: string;
}

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

/**
 * Payload passed to a `ConversationMailer` when the service needs to dispatch
 * a verification email. The implementation lives in the host app
 * (e.g. `apps/api`) so that React + email-template imports stay out of
 * `@repo/service-core` (this package is backend-pure: no JSX, no React).
 */
export interface VerificationEmailPayload {
    readonly conversationId: string;
    readonly recipientEmail: string;
    readonly verificationUrl: string;
    readonly guestName: string;
    readonly accommodationName: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/**
 * Payload passed to a `ConversationMailer` when the service needs to dispatch
 * a magic-link access email to an anonymous guest who already verified their
 * email and is requesting a new access link (AC-004-04).
 */
export interface AccessLinkEmailPayload {
    readonly conversationId: string;
    readonly recipientEmail: string;
    /** Full URL to the guest messages thread (includes the raw access token). */
    readonly accessUrl: string;
    readonly guestName: string;
    readonly accommodationName: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/**
 * Mailer interface injected into `ConversationService`.
 *
 * `service-core` only knows how to build the verification payload (sign JWT,
 * compute URL). The actual `sendEmail` call (which renders a React template)
 * lives in the host app and conforms to this interface. Pass `undefined` in
 * tests or local dev to skip email dispatch with a logger warning.
 */
export interface ConversationMailer {
    sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>;
    /**
     * Sends a magic-link access email to an anonymous guest who requests
     * re-access to an existing verified conversation (AC-004-04).
     */
    sendAccessLinkEmail(payload: AccessLinkEmailPayload): Promise<void>;
}

/**
 * Injectable runtime dependencies for `ConversationService`.
 *
 * These values come from the host application's environment (e.g. the API's
 * `env` module) and are passed here to avoid coupling `@repo/service-core` to
 * any specific app's configuration layer.
 */
export interface ConversationServiceDeps {
    /** JWT secret for signing/verifying email-verification tokens (min 32 chars). */
    readonly authSecret: string;
    /** Base URL for the web app (e.g. `https://hospeda.com.ar`). */
    readonly siteUrl: string;
    /** Email dispatcher. When absent, email sending is skipped with a warning. */
    readonly mailer?: ConversationMailer;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * ConversationService orchestrates the guest-owner messaging lifecycle.
 *
 * Extends `BaseService` (NOT `BaseCrudService`) because this feature exposes
 * only bespoke business methods — there is no generic CRUD surface.
 *
 * All dependency injection is via constructor to support unit testing without
 * hitting the real database or email provider.
 *
 * @example
 * ```ts
 * const svc = new ConversationService(
 *   { logger },
 *   {
 *     authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
 *     siteUrl: env.HOSPEDA_SITE_URL,
 *     resendApiKey: env.HOSPEDA_EMAIL_API_KEY,
 *   }
 * );
 * const result = await svc.initiateAnonymous(actor, { accommodationId, guestName, guestEmail, message });
 * ```
 */
export class ConversationService extends BaseService {
    static readonly ENTITY_NAME = 'conversation';

    protected override readonly entityName = ConversationService.ENTITY_NAME;

    private readonly conversationModel: ConversationModel;
    private readonly messageModel: MessageModel;
    private readonly accommodationModel: AccommodationModel;
    private readonly accessTokenService: AccessTokenService;
    private readonly notificationScheduleService: NotificationScheduleService;
    private readonly messageService: MessageService;
    private readonly deps: ConversationServiceDeps;

    /**
     * Creates a new ConversationService instance.
     *
     * @param config - Service configuration (logger, etc.).
     * @param deps - Injectable runtime dependencies (authSecret, siteUrl, resendApiKey).
     * @param conversationModel - Optional ConversationModel for DI / testing.
     * @param messageModel - Optional MessageModel for DI / testing.
     * @param accommodationModel - Optional AccommodationModel for DI / testing.
     * @param accessTokenService - Optional AccessTokenService for DI / testing.
     * @param notificationScheduleService - Optional NotificationScheduleService for DI / testing.
     * @param messageService - Optional MessageService for DI / testing.
     */
    constructor(
        config: ServiceConfig,
        deps: ConversationServiceDeps,
        conversationModel?: ConversationModel,
        messageModel?: MessageModel,
        accommodationModel?: AccommodationModel,
        accessTokenService?: AccessTokenService,
        notificationScheduleService?: NotificationScheduleService,
        messageService?: MessageService
    ) {
        super(config, ConversationService.ENTITY_NAME);
        this.deps = deps;
        this.conversationModel = conversationModel ?? new ConversationModel();
        this.messageModel = messageModel ?? new MessageModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
        this.accessTokenService = accessTokenService ?? new AccessTokenService(config);
        this.notificationScheduleService =
            notificationScheduleService ?? new NotificationScheduleService(config);
        this.messageService = messageService ?? new MessageService(config);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the JWT signing secret derived from the injected `authSecret`.
     */
    private _getJwtSecret(): Uint8Array {
        return new TextEncoder().encode(this.deps.authSecret);
    }

    /**
     * Builds a minimal internal system actor with all conversation permissions.
     *
     * Used only for cascaded calls to `AccessTokenService` and
     * `NotificationScheduleService` that require an actor parameter.
     * This actor is never exposed to external callers.
     */
    private _buildSystemActor(): Actor {
        return {
            id: SYSTEM_ACTOR_ID,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.CONVERSATION_VIEW_OWN,
                PermissionEnum.CONVERSATION_VIEW_ANY,
                PermissionEnum.CONVERSATION_VIEW_ALL,
                PermissionEnum.CONVERSATION_REPLY_OWN,
                PermissionEnum.CONVERSATION_REPLY_ANY,
                PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
                PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
                PermissionEnum.CONVERSATION_BLOCK_OWN,
                PermissionEnum.CONVERSATION_BLOCK_ANY,
                PermissionEnum.CONVERSATION_DELETE_ANY
            ] as readonly PermissionEnum[],
            _isSystemActor: true
        };
    }

    // -------------------------------------------------------------------------
    // Public API — initiation
    // -------------------------------------------------------------------------

    /**
     * Initiates a conversation from an anonymous (non-authenticated) guest.
     *
     * Three possible outcomes:
     * - Returns `'pending_verification'` — new conversation created, email sent.
     * - Returns `'resent'` — unverified duplicate found; email re-sent, no new row.
     * - Throws `ServiceError(CONFLICT, ..., 'CONVERSATION_DUPLICATE')` — verified duplicate.
     *
     * @param actor - Caller actor (system or public endpoint handler).
     * @param input - Guest identification and initial message.
     * @param ctx - Optional service context for transaction propagation.
     * @returns ServiceOutput wrapping `{ status, conversationId }`.
     *
     * @example
     * ```ts
     * const result = await svc.initiateAnonymous(actor, {
     *   accommodationId, guestName, guestEmail, message
     * });
     * ```
     */
    public async initiateAnonymous(
        actor: Actor,
        input: {
            accommodationId: string;
            guestName: string;
            guestEmail: string;
            guestPhone?: string;
            message: string;
            locale?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<InitiateAnonymousResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'initiateAnonymous',
            input: { actor, ...input },
            schema: InitiateAnonymousInputSchema,
            ctx,
            execute: async (validated) => {
                const normalizedEmail = validated.guestEmail.toLowerCase();
                const locale = validated.locale ?? 'es';

                const accommodation = await this.accommodationModel.findById(
                    validated.accommodationId
                );
                if (!accommodation || accommodation.deletedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Accommodation not found: ${validated.accommodationId}`,
                        undefined,
                        'ACCOMMODATION_DELETED'
                    );
                }

                // 1. Verified duplicate check — returns ServiceError(CONFLICT)
                const verifiedDuplicate =
                    await this.conversationModel.findByAnonymousEmailAndAccommodationId(
                        normalizedEmail,
                        validated.accommodationId
                    );
                if (verifiedDuplicate) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'A verified conversation already exists for this email and accommodation',
                        undefined,
                        'CONVERSATION_DUPLICATE'
                    );
                }

                const db = getDb();

                // 2. Unverified duplicate — re-send email, no new row
                const [pendingRow] = await db
                    .select()
                    .from(conversations)
                    .where(
                        and(
                            eq(conversations.anonymousEmail, normalizedEmail),
                            eq(conversations.accommodationId, validated.accommodationId),
                            eq(conversations.status, 'PENDING_VERIFICATION' as const),
                            isNull(conversations.deletedAt)
                        )
                    )
                    .limit(1);

                if (pendingRow) {
                    await this.sendVerificationEmail(
                        pendingRow.id,
                        normalizedEmail,
                        validated.guestName,
                        accommodation.name,
                        locale as 'es' | 'en' | 'pt'
                    );
                    return { status: 'resent', conversationId: pendingRow.id };
                }

                // 3. Create new PENDING_VERIFICATION conversation
                const [newConversation] = await db
                    .insert(conversations)
                    .values({
                        accommodationId: validated.accommodationId,
                        anonymousName: validated.guestName,
                        anonymousEmail: normalizedEmail,
                        anonymousPhone: validated.guestPhone,
                        anonymousEmailVerified: false,
                        status: 'PENDING_VERIFICATION' as const,
                        locale
                    } satisfies InsertConversation)
                    .returning();

                if (!newConversation) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to create conversation'
                    );
                }

                await this.sendVerificationEmail(
                    newConversation.id,
                    normalizedEmail,
                    validated.guestName,
                    accommodation.name,
                    locale as 'es' | 'en' | 'pt'
                );

                return {
                    status: 'pending_verification',
                    conversationId: newConversation.id
                };
            }
        });
    }

    /**
     * Initiates or resumes a conversation from an authenticated guest.
     *
     * - When no conversation exists for `(userId, accommodationId)`: creates a new
     *   `PENDING_OWNER` conversation, inserts the opening message, and schedules
     *   the owner notification. Returns `isNew = true`.
     * - When a conversation already exists: returns `isNew = false`. The route
     *   layer appends further messages via `MessageService`.
     *
     * Locale resolution order: `body.locale → urlLang → 'es'`.
     *
     * @param actor - Authenticated actor.
     * @param input - `{ accommodationId, message, locale?, urlLang? }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `{ conversationId, isNew }`.
     *
     * @example
     * ```ts
     * const result = await svc.initiateAuthenticated(actor, { accommodationId, message });
     * ```
     */
    public async initiateAuthenticated(
        actor: Actor,
        input: {
            accommodationId: string;
            message: string;
            locale?: string;
            urlLang?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<InitiateAuthenticatedResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'initiateAuthenticated',
            input: { actor, ...input },
            schema: InitiateAuthenticatedInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const accommodation = await this.accommodationModel.findById(
                    validated.accommodationId
                );
                if (!accommodation || accommodation.deletedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Accommodation not found: ${validated.accommodationId}`,
                        undefined,
                        'ACCOMMODATION_DELETED'
                    );
                }

                // Resume existing conversation — append the new message
                const existing = await this.conversationModel.findByUserIdAndAccommodationId(
                    validatedActor.id,
                    validated.accommodationId
                );
                if (existing) {
                    const systemActor = this._buildSystemActor();
                    const msgResult = await this.messageService.createMessage(systemActor, {
                        conversationId: existing.id,
                        senderType: MessageSenderTypeEnum.GUEST,
                        body: validated.message,
                        userId: validatedActor.id
                    });
                    if (msgResult.error) {
                        throw new ServiceError(
                            msgResult.error.code,
                            msgResult.error.message,
                            msgResult.error.details
                        );
                    }
                    return {
                        conversationId: existing.id,
                        isNew: false,
                        messageId: msgResult.data.id
                    };
                }

                const locale = validated.locale ?? validated.urlLang ?? 'es';

                const { conversationId, messageId } = await withServiceTransaction(
                    async (txCtx) => {
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        const tx = txCtx.tx!;
                        // Create conversation
                        const [newConversation] = await tx
                            .insert(conversations)
                            .values({
                                accommodationId: validated.accommodationId,
                                userId: validatedActor.id,
                                status: 'PENDING_OWNER' as const,
                                locale,
                                createdById: validatedActor.id,
                                updatedById: validatedActor.id
                            } satisfies InsertConversation)
                            .returning();

                        if (!newConversation) {
                            throw new ServiceError(
                                ServiceErrorCode.INTERNAL_ERROR,
                                'Failed to create conversation'
                            );
                        }

                        const now = new Date();

                        // Insert opening message and capture its id
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        const [insertedMessage] = await txCtx
                            .tx!.insert(messages)
                            .values({
                                conversationId: newConversation.id,
                                senderType: 'GUEST' as const,
                                userId: validatedActor.id,
                                body: validated.message,
                                status: 'VISIBLE' as const,
                                createdById: validatedActor.id,
                                updatedById: validatedActor.id
                            })
                            .returning();

                        if (!insertedMessage) {
                            throw new ServiceError(
                                ServiceErrorCode.INTERNAL_ERROR,
                                'Failed to create opening message'
                            );
                        }

                        // Update conversation activity counters
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        await txCtx
                            .tx!.update(conversations)
                            .set({
                                lastActivityAt: now,
                                lastGuestMessageAt: now,
                                firstGuestMessageAt: now,
                                guestMessageCount: 1
                            })
                            .where(eq(conversations.id, newConversation.id));

                        // Schedule owner notification
                        const systemActor = this._buildSystemActor();
                        await this.notificationScheduleService.upsertForMessage(
                            systemActor,
                            {
                                conversationId: newConversation.id,
                                recipientSide: NotificationRecipientSideEnum.OWNER
                            },
                            txCtx
                        );

                        return {
                            conversationId: newConversation.id,
                            messageId: insertedMessage.id
                        };
                    }
                );

                return { conversationId, isNew: true, messageId };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — thread
    // -------------------------------------------------------------------------

    /**
     * Loads a conversation thread with cursor-based pagination.
     *
     * Fetches `limit + 1` messages to determine `hasMore`. Updates the
     * actor-side `lastReadAt` timestamp and cancels the pending notification
     * schedule for the actor's recipient side.
     *
     * @param actor - Actor requesting the thread.
     * @param input - `{ conversationId, actorSide, cursor?, limit? }`.
     * @param ownerAccommodationIds - IDs of accommodations owned by the actor (permission check).
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `{ conversation, messages, hasMore }`.
     *
     * @example
     * ```ts
     * const result = await svc.getThread(actor, { conversationId, actorSide: 'OWNER' }, ['acc-uuid']);
     * ```
     */
    public async getThread(
        actor: Actor,
        input: {
            conversationId: string;
            actorSide: 'GUEST' | 'OWNER';
            cursor?: Date;
            limit?: number;
        },
        ownerAccommodationIds: readonly string[],
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ConversationThreadResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getThread',
            input: { actor, ...input },
            schema: GetThreadInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const conversation = await this.conversationModel.findById(
                    validated.conversationId
                );
                if (!conversation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Conversation not found: ${validated.conversationId}`,
                        undefined,
                        'CONVERSATION_NOT_FOUND'
                    );
                }

                checkCanViewConversation(validatedActor, conversation, ownerAccommodationIds);

                const effectiveLimit = Math.min(
                    validated.limit ?? DEFAULT_THREAD_LIMIT,
                    MAX_THREAD_LIMIT
                );

                const loadedMessages = await this.messageModel.findByConversationId(
                    validated.conversationId,
                    { cursor: validated.cursor, limit: effectiveLimit + 1 }
                );

                // The model returns the most recent rows first. Keep the newest
                // `effectiveLimit` of them, then reverse to ascending order so the
                // chat renders oldest-at-top with the latest message at the bottom.
                const hasMore = loadedMessages.length > effectiveLimit;
                const recentMessages = hasMore
                    ? loadedMessages.slice(0, effectiveLimit)
                    : loadedMessages;
                const pageMessages = [...recentMessages].reverse();

                // Update read receipt and cancel notification schedule
                await withServiceTransaction(async (txCtx) => {
                    const now = new Date();
                    const readPatch =
                        validated.actorSide === 'GUEST'
                            ? ({ lastReadAtByGuest: now } as Partial<SelectConversation>)
                            : ({ lastReadAtByOwner: now } as Partial<SelectConversation>);

                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    await txCtx
                        .tx!.update(conversations)
                        .set(readPatch)
                        .where(eq(conversations.id, validated.conversationId));

                    const recipientSide =
                        validated.actorSide === 'OWNER'
                            ? NotificationRecipientSideEnum.OWNER
                            : NotificationRecipientSideEnum.GUEST;

                    await this.notificationScheduleService.cancelForRecipient(
                        this._buildSystemActor(),
                        { conversationId: validated.conversationId, recipientSide },
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );
                });

                return { conversation, messages: pageMessages, hasMore };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — inbox listing
    // -------------------------------------------------------------------------

    /**
     * Returns a paginated inbox for an authenticated guest.
     *
     * Excludes archived conversations unless `archivedByGuest = true` is set.
     *
     * @param actor - Actor performing the request.
     * @param input - `{ userId, page, pageSize, archivedByGuest? }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `ConversationListResult`.
     *
     * @example
     * ```ts
     * const result = await svc.listForGuest(actor, { userId: actor.id, page: 1, pageSize: 20 });
     * ```
     */
    public async listForGuest(
        actor: Actor,
        input: {
            userId: string;
            page?: number;
            pageSize?: number;
            archivedByGuest?: boolean;
            /**
             * Optional filter — when set, only return conversations attached
             * to this accommodation. Powers the "has the visitor contacted
             * the host?" check used by the accommodation detail page.
             */
            accommodationId?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ConversationListResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForGuest',
            input: { actor, ...input },
            schema: ListForGuestInputSchema,
            ctx,
            execute: async (validated) => {
                const { items, total } = await this.conversationModel.listByUserId(
                    validated.userId,
                    {
                        page: validated.page,
                        pageSize: validated.pageSize,
                        archivedByGuest: validated.archivedByGuest,
                        accommodationId: validated.accommodationId
                    }
                );
                return {
                    items,
                    total,
                    page: validated.page,
                    pageSize: validated.pageSize
                };
            }
        });
    }

    /**
     * Returns a paginated inbox for an accommodation owner.
     *
     * The scope is determined by the provided `accommodationIds`. The route layer
     * must resolve these IDs (e.g. from owner's accommodations or from admin-all
     * scope) before calling this method.
     *
     * @param actor - Actor performing the request (owner or admin).
     * @param input - `{ userId, accommodationIds, page, pageSize, status?, search? }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `ConversationListResult`.
     *
     * @example
     * ```ts
     * const result = await svc.listForOwner(actor, { userId: actor.id, accommodationIds, page: 1, pageSize: 20 });
     * ```
     */
    public async listForOwner(
        actor: Actor,
        input: {
            userId: string;
            accommodationIds: string[];
            page?: number;
            pageSize?: number;
            status?: string;
            search?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ConversationListResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listForOwner',
            input: { actor, ...input },
            schema: ListForOwnerInputSchema,
            ctx,
            execute: async (validated) => {
                if (validated.accommodationIds.length === 0) {
                    return {
                        items: [],
                        total: 0,
                        page: validated.page,
                        pageSize: validated.pageSize
                    };
                }

                const { items, total } = await this.conversationModel.listByAccommodationIds(
                    validated.accommodationIds,
                    {
                        page: validated.page,
                        pageSize: validated.pageSize,
                        status: validated.status,
                        search: validated.search
                    }
                );
                return {
                    items,
                    total,
                    page: validated.page,
                    pageSize: validated.pageSize
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — lifecycle
    // -------------------------------------------------------------------------

    /**
     * Transitions a conversation to a new status, enforcing the state machine.
     *
     * Side effects:
     * - `BLOCKED` → cancels all active notification schedules.
     * - `CLOSED` → appends a SYSTEM message to the thread (best-effort; logged
     *   but non-blocking on failure).
     *
     * @param actor - Actor performing the transition.
     * @param input - `{ conversationId, status, blockReason? }`.
     * @param ownerAccommodationIds - Accommodation IDs owned by the actor.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping the updated `SelectConversation`.
     *
     * @throws {ServiceError} CONFLICT when the state machine rejects the transition.
     *
     * @example
     * ```ts
     * await svc.updateStatus(actor, { conversationId, status: ConversationStatusEnum.CLOSED }, ['acc-uuid']);
     * ```
     */
    public async updateStatus(
        actor: Actor,
        input: {
            conversationId: string;
            status: ConversationStatusEnum;
            blockReason?: string;
        },
        ownerAccommodationIds: readonly string[],
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateStatus',
            input: { actor, ...input },
            schema: UpdateStatusInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const conversation = await this.conversationModel.findById(
                    validated.conversationId
                );
                if (!conversation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Conversation not found: ${validated.conversationId}`,
                        undefined,
                        'CONVERSATION_NOT_FOUND'
                    );
                }

                checkCanUpdateStatus(validatedActor, conversation, ownerAccommodationIds);

                const currentStatus = conversation.status as ConversationStatusEnum;
                const allowed: readonly ConversationStatusEnum[] =
                    ALLOWED_TRANSITIONS[currentStatus] ?? [];

                if (!allowed.includes(validated.status)) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Invalid status transition: ${currentStatus} → ${validated.status}`,
                        { from: currentStatus, to: validated.status }
                    );
                }

                const db = getDb();
                const now = new Date();

                const patch: Record<string, unknown> = {
                    status: validated.status,
                    updatedAt: now,
                    updatedById: validatedActor.id
                };

                if (validated.status === ConversationStatusEnum.BLOCKED) {
                    patch.blockedAt = now;
                    patch.blockReason = validated.blockReason ?? null;
                }

                if (validated.status === ConversationStatusEnum.CLOSED) {
                    patch.closedAt = now;
                }

                const [updated] = await db
                    .update(conversations)
                    .set(patch)
                    .where(eq(conversations.id, validated.conversationId))
                    .returning();

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update conversation status'
                    );
                }

                // On BLOCKED: cancel all active notification schedules
                if (validated.status === ConversationStatusEnum.BLOCKED) {
                    await withServiceTransaction(async (txCtx) => {
                        await this.notificationScheduleService.cancelAllForConversation(
                            this._buildSystemActor(),
                            { conversationId: validated.conversationId },
                            // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                            txCtx.tx!
                        );
                    });
                }

                // On CLOSED: append a SYSTEM message to the thread so both sides see
                // the closure event in the conversation log (AC-003-05). Best-effort:
                // a failure here logs but does not roll back the status change, since
                // the status update is the load-bearing side effect.
                if (validated.status === ConversationStatusEnum.CLOSED) {
                    try {
                        await this.messageService.createSystemMessage(this._buildSystemActor(), {
                            conversationId: validated.conversationId,
                            body: 'Conversation closed.'
                        });
                    } catch (error) {
                        this.logger.error(
                            { conversationId: validated.conversationId, error },
                            'Failed to append CLOSED SYSTEM message; status change preserved'
                        );
                    }
                }

                return updated;
            }
        });
    }

    /**
     * Toggles the archived state of a conversation for one side.
     *
     * Sets `archivedByGuest` or `archivedByOwner` to the given boolean.
     * The action is reversible (pass `archived: false` to un-archive).
     *
     * @param actor - Actor performing the action.
     * @param input - `{ conversationId, side, archived }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping the updated `SelectConversation`.
     *
     * @example
     * ```ts
     * await svc.archive(actor, { conversationId, side: 'GUEST', archived: true });
     * ```
     */
    public async archive(
        actor: Actor,
        input: { conversationId: string; side: 'GUEST' | 'OWNER'; archived: boolean },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'archive',
            input: { actor, ...input },
            schema: ArchiveInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const db = getDb();
                const now = new Date();

                const field =
                    validated.side === 'GUEST'
                        ? ({ archivedByGuest: validated.archived } as Record<string, unknown>)
                        : ({ archivedByOwner: validated.archived } as Record<string, unknown>);

                const [updated] = await db
                    .update(conversations)
                    .set({ ...field, updatedAt: now, updatedById: validatedActor.id })
                    .where(
                        and(
                            eq(conversations.id, validated.conversationId),
                            isNull(conversations.deletedAt)
                        )
                    )
                    .returning();

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Conversation not found: ${validated.conversationId}`,
                        undefined,
                        'CONVERSATION_NOT_FOUND'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Soft-deletes a conversation and cascades to all related entities within a
     * single database transaction:
     *
     * 1. `conversations.deleted_at = now()`
     * 2. `messages.deleted_at = now()` (all messages in the conversation)
     * 3. Access tokens revoked via `AccessTokenService.revokeAllForConversation`
     * 4. Notification schedules cancelled via `NotificationScheduleService.cancelAllForConversation`
     *
     * Only admins with `CONVERSATION_DELETE_ANY` may call this (no self-service delete in MVP).
     *
     * @param actor - Admin actor performing the deletion.
     * @param input - `{ conversationId }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `void`.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks `CONVERSATION_DELETE_ANY`.
     *
     * @example
     * ```ts
     * await svc.softDelete(actor, { conversationId });
     * ```
     */
    public async softDelete(
        actor: Actor,
        input: { conversationId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'softDelete',
            input: { actor, ...input },
            schema: SoftDeleteInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const conversation = await this.conversationModel.findById(
                    validated.conversationId
                );
                if (!conversation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Conversation not found: ${validated.conversationId}`,
                        undefined,
                        'CONVERSATION_NOT_FOUND'
                    );
                }

                checkCanDelete(validatedActor, conversation);

                await withServiceTransaction(async (txCtx) => {
                    const now = new Date();
                    const systemActor = this._buildSystemActor();

                    // Step 1: soft-delete the conversation
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    await txCtx
                        .tx!.update(conversations)
                        .set({ deletedAt: now, deletedById: validatedActor.id })
                        .where(eq(conversations.id, validated.conversationId));

                    // Step 2: soft-delete all messages
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    await txCtx
                        .tx!.update(messages)
                        .set({ deletedAt: now, deletedById: validatedActor.id })
                        .where(eq(messages.conversationId, validated.conversationId));

                    // Step 3: revoke all access tokens
                    await this.accessTokenService.revokeAllForConversation(
                        systemActor,
                        { conversationId: validated.conversationId },
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );

                    // Step 4: cancel all notification schedules
                    await this.notificationScheduleService.cancelAllForConversation(
                        systemActor,
                        { conversationId: validated.conversationId },
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        txCtx.tx!
                    );
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — accommodation cascade
    // -------------------------------------------------------------------------

    /**
     * Closes all non-deleted conversations for an accommodation and cancels
     * their notification schedules. Intended to be called from
     * `AccommodationService._afterSoftDelete` inside the accommodation
     * soft-delete transaction.
     *
     * Conversations already `BLOCKED` or `CLOSED` are re-updated (idempotent)
     * to ensure all schedules are cancelled.
     *
     * @param accommodationId - UUID of the accommodation being soft-deleted.
     * @param tx - Drizzle transaction client from the accommodation transaction.
     * @returns Number of conversations updated.
     *
     * @example
     * ```ts
     * // Inside AccommodationService._afterSoftDelete:
     * await conversationSvc.closeAllForAccommodation(accommodationId, ctx.tx!);
     * ```
     */
    public async closeAllForAccommodation(
        accommodationId: string,
        tx: DrizzleClient
    ): Promise<number> {
        const now = new Date();

        const updatedRows = await tx
            .update(conversations)
            .set({ status: 'CLOSED' as const, closedAt: now, updatedAt: now })
            .where(
                and(
                    eq(conversations.accommodationId, accommodationId),
                    isNull(conversations.deletedAt)
                )
            )
            .returning({ id: conversations.id });

        const systemActor = this._buildSystemActor();

        for (const row of updatedRows) {
            await this.notificationScheduleService.cancelAllForConversation(
                systemActor,
                { conversationId: row.id },
                tx
            );
        }

        return updatedRows.length;
    }

    // -------------------------------------------------------------------------
    // Public API — unread count
    // -------------------------------------------------------------------------

    /**
     * Returns a count of conversations with unread activity for the given actor.
     *
     * For guests: counts active conversations scoped to `actorId`.
     * For owners: counts active conversations scoped to `accommodationIds`.
     *
     * Note: This is a coarse count (conversations with any activity, not strictly
     * conversations where `lastReadAt < lastActivityAt`). A future optimisation
     * can push the read-receipt comparison into SQL.
     *
     * @param actor - Actor requesting the count.
     * @param input - `{ actorId, actorSide, accommodationIds? }`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `{ count }`.
     *
     * @example
     * ```ts
     * const result = await svc.getUnreadCount(actor, { actorId: actor.id, actorSide: 'OWNER', accommodationIds });
     * ```
     */
    public async getUnreadCount(
        actor: Actor,
        input: {
            actorId: string;
            actorSide: 'GUEST' | 'OWNER';
            accommodationIds?: string[];
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUnreadCount',
            input: { actor, ...input },
            schema: GetUnreadCountInputSchema,
            ctx,
            execute: async (validated) => {
                const db = getDb();

                if (validated.actorSide === 'GUEST') {
                    const rows = await db
                        .select({ id: conversations.id })
                        .from(conversations)
                        .where(
                            and(
                                eq(conversations.userId, validated.actorId),
                                isNull(conversations.deletedAt),
                                isNotNull(conversations.lastActivityAt)
                            )
                        );
                    return { count: rows.length };
                }

                // Owner side
                if (!validated.accommodationIds || validated.accommodationIds.length === 0) {
                    return { count: 0 };
                }

                const rows = await db
                    .select({ id: conversations.id })
                    .from(conversations)
                    .where(
                        and(
                            inArray(conversations.accommodationId, validated.accommodationIds),
                            isNull(conversations.deletedAt),
                            isNotNull(conversations.lastActivityAt)
                        )
                    );
                return { count: rows.length };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — request access (magic-link re-delivery, AC-004-04)
    // -------------------------------------------------------------------------

    /**
     * Finds a verified anonymous conversation for the given email, generates a
     * fresh access token, and dispatches the magic-link email to the guest.
     *
     * Anti-enumeration: this method NEVER throws and NEVER returns a value that
     * would reveal whether the email was found. Both the "found" and "not found"
     * paths complete silently. Errors are logged and swallowed.
     *
     * @param email - Normalised guest email address.
     * @param locale - Locale override for the email template (default: 'es').
     *
     * @example
     * ```ts
     * await svc.requestAccessByEmail('guest@example.com');
     * // Always returns void — never throws
     * ```
     */
    public async requestAccessByEmail(email: string, locale?: string): Promise<void> {
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const db = getDb();

            // Find any verified anonymous conversation for this email
            const [row] = await db
                .select()
                .from(conversations)
                .where(
                    and(
                        eq(conversations.anonymousEmail, normalizedEmail),
                        eq(conversations.anonymousEmailVerified, true),
                        isNull(conversations.deletedAt)
                    )
                )
                .limit(1);

            if (!row) {
                // Anti-enumeration: no-op, do not reveal the miss
                return;
            }

            const effectiveLocale = (locale ?? row.locale ?? 'es') as 'es' | 'en' | 'pt';

            const systemActor = this._buildSystemActor();
            const tokenResult = await this.accessTokenService.generateToken(systemActor, {
                conversationId: row.id
            });

            if (tokenResult.error || !tokenResult.data?.rawToken) {
                this.logger.warn(
                    { conversationId: row.id },
                    'requestAccessByEmail: failed to generate access token (suppressed)'
                );
                return;
            }

            const accessUrl = `${this.deps.siteUrl}/${effectiveLocale}/guest/messages/${tokenResult.data.rawToken}`;

            if (!this.deps.mailer) {
                this.logger.warn(
                    { conversationId: row.id },
                    'requestAccessByEmail: mailer not configured — skipping access link email dispatch'
                );
                return;
            }

            // Fetch accommodation name for personalisation (best-effort)
            let accommodationName = 'Alojamiento';
            try {
                const accommodation = await this.accommodationModel.findById(row.accommodationId);
                if (accommodation?.name) {
                    accommodationName = accommodation.name;
                }
            } catch {
                // Non-fatal: proceed with default name
            }

            await this.deps.mailer.sendAccessLinkEmail({
                conversationId: row.id,
                recipientEmail: normalizedEmail,
                accessUrl,
                guestName: row.anonymousName ?? normalizedEmail,
                accommodationName,
                locale: effectiveLocale
            });
        } catch (error) {
            // Anti-enumeration: swallow all errors
            this.logger.warn(
                { error: error instanceof Error ? error.message : String(error) },
                'requestAccessByEmail: error suppressed for anti-enumeration'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Public API — email verification
    // -------------------------------------------------------------------------

    /**
     * Signs a 24-hour JWT and sends the verification email to the anonymous guest.
     *
     * JWT payload: `{ conversationId, email }`. Algorithm: HS256.
     * The verification URL is: `{siteUrl}/api/v1/public/conversations/verify?token={jwt}`.
     *
     * When `resendApiKey` is absent, logs a warning and returns without sending
     * (safe degradation for local development).
     *
     * @param conversationId - UUID of the conversation being verified.
     * @param guestEmail - Recipient email address.
     * @param guestName - Guest display name for personalisation.
     * @param accommodationName - Accommodation name for personalisation.
     * @param locale - Template locale.
     *
     * @example
     * ```ts
     * await svc.sendVerificationEmail(conversationId, 'guest@example.com', 'Ana', 'Posada del Sol', 'es');
     * ```
     */
    public async sendVerificationEmail(
        conversationId: string,
        guestEmail: string,
        guestName: string,
        accommodationName: string,
        locale: 'es' | 'en' | 'pt' = 'es'
    ): Promise<void> {
        const secret = this._getJwtSecret();
        const jwt = await new SignJWT({ conversationId, email: guestEmail })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('24h')
            .sign(secret);

        const verificationUrl = `${this.deps.siteUrl}/api/v1/public/conversations/verify?token=${jwt}`;

        if (!this.deps.mailer) {
            this.logger.warn(
                { conversationId },
                'ConversationMailer not configured — skipping verification email dispatch'
            );
            return;
        }

        try {
            await this.deps.mailer.sendVerificationEmail({
                conversationId,
                recipientEmail: guestEmail,
                verificationUrl,
                guestName,
                accommodationName,
                locale
            });
        } catch (error) {
            this.logger.error(
                { conversationId, error },
                'Failed to send conversation verification email'
            );
        }
    }

    /**
     * Validates a JWT email-verification token and activates the conversation.
     *
     * **Primary path** (conversation is `PENDING_VERIFICATION`):
     * 1. Transitions status to `PENDING_OWNER`.
     * 2. Sets `anonymousEmailVerified = true`.
     * 3. Generates a new access token via `AccessTokenService.generateToken`.
     * 4. Schedules the owner notification via `NotificationScheduleService.upsertForMessage`.
     *
     * **Idempotent path** (conversation already past `PENDING_VERIFICATION`):
     * Returns a fresh access token without mutating conversation state. Supports
     * "verify again" and cross-device access flows without creating duplicate records.
     *
     * @param actor - Caller actor (system-level; must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ verificationToken }` — raw JWT from the verification URL query param.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping `{ conversationId, rawToken }`.
     *
     * @throws {ServiceError} UNAUTHORIZED with reason `VERIFICATION_INVALID` on JWT failure.
     *
     * @example
     * ```ts
     * const result = await svc.verifyEmailToken(actor, { verificationToken: req.query.token });
     * if (result.data) redirect(`/guest/messages/${result.data.rawToken}`);
     * ```
     */
    public async verifyEmailToken(
        actor: Actor,
        input: { verificationToken: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<VerifyEmailTokenResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'verifyEmailToken',
            input: { actor, ...input },
            schema: VerifyEmailTokenInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                const secret = this._getJwtSecret();
                let conversationId: string;

                try {
                    const { payload } = await jwtVerify(validated.verificationToken, secret);
                    const convId = (payload as Record<string, unknown>).conversationId;
                    if (typeof convId !== 'string') {
                        throw new ServiceError(
                            ServiceErrorCode.UNAUTHORIZED,
                            'Verification token missing conversationId claim',
                            undefined,
                            'VERIFICATION_TOKEN_INVALID'
                        );
                    }
                    conversationId = convId;
                } catch (err) {
                    if (err instanceof ServiceError) throw err;
                    // Distinguish expired JWT from any other JWT failure (AC-002-03 vs AC-002-04)
                    const isExpired = err instanceof joseErrors.JWTExpired;
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        isExpired
                            ? 'Email verification token has expired'
                            : 'Invalid email verification token',
                        err instanceof Error ? err.message : undefined,
                        isExpired ? 'VERIFICATION_TOKEN_EXPIRED' : 'VERIFICATION_TOKEN_INVALID'
                    );
                }

                const conversation = await this.conversationModel.findById(conversationId);
                if (!conversation) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Conversation not found: ${conversationId}`,
                        undefined,
                        'CONVERSATION_NOT_FOUND'
                    );
                }

                // Idempotent path: already verified — return a fresh token
                if (conversation.status !== 'PENDING_VERIFICATION') {
                    const tokenResult = await this.accessTokenService.generateToken(
                        validatedActor,
                        { conversationId },
                        ctx
                    );
                    if (tokenResult.error) {
                        throw new ServiceError(
                            tokenResult.error.code,
                            tokenResult.error.message,
                            tokenResult.error.details
                        );
                    }
                    return { conversationId, rawToken: tokenResult.data.rawToken };
                }

                // Primary path: PENDING_VERIFICATION → PENDING_OWNER
                const rawToken = await withServiceTransaction(async (txCtx) => {
                    const now = new Date();

                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    await txCtx
                        .tx!.update(conversations)
                        .set({
                            status: 'PENDING_OWNER' as const,
                            anonymousEmailVerified: true,
                            updatedAt: now
                        })
                        .where(eq(conversations.id, conversationId));

                    const tokenResult = await this.accessTokenService.generateToken(
                        validatedActor,
                        { conversationId },
                        txCtx
                    );
                    if (tokenResult.error) {
                        throw new ServiceError(
                            tokenResult.error.code,
                            tokenResult.error.message,
                            tokenResult.error.details
                        );
                    }

                    await this.notificationScheduleService.upsertForMessage(
                        this._buildSystemActor(),
                        {
                            conversationId,
                            recipientSide: NotificationRecipientSideEnum.OWNER
                        },
                        txCtx
                    );

                    return tokenResult.data.rawToken;
                });

                return { conversationId, rawToken };
            }
        });
    }

    // -------------------------------------------------------------------------
    // SPEC-155 T-006: Host conversation response-rate KPIs
    // -------------------------------------------------------------------------

    /**
     * Returns aggregated conversation response-rate KPIs for the authenticated
     * host.
     *
     * Scoped strictly to the host's own conversations by resolving the actor's
     * accommodation IDs first (via `AccommodationModel.findByOwnerId`) and
     * delegating the aggregation to `ConversationModel.getResponseRateByOwnerId`.
     *
     * Permission gating: requires `CONVERSATION_VIEW_OWN` — the same permission
     * used by the host inbox (list route).  The ownerId is always derived from
     * `actor.id`; callers cannot override the scope via a query param.
     *
     * @param actor - Authenticated host performing the request.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ responseRatePct, avgResponseTimeMinutes }`.
     * @throws {ServiceError} FORBIDDEN when actor lacks `CONVERSATION_VIEW_OWN`.
     * @throws {ServiceError} INTERNAL_ERROR on unexpected DB errors.
     */
    public async getHostResponseRate(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<HostConversationResponseRate>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getHostResponseRate',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                if (!validatedActor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: CONVERSATION_VIEW_OWN required for host response rate'
                    );
                }

                // Resolve the host's accommodation IDs (may be empty for a
                // brand-new host who has not yet created any accommodations).
                const ownerAccommodationIds = await this.accommodationModel.findIdsByOwnerId(
                    validatedActor.id,
                    execCtx?.tx
                );

                return this.conversationModel.getResponseRateByOwnerId(
                    ownerAccommodationIds,
                    execCtx?.tx
                );
            }
        });
    }

    /**
     * Monthly inquiry counts for the authenticated host (HOST card I —
     * conversations-monthly trend). Fills missing months with zero so the
     * chart always reads as a continuous time-series.
     *
     * Permission gating: requires `CONVERSATION_VIEW_OWN` — same as the
     * response-rate KPI.
     */
    public async getHostMonthlyInquiries(
        actor: Actor,
        input: { readonly months?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ReadonlyArray<{ readonly month: string; readonly count: number }>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getHostMonthlyInquiries',
            input: { actor, ...input },
            schema: z.object({
                months: z.number().int().min(1).max(24).optional()
            }),
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                if (!validatedActor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: CONVERSATION_VIEW_OWN required for monthly inquiries'
                    );
                }

                const months = validated.months ?? 6;
                const ownerAccommodationIds = await this.accommodationModel.findIdsByOwnerId(
                    validatedActor.id,
                    execCtx?.tx
                );

                const raw = await this.conversationModel.getMonthlyInquiriesByOwnerId(
                    ownerAccommodationIds,
                    months,
                    execCtx?.tx
                );

                // Build a continuous series — months with zero conversations
                // are absent from the SQL result and must be filled here so
                // the chart never skips a bucket.
                const seriesMap = new Map<string, number>();
                for (const row of raw) seriesMap.set(row.month, row.count);

                const series: Array<{ month: string; count: number }> = [];
                const cursor = new Date();
                cursor.setUTCDate(1);
                cursor.setUTCHours(0, 0, 0, 0);
                cursor.setUTCMonth(cursor.getUTCMonth() - (months - 1));
                for (let i = 0; i < months; i++) {
                    const year = cursor.getUTCFullYear();
                    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
                    const key = `${year}-${m}`;
                    series.push({ month: key, count: seriesMap.get(key) ?? 0 });
                    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
                }

                return series;
            }
        });
    }
}
