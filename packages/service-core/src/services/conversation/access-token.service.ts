import { createHash, randomBytes } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { AccessTokenModel } from '@repo/db';
import type { SelectConversationAccessToken } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 30 days in milliseconds — access token time-to-live. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Day-15 reminder: token expires between now+14d and now+16d.
 * The 2-day window ensures the cron (running every 5 min) catches the token
 * even if there is clock drift or a missed run.
 */
const DAY15_WINDOW_LOWER_MS = 14 * 24 * 60 * 60 * 1000;
const DAY15_WINDOW_UPPER_MS = 16 * 24 * 60 * 60 * 1000;

/**
 * Day-25 reminder: token expires between now+4d and now+6d.
 */
const DAY25_WINDOW_LOWER_MS = 4 * 24 * 60 * 60 * 1000;
const DAY25_WINDOW_UPPER_MS = 6 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Input schemas (internal — not exported; only used inside runWithLoggingAndValidation)
// ---------------------------------------------------------------------------

const GenerateTokenInputSchema = z.object({
    conversationId: z.string().uuid()
});

const ValidateTokenInputSchema = z.object({
    rawToken: z.string().min(1, 'rawToken must not be empty')
});

const RevokeAllInputSchema = z.object({
    conversationId: z.string().uuid()
});

const FindDueRemindersInputSchema = z.object({
    reminderType: z.enum(['day15', 'day25'])
});

