/**
 * @module newsletter-subscriber.service
 *
 * NewsletterSubscriberService — orchestrates the newsletter opt-in / opt-out
 * lifecycle for authenticated users (SPEC-101).
 *
 * Responsibilities:
 * - Double opt-in subscribe flow (insert + verification email)
 * - HMAC token verification (pending → active)
 * - Re-send verification
 * - HMAC token unsubscribe (public, no auth)
 * - Authenticated unsubscribe
 * - Subscription status lookup (owner-only)
 * - Eligible-for-campaign selection with soft-cap (single NOT EXISTS subquery)
 * - Admin list with filtering (requires NEWSLETTER_SUBSCRIBER_VIEW)
 * - Admin stats aggregation (requires NEWSLETTER_SUBSCRIBER_VIEW)
 *
 * DEVIATIONS FROM SPEC (documented):
 * 1. `adminList` and `getStats` are implemented directly on this class rather
 *    than delegating to a BaseCrudService because the table has no BaseModel
 *    wrapper shipped in this task; the raw drizzle table is queried directly
 *    via getDb(). If a NewsletterSubscribersModel is added in a later task,
 *    these methods should be refactored to use it.
 * 2. `getEligibleForCampaign` is a single SQL query with a NOT EXISTS subquery
 *    as required. The soft-cap window is expressed as a PostgreSQL INTERVAL
 *    expression to avoid JS date arithmetic.
 * 3. `adminList` builds filters manually (no BaseCrudService.adminList helper)
 *    for the same reason as (1). The filter set matches
 *    NewsletterSubscriberAdminSearchSchema.
 *
 * @see {@link newsletter-subscriber.permissions}
 * @see {@link newsletter-token.helpers}
 */

import { getDb } from '@repo/db';
import type { InsertNewsletterSubscriber, SelectNewsletterSubscriber } from '@repo/db';
import {
    NewsletterChannelEnum,
    NewsletterSourceEnum,
    NewsletterSubscriberStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { NewsletterSubscriberAdminSearch } from '@repo/schemas';
import type { NewsletterSubscriberStatsResponse } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { checkCanViewSubscribers, requireSelf } from './newsletter-subscriber.permissions.js';
import {
    InvalidTokenError,
    TokenExpiredError,
    generateUnsubscribeToken,
    generateVerificationToken,
    verifyUnsubscribeToken,
    verifyVerificationToken
} from './newsletter-token.helpers.js';

// ---------------------------------------------------------------------------
// Re-export types used by route layer
// ---------------------------------------------------------------------------

export type { InsertNewsletterSubscriber, SelectNewsletterSubscriber };

// ---------------------------------------------------------------------------
// Notification dispatcher interface
// ---------------------------------------------------------------------------

/**
 * Notification dispatcher interface injected into `NewsletterSubscriberService`.
 *
 * Implementations live in the host app (`apps/api`) so that email-template
 * imports stay out of `@repo/service-core`. The default is a no-op so that
 * unit tests and early dev wiring do not need to inject anything.
 */
export interface NewsletterNotificationDispatcher {
    /**
     * Dispatches the double opt-in verification email.
     *
     * @param input - Subscriber identity and the freshly generated HMAC token.
     */
    sendVerification(input: {
        subscriberId: string;
        email: string;
        userId: string;
        locale: string;
        token: string;
    }): Promise<void>;

    /**
     * Dispatches the welcome email after a subscriber verifies.
     *
     * @param input - Subscriber identity and an unsubscribe token for the footer link.
     */
    sendWelcome(input: {
        subscriberId: string;
        email: string;
        userId: string;
        locale: string;
        unsubscribeToken: string;
    }): Promise<void>;
}

/** No-op dispatcher used when no dispatcher is injected. */
const NO_OP_DISPATCHER: NewsletterNotificationDispatcher = {
    sendVerification: async () => undefined,
    sendWelcome: async () => undefined
};

// ---------------------------------------------------------------------------
// Service options
// ---------------------------------------------------------------------------

/**
 * Constructor options for `NewsletterSubscriberService`.
 */
export interface NewsletterSubscriberServiceOptions {
    /** Logger from the parent context. */
    logger?: ServiceConfig['logger'];
    /** HMAC secret for verification + unsubscribe tokens. */
    hmacSecret: string;
    /** Previous HMAC secret for graceful key rotation (optional). */
    hmacSecretPrev?: string;
    /** Default verification TTL in hours (defaults to 72). */
    verificationTtlHours?: number;
    /** Soft-cap rolling window in days (defaults to 7). */
    softCapDays?: number;
    /**
     * Optional notification dispatcher (fire-and-forget).
     * Defaults to a no-op so unit tests don't have to inject.
     */
    notificationDispatcher?: NewsletterNotificationDispatcher;
}

// ---------------------------------------------------------------------------
// Internal Zod schemas for method input validation
// ---------------------------------------------------------------------------

const SubscribeInputSchema = z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL),
    locale: z.enum(['es', 'en', 'pt']).default('es'),
    source: z.nativeEnum(NewsletterSourceEnum).default(NewsletterSourceEnum.WEB_FOOTER),
    consentIp: z.string().max(45).optional(),
    consentUa: z.string().optional(),
    consentVersion: z.string().max(20).optional()
});

