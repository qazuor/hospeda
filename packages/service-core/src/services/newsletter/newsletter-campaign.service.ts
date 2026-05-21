/**
 * @module newsletter-campaign.service
 *
 * NewsletterCampaignService — orchestrates the campaign lifecycle for the
 * newsletter feature (SPEC-101).
 *
 * Responsibilities:
 * - Create / update / soft-delete DRAFT campaigns
 * - Dispatch (`send`): resolve eligible subscribers, bulk-insert delivery rows,
 *   update campaign to `sending`, then enqueue BullMQ batches AFTER the
 *   transaction commits (per tech-analysis §4.2 rule 7)
 * - Test-send: fire a single preview email via the delivery service without
 *   touching the deliveries table or changing campaign status
 * - Cancel: flip campaign to `cancelled` and bulk-skip pending deliveries
 * - Metrics aggregation: count delivered/opened/clicked/failed/pending
 * - Failed-delivery pagination: paginated list for the admin UI
 * - Campaign closure: cron-driven (T-101-47) — closes campaigns whose every
 *   delivery has reached a terminal state
 *
 * DEPENDENCY INJECTION DESIGN:
 *   `NewsletterDeliveryService` (T-101-16) does NOT exist yet. This service
 *   depends on the `INewsletterDeliveryService` interface declared below.
 *   The host app (`apps/api`) will inject a concrete implementation that
 *   `implements INewsletterDeliveryService`. Tests inject a mock.
 *
 * @see {@link newsletter-campaign.permissions}
 * @see {@link NewsletterSubscriberService}
 */

