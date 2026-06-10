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
 * TERMINAL-STATE POLICY (bounced / complained):
 * Rows in `bounced` or `complained` are TERMINAL — only an admin reset (out of
 * scope here) clears them. Every mutating path on this service enforces this:
 *   - `subscribe`           → throws `NEWSLETTER_SUBSCRIBER_BLOCKED`.
 *   - `updatePreferences`   → throws `NEWSLETTER_SUBSCRIBER_BLOCKED`.
 *   - `verifyToken`         → throws `NEWSLETTER_SUBSCRIBER_NOT_PENDING`
 *                             (status is not pending_verification).
 *   - `unsubscribeByToken`  → idempotently returns `'already_unsubscribed'`
 *                             (terminal rows are effectively unsubscribed).
 *   - `unsubscribeAuthenticated` → same idempotent return.
 *   - `resendVerification`  → throws `NEWSLETTER_SUBSCRIBER_NOT_PENDING`.
 *   - `linkAnonymousSubscribersToUser` → may link an anonymous bounced /
 *     complained row to a freshly signed-up user (transferring ownership of
 *     the consent audit trail), but NEVER promotes its status and NEVER
 *     dispatches a welcome email. The terminal state survives the link, and
 *     subsequent `subscribe` / `updatePreferences` calls then trip the block
 *     above. This is intentional: the email itself is poisoned, regardless of
 *     which account currently owns the row.
 *
 * @see {@link newsletter-subscriber.permissions}
 * @see {@link newsletter-token.helpers}
 */

import { getDb } from '@repo/db';
import type { InsertNewsletterSubscriber, SelectNewsletterSubscriber } from '@repo/db';
import {
    DEFAULT_NEWSLETTER_PREFERENCES,
    NewsletterChannelEnum,
    NewsletterContentTypeEnum,
    NewsletterSourceEnum,
    NewsletterSubscriberStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type {
    NewsletterContentPreferences,
    NewsletterSubscriberAdminSearch,
    NewsletterSubscriberStatsResponse,
    NewsletterSubscribersByPreference
} from '@repo/schemas';
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
        userId: string | null;
        locale: string;
        unsubscribeToken: string;
    }): Promise<void>;
}

/** No-op dispatcher used when no dispatcher is injected. */
const NO_OP_DISPATCHER: NewsletterNotificationDispatcher = {
    sendVerification: async () => undefined,
    sendWelcome: async () => undefined
};

/**
 * Coerces a value that may be a Date, an ISO/pg timestamp string, or nullish
 * into `Date | null`. Drizzle's raw `db.execute(sql)` returns timestamptz
 * columns as strings; we normalise here so service consumers can rely on the
 * typed `Date | null` contract.
 */
const toDateOrNull = (value: string | Date | null | undefined): Date | null => {
    if (value == null) return null;
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
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

const UpdatePreferencesInputSchema = z.object({
    userId: z.string().uuid(),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL),
    /**
     * Partial map of NewsletterContentTypeEnum → boolean. Validated by the
     * route layer with `UpdateNewsletterPreferencesInputSchema`; here we only
     * accept the same enum keys to keep the SQL merge well-typed.
     */
    preferences: z
        .object({
            [NewsletterContentTypeEnum.OFFERS]: z.boolean().optional(),
            [NewsletterContentTypeEnum.EVENTS]: z.boolean().optional(),
            [NewsletterContentTypeEnum.GUIDES]: z.boolean().optional(),
            [NewsletterContentTypeEnum.PRODUCT_NEWS]: z.boolean().optional()
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0, {
            message: 'At least one preference key must be provided'
        })
});

const GetEligibleInputSchema = z.object({
    localeFilter: z.enum(['all', 'es', 'en', 'pt']),
    softCapWindowDays: z.number().int().min(1),
    /**
     * Optional content-type filter. When provided, only subscribers whose
     * `preferences[contentType]` is `true` are eligible — implemented as a
     * COALESCE-defaulted JSONB lookup so missing keys (defensive case) are
     * treated as opted-in. When omitted, no preference filter is applied
     * (legacy callers and broadcasts that don't tag a content type).
     */
    contentType: z.nativeEnum(NewsletterContentTypeEnum).optional()
});

const LinkAnonymousSubscribersInputSchema = z.object({
    userId: z.string().uuid(),
    /** Account email of the freshly signed-up user. Lowercased before lookup. */
    email: z.string().email(),
    /**
     * Whether the new user's account email is verified (Better Auth
     * `users.email_verified`). When `true`, any matched anonymous row in
     * `pending_verification` is promoted to `active` and a welcome email is
     * dispatched. When `false`, the rows are only linked — the user still
     * needs to verify their account email before the subscription becomes
     * active, mirroring the gate in `subscribe`.
     */
    accountEmailVerified: z.boolean()
});

const SubscribeGuestInputSchema = z.object({
    email: z.string().email().max(255),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL),
    locale: z.enum(['es', 'en', 'pt']).default('es'),
    source: z.nativeEnum(NewsletterSourceEnum).default(NewsletterSourceEnum.WEB_FOOTER),
    consentIp: z.string().max(45).optional(),
    consentUa: z.string().optional(),
    consentVersion: z.string().max(20).optional()
});