const VerifyTokenInputSchema = z.object({
    token: z.string().min(1)
});

const ResendVerificationInputSchema = z.object({
    userId: z.string().uuid(),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL)
});

const UnsubscribeByTokenInputSchema = z.object({
    token: z.string().min(1)
});

const UnsubscribeAuthenticatedInputSchema = z.object({
    userId: z.string().uuid(),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL)
});

const GetStatusInputSchema = z.object({
    userId: z.string().uuid(),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL)
});

const GetEligibleInputSchema = z.object({
    localeFilter: z.enum(['all', 'es', 'en', 'pt']),
    softCapWindowDays: z.number().int().min(1)
});

const AdminListInputSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(200).default(50),
    subscriberStatus: z.nativeEnum(NewsletterSubscriberStatusEnum).optional(),
    channel: z.nativeEnum(NewsletterChannelEnum).optional(),
    locale: z.enum(['es', 'en', 'pt']).optional(),
    source: z.nativeEnum(NewsletterSourceEnum).optional(),
    emailSearch: z.string().max(255).optional()
});

const GetStatsInputSchema = z.object({});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Result returned by `subscribe`. */
export interface SubscribeResult {
    readonly status: 'pending_verification' | 'active' | 'already_pending';
}

/** Result returned by `verifyToken`. */
export interface VerifyTokenResult {
    readonly subscriberId: string;
    readonly status: 'active' | 'already_active';
}

/** Result returned by `unsubscribeByToken`. */
export interface UnsubscribeByTokenResult {
    readonly status: 'unsubscribed' | 'already_unsubscribed';
}

/** Result returned by `unsubscribeAuthenticated`. */
export interface UnsubscribeAuthenticatedResult {
    readonly status: 'unsubscribed' | 'not_subscribed';
}

/** Result returned by `getStatus`. */
export interface GetStatusResult {
    readonly subscribed: boolean;
    readonly status: NewsletterSubscriberStatusEnum | null;
    readonly subscribedAt: Date | null;
    readonly verifiedAt: Date | null;
}

/** Result returned by `getEligibleForCampaign`. */
export interface GetEligibleForCampaignResult {
    readonly eligibleIds: string[];
    readonly softCappedCount: number;
    readonly totalCandidates: number;
}