import { getDb } from '@repo/db';
import type { InsertNewsletterCampaignDelivery, SelectNewsletterCampaign } from '@repo/db';
import { newsletterCampaignDeliveries, newsletterCampaigns } from '@repo/db';
import {
    NewsletterCampaignStatusEnum,
    NewsletterContentTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { CreateNewsletterCampaign, UpdateNewsletterCampaign } from '@repo/schemas';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { withServiceTransaction } from '../../utils/transaction.js';
import {
    checkCanSendCampaign,
    checkCanViewCampaign,
    checkCanWriteCampaign
} from './newsletter-campaign.permissions.js';
import type { GetEligibleForCampaignResult } from './newsletter-subscriber.service.js';
import { NewsletterSubscriberService } from './newsletter-subscriber.service.js';

// ---------------------------------------------------------------------------
// INewsletterDeliveryService — dependency injection contract
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the delivery service consumed by `NewsletterCampaignService`.
 *
 * `NewsletterDeliveryService` (T-101-16) will implement this interface.
 * This allows `NewsletterCampaignService` to be fully testable without the
 * concrete delivery implementation.
 *
 * Methods:
 * - `enqueueBatches` — groups delivery IDs into BullMQ batches and enqueues them.
 *   Called AFTER the `send()` transaction commits (never inside the transaction).
 * - `bulkSkipPending` — bulk-updates all pending deliveries for a campaign to
 *   `status='skipped'`. Called inside `cancel()` after the campaign row is updated.
 * - `sendTestEmail` — fires a single transactional preview email to one address.
 *   Does NOT create delivery rows. Used by `testSend()`.
 */
export interface INewsletterDeliveryService {
    /**
     * Groups delivery IDs into batches of `batchSize` and enqueues each batch
     * as a BullMQ job on the `hospeda-newsletter-dispatch` queue.
     *
     * @param input.deliveryIds - IDs of the freshly-inserted pending delivery rows.
     * @param input.batchSize - Number of deliveries per BullMQ job (default 100).
     * @returns Number of jobs enqueued.
     */
    enqueueBatches(input: {
        campaignId: string;
        deliveryIds: string[];
        batchSize: number;
    }): Promise<ServiceOutput<{ jobsEnqueued: number }>>;

    /**
     * Bulk-updates all pending deliveries for a campaign to `status='skipped'`.
     * Called during `cancel()` to prevent workers from dispatching cancelled content.
     *
     * @param input.campaignId - The campaign whose pending deliveries are skipped.
     * @returns Number of rows updated.
     */
    bulkSkipPending(input: { campaignId: string }): Promise<ServiceOutput<number>>;

    /**
     * Sends a single preview email to `toEmail` using the campaign's subject
     * and body. Does NOT create delivery rows or change campaign status.
     *
     * @param input.campaignId - Campaign to preview.
     * @param input.toEmail - Recipient email address (the actor's email or an override).
     * @returns The address the email was sent to.
     */
    sendTestEmail(input: {
        campaignId: string;
        toEmail: string;
    }): Promise<ServiceOutput<{ sentTo: string }>>;
}

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const CreateCampaignInputSchema = z.object({
    title: z.string().min(1).max(120),
    subject: z.string().min(1).max(120),
    bodyJson: z.object({ type: z.literal('doc') }).passthrough(),
    localeFilter: z.enum(['all', 'es', 'en', 'pt']).default('all'),
    // `null` means "no segmentation"; same as undefined. The column is nullable
    // so we accept both shapes from the route layer.
    contentType: z.nativeEnum(NewsletterContentTypeEnum).nullable().optional(),
    createdBy: z.string().uuid()
});

const UpdateCampaignInputSchema = z.object({
    id: z.string().uuid(),
    data: z
        .object({
            title: z.string().min(1).max(120).optional(),
            subject: z.string().min(1).max(120).optional(),
            bodyJson: z
                .object({ type: z.literal('doc') })
                .passthrough()
                .optional(),
            localeFilter: z.enum(['all', 'es', 'en', 'pt']).optional(),
            contentType: z.nativeEnum(NewsletterContentTypeEnum).nullable().optional()
        })
        .strict()
});

const SoftDeleteInputSchema = z.object({
    id: z.string().uuid()
});

const SendInputSchema = z.object({
    id: z.string().uuid(),
    ignoreSoftCap: z.boolean().default(false)
});

const TestSendInputSchema = z.object({
    id: z.string().uuid(),
    toEmail: z.string().email()
});

const CancelInputSchema = z.object({
    id: z.string().uuid()
});

const ComputeMetricsInputSchema = z.object({
    id: z.string().uuid()
});

const GetFailedDeliveriesInputSchema = z.object({
    id: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(200).default(50)
});

const CloseSentCampaignsInputSchema = z.object({});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Result returned by `send()`. */
export interface SendCampaignResult {
    /** Number of delivery rows inserted and BullMQ jobs enqueued. */
    readonly enqueued: number;
    /** Number of subscribers excluded by the rolling soft-cap window. */
    readonly softcapped: number;
}

/** Result returned by `cancel()`. */
export interface CancelCampaignResult {
    /** Number of pending delivery rows flipped to `skipped`. */
    readonly skipped: number;
}

/** Aggregated campaign metrics. */
export interface CampaignMetrics {
    readonly campaignId: string;
    readonly totalRecipients: number;
    readonly totalSoftcapped: number;
    readonly pending: number;
    readonly delivered: number;
    readonly failed: number;
    readonly skipped: number;
    readonly opened: number;
    readonly clicked: number;
}

/** A single failed delivery row (for the admin UI). */
export interface FailedDelivery {
    readonly id: string;
    readonly subscriberId: string;
    readonly channel: string;
    readonly errorMessage: string | null;
    readonly retryCount: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/** Paginated failed deliveries result. */
export interface FailedDeliveriesResult {
    readonly items: readonly FailedDelivery[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Constructor options for `NewsletterCampaignService`.
 */
export interface NewsletterCampaignServiceOptions {
    /** Logger from the parent context. */
    logger?: ServiceConfig['logger'];
    /**
     * Batch size for BullMQ job grouping (default 100).
     * Maps to the `HOSPEDA_NEWSLETTER_BATCH_SIZE` env var in the host app.
     */
    batchSize?: number;
    /**
     * Soft-cap rolling window in days (default 7).
     * Maps to `HOSPEDA_NEWSLETTER_SOFTCAP_DAYS` env var in the host app.
     */
    softCapDays?: number;
    /**
     * Delivery service implementation (injected at construction).
     *
     * T-101-16 provides the concrete class. Tests inject a mock.
     * When not provided, `send()` and `cancel()` will throw
     * `SERVICE_UNAVAILABLE` — a safety guard to catch misconfigured apps.
     */
    deliveryService?: INewsletterDeliveryService;
    /**
     * Subscriber service used by `send()` to resolve eligible subscribers.
     * When not provided, falls back to a new instance with the default
     * `hmacSecret='__missing__'` (safe for read-only `getEligibleForCampaign`).
     */
    subscriberService?: NewsletterSubscriberService;
    /**
     * Optional callback invoked by `closeSentCampaigns` for each campaign
     * that transitioned to `sent` with at least one failed delivery
     * (SPEC-108 T-108-02). The host app wires this to
     * `NotificationService.send({ type: ADMIN_SYSTEM_EVENT, ... })`; tests
     * inject a `vi.fn()`. Service-core stays decoupled from
     * `@repo/notifications`.
     *
     * The callback is fire-and-forget from the service's point of view —
     * `closeSentCampaigns` awaits it but catches errors so a notification
     * failure does not roll back the campaign transition.
     */
    notifyCampaignClosedWithFailuresFn?: NotifyCampaignClosedWithFailuresFn;
}

/**
 * DI seam: invoked once per campaign that closes with `failed > 0`. The
 * host app fires the actual admin notification (see SPEC-108 T-108-02).
 */
export type NotifyCampaignClosedWithFailuresFn = (event: {
    campaignId: string;
    subject: string;
    totalRecipients: number;
    delivered: number;
    failed: number;
    closedAt: Date;
}) => Promise<void> | void;

/**
 * NewsletterCampaignService orchestrates the campaign lifecycle for the
 * newsletter feature (SPEC-101).
 *
 * All public methods return `ServiceOutput<T>` and are wrapped by
 * `runWithLoggingAndValidation` for consistent logging, input validation,
 * and error normalisation.
 *
 * DESIGN: `NewsletterDeliveryService` (T-101-16) is injected via
 * `INewsletterDeliveryService` so this class is testable without a real
 * BullMQ / Redis connection.
 *
 * @example
 * ```ts
 * const campaignSvc = new NewsletterCampaignService(
 *   { logger },
 *   {
 *     batchSize: 100,
 *     softCapDays: 7,
 *     deliveryService: myDeliveryService,
 *     subscriberService: mySubscriberService,
 *   }
 * );
 *
 * const result = await campaignSvc.send(actor, { id: campaignId });
 * if (result.data) {
 *   console.log(`Enqueued ${result.data.enqueued} deliveries`);
 * }
 * ```
 */
export class NewsletterCampaignService extends BaseService {
    static readonly ENTITY_NAME = 'newsletterCampaign';

    protected override readonly entityName = NewsletterCampaignService.ENTITY_NAME;

    private readonly batchSize: number;
    private readonly softCapDays: number;
    private readonly deliveryService: INewsletterDeliveryService | undefined;
    private readonly subscriberService: NewsletterSubscriberService;
    private readonly notifyCampaignClosedWithFailuresFn:
        | NotifyCampaignClosedWithFailuresFn
        | undefined;

    /**
     * Creates a new NewsletterCampaignService.
     *
     * @param config - Base service configuration (logger).
     * @param options - Feature-specific options (batchSize, softCapDays, DI services).
     */
    constructor(config: ServiceConfig, options: NewsletterCampaignServiceOptions = {}) {
        super(config, NewsletterCampaignService.ENTITY_NAME);
        this.batchSize = options.batchSize ?? 100;
        this.softCapDays = options.softCapDays ?? 7;
        this.deliveryService = options.deliveryService;
        this.subscriberService =
            options.subscriberService ??
            new NewsletterSubscriberService(config, { hmacSecret: '__missing__' });
        this.notifyCampaignClosedWithFailuresFn = options.notifyCampaignClosedWithFailuresFn;
    }

    // -------------------------------------------------------------------------
    // requireDeliveryService — guard helper
    // -------------------------------------------------------------------------

    /**
     * Returns the delivery service or throws SERVICE_UNAVAILABLE if not configured.
     *
     * @throws {ServiceError} SERVICE_UNAVAILABLE when deliveryService was not injected.
     */
    private requireDeliveryService(): INewsletterDeliveryService {
        if (!this.deliveryService) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'NewsletterDeliveryService is not configured. Inject it via NewsletterCampaignServiceOptions.deliveryService.',
                undefined,
                'DELIVERY_SERVICE_NOT_CONFIGURED'
            );
        }
        return this.deliveryService;
    }

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    /**
     * Creates a new newsletter campaign in DRAFT status.
     *
     * Requires `NEWSLETTER_CAMPAIGN_WRITE` permission.
     *
     * @param actor - The admin actor.
     * @param input - Campaign fields: title, subject, bodyJson, localeFilter, createdBy.
     * @param ctx - Optional service context (for transaction composition).
     * @returns The newly created campaign row.
     *
     * @example
     * ```ts
     * const result = await svc.create(actor, {
     *   title: 'Mayo 2025',
     *   subject: 'Novedades — mayo',
     *   bodyJson: { type: 'doc', content: [] },
     *   localeFilter: 'es',
     *   createdBy: actor.id,
     * });
     * ```
     */
    public async create(
        actor: Actor,
        input: CreateNewsletterCampaign & { createdBy: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectNewsletterCampaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'create',
            input: { actor, ...input },
            schema: CreateCampaignInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanWriteCampaign(actor);

                const db = getDb();
                const client = ctx?.tx ?? db;

                const [created] = await client
                    .insert(newsletterCampaigns)
                    .values({
                        title: validated.title,
                        subject: validated.subject,
                        bodyJson: validated.bodyJson,
                        localeFilter: validated.localeFilter as 'all' | 'es' | 'en' | 'pt',
                        // `null` and `undefined` collapse to NULL in the column;
                        // the dispatcher treats NULL as "no segmentation".
                        contentType: validated.contentType ?? null,
                        status: NewsletterCampaignStatusEnum.DRAFT,
                        createdBy: validated.createdBy
                    })
                    .returning();

                if (!created) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Campaign INSERT did not return a row',
                        undefined,
                        'CAMPAIGN_INSERT_NO_ROW'
                    );
                }

                return created;
            }
        });
    }

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    /**
     * Partially updates a DRAFT campaign.
     *
     * Only campaigns with `status='draft'` may be updated. Any other status
     * results in `ALREADY_EXISTS` with reason `CAMPAIGN_NOT_DRAFT`.
     *
     * Requires `NEWSLETTER_CAMPAIGN_WRITE` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign and the partial `data` to apply.
     * @param ctx - Optional service context.
     * @returns The updated campaign row.
     *
     * @example
     * ```ts
     * const result = await svc.update(actor, {
     *   id: campaignId,
     *   data: { subject: 'Novedades (corregido)' },
     * });
     * ```
     */
    public async update(
        actor: Actor,
        input: { id: string; data: UpdateNewsletterCampaign },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<SelectNewsletterCampaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'update',
            input: { actor, ...input },
            schema: UpdateCampaignInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanWriteCampaign(actor);

                const db = getDb();
                const client = ctx?.tx ?? db;

                const existing = await client
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = existing[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                if (campaign.status !== NewsletterCampaignStatusEnum.DRAFT) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Only DRAFT campaigns may be updated. Current status: ${campaign.status}`,
                        { id: validated.id, status: campaign.status },
                        'CAMPAIGN_NOT_DRAFT'
                    );
                }

                const [updated] = await client
                    .update(newsletterCampaigns)
                    .set({
                        ...validated.data,
                        updatedAt: new Date()
                    })
                    .where(eq(newsletterCampaigns.id, validated.id))
                    .returning();

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Campaign UPDATE did not return a row',
                        undefined,
                        'CAMPAIGN_UPDATE_NO_ROW'
                    );
                }

                return updated;
            }
        });
    }

    // -------------------------------------------------------------------------
    // softDelete
    // -------------------------------------------------------------------------

    /**
     * Soft-deletes a campaign by setting `deletedAt=now()`.
     *
     * Only DRAFT campaigns may be deleted. Attempting to delete a campaign
     * in any other state results in `ALREADY_EXISTS` with reason `CAMPAIGN_NOT_DRAFT`.
     *
     * Requires `NEWSLETTER_CAMPAIGN_WRITE` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign to delete.
     * @param ctx - Optional service context.
     * @returns void on success.
     *
     * @example
     * ```ts
     * await svc.softDelete(actor, { id: campaignId });
     * ```
     */
    public async softDelete(
        actor: Actor,
        input: { id: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'softDelete',
            input: { actor, ...input },
            schema: SoftDeleteInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanWriteCampaign(actor);

                const db = getDb();
                const client = ctx?.tx ?? db;

                const existing = await client
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = existing[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                if (campaign.status !== NewsletterCampaignStatusEnum.DRAFT) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Only DRAFT campaigns may be deleted. Current status: ${campaign.status}`,
                        { id: validated.id, status: campaign.status },
                        'CAMPAIGN_NOT_DRAFT'
                    );
                }

                await client
                    .update(newsletterCampaigns)
                    .set({ deletedAt: new Date(), updatedAt: new Date() })
                    .where(eq(newsletterCampaigns.id, validated.id));
            }
        });
    }

    // -------------------------------------------------------------------------
    // send
    // -------------------------------------------------------------------------

    /**
     * Dispatches a campaign to all eligible subscribers.
     *
     * **7-step flow (per tech-analysis §4.2):**
     * 1. Assert `campaign.status === 'draft'` — throws `ALREADY_EXISTS` / reason
     *    `CAMPAIGN_NOT_SENDABLE` if not.
     * 2. Call `NewsletterSubscriberService.getEligibleForCampaign()` to resolve
     *    active subscribers matching the locale filter (soft-cap applied unless
     *    `ignoreSoftCap=true`).
     * 3. If 0 eligible subscribers — return `{ enqueued: 0, softcapped }` without
     *    touching the campaign row (status stays DRAFT).
     * 4. BULK INSERT delivery rows (one per eligible subscriber) via a single
     *    `onConflictDoNothing()` round-trip.
     * 5. UPDATE campaign: `status='sending'`, `sentAt=now()`,
     *    `totalRecipients=N`, `totalSoftcapped=softcappedCount`.
     * 6. Steps 4 and 5 execute inside `withServiceTransaction()`.
     * 7. AFTER the transaction commits, call
     *    `NewsletterDeliveryService.enqueueBatches({ deliveryIds, batchSize })`.
     *    BullMQ enqueue is intentionally outside the transaction boundary because
     *    external I/O (Redis) must not be rolled back if a later DB error occurs
     *    in the same transaction scope.
     *
     * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign; `ignoreSoftCap` bypasses rolling-window exclusion.
     * @param ctx - Optional service context. NOTE: not passed into the inner
     *   `withServiceTransaction` — `send` always creates its own transaction boundary.
     * @returns `{ enqueued, softcapped }` counts.
     *
     * @example
     * ```ts
     * const result = await svc.send(actor, { id: campaignId });
     * // { data: { enqueued: 1500, softcapped: 32 } }
     * ```
     */
    public async send(
        actor: Actor,
        input: { id: string; ignoreSoftCap?: boolean },
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<SendCampaignResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'send',
            input: { actor, ...input },
            schema: SendInputSchema,
            execute: async (validated) => {
                checkCanSendCampaign(actor);

                const deliverySvc = this.requireDeliveryService();

                // Step 1 — Load and assert DRAFT status
                const db = getDb();
                const existing = await db
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = existing[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                if (campaign.status !== NewsletterCampaignStatusEnum.DRAFT) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Campaign is not sendable. Current status: ${campaign.status}`,
                        { id: validated.id, status: campaign.status },
                        'CAMPAIGN_NOT_SENDABLE'
                    );
                }

                // Step 2 — Resolve eligible subscribers
                const softCapDays = validated.ignoreSoftCap ? 0 : this.softCapDays;
                const eligibleResult = await this.subscriberService.getEligibleForCampaign({
                    localeFilter: campaign.localeFilter as 'all' | 'es' | 'en' | 'pt',
                    softCapWindowDays: softCapDays === 0 ? 99999 : softCapDays,
                    // NULL contentType collapses to undefined → no preferences
                    // filter applied; non-NULL gates the audience by
                    // `preferences[contentType] = true` (with a defensive
                    // COALESCE-to-TRUE inside the SQL for rows missing the key).
                    contentType:
                        (campaign.contentType as NewsletterContentTypeEnum | null) ?? undefined
                });

                if (eligibleResult.error) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to resolve eligible subscribers: ${eligibleResult.error.message}`,
                        eligibleResult.error,
                        'ELIGIBLE_FETCH_FAILED'
                    );
                }

                const { eligibleIds, softCappedCount } =
                    eligibleResult.data as GetEligibleForCampaignResult;

                // Step 3 — No eligible subscribers → early return without status change
                if (eligibleIds.length === 0) {
                    return { enqueued: 0, softcapped: softCappedCount };
                }

                // Steps 4 + 5 inside a single transaction
                let insertedDeliveryIds: string[] = [];

                await withServiceTransaction(async (txCtx) => {
                    // Step 4 — Bulk INSERT delivery rows
                    const deliveryRows: InsertNewsletterCampaignDelivery[] = eligibleIds.map(
                        (subscriberId) => ({
                            campaignId: validated.id,
                            subscriberId,
                            channel: 'email',
                            status: 'pending' as const
                        })
                    );

                    // biome-ignore lint/style/noNonNullAssertion: txCtx.tx is always defined inside withServiceTransaction
                    const tx = txCtx.tx!;

                    const inserted = await tx
                        .insert(newsletterCampaignDeliveries)
                        .values(deliveryRows)
                        .onConflictDoNothing()
                        .returning({ id: newsletterCampaignDeliveries.id });

                    insertedDeliveryIds = inserted.map((r) => r.id);

                    // Step 5 — Update campaign status
                    await tx
                        .update(newsletterCampaigns)
                        .set({
                            status: NewsletterCampaignStatusEnum.SENDING,
                            sentAt: new Date(),
                            totalRecipients: insertedDeliveryIds.length,
                            totalSoftcapped: softCappedCount,
                            updatedAt: new Date()
                        })
                        .where(eq(newsletterCampaigns.id, validated.id));
                });

                // Step 7 — Enqueue BullMQ batches AFTER transaction commits
                const enqueueResult = await deliverySvc.enqueueBatches({
                    campaignId: validated.id,
                    deliveryIds: insertedDeliveryIds,
                    batchSize: this.batchSize
                });

                if (enqueueResult.error) {
                    // Deliveries are inserted and campaign is SENDING — log but don't fail.
                    // The cron will eventually pick up un-enqueued pending deliveries.
                    this.logger.warn(
                        `[newsletterCampaign.send] enqueueBatches failed for campaign ${validated.id}: ${enqueueResult.error.message}`
                    );
                }

                return {
                    enqueued: insertedDeliveryIds.length,
                    softcapped: softCappedCount
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // testSend
    // -------------------------------------------------------------------------

    /**
     * Sends a single preview email to one address without touching deliveries
     * or changing campaign status.
     *
     * Intended for admin pre-flight checks before committing to a full dispatch.
     * The delivery service handles rendering and email transport.
     *
     * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign; `toEmail` address to send the preview to.
     * @param ctx - Optional service context.
     * @returns The address the preview was sent to.
     *
     * @example
     * ```ts
     * const result = await svc.testSend(actor, {
     *   id: campaignId,
     *   toEmail: 'admin@hospeda.com.ar',
     * });
     * // { data: { sentTo: 'admin@hospeda.com.ar' } }
     * ```
     */
    public async testSend(
        actor: Actor,
        input: { id: string; toEmail: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ sentTo: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'testSend',
            input: { actor, ...input },
            schema: TestSendInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanSendCampaign(actor);

                const deliverySvc = this.requireDeliveryService();

                // Verify campaign exists and is accessible
                const db = getDb();
                const existing = await db
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                if (!existing[0]) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                const testResult = await deliverySvc.sendTestEmail({
                    campaignId: validated.id,
                    toEmail: validated.toEmail
                });

                if (testResult.error) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Test send failed: ${testResult.error.message}`,
                        testResult.error,
                        'TEST_SEND_FAILED'
                    );
                }

                return { sentTo: testResult.data.sentTo };
            }
        });
    }

    // -------------------------------------------------------------------------
    // cancel
    // -------------------------------------------------------------------------

    /**
     * Cancels a `sending` or `scheduled` campaign.
     *
     * Sets campaign status to `cancelled`, then calls
     * `NewsletterDeliveryService.bulkSkipPending()` to flip all pending
     * delivery rows to `skipped`. Workers that have already picked up batches
     * will process them (accepted edge case per AC-101-12.2 in tech-analysis §8.7).
     *
     * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign to cancel.
     * @param ctx - Optional service context.
     * @returns Number of delivery rows flipped to `skipped`.
     *
     * @example
     * ```ts
     * const result = await svc.cancel(actor, { id: campaignId });
     * // { data: { skipped: 1500 } }
     * ```
     */
    public async cancel(
        actor: Actor,
        input: { id: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CancelCampaignResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor, ...input },
            schema: CancelInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanSendCampaign(actor);

                const deliverySvc = this.requireDeliveryService();
                const db = getDb();
                const client = ctx?.tx ?? db;

                const existing = await client
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = existing[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                const cancellableStatuses: string[] = [
                    NewsletterCampaignStatusEnum.SENDING,
                    'scheduled' // reserved for V2
                ];

                if (!cancellableStatuses.includes(campaign.status)) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `Campaign cannot be cancelled. Current status: ${campaign.status}`,
                        { id: validated.id, status: campaign.status },
                        'CAMPAIGN_NOT_CANCELLABLE'
                    );
                }

                // Update campaign status
                await client
                    .update(newsletterCampaigns)
                    .set({
                        status: NewsletterCampaignStatusEnum.CANCELLED,
                        updatedAt: new Date()
                    })
                    .where(eq(newsletterCampaigns.id, validated.id));

                // Bulk skip pending deliveries
                const skipResult = await deliverySvc.bulkSkipPending({
                    campaignId: validated.id
                });

                if (skipResult.error) {
                    this.logger.warn(
                        `[newsletterCampaign.cancel] bulkSkipPending failed for campaign ${validated.id}: ${skipResult.error.message}`
                    );
                }

                const skipped = skipResult.data ?? 0;

                return { skipped };
            }
        });
    }

    // -------------------------------------------------------------------------
    // computeMetrics
    // -------------------------------------------------------------------------

    /**
     * Aggregates delivery metrics for a campaign.
     *
     * Queries the `newsletter_campaign_deliveries` table grouped by status and
     * counts `opened_at IS NOT NULL` and `first_click_at IS NOT NULL` for
     * open and click rates.
     *
     * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign.
     * @param ctx - Optional service context.
     * @returns Aggregated metrics for the campaign.
     *
     * @example
     * ```ts
     * const result = await svc.computeMetrics(actor, { id: campaignId });
     * // { data: { pending: 0, delivered: 1450, failed: 12, ... } }
     * ```
     */
    public async computeMetrics(
        actor: Actor,
        input: { id: string },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CampaignMetrics>> {
        return this.runWithLoggingAndValidation({
            methodName: 'computeMetrics',
            input: { actor, ...input },
            schema: ComputeMetricsInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewCampaign(actor);

                const db = getDb();
                const client = ctx?.tx ?? db;

                // Load campaign header (for totalRecipients / totalSoftcapped)
                const campaigns = await client
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = campaigns[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                // Aggregate delivery counts via a single raw SQL query to minimise round-trips
                const metricsResult = await db.execute(sql`
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
                        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
                        COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
                        COUNT(*) FILTER (WHERE status = 'skipped')   AS skipped,
                        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
                        COUNT(*) FILTER (WHERE first_click_at IS NOT NULL) AS clicked
                    FROM newsletter_campaign_deliveries
                    WHERE campaign_id = ${validated.id}
                `);

                const row = metricsResult.rows[0] as
                    | {
                          pending: string;
                          delivered: string;
                          failed: string;
                          skipped: string;
                          opened: string;
                          clicked: string;
                      }
                    | undefined;

                return {
                    campaignId: validated.id,
                    totalRecipients: campaign.totalRecipients ?? 0,
                    totalSoftcapped: campaign.totalSoftcapped,
                    pending: Number(row?.pending ?? 0),
                    delivered: Number(row?.delivered ?? 0),
                    failed: Number(row?.failed ?? 0),
                    skipped: Number(row?.skipped ?? 0),
                    opened: Number(row?.opened ?? 0),
                    clicked: Number(row?.clicked ?? 0)
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // getFailedDeliveries
    // -------------------------------------------------------------------------

    /**
     * Returns a paginated list of failed delivery rows for a campaign.
     *
     * Intended for the admin UI to allow re-inspection or manual retry logic.
     *
     * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission.
     *
     * @param actor - The admin actor.
     * @param input - `id` of the campaign; `page` and `pageSize` for pagination.
     * @param ctx - Optional service context.
     * @returns Paginated list of failed deliveries.
     *
     * @example
     * ```ts
     * const result = await svc.getFailedDeliveries(actor, {
     *   id: campaignId,
     *   page: 1,
     *   pageSize: 50,
     * });
     * ```
     */
    public async getFailedDeliveries(
        actor: Actor,
        input: { id: string; page?: number; pageSize?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<FailedDeliveriesResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFailedDeliveries',
            input: { actor, ...input },
            schema: GetFailedDeliveriesInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanViewCampaign(actor);

                const db = getDb();
                const client = ctx?.tx ?? db;

                // Verify campaign exists
                const campaigns = await client
                    .select({ id: newsletterCampaigns.id })
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.id),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                if (!campaigns[0]) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.id}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                const offset = (validated.page - 1) * validated.pageSize;

                const [items, totalResult] = await Promise.all([
                    client
                        .select({
                            id: newsletterCampaignDeliveries.id,
                            subscriberId: newsletterCampaignDeliveries.subscriberId,
                            channel: newsletterCampaignDeliveries.channel,
                            errorMessage: newsletterCampaignDeliveries.errorMessage,
                            retryCount: newsletterCampaignDeliveries.retryCount,
                            createdAt: newsletterCampaignDeliveries.createdAt,
                            updatedAt: newsletterCampaignDeliveries.updatedAt
                        })
                        .from(newsletterCampaignDeliveries)
                        .where(
                            and(
                                eq(newsletterCampaignDeliveries.campaignId, validated.id),
                                eq(newsletterCampaignDeliveries.status, 'failed')
                            )
                        )
                        .limit(validated.pageSize)
                        .offset(offset),
                    client
                        .select({ total: count() })
                        .from(newsletterCampaignDeliveries)
                        .where(
                            and(
                                eq(newsletterCampaignDeliveries.campaignId, validated.id),
                                eq(newsletterCampaignDeliveries.status, 'failed')
                            )
                        )
                ]);

                const total = totalResult[0]?.total ?? 0;

                return {
                    items: items as FailedDelivery[],
                    total,
                    page: validated.page,
                    pageSize: validated.pageSize
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // closeSentCampaigns
    // -------------------------------------------------------------------------

    /**
     * Closes campaigns that are in `sending` state but have no remaining
     * pending deliveries.
     *
     * This method is called by the `newsletter-close-campaigns` cron job
     * (T-101-47) every 5 minutes. It does NOT require an actor — the cron
     * scheduler is the caller.
     *
     * Query (per tech-analysis §8.5):
     * ```sql
     * SELECT id FROM newsletter_campaigns
     * WHERE status = 'sending'
     *   AND NOT EXISTS (
     *     SELECT 1 FROM newsletter_campaign_deliveries
     *     WHERE campaign_id = newsletter_campaigns.id
     *       AND status = 'pending'
     *   )
     * ```
     *
     * @returns Number of campaigns transitioned to `sent`.
     *
     * @example
     * ```ts
     * // In the cron handler:
     * const result = await campaignSvc.closeSentCampaigns();
     * logger.info(`Closed ${result.data} campaigns`);
     * ```
     */
    public async closeSentCampaigns(): Promise<ServiceOutput<number>> {
        // Use a synthetic system actor for the logging pipeline
        const systemActor: Actor = {
            id: '00000000-0000-0000-0000-000000000002',
            role: 'SUPER_ADMIN' as never,
            permissions: Object.values(PermissionEnum) as never,
            _isSystemActor: true
        };

        return this.runWithLoggingAndValidation({
            methodName: 'closeSentCampaigns',
            input: { actor: systemActor },
            schema: CloseSentCampaignsInputSchema,
            execute: async () => {
                const db = getDb();

                // Single query: find sending campaigns with no pending deliveries
                // (NOT EXISTS is faster than LEFT JOIN / COUNT for this use case)
                const toCloseResult = await db.execute(sql`
                    SELECT id FROM newsletter_campaigns
                    WHERE status = 'sending'
                      AND NOT EXISTS (
                        SELECT 1 FROM newsletter_campaign_deliveries
                        WHERE campaign_id = newsletter_campaigns.id
                          AND status = 'pending'
                      )
                `);

                const ids = (toCloseResult.rows as { id: string }[]).map((r) => r.id);

                if (ids.length === 0) {
                    return 0;
                }

                // Bulk UPDATE to 'sent'
                await db.execute(sql`
                    UPDATE newsletter_campaigns
                    SET status = 'sent', updated_at = NOW()
                    WHERE id = ANY(ARRAY[${sql.join(
                        ids.map((id) => sql`${id}::uuid`),
                        sql`, `
                    )}])
                `);

                // SPEC-108 T-108-02: notify admin for each just-closed campaign
                // that finished with at least one failed delivery. Fires only
                // once per campaign (this query targets the IDs we just
                // transitioned, so subsequent cron ticks will not re-notify —
                // they no longer have status = 'sending'). Notifier errors are
                // swallowed so a transient transport failure does not roll
                // back the campaign transition.
                if (this.notifyCampaignClosedWithFailuresFn) {
                    await this.fireFailureNotifications(ids);
                }

                return ids.length;
            }
        });
    }

    /**
     * Emits admin notifications for campaigns that just transitioned to
     * `sent` with at least one failed delivery row. Internal helper for
     * `closeSentCampaigns`; gated by the optional
     * `notifyCampaignClosedWithFailuresFn` DI seam.
     */
    private async fireFailureNotifications(closedCampaignIds: string[]): Promise<void> {
        if (!this.notifyCampaignClosedWithFailuresFn || closedCampaignIds.length === 0) {
            return;
        }

        const db = getDb();
        const rows = (
            await db.execute(sql`
                SELECT
                    c.id,
                    c.subject,
                    c.total_recipients,
                    COALESCE(SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END), 0)::int AS delivered,
                    COALESCE(SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed
                FROM newsletter_campaigns c
                LEFT JOIN newsletter_campaign_deliveries d ON d.campaign_id = c.id
                WHERE c.id = ANY(ARRAY[${sql.join(
                    closedCampaignIds.map((id) => sql`${id}::uuid`),
                    sql`, `
                )}])
                GROUP BY c.id, c.subject, c.total_recipients
                HAVING SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) > 0
            `)
        ).rows as Array<{
            id: string;
            subject: string;
            total_recipients: number;
            delivered: number;
            failed: number;
        }>;

        const closedAt = new Date();
        for (const row of rows) {
            try {
                await this.notifyCampaignClosedWithFailuresFn({
                    campaignId: row.id,
                    subject: row.subject,
                    totalRecipients: row.total_recipients,
                    delivered: row.delivered,
                    failed: row.failed,
                    closedAt
                });
            } catch (error) {
                this.logger.warn(
                    `[newsletterCampaign.closeSentCampaigns] admin failure-notification threw for campaign ${row.id}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }
    }
}