const ResendGuestVerificationInputSchema = z.object({
    email: z.string().email().max(255),
    channel: z.nativeEnum(NewsletterChannelEnum).default(NewsletterChannelEnum.EMAIL)
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
    /**
     * Per-content-type opt-in flags. `null` when no subscriber row exists for
     * the user/channel pair — callers default to the all-true preset in that
     * case. Populated from `newsletter_subscribers.preferences` (JSONB) and
     * passes through verbatim (no merge / coercion here).
     */
    readonly preferences: NewsletterContentPreferences | null;
}

/** Result returned by `updatePreferences`. */
export interface UpdatePreferencesResult {
    /** The full merged preferences object after the partial was applied. */
    readonly preferences: NewsletterContentPreferences;
}

/** Result returned by `getEligibleForCampaign`. */
export interface GetEligibleForCampaignResult {
    readonly eligibleIds: string[];
    readonly softCappedCount: number;
    readonly totalCandidates: number;
}

/** Result returned by `linkAnonymousSubscribersToUser`. */
export interface LinkAnonymousSubscribersResult {
    /** Total number of anonymous rows that were linked to the user. */
    readonly linkedCount: number;
    /**
     * Number of rows that ALSO transitioned `pending_verification` → `active`
     * during the link (only when `accountEmailVerified === true`). One welcome
     * email is dispatched per promoted row.
     */
    readonly promotedToActiveCount: number;
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
        userId: string | null;
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
     * Spec rules (from the consolidated newsletter functional spec):
     * - Authed user with VERIFIED account email → DIRECT to `active`, send
     *   welcome email. No double opt-in.
     * - Authed user with UNVERIFIED account email → BLOCKED with
     *   `NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED`. The UI surfaces this as
     *   "verify your account email first" — the user is bounced back to
     *   the verification flow before they can subscribe.
     * - Row with `bounced` or `complained` → BLOCKED with
     *   `NEWSLETTER_SUBSCRIBER_BLOCKED` (admin-only reset).
     *
     * State machine (only reached when `actor.emailVerified === true`):
     * - No row → INSERT `active` + `verified_at = NOW()`, send welcome.
     * - Row `active` → no-op, return `'active'`.
     * - Row `pending_verification` (e.g. seeded by a guest flow that the user
     *   later signed up to) → flip to `active`, set `verified_at`, send welcome.
     * - Row `unsubscribed` → reactivate to `active`, set `verified_at`, send welcome.
     *
     * Guest subscribe (no actor / no userId) does NOT go through this method —
     * it lives in the public-tier subscribe flow which retains the
     * `pending_verification` + double-opt-in path.
     *
     * Owner-only: actor must equal `input.userId`.
     *
     * @param actor - The authenticated actor.
     * @param input - Subscription details (email pulled from the user record by the route).
     * @param ctx - Optional service context.
     * @returns Outcome status discriminator. For authed callers always `'active'`
     *   (or an error). The `'pending_verification'` / `'already_pending'` variants
     *   are reserved for the guest path documented in the spec.
     *
     * @example
     * ```ts
     * const result = await svc.subscribe(actor, { userId: actor.id, email: actor.email, locale: 'es' });
     * // result.data.status === 'active' (or error if email unverified / blocked)
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

                // Blocked terminal states win over every other gate: an admin
                // reset is the only way out.
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

                // An already-active row is a no-op regardless of emailVerified —
                // the user is subscribed; nothing to do, no welcome email.
                if (status === NewsletterSubscriberStatusEnum.ACTIVE) {
                    return { status: 'active' };
                }

                // Authed subscribe requires a verified account email. We treat
                // `undefined` as "not verified" so legacy / partial actors fail
                // safe instead of slipping into the direct-to-active path.
                if (actor.emailVerified !== true) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Verify your account email before subscribing to the newsletter.',
                        undefined,
                        'NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED'
                    );
                }

                const now = new Date();
                const channelVal = validated.channel as 'email' | 'whatsapp';

                if (!row) {
                    // New subscription — straight to ACTIVE since the account
                    // email is verified.
                    const inserted = await db.execute(sql`
                        INSERT INTO newsletter_subscribers
                            (user_id, email, channel, status, locale, source,
                             consent_ip, consent_ua, consent_version,
                             subscribed_at, verified_at, created_at, updated_at)
                        VALUES
                            (${validated.userId}, ${validated.email}, ${validated.channel},
                             ${NewsletterSubscriberStatusEnum.ACTIVE},
                             ${validated.locale}, ${validated.source},
                             ${validated.consentIp ?? null}, ${validated.consentUa ?? null},
                             ${validated.consentVersion ?? null},
                             ${now.toISOString()}, ${now.toISOString()},
                             ${now.toISOString()}, ${now.toISOString()})
                        RETURNING id
                    `);
                    const newId = (inserted.rows[0] as { id: string }).id;
                    const unsubscribeToken = this._genUnsubscribeToken(newId, channelVal);
                    await this._sendWelcome({
                        subscriberId: newId,
                        email: validated.email,
                        userId: validated.userId,
                        locale: validated.locale,
                        unsubscribeToken
                    });
                    return { status: 'active' };
                }

                const subscriberId = row.id;

                // Pre-existing row in `pending_verification` (typically seeded by
                // the guest subscribe flow that the user later signed up to) or
                // `unsubscribed`. Flip it to active in either case.
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.ACTIVE},
                        verified_at = ${now.toISOString()},
                        unsubscribed_at = NULL,
                        subscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${subscriberId}
                `);
                const unsubscribeToken = this._genUnsubscribeToken(subscriberId, channelVal);
                await this._sendWelcome({
                    subscriberId,
                    email: row.email,
                    userId: validated.userId,
                    locale: row.locale,
                    unsubscribeToken
                });
                return { status: 'active' };
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
                    SELECT status, subscribed_at, verified_at, deleted_at, preferences
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                // Drizzle's raw `db.execute(sql)` via node-postgres returns
                // `timestamp with time zone` columns as STRINGS (raw pg format),
                // not JS Date — the schema-based type parsers only run for the
                // typed query builder. Annotate the cast accordingly and
                // normalise to Date at this boundary so the public
                // `GetStatusResult.subscribedAt: Date | null` contract holds.
                const row = rows.rows[0] as
                    | {
                          status: string;
                          subscribed_at: string | Date | null;
                          verified_at: string | Date | null;
                          deleted_at: string | Date | null;
                          preferences: NewsletterContentPreferences | null;
                      }
                    | undefined;

                if (!row) {
                    return {
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null,
                        preferences: null
                    };
                }

                const status = row.status as NewsletterSubscriberStatusEnum;
                return {
                    subscribed: status === NewsletterSubscriberStatusEnum.ACTIVE,
                    status,
                    subscribedAt: toDateOrNull(row.subscribed_at),
                    verifiedAt: toDateOrNull(row.verified_at),
                    preferences: row.preferences ?? null
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — updatePreferences
    // -------------------------------------------------------------------------

    /**
     * Merges a partial preferences payload onto the subscriber's stored
     * `preferences` JSONB. Owner-only.
     *
     * - Only keys included in `input.preferences` are updated; the others retain
     *   whatever value they already had (PostgreSQL JSONB `||` merge).
     * - Terminal states (`BOUNCED`, `COMPLAINED`) are read-only per spec: this
     *   method throws `NEWSLETTER_SUBSCRIBER_BLOCKED` and never mutates the row.
     *   The UI surfaces this as a "contact us" banner instead of toggle controls.
     * - Missing row throws `NEWSLETTER_SUBSCRIBER_NOT_FOUND` — callers create
     *   the subscription via `subscribe` first.
     *
     * @param actor - The authenticated actor (must match `userId`).
     * @param input - `{ userId, channel, preferences }`.
     * @param ctx - Optional service context.
     * @returns The full merged preferences object.
     *
     * @example
     * ```ts
     * await svc.updatePreferences(actor, {
     *   userId: actor.id,
     *   preferences: { offers: false }
     * });
     * ```
     */
    public async updatePreferences(
        actor: Actor,
        input: {
            userId: string;
            channel?: NewsletterChannelEnum;
            preferences: Partial<Record<NewsletterContentTypeEnum, boolean>>;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<UpdatePreferencesResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updatePreferences',
            input: { actor, ...input },
            schema: UpdatePreferencesInputSchema,
            ctx,
            execute: async (validated) => {
                requireSelf(actor, validated.userId);

                const db = getDb();

                // Fetch current row to gate on terminal status BEFORE mutating.
                const rows = await db.execute(sql`
                    SELECT id, status, preferences, deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE user_id = ${validated.userId}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | {
                          id: string;
                          status: string;
                          preferences: NewsletterContentPreferences | null;
                          deletedAt: string | Date | null;
                      }
                    | undefined;

                if (!row) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No newsletter subscription found for this user and channel',
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_NOT_FOUND'
                    );
                }

                const status = row.status as NewsletterSubscriberStatusEnum;
                if (
                    status === NewsletterSubscriberStatusEnum.BOUNCED ||
                    status === NewsletterSubscriberStatusEnum.COMPLAINED
                ) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Preferences cannot be updated on a blocked subscriber row',
                        undefined,
                        'NEWSLETTER_SUBSCRIBER_BLOCKED'
                    );
                }

                const partial = validated.preferences as Partial<
                    Record<NewsletterContentTypeEnum, boolean>
                >;
                const now = new Date();

                // Use JSONB `||` to merge atomically server-side. If for any
                // reason the column was NULL (pre-migration row that escaped
                // the backfill), seed from the canonical default first.
                const partialJson = JSON.stringify(partial);
                const updated = await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET preferences = COALESCE(preferences, ${JSON.stringify(DEFAULT_NEWSLETTER_PREFERENCES)}::jsonb)
                        || ${partialJson}::jsonb,
                        updated_at = ${now.toISOString()}
                    WHERE id = ${row.id}
                    RETURNING preferences
                `);

                const updatedRow = updated.rows[0] as
                    | { preferences: NewsletterContentPreferences }
                    | undefined;

                // Defensive: should never happen since the SELECT above found the row.
                const merged: NewsletterContentPreferences = updatedRow?.preferences ?? {
                    ...DEFAULT_NEWSLETTER_PREFERENCES,
                    ...(row.preferences ?? {}),
                    ...partial
                };

                return { preferences: merged };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — linkAnonymousSubscribersToUser
    // -------------------------------------------------------------------------

    /**
     * Backfills `user_id` on every anonymous subscriber row that matches the
     * freshly signed-up user's email, and (when `accountEmailVerified === true`)
     * promotes any matched row in `pending_verification` to `active` with a
     * transactional welcome email.
     *
     * Designed to be invoked from a post-signup hook so a guest who subscribed
     * via the public footer flow before creating an account is seamlessly
     * connected to their new user record — and, for OAuth providers that
     * deliver a pre-verified email, the subscription becomes active without
     * the user having to click the verification link a second time.
     *
     * Idempotent on re-runs: rows that were already linked don't match
     * `user_id IS NULL`, so a duplicate call returns `{ linkedCount: 0 }`.
     *
     * No actor parameter: this method runs under a synthetic system actor
     * because the new user does not yet "own" the anonymous rows when the
     * hook fires (the link itself transfers ownership).
     *
     * @param input - `{ userId, email, accountEmailVerified }`.
     * @param ctx - Optional service context.
     * @returns `{ linkedCount, promotedToActiveCount }`.
     *
     * @example
     * ```ts
     * await svc.linkAnonymousSubscribersToUser({
     *   userId: newUser.id,
     *   email: newUser.email,
     *   accountEmailVerified: newUser.emailVerified
     * });
     * ```
     */
    public async linkAnonymousSubscribersToUser(
        input: {
            userId: string;
            email: string;
            accountEmailVerified: boolean;
        },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<LinkAnonymousSubscribersResult>> {
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'linkAnonymousSubscribersToUser',
            input: { actor: systemActor, ...input },
            schema: LinkAnonymousSubscribersInputSchema,
            ctx,
            execute: async (validated) => {
                const db = getDb();

                // Find anonymous rows matching the email. We capture the
                // pre-update status here so we can decide which rows trigger
                // a welcome email after the atomic UPDATE.
                const lookupRows = await db.execute(sql`
                    SELECT id, status, email, channel, locale
                    FROM newsletter_subscribers
                    WHERE email = ${validated.email}
                      AND user_id IS NULL
                      AND deleted_at IS NULL
                `);
                const anonRows = lookupRows.rows as Array<{
                    id: string;
                    status: string;
                    email: string;
                    channel: string;
                    locale: string;
                }>;

                if (anonRows.length === 0) {
                    return { linkedCount: 0, promotedToActiveCount: 0 };
                }

                const now = new Date();
                const ids = anonRows.map((r) => r.id);

                // Build the UPDATE — when the account email is verified we
                // also flip `pending_verification` → `active` and stamp
                // `verified_at`. Otherwise we just link `user_id` and leave
                // the lifecycle state alone (the user can verify later and
                // re-subscribe to promote).
                if (validated.accountEmailVerified) {
                    await db.execute(sql`
                        UPDATE newsletter_subscribers
                        SET user_id = ${validated.userId},
                            status = CASE
                                WHEN status = ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION}
                                    THEN ${NewsletterSubscriberStatusEnum.ACTIVE}
                                ELSE status
                            END,
                            verified_at = CASE
                                WHEN status = ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION}
                                    THEN ${now.toISOString()}::timestamptz
                                ELSE verified_at
                            END,
                            updated_at = ${now.toISOString()}
                        WHERE id = ANY(${ids}::uuid[])
                    `);
                } else {
                    await db.execute(sql`
                        UPDATE newsletter_subscribers
                        SET user_id = ${validated.userId},
                            updated_at = ${now.toISOString()}
                        WHERE id = ANY(${ids}::uuid[])
                    `);
                }

                // Dispatch welcome emails for rows that just transitioned
                // pending_verification → active. The dispatcher swallows its
                // own errors so a mailer hiccup doesn't undo the link.
                const promotedRows = validated.accountEmailVerified
                    ? anonRows.filter(
                          (r) => r.status === NewsletterSubscriberStatusEnum.PENDING_VERIFICATION
                      )
                    : [];

                for (const row of promotedRows) {
                    const channel = row.channel as 'email' | 'whatsapp';
                    const unsubscribeToken = this._genUnsubscribeToken(row.id, channel);
                    await this._sendWelcome({
                        subscriberId: row.id,
                        email: row.email,
                        userId: validated.userId,
                        locale: row.locale,
                        unsubscribeToken
                    });
                }

                return {
                    linkedCount: anonRows.length,
                    promotedToActiveCount: promotedRows.length
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — subscribeGuest
    // -------------------------------------------------------------------------

    /**
     * Subscribes an anonymous (guest) visitor to the newsletter via the public
     * footer / standalone subscribe widget.
     *
     * Unlike `subscribe` (authed direct-to-active), the guest flow always uses
     * the double opt-in path: rows are inserted with `user_id = NULL` and
     * `status = 'pending_verification'`, and a verification email is dispatched
     * with an HMAC token the visitor clicks to flip the row to active.
     *
     * State machine (lookup is by `email + channel + deleted_at IS NULL`):
     *   - Terminal row (bounced / complained) → throw `NEWSLETTER_SUBSCRIBER_BLOCKED`.
     *   - Active row → no-op, return `'active'` (whether the row is anonymous or
     *     already linked to a user, the email IS subscribed already — privacy-safe).
     *   - Linked row in pending / unsubscribed → return `'already_pending'` WITHOUT
     *     side-effects. We don't refresh tokens or send emails to a row that
     *     belongs to a real account, otherwise the linked user could be spammed
     *     by anyone who knows their email.
     *   - Anonymous row in pending → refresh `subscribed_at`, re-issue token,
     *     send verification, return `'already_pending'`.
     *   - Anonymous row in unsubscribed → reactivate to `pending_verification`,
     *     re-issue token, send verification, return `'pending_verification'`.
     *   - No row → INSERT anonymous pending row, send verification, return
     *     `'pending_verification'`.
     *
     * @param input - Guest subscription details (email, locale, source, consent).
     * @param ctx - Optional service context.
     * @returns Status discriminator.
     */
    public async subscribeGuest(
        input: {
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
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'subscribeGuest',
            input: { actor: systemActor, ...input },
            schema: SubscribeGuestInputSchema,
            ctx,
            execute: async (validated) => {
                const db = getDb();

                const rows = await db.execute(sql`
                    SELECT id, user_id AS "userId", status, locale,
                           deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE email = ${validated.email}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | {
                          id: string;
                          userId: string | null;
                          status: string;
                          locale: string;
                          deletedAt: string | Date | null;
                      }
                    | undefined;

                const status = row?.status as NewsletterSubscriberStatusEnum | undefined;
                const channelVal = validated.channel as 'email' | 'whatsapp';

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

                if (status === NewsletterSubscriberStatusEnum.ACTIVE) {
                    return { status: 'active' };
                }

                // Privacy guard: never side-effect on a row that already belongs
                // to a signed-up user. We don't even reveal the difference between
                // pending / unsubscribed here — both report 'already_pending'.
                if (row && row.userId != null) {
                    return { status: 'already_pending' };
                }

                const now = new Date();

                if (!row) {
                    // New anonymous pending row.
                    const inserted = await db.execute(sql`
                        INSERT INTO newsletter_subscribers
                            (user_id, email, channel, status, locale, source,
                             consent_ip, consent_ua, consent_version,
                             subscribed_at, created_at, updated_at)
                        VALUES
                            (NULL, ${validated.email}, ${validated.channel},
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
                        // No user yet — pass '' so the dispatcher can branch on
                        // anonymous templates without dereferencing undefined.
                        userId: '',
                        locale: validated.locale,
                        token
                    });
                    return { status: 'pending_verification' };
                }

                // Anonymous row in pending or unsubscribed.
                if (status === NewsletterSubscriberStatusEnum.PENDING_VERIFICATION) {
                    await db.execute(sql`
                        UPDATE newsletter_subscribers
                        SET subscribed_at = ${now.toISOString()},
                            updated_at = ${now.toISOString()}
                        WHERE id = ${row.id}
                    `);
                    const token = this._genVerificationToken(row.id, channelVal);
                    await this._sendVerification({
                        subscriberId: row.id,
                        email: validated.email,
                        userId: '',
                        locale: row.locale,
                        token
                    });
                    return { status: 'already_pending' };
                }

                // status === UNSUBSCRIBED → reactivate to pending_verification.
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET status = ${NewsletterSubscriberStatusEnum.PENDING_VERIFICATION},
                        unsubscribed_at = NULL,
                        subscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${row.id}
                `);
                const token = this._genVerificationToken(row.id, channelVal);
                await this._sendVerification({
                    subscriberId: row.id,
                    email: validated.email,
                    userId: '',
                    locale: row.locale,
                    token
                });
                return { status: 'pending_verification' };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API — resendGuestVerification
    // -------------------------------------------------------------------------

    /**
     * Re-sends the double opt-in verification email for an ANONYMOUS subscriber
     * matched by email. Used by the public "didn't receive the email?" button
     * on `/{locale}/newsletter/confirma-tu-email`.
     *
     * Behavior (anti-enumeration):
     *   - The method ALWAYS returns `{ sent: true }` regardless of whether a
     *     matching row exists. This prevents the endpoint from being used as
     *     an oracle to probe which emails have a pending subscription.
     *   - A verification email is dispatched only when an anonymous row in
     *     `pending_verification` exists for the email. Other states (active,
     *     unsubscribed, bounced, complained) and linked rows (user_id IS NOT
     *     NULL) are silently no-ops on the email side.
     *
     * Rate limiting is the route's responsibility — the spec asks for
     * 1 req/minute per IP on the public surface.
     */
    public async resendGuestVerification(
        input: { email: string; channel?: NewsletterChannelEnum },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ sent: true }>> {
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000001',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never
        };
        return this.runWithLoggingAndValidation({
            methodName: 'resendGuestVerification',
            input: { actor: systemActor, ...input },
            schema: ResendGuestVerificationInputSchema,
            ctx,
            execute: async (validated) => {
                const db = getDb();

                const rows = await db.execute(sql`
                    SELECT id, user_id AS "userId", status, locale, deleted_at AS "deletedAt"
                    FROM newsletter_subscribers
                    WHERE email = ${validated.email}
                      AND channel = ${validated.channel}
                      AND deleted_at IS NULL
                    LIMIT 1
                `);
                const row = rows.rows[0] as
                    | {
                          id: string;
                          userId: string | null;
                          status: string;
                          locale: string;
                          deletedAt: string | Date | null;
                      }
                    | undefined;

                // Anti-enumeration: any non-matching branch returns success
                // without an email side-effect.
                if (!row) {
                    return { sent: true as const };
                }
                if (row.userId != null) {
                    // Linked row → guest path can't re-send to it.
                    return { sent: true as const };
                }
                if (row.status !== NewsletterSubscriberStatusEnum.PENDING_VERIFICATION) {
                    return { sent: true as const };
                }

                const now = new Date();
                await db.execute(sql`
                    UPDATE newsletter_subscribers
                    SET subscribed_at = ${now.toISOString()},
                        updated_at = ${now.toISOString()}
                    WHERE id = ${row.id}
                `);
                const channelVal = validated.channel as 'email' | 'whatsapp';
                const token = this._genVerificationToken(row.id, channelVal);
                await this._sendVerification({
                    subscriberId: row.id,
                    email: validated.email,
                    userId: '',
                    locale: row.locale,
                    token
                });

                return { sent: true as const };
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
     * (optionally) `preferences[contentType] = true`, AND no delivery row with
     * `delivered_at >= now() - softCapWindowDays days`.
     *
     * The soft-cap exclusion is expressed as a single SQL `NOT EXISTS` subquery
     * to avoid fetching all rows and filtering in JS (scales to 50k+ subscribers).
     *
     * The `contentType` filter uses
     * `COALESCE((ns.preferences->>contentType)::boolean, TRUE)` so a row whose
     * preferences JSONB is missing the key (only possible if the 0026 backfill
     * was skipped) is treated as opted-in — the column default is all-true and
     * we don't want a stale row to silently mute deliveries.
     *
     * @param input - Locale filter, soft-cap window, optional contentType filter.
     * @param ctx - Optional service context.
     * @returns Eligible IDs, soft-capped count, and total candidates.
     *
     * @example
     * ```ts
     * const result = await svc.getEligibleForCampaign({
     *   localeFilter: 'es',
     *   softCapWindowDays: 7,
     *   contentType: NewsletterContentTypeEnum.OFFERS
     * });
     * ```
     */
    public async getEligibleForCampaign(
        input: {
            localeFilter: 'all' | 'es' | 'en' | 'pt';
            softCapWindowDays: number;
            contentType?: NewsletterContentTypeEnum;
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

                // Build content-type condition: opt-in when the key is true OR
                // when it's missing entirely (defensive default — matches the
                // column-level default of all-true).
                const contentTypeCondition = validated.contentType
                    ? sql`COALESCE((ns.preferences->>${validated.contentType})::boolean, TRUE) = TRUE`
                    : sql`TRUE`;

                // Total candidates (active, non-deleted, locale matches, content matches)
                const totalResult = await db.execute(sql`
                    SELECT COUNT(*)::int AS total
                    FROM newsletter_subscribers ns
                    WHERE ns.status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                      AND ns.deleted_at IS NULL
                      AND ${localeCondition}
                      AND ${contentTypeCondition}
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
                      AND ${contentTypeCondition}
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

    // -------------------------------------------------------------------------
    // Public API — getStatsByPreference
    // -------------------------------------------------------------------------

    /**
     * Returns per-content-preference opt-in counts for ACTIVE subscribers (admin only).
     *
     * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission.
     *
     * A subscriber is counted for a preference when their `preferences` JSONB
     * field contains `{ "<key>": true }` AND their `status` is `active` AND
     * `deleted_at IS NULL`.
     *
     * The JSONB keys are camelCase (`offers`, `events`, `guides`, `productNews`)
     * matching `NewsletterContentTypeEnum` values. The response uses UPPER_SNAKE
     * keys (`OFFERS`, `EVENTS`, `GUIDES`, `PRODUCT_NEWS`) matching the enum
     * member names so the client can reference them without a mapping table.
     *
     * A single SQL query with four `COUNT(*) FILTER` clauses avoids multiple
     * round-trips; the JSONB boolean cast `(preferences->>'<key>')::boolean`
     * handles `null` as falsy (PostgreSQL returns NULL for missing keys, which
     * the `= true` comparison treats as false — no subscribers are
     * over-counted).
     *
     * @param actor - The admin actor requesting the stats.
     * @param ctx - Optional service context (e.g. for test transaction isolation).
     * @returns Counts per content preference, keyed by UPPER_SNAKE enum name.
     *
     * @example
     * ```ts
     * const result = await svc.getStatsByPreference(actor);
     * if (!result.error) {
     *   console.log(result.data.OFFERS); // e.g. 980
     * }
     * ```
     */
    public async getStatsByPreference(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<NewsletterSubscribersByPreference>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStatsByPreference',
            input: { actor },
            schema: z.object({ actor: z.unknown() }),
            ctx,
            execute: async () => {
                checkCanViewSubscribers(actor);

                const db = getDb();

                // Each FILTER clause inspects the JSONB column using the
                // camelCase key names stored in the database.
                // (preferences->>'offers')::boolean = true  is safe:
                //   - missing key  → NULL  → comparison is false (not counted)
                //   - stored false → false → not counted
                //   - stored true  → true  → counted
                const result = await db.execute<{
                    offers: number;
                    events: number;
                    guides: number;
                    productNews: number;
                }>(sql`
                    SELECT
                        COUNT(*) FILTER (
                            WHERE status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                              AND deleted_at IS NULL
                              AND (preferences->>'offers')::boolean = true
                        )::int AS "offers",
                        COUNT(*) FILTER (
                            WHERE status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                              AND deleted_at IS NULL
                              AND (preferences->>'events')::boolean = true
                        )::int AS "events",
                        COUNT(*) FILTER (
                            WHERE status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                              AND deleted_at IS NULL
                              AND (preferences->>'guides')::boolean = true
                        )::int AS "guides",
                        COUNT(*) FILTER (
                            WHERE status = ${NewsletterSubscriberStatusEnum.ACTIVE}
                              AND deleted_at IS NULL
                              AND (preferences->>'productNews')::boolean = true
                        )::int AS "productNews"
                    FROM newsletter_subscribers
                `);

                const row = result.rows[0];

                return {
                    OFFERS: row?.offers ?? 0,
                    EVENTS: row?.events ?? 0,
                    GUIDES: row?.guides ?? 0,
                    PRODUCT_NEWS: row?.productNews ?? 0
                };
            }
        });
    }
}