/** Result returned by `adminList`. */
export interface AdminListResult {
    readonly items: readonly SelectNewsletterSubscriber[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * NewsletterSubscriberService orchestrates the newsletter opt-in / opt-out
 * lifecycle for authenticated users.
 *
 * Extends `BaseService` (NOT `BaseCrudService`) because the entity has no
 * BaseModel wrapper in the current task scope. All DB access goes via
 * `getDb()` with the Drizzle table reference imported from `@repo/db`.
 *
 * All public methods return `ServiceOutput<T>` and are wrapped by
 * `runWithLoggingAndValidation` for consistent logging.
 *
 * @example
 * ```ts
 * const svc = new NewsletterSubscriberService(
 *   { logger },
 *   {
 *     hmacSecret: env.HOSPEDA_NEWSLETTER_HMAC_SECRET,
 *     notificationDispatcher: myDispatcher
 *   }
 * );
 * const result = await svc.subscribe(actor, {
 *   userId: actor.id,
 *   email: 'user@example.com',
 *   channel: NewsletterChannelEnum.EMAIL,
 *   locale: 'es',
 *   source: NewsletterSourceEnum.WEB_FOOTER
 * });
 * ```
 */
export class NewsletterSubscriberService extends BaseService {
    static readonly ENTITY_NAME = 'newsletterSubscriber';

    protected override readonly entityName = NewsletterSubscriberService.ENTITY_NAME;

    private readonly hmacSecret: string;
    private readonly hmacSecretPrev?: string;
    private readonly verificationTtlHours: number;
    private readonly softCapDays: number;
    private readonly dispatcher: NewsletterNotificationDispatcher;

    /**
     * Creates a new NewsletterSubscriberService.
     *
     * @param config - Base service configuration (logger).
     * @param options - HMAC secrets, TTL, dispatcher.
     */
    constructor(config: ServiceConfig, options: NewsletterSubscriberServiceOptions) {
        super(config, NewsletterSubscriberService.ENTITY_NAME);
        this.hmacSecret = options.hmacSecret;
        this.hmacSecretPrev = options.hmacSecretPrev;
        this.verificationTtlHours = options.verificationTtlHours ?? 72;
        this.softCapDays = options.softCapDays ?? 7;
        this.dispatcher = options.notificationDispatcher ?? NO_OP_DISPATCHER;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Generates a verification HMAC token for a subscriber.
     *
     * @param subscriberId - UUID of the subscriber row.
     * @param channel - The delivery channel.
     * @returns Base64url-encoded token string.
     */
    private _genVerificationToken(subscriberId: string, channel: 'email' | 'whatsapp'): string {
        return generateVerificationToken({
            subscriberId,
            channel,
            secret: this.hmacSecret
        });
    }

    /**
     * Generates a stable unsubscribe token for use in email footers.
     *
     * @param subscriberId - UUID of the subscriber row.
     * @param channel - The delivery channel.
     * @returns Base64url-encoded token string.
     */
    private _genUnsubscribeToken(subscriberId: string, channel: 'email' | 'whatsapp'): string {
        return generateUnsubscribeToken({
            subscriberId,
            channel,
            secret: this.hmacSecret
        });
    }

    /**
     * Dispatches a verification email, swallowing errors to avoid breaking
     * the DB transaction on mailer failure.
     *
     * @param input - Subscriber data and token.
     */
    private async _sendVerification(input: {
        subscriberId: string;
        email: string;
        userId: string;
        locale: string;
        token: string;
    }): Promise<void> {
        try {
            await this.dispatcher.sendVerification(input);
        } catch (err) {
            this.logger.error(
                { subscriberId: input.subscriberId, err },
                'newsSubscriber: failed to dispatch verification email (swallowed)'
            );
        }
    }

    /**
     * Dispatches a welcome email, swallowing errors.
     *
     * @param input - Subscriber data and unsubscribe token.
     */
    private async _sendWelcome(input: {
        subscriberId: string;
        email: string;
        userId: string;
        locale: string;
        unsubscribeToken: string;
    }): Promise<void> {
        try {
            await this.dispatcher.sendWelcome(input);
        } catch (err) {
            this.logger.error(
                { subscriberId: input.subscriberId, err },
                'newsSubscriber: failed to dispatch welcome email (swallowed)'
            );
        }
    }

    // -------------------------------------------------------------------------
    // Public API — subscribe
    // -------------------------------------------------------------------------

    /**
     * Subscribes an authenticated user to the newsletter.
     *
     * State machine:
     * - No row (or only soft-deleted rows) → INSERT `pending_verification`, send verification email.
     * - Row with `pending_verification` → refresh `subscribedAt`, re-issue token, send verification email.
     * - Row with `active` → no-op, return `'active'` (no email).
     * - Row with `unsubscribed` → reactivate to `pending_verification`, send verification email.
     * - Row with `bounced` or `complained` → BLOCKED, return Err `NEWSLETTER_SUBSCRIBER_BLOCKED`.
     *
     * Owner-only: actor must equal `input.userId`.
     *
     * @param actor - The authenticated actor.
     * @param input - Subscription details.
     * @param ctx - Optional service context.
     * @returns Outcome status discriminator.
     *
     * @example
     * ```ts
     * const result = await svc.subscribe(actor, { userId: actor.id, email: 'a@b.com', channel: 'email', locale: 'es', source: 'web_footer' });
     * ```
     */
    public async subscribe(
        actor: Actor,
        input: {
            userId: string;
            email: string;
            channel?: NewsletterChannelEnum;
            locale?: 'es' | 'en' | 'pt';
            source?: NewsletterSourceEnum;
            consentIp?: string;
            consentUa?: string;
            consentVersion?: string;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SubscribeResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'subscribe',
            input: { actor, ...input },
            schema: SubscribeInputSchema,
            ctx,
            execute: async (validated) => {
                requireSelf(actor, validated.userId);

                const db = getDb();

                // NOTE: No NewsletterSubscribersModel exists yet (DEVIATION #1).
                // We query the table directly via raw SQL executed through getDb().
                const rows = await db.execute(sql`
                    SELECT id, user_id AS "userId", email, channel, status, locale, source,
                           consent_ip AS "consentIp", consent_ua AS "consentUa",
                           consent_version AS "consentVersion",
                           subscribed_at AS "subscribedAt", verified_at AS "verifiedAt",
                           unsubscribed_at AS "unsubscribedAt", bounced_at AS "bouncedAt",
                           complained_at AS "complainedAt",
                           created_at AS "createdAt", updated_at AS "updatedAt",
                           deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);

                const row = rows.rows[0] as SelectNewsletterSubscriber | undefined;

                const status = row?.status as NewsletterSubscriberStatusEnum | undefined;

                // Blocked terminal states
                if (
                    status === NewsletterSubscriberStatusEnum.BOUNCED ||
                    status === NewsletterSubscriberStatusEnum.COMPLAINED
                ) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'This email address is blocked from newsletter subscriptions',
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_BLOCKED'
                    );
                }

                const now = new Date();
                const channelVal = validated.channel as 'email' | 'whatsapp';

                if (!row) {
                    // New subscription
                    const inserted = await db.execute(sql`
                        INSERT INTO newsletter_subscribers
                            (user_id, email, channel, status, locale, source,
                             consent_ip, consent_ua, consent_version,
                             subscribed_at, created_at, updated_at)
                        VALUES
                            (${validated.userId}, ${validated.email}, ${validated.channel},
                             ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION},
                             ${validated.locale}, ${validated.source},
                             ${validated.consentIp ?? null}, ${validated.consentUa ?? null},
                             ${validated.consentVersion ?? null},
                             ${now.toISOString()}, ${now.toISOString()}, ${now.toISOString()})
                        RETURNING id
                    `);
                    const newId = (inserted.rows[0] as { id: string }).id;
                    const token = this._genVerificationToken(newId, channelVal);
                    await this._sendVerification({
                        subscriberId: newId,
                        email: validated.email,
                        userId: validated.userId,
                        locale: validated.locale,
                        token
                    });
                    return { status: 'pending_verification' };
                }

                const subscriberId = row.id;

                if (status === NewsletterSubscriberStatusEnum.ACTIVE) {
                    return { status: 'active' };
                }

                if (status === NewsletterSubscriberStatusEnum.PENDING_VERIFICATION) {
                    // Refresh subscribedAt to extend TTL
                    await db.execute(sql`
                        UPDATE newsletter_subscribers
                        SET subscribed_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
                        WHERE id = ${subscriberId}
                    `);
                    const token = this._genVerificationToken(subscriberId, channelVal);
                    await this._sendVerification({
                        subscriberId,
                        email: row.email,
                        userId: validated.userId,
                        locale: row.locale,
                        token
                    });
                    return { status: 'already_pending' };
                }

                // status === UNSUBSCRIBED → reactivate
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION},
                        unsubscribed_at = NULL,
                        subscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${subscriberId}
                `);
                const token = this._genVerificationToken(subscriberId, channelVal);
                await this._sendVerification({
                    subscriberId,
                    email: row.email,
                    userId: validated.userId,
                    locale: row.locale,
                    token
                });
                return { status: 'pending_verification' };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — verifyToken
    // -------------------------------------------------------------------------

    /**
     * Verifies a double opt-in HMAC token and activates the subscriber.
     *
     * Public method (no actor). Throws `NEWSLETTER_TOKEN_EXPIRED` or
     * `NEWSLETTER_TOKEN_INVALID` on bad tokens.
     *
     * Idempotent: already-active subscribers return `'already_active'`.
     *
     * @param token - Base64url HMAC token from the verification email.
     * @param ctx - Optional service context.
     * @returns `{ subscriberId, status }`.
     *
     * @example
     * ```ts
     * const result = await svc.verifyToken(token);
     * ```
     */
    public async verifyToken(
        token: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<VerifyTokenResult>> {
        // Use a minimal system actor so runWithLoggingAndValidation is happy
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'verifyToken',
            input: { actor: systemActor, token },
            schema: VerifyTokenInputSchema,
            ctx,
            execute: async (validated) => {
                let subscriberId: string;
                let channel: 'email' | 'whatsapp';

                try {
                    const payload = verifyVerificationToken({
                        token: validated.token,
                        secret: this.hmacSecret,
                        secretPrev: this.hmacSecretPrev,
                        ttlHours: this.verificationTtlHours
                    });
                    subscriberId = payload.subscriberId;
                    channel = payload.channel;
                } catch (err) {
                    if (err instanceof TokenExpiredError) {
                        throw new ServiceError(
                            ServiceErrorCode.UNAUTHORIZED,
                            'Newsletter verification token has expired',
                            undefined,
                            'NEWSLETTER_TOKEN_EXPIRED'
                        );
                    }
                    if (err instanceof InvalidTokenError) {
                        throw new ServiceError(
                            ServiceErrorCode.UNAUTHORIZED,
                            'Invalid newsletter verification token',
                            undefined,
                            'NEWSLETTER_TOKEN_INVALID'
                        );
                    }
                    throw err;
                }

                const db = getDb();
                const rows = await db.execute(sql`
                    SELECT id, user_id AS "userId", email, status, locale,
                           deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE id = ${subscriberId}
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | Pick<
                          SelectNewsletterSubscriber,
                          'id' | 'userId' | 'email' | 'status' | 'locale' | 'deletedAt'
                      >
                    | undefined;

                if (!row || row.deletedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Newsletter subscriber not found: ${subscriberId}`,
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_FOUND'
                    );
                }

                const status = row.status as NewsletterSubscriberStatusEnum;

                if (status === NewsletterSubscriberStatusEnum.ACTIVE) {
                    return { subscriberId, status: 'already_active' };
                }

                if (status !== NewsletterSubscriberStatusEnum.PENDING_VERIFICATION) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Subscriber is in status '${status}' — cannot verify`,
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_PENDING'
                    );
                }

                const now = new Date();
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.ACTIVE},
                        verified_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${subscriberId}
                `);

                const unsubscribeToken = this._genUnsubscribeToken(subscriberId, channel);
                await this._sendWelcome({
                    subscriberId,
                    email: row.email,
                    userId: row.userId,
                    locale: row.locale,
                    unsubscribeToken
                });

                return { subscriberId, status: 'active' };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — resendVerification
    // -------------------------------------------------------------------------

    /**
     * Re-sends the verification email for a subscriber in `pending_verification`.
     *
     * Owner-only. Fails with `NEWSLETTER_SUBSCRIBER_NOT_PENDING` if the
     * subscriber is not in `pending_verification`, and `NEWSLETTER_SUBSCRIBER_NOT_FOUND`
     * if no active row exists.
     *
     * @param actor - The authenticated actor.
     * @param userId - User ID of the subscriber.
     * @param channel - Delivery channel (defaults to 'email').
     * @param ctx - Optional service context.
     * @returns `{ sent: true }`.
     *
     * @example
     * ```ts
     * await svc.resendVerification(actor, actor.id);
     * ```
     */
    public async resendVerification(
        actor: Actor,
        userId: string,
        channel: NewsletterChannelEnum = NewsletterChannelEnum.EMAIL,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ sent: true }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'resendVerification',
            input: { actor, userId, channel },
            schema: ResendVerificationInputSchema,
            ctx,
            execute: async (validated) => {
                requireSelf(actor, validated.userId);

                const db = getDb();
                const rows = await db.execute(sql`
                    SELECT id, user_id AS "userId", email, channel, status, locale,
                           deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | Pick<
                          SelectNewsletterSubscriber,
                          'id' | 'userId' | 'email' | 'channel' | 'status' | 'locale' | 'deletedAt'
                      >
                    | undefined;

                if (!row) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No newsletter subscription found for this user and channel',
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_FOUND'
                    );
                }

                if (row.status !== NewsletterSubscriberStatusEnum.PENDING_VERIFICATION) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Subscriber is in status '${row.status}' — not pending verification`,
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_PENDING'
                    );
                }

                const now = new Date();
                // Refresh subscribedAt to extend TTL
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET subscribed_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
                    WHERE id = ${row.id}
                `);

                const channelVal = row.channel as 'email' | 'whatsapp';
                const token = this._genVerificationToken(row.id, channelVal);
                await this._sendVerification({
                    subscriberId: row.id,
                    email: row.email,
                    userId: validated.userId,
                    locale: row.locale,
                    token
                });

                return { sent: true };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — unsubscribeByToken
    // -------------------------------------------------------------------------

    /**
     * Unsubscribes via the HMAC token embedded in the email footer link.
     *
     * Public method (no actor). Idempotent: already-unsubscribed, bounced, and
     * complained rows all return `'already_unsubscribed'` without a state change.
     *
     * @param token - Base64url HMAC unsubscribe token.
     * @param ctx - Optional service context.
     * @returns Status discriminator.
     *
     * @example
     * ```ts
     * const result = await svc.unsubscribeByToken(token);
     * ```
     */
    public async unsubscribeByToken(
        token: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UnsubscribeByTokenResult>> {
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'unsubscribeByToken',
            input: { actor: systemActor, token },
            schema: UnsubscribeByTokenInputSchema,
            ctx,
            execute: async (validated) => {
                let subscriberId: string;

                try {
                    const payload = verifyUnsubscribeToken({
                        token: validated.token,
                        secret: this.hmacSecret,
                        secretPrev: this.hmacSecretPrev
                    });
                    subscriberId = payload.subscriberId;
                } catch (err) {
                    if (err instanceof InvalidTokenError) {
                        throw new ServiceError(
                            ServiceErrorCode.UNAUTHORIZED,
                            'Invalid newsletter unsubscribe token',
                            undefined,
                            'NEWSLETTER_TOKEN_INVALID'
                        );
                    }
                    throw err;
                }

                const db = getDb();
                const rows = await db.execute(sql`
                    SELECT id, status, deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE id = ${subscriberId}
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | Pick<SelectNewsletterSubscriber, 'id' | 'status' | 'deletedAt'>
                    | undefined;

                if (!row || row.deletedAt !== null) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Newsletter subscriber not found: ${subscriberId}`,
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_FOUND'
                    );
                }

                const status = row.status as NewsletterSubscriberStatusEnum;

                // Terminal or already-unsubscribed states are idempotent
                if (
                    status === NewsletterSubscriberStatusEnum.UNSUBSCRIBED ||
                    status === NewsletterSubscriberStatusEnum.BOUNCED ||
                    status === NewsletterSubscriberStatusEnum.COMPLAINED
                ) {
                    return { status: 'already_unsubscribed' };
                }

                const now = new Date();
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.UNSUBSCRIBED},
                        unsubscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${subscriberId}
                `);

                return { status: 'unsubscribed' };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — unsubscribeAuthenticated
    // -------------------------------------------------------------------------

    /**
     * Unsubscribes an authenticated user from the newsletter.
     *
     * Owner-only. Returns `'not_subscribed'` when no active row is found.
     * Idempotent for already-unsubscribed rows.
     *
     * @param actor - The authenticated actor.
     * @param userId - User ID of the subscriber.
     * @param channel - Delivery channel (defaults to 'email').
     * @param ctx - Optional service context.
     * @returns Status discriminator.
     *
     * @example
     * ```ts
     * await svc.unsubscribeAuthenticated(actor, actor.id);
     * ```
     */
    public async unsubscribeAuthenticated(
        actor: Actor,
        userId: string,
        channel: NewsletterChannelEnum = NewsletterChannelEnum.EMAIL,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UnsubscribeAuthenticatedResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unsubscribeAuthenticated',
            input: { actor, userId, channel },
            schema: UnsubscribeAuthenticatedInputSchema,
            ctx,
            execute: async (validated) => {
                requireSelf(actor, validated.userId);

                const db = getDb();
                const rows = await db.execute(sql`
                    SELECT id, status, deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | Pick<SelectNewsletterSubscriber, 'id' | 'status' | 'deletedAt'>
                    | undefined;

                if (!row) {
                    return { status: 'not_subscribed' };
                }

                const status = row.status as NewsletterSubscriberStatusEnum;

                if (
                    status === NewsletterSubscriberStatusEnum.UNSUBSCRIBED ||
                    status === NewsletterSubscriberStatusEnum.BOUNCED ||
                    status === NewsletterSubscriberStatusEnum.COMPLAINED
                ) {
                    return { status: 'unsubscribed' };
                }

                const now = new Date();
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.UNSUBSCRIBED},
                        unsubscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${row.id}
                `);

                return { status: 'unsubscribed' };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — getStatus
    // -------------------------------------------------------------------------

    /**
     * Returns the current subscription status for a user.
     *
     * Owner-only. Returns `{ subscribed: false, ... }` when no active row exists.
     *
     * @param actor - The authenticated actor.
     * @param userId - User ID to look up.
     * @param channel - Delivery channel (defaults to 'email').
     * @param ctx - Optional service context.
     * @returns Subscription status snapshot.
     *
     * @example
     * ```ts
     * const result = await svc.getStatus(actor, actor.id);
     * ```
     */
    public async getStatus(
        actor: Actor,
        userId: string,
        channel: NewsletterChannelEnum = NewsletterChannelEnum.EMAIL,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<GetStatusResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStatus',
            input: { actor, userId, channel },
            schema: GetStatusInputSchema,
            ctx,
            execute: async (validated) => {
                requireSelf(actor, validated.userId);

                const db = getDb();
                const rows = await db.execute(sql`
                    SELECT status, subscribed_at, verified_at, deleted_at
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | {
                          status: string;
                          subscribed_at: Date | null;
                          verified_at: Date | null;
                          deleted_at: Date | null;
                      }
                    | undefined;

                if (!row) {
                    return {
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    };
                }

                const status = row.status as NewsletterSubscriberStatusEnum;
                return {
                    subscribed: status === NewsletterSubscriberStatusEnum.ACTIVE,
                    status,
                    subscribedAt: row.subscribed_at ?? null,
                    verifiedAt: row.verified_at ?? null
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Internal — getEligibleForCampaign
    // -------------------------------------------------------------------------

    /**
     * Returns subscriber IDs eligible for a campaign dispatch.
     *
     * Eligible = `status='active'`, `deleted_at IS NULL`, locale matches,
     * AND no delivery row with `delivered_at >= now() - softCapWindowDays days`.
     *
     * The soft-cap exclusion is expressed as a single SQL `NOT EXISTS` subquery
     * to avoid fetching all rows and filtering in JS (scales to 50k+ subscribers).
     *
     * @param input - Locale filter and soft-cap window.
     * @param ctx - Optional service context.
     * @returns Eligible IDs, soft-capped count, and total candidates.
     *
     * @example
     * ```ts
     * const result = await svc.getEligibleForCampaign({ localeFilter: 'es', softCapWindowDays: 7 });
     * ```
     */
    public async getEligibleForCampaign(
        input: {
            localeFilter: 'all' | 'es' | 'en' | 'pt';
            softCapWindowDays: number;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<GetEligibleForCampaignResult>> {
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'getEligibleForCampaign',
            input: { actor: systemActor, ...input },
            schema: GetEligibleInputSchema,
            ctx,
            execute: async (validated) => {
                const db = getDb();

                // Build locale condition
                const localeCondition =
                    validated.localeFilter === 'all'
                        ? sql`TRUE`
                        : sql`ns.locale = ${validated.localeFilter}`;

                // Total candidates (active, non-deleted, locale matches)
                const totalResult = await db.execute(sql`
                    SELECT COUNT(*)::int AS total
                    FROM newsletter_subscribers ns
                    WHERE ns.status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                      AND ns.deleted_at IS NULL
                      AND ${localeCondition}
                `);
                const totalCandidates = Number(
                    (totalResult.rows[0] as { total: number }).total ?? 0
                );

                if (totalCandidates === 0) {
                    return { eligibleIds: [], softCappedCount: 0, totalCandidates: 0 };
                }

                // Eligible = candidates that have NOT received a delivery recently.
                // NOT EXISTS subquery keeps this to a single SQL round-trip.
                const eligibleResult = await db.execute(sql`
                    SELECT ns.id
                    FROM newsletter_subscribers ns
                    WHERE ns.status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                      AND ns.deleted_at IS NULL
                      AND ${localeCondition}
                      AND NOT EXISTS (
                          SELECT 1
                          FROM newsletter_campaign_deliveries d
                          WHERE d.subscriber_id = ns.id
                            AND d.delivered_at >= NOW() - (${validated.softCapWindowDays} || ' days')::interval
                      )
                `);

                const eligibleIds = (eligibleResult.rows as { id: string }[]).map((r) => r.id);
                const softCappedCount = totalCandidates - eligibleIds.length;

                return { eligibleIds, softCappedCount, totalCandidates };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — adminList
    // -------------------------------------------------------------------------

    /**
     * Returns a paginated list of newsletter subscribers (admin only).
     *
     * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission. Supports filtering by
     * subscriberStatus, channel, locale, source, and email (ILIKE via safeIlike).
     *
     * @param actor - The admin actor.
     * @param params - Admin search parameters (from NewsletterSubscriberAdminSearchSchema).
     * @param ctx - Optional service context.
     * @returns Paginated subscriber list.
     *
     * @example
     * ```ts
     * const result = await svc.adminList(actor, { page: 1, pageSize: 50, subscriberStatus: 'active' });
     * ```
     */
    public async adminList(
        actor: Actor,
        params: NewsletterSubscriberAdminSearch,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AdminListResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'adminList',
            input: { actor, ...params },
            schema: AdminListInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewSubscribers(actor);

                const db = getDb();

                // Build WHERE conditions
                const conditions: ReturnType<typeof sql>[] = [sql`deleted_at IS NULL`];

                if (validated.subscriberStatus) {
                    conditions.push(sql`status = ${validated.subscriberStatus}`);
                }
                if (validated.channel) {
                    conditions.push(sql`channel = ${validated.channel}`);
                }
                if (validated.locale) {
                    conditions.push(sql`locale = ${validated.locale}`);
                }
                if (validated.source) {
                    conditions.push(sql`source = ${validated.source}`);
                }
                if (validated.emailSearch) {
                    // safeIlike escapes LIKE metacharacters
                    // We inline the escaped pattern here since we're using raw sql
                    const escaped = validated.emailSearch
                        .replace(/\\/g, '\\\\')
                        .replace(/%/g, '\\%')
                        .replace(/_/g, '\\_');
                    conditions.push(sql`email ILIKE ${`%${escaped}%`}`);
                }

                const whereClause = conditions.reduce((acc, cond, idx) =>
                    idx === 0 ? cond : sql`${acc} AND ${cond}`
                );

                const offset = (validated.page - 1) * validated.pageSize;

                const [countResult, itemsResult] = await Promise.all([
                    db.execute(sql`
                        SELECT COUNT(*)::int AS total
                        FROM newsletter_subscribers
                        WHERE ${whereClause}
                    `),
                    db.execute(sql`
                        SELECT *
                        FROM newsletter_subscribers
                        WHERE ${whereClause}
                        ORDER BY created_at DESC
                        LIMIT ${validated.pageSize}
                        OFFSET ${offset}
                    `)
                ]);

                const total = Number((countResult.rows[0] as { total: number }).total ?? 0);
                const items = itemsResult.rows as SelectNewsletterSubscriber[];

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
    // Public API — getStats
    // -------------------------------------------------------------------------

    /**
     * Returns aggregated subscriber counts per lifecycle status (admin only).
     *
     * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission. A single SQL query with
     * `COUNT(*) FILTER (WHERE status = ...)` avoids multiple round-trips.
     *
     * @param actor - The admin actor.
     * @param ctx - Optional service context.
     * @returns Counts per status.
     *
     * @example
     * ```ts
     * const result = await svc.getStats(actor);
     * ```
     */
    public async getStats(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<NewsletterSubscriberStatsResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { actor },
            schema: GetStatsInputSchema,
            ctx,
            execute: async () => {
                checkCanViewSubscribers(actor);

                const db = getDb();
                const result = await db.execute(sql`
                    SELECT
                        COUNT(*) FILTER (WHERE status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                                          AND deleted_at IS NULL)::int AS "totalActive",
                        COUNT(*) FILTER (WHERE status = ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION}
                                          AND deleted_at IS NULL)::int AS "totalPending",
                        COUNT(*) FILTER (WHERE status = ${NewsletterSubscriberStatusEnum.UNSUBSCRIBED}
                                          AND deleted_at IS NULL)::int AS "totalUnsubscribed",
                        COUNT(*) FILTER (WHERE status = ${NewsletterSubscriberStatusEnum.BOUNCED}
                                          AND deleted_at IS NULL)::int AS "totalBounced",
                        COUNT(*) FILTER (WHERE status = ${NewsletterSubscriberStatusEnum.COMPLAINED}
                                          AND deleted_at IS NULL)::int AS "totalComplained"
                    FROM newsletter_subscribers
                `);

                const row = result.rows[0] as {
                    totalActive: number;
                    totalPending: number;
                    totalUnsubscribed: number;
                    totalBounced: number;
                    totalComplained: number;
                };

                return {
                    totalActive: row.totalActive ?? 0,
                    totalPending: row.totalPending ?? 0,
                    totalUnsubscribed: row.totalUnsubscribed ?? 0,
                    totalBounced: row.totalBounced ?? 0,
                    totalComplained: row.totalComplained ?? 0
                };
            }
        });
    }
}