const MarkReminderSentInputSchema = z.object({
    tokenId: z.string().uuid(),
    reminderType: z.enum(['day15', 'day25'])
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Result of a successful `generateToken` call.
 * Contains the raw token value that must be delivered to the guest once via
 * email. The raw token is never persisted.
 */
export interface GenerateTokenResult {
    /** 32-character lowercase hex token (16 random bytes). */
    rawToken: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages the lifecycle of anonymous-guest conversation access tokens.
 *
 * Security model:
 * - Raw tokens are 32-char hex strings generated from `crypto.randomBytes(16)`.
 * - Only the SHA-256 hex hash of the raw token is persisted (`token_hash`).
 * - Raw tokens are returned exactly once from `generateToken` and must be
 *   delivered to the guest via a magic-link email. They are never logged.
 * - Tokens expire after 30 days (`expiresAt`).
 * - Tokens can be explicitly revoked via `revokeAllForConversation` (e.g. on
 *   conversation soft-delete or admin action).
 *
 * Cron integration:
 * - `findDueReminders('day15')` / `findDueReminders('day25')` return tokens
 *   whose expiry falls in the expected window AND whose reminder flag is unset.
 * - `markReminderSent` stamps the matching column after the email is dispatched.
 *
 * @example
 * ```ts
 * const svc = new AccessTokenService({ logger });
 * const result = await svc.generateToken(actor, { conversationId });
 * if (result.data) sendMagicLink(email, result.data.rawToken);
 * ```
 */
export class AccessTokenService extends BaseService {
    static readonly ENTITY_NAME = 'conversationAccessToken';

    protected override readonly entityName = AccessTokenService.ENTITY_NAME;

    private readonly model: AccessTokenModel;

    /**
     * Creates a new AccessTokenService instance.
     *
     * @param config - Service configuration (logger, etc.).
     * @param model - Optional AccessTokenModel for dependency injection / testing.
     */
    constructor(config: ServiceConfig, model?: AccessTokenModel) {
        super(config, AccessTokenService.ENTITY_NAME);
        this.model = model ?? new AccessTokenModel();
    }

    // -------------------------------------------------------------------------
    // Permission helpers
    // -------------------------------------------------------------------------

    /**
     * Verifies the actor holds a conversation-level permission.
     * Accepts guest-level permissions (REPLY_OWN) or higher.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks sufficient permissions.
     */
    private _requireConversationAccess(actor: Actor): void {
        const allowed =
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_OWN) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_REPLY_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY) ||
            actor.permissions.includes(PermissionEnum.CONVERSATION_DELETE_ANY);

        if (!actor.id || !allowed) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions for conversation token operations'
            );
        }
    }

    /**
     * Verifies the actor holds admin-level conversation access.
     * Used for bulk revocation and cron-oriented operations.
     *
     * @throws {ServiceError} FORBIDDEN when the actor lacks CONVERSATION_VIEW_ANY.
     */
    private _requireAdminAccess(actor: Actor): void {
        if (!actor.id || !actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_ANY)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: CONVERSATION_VIEW_ANY required for bulk token operations'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Generates a new 30-day access token for an anonymous guest conversation.
     *
     * Creates 16 random bytes via `crypto.randomBytes`, returns the hex string as
     * the raw token, and stores only the SHA-256 hash. The raw token is returned
     * exactly once and must be delivered to the guest via the magic-link email.
     *
     * @param actor - Actor performing the action (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ conversationId }` — UUID of the target conversation.
     * @param ctx - Optional service context for transaction propagation.
     * @returns ServiceOutput wrapping `{ rawToken }` — the 32-char hex token.
     *
     * @example
     * ```ts
     * const { data } = await svc.generateToken(actor, { conversationId }, ctx);
     * if (data) await sendMagicLinkEmail(guest.email, data.rawToken);
     * ```
     */
    public async generateToken(
        actor: Actor,
        input: { conversationId: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<GenerateTokenResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'generateToken',
            input: { actor, ...input },
            schema: GenerateTokenInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireConversationAccess(validatedActor);

                const rawToken = randomBytes(16).toString('hex');
                const tokenHash = createHash('sha256').update(rawToken).digest('hex');
                const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

                await this.model.create(
                    {
                        conversationId: validated.conversationId,
                        tokenHash,
                        expiresAt
                    },
                    execCtx?.tx
                );

                // Return only the raw token. The hash is never exposed outside this method.
                return { rawToken };
            }
        });
    }

    /**
     * Validates a raw access token submitted by a guest.
     *
     * Hashes the raw value and looks up the row. Returns the token row on success.
     * Returns a typed ServiceError (UNAUTHORIZED) for missing, revoked, or expired tokens.
     *
     * Reason codes on failure:
     * - `TOKEN_REVOKED` — row not found OR `revokedAt` is set.
     * - `TOKEN_EXPIRED` — `expiresAt` is in the past.
     *
     * @param actor - Actor performing the validation (must hold CONVERSATION_REPLY_OWN or higher).
     * @param input - `{ rawToken }` — the plain-text token from the guest's magic link.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping the token row, or an UNAUTHORIZED error.
     *
     * @example
     * ```ts
     * const result = await svc.validateToken(actor, { rawToken });
     * if (result.error?.code === 'UNAUTHORIZED') return showExpiredPage();
     * // result.data is the token row
     * ```
     */
    public async validateToken(
        actor: Actor,
        input: { rawToken: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversationAccessToken>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateToken',
            input: { actor, ...input },
            schema: ValidateTokenInputSchema,
            ctx,
            execute: async (validated, validatedActor) => {
                this._requireConversationAccess(validatedActor);

                const tokenHash = createHash('sha256').update(validated.rawToken).digest('hex');

                // Use findOne to get the raw row — including revoked/expired —
                // so we can return the correct reason code.
                const row = await this.model.findOne({ tokenHash });

                if (!row) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Access token not found or invalid',
                        undefined,
                        'TOKEN_REVOKED'
                    );
                }

                if (row.revokedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Access token has been revoked',
                        undefined,
                        'TOKEN_REVOKED'
                    );
                }

                const now = new Date();
                if (row.expiresAt <= now) {
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Access token has expired',
                        undefined,
                        'TOKEN_EXPIRED'
                    );
                }

                return row;
            }
        });
    }

    /**
     * Revokes all active tokens for a conversation.
     *
     * Idempotent: calling this when no active tokens exist returns `{ count: 0 }`.
     * Must be called inside the same transaction as the parent operation (soft-delete,
     * admin close, etc.) to guarantee atomicity.
     *
     * @param actor - Actor performing the revocation (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ conversationId }` — UUID of the conversation.
     * @param tx - Required Drizzle transaction client.
     * @returns ServiceOutput wrapping `{ count }` — number of tokens revoked.
     *
     * @example
     * ```ts
     * await withServiceTransaction(async (ctx) => {
     *   await conversationService.softDelete(actor, { id: conversationId }, ctx);
     *   await accessTokenSvc.revokeAllForConversation(actor, { conversationId }, ctx.tx!);
     * });
     * ```
     */
    public async revokeAllForConversation(
        actor: Actor,
        input: { conversationId: string },
        tx: DrizzleClient
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'revokeAllForConversation',
            input: { actor, ...input },
            schema: RevokeAllInputSchema,
            execute: async (validated, validatedActor) => {
                this._requireAdminAccess(validatedActor);
                const count = await this.model.revokeAll(validated.conversationId, tx);
                return { count };
            }
        });
    }

    /**
     * Returns tokens due for a reminder email in the given window.
     *
     * Reminder windows (relative to `expiresAt` from `now`):
     * - `day15`: `[now+14d, now+16d]` — "your link expires in ~15 days"
     * - `day25`: `[now+4d,  now+6d]`  — "your link expires in ~5 days"
     *
     * Only tokens where the corresponding `*_reminder_sent_at IS NULL` are returned.
     * Revoked tokens are excluded at the model layer.
     *
     * @param actor - Actor performing the query (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ reminderType }` — `'day15'` or `'day25'`.
     * @param ctx - Optional service context.
     * @returns ServiceOutput wrapping an array of token rows due for dispatch.
     */
    public async findDueReminders(
        actor: Actor,
        input: { reminderType: 'day15' | 'day25' },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversationAccessToken[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findDueReminders',
            input: { actor, ...input },
            schema: FindDueRemindersInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireAdminAccess(validatedActor);

                const now = Date.now();
                let windowStart: Date;
                let windowEnd: Date;

                if (validated.reminderType === 'day15') {
                    windowStart = new Date(now + DAY15_WINDOW_LOWER_MS);
                    windowEnd = new Date(now + DAY15_WINDOW_UPPER_MS);
                } else {
                    windowStart = new Date(now + DAY25_WINDOW_LOWER_MS);
                    windowEnd = new Date(now + DAY25_WINDOW_UPPER_MS);
                }

                return this.model.findDueReminders(
                    windowStart,
                    windowEnd,
                    validated.reminderType,
                    execCtx?.tx
                );
            }
        });
    }

    /**
     * Stamps the `day15_reminder_sent_at` or `day25_reminder_sent_at` column
     * after the corresponding reminder email is dispatched.
     *
     * Only the column matching `reminderType` is updated; the other column is
     * left unchanged. This prevents future cron runs from re-dispatching the
     * same reminder.
     *
     * @param actor - Actor performing the update (must hold CONVERSATION_VIEW_ANY).
     * @param input - `{ tokenId, reminderType }`.
     * @param ctx - Optional service context for transaction propagation.
     * @returns ServiceOutput wrapping the updated token row, or `null` if not found.
     *
     * @example
     * ```ts
     * for (const token of dueTokens) {
     *   await sendReminderEmail(token);
     *   await svc.markReminderSent(actor, { tokenId: token.id, reminderType: 'day15' });
     * }
     * ```
     */
    public async markReminderSent(
        actor: Actor,
        input: { tokenId: string; reminderType: 'day15' | 'day25' },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectConversationAccessToken | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markReminderSent',
            input: { actor, ...input },
            schema: MarkReminderSentInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                this._requireAdminAccess(validatedActor);

                const now = new Date();
                const patch =
                    validated.reminderType === 'day15'
                        ? ({ day15ReminderSentAt: now } as Partial<SelectConversationAccessToken>)
                        : ({ day25ReminderSentAt: now } as Partial<SelectConversationAccessToken>);

                return this.model.update({ id: validated.tokenId }, patch, execCtx?.tx);
            }
        });
    }
}
