/**
 * @module newsletter-delivery.service
 *
 * NewsletterDeliveryService — manages the campaign delivery lifecycle for the
 * newsletter dispatch engine (SPEC-101 T-101-16).
 *
 * Responsibilities:
 * - `enqueueBatches`: groups delivery IDs into BullMQ jobs for the dispatch queue.
 * - `processBatch`: core worker handler — renders HTML, calls Brevo batch, updates DB.
 * - `bulkSkipPending`: cancels all pending deliveries for a campaign (used in cancel()).
 * - `sendTestEmail`: renders + sends a preview email to a single address via the
 *   injected single-recipient transport (does NOT use the batch helper).
 *
 * DESIGN DECISIONS:
 * 1. Does NOT extend `BaseCrudService`. Delivery rows are immutable outbox entries
 *    managed through status transitions, not CRUD.
 * 2. BullMQ `Queue`, the email transport, and the email rendering / sending helpers
 *    are all dependency-injected. `@repo/service-core` does not depend on
 *    `@repo/notifications` — that would create a circular package boundary.
 *    The host app (`apps/api`) wires the concrete implementations.
 * 3. `processBatch` is a public method so the BullMQ worker (T-101-44) can call it
 *    directly rather than going through HTTP.
 * 4. No permission guards on `enqueueBatches`, `processBatch`, or `bulkSkipPending` —
 *    these are system operations called from trusted contexts. Only `sendTestEmail`
 *    enforces `NEWSLETTER_CAMPAIGN_SEND` (user-driven action).
 * 5. `processBatch` throws on Brevo HTTP failure so BullMQ retries the entire batch.
 *    DB rows are updated LAST (after a successful Brevo response).
 *
 * @see {@link INewsletterDeliveryService} in newsletter-campaign.service.ts
 *   for the interface contract consumed by NewsletterCampaignService.
 * @see tech-analysis §4.3 for the 8-step processBatch() flow specification.
 */

import { getDb } from '@repo/db';
import { newsletterCampaignDeliveries, newsletterCampaigns, newsletterSubscribers } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { checkCanSendCampaign } from './newsletter-campaign.permissions.js';
import type { INewsletterDeliveryService } from './newsletter-campaign.service.js';
import { generateUnsubscribeToken } from './newsletter-token.helpers.js';

// ---------------------------------------------------------------------------
// Minimal BullMQ Queue interface (avoids hard-dep on bullmq package)
// ---------------------------------------------------------------------------

/**
 * Minimal subset of the BullMQ `Queue` API used by `enqueueBatches`.
 *
 * The host app injects a real `Queue` instance; tests inject a mock with
 * `{ addBulk: vi.fn() }`. We avoid importing `bullmq` here so that packages
 * that don't use BullMQ do not pull in the Redis client at build time.
 */
export interface NewsletterQueue {
    addBulk(
        jobs: ReadonlyArray<{
            readonly name: string;
            readonly data: { readonly campaignId: string; readonly deliveryIds: string[] };
            readonly opts?: Readonly<Record<string, unknown>>;
        }>
    ): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Injected email helpers (avoids @repo/notifications dep in @repo/service-core)
// ---------------------------------------------------------------------------

/**
 * Per-recipient outcome from a batch send.
 *
 * Mirrors `BatchRecipientOutcome` from `@repo/notifications` without creating
 * a hard dependency on that package.
 */
export interface DeliveryBatchOutcome {
    readonly email: string;
    readonly messageId?: string;
    readonly error?: string;
}

/**
 * Result returned by the injected `sendBatchFn`.
 */
export interface DeliveryBatchResult {
    readonly messageIds: readonly DeliveryBatchOutcome[];
    readonly statusCode: number;
}

/**
 * Payload passed to the injected `sendBatchFn`.
 *
 * Mirrors the `BrevoBatchPayload` shape from `@repo/notifications` without a
 * hard dependency.
 */
export interface DeliveryBatchPayload {
    readonly sender: { readonly email: string; readonly name: string };
    readonly subject: string;
    readonly htmlContent: string;
    readonly trackOpens?: boolean;
    readonly trackClicks?: boolean;
    readonly tags?: readonly string[];
    readonly messageVersions: ReadonlyArray<{
        readonly to: { readonly email: string; readonly name?: string };
        readonly subject: string;
        readonly htmlContent: string;
        readonly headers?: Readonly<Record<string, string>>;
    }>;
}

/**
 * Injected function for rendering a TipTap document to email-safe HTML.
 *
 * In production this is `renderTiptapEmailContent` from `@repo/notifications`.
 * In tests it is a `vi.fn()`.
 */
export type RenderTiptapEmailFn = (input: { content: unknown }) => string;

/**
 * Injected function for rendering the campaign email template to an HTML string.
 *
 * In production this wraps `render(NewsletterCampaign({ ... }))` from
 * `@react-email/render` + the template in `@repo/notifications`. The
 * production implementation is async (so CSS inlining and Tailwind passes
 * run); the return type accepts `string` too so sync test stubs keep
 * working without `await` wrappers (SPEC-108 T-108-01).
 * In tests it is a `vi.fn()`.
 */
export type RenderCampaignEmailFn = (input: {
    subject: string;
    bodyHtml: string;
    unsubscribeUrl: string;
    isTest?: boolean;
}) => string | Promise<string>;

/**
 * Opaque react element type — avoids importing `react` into `@repo/service-core`.
 *
 * At runtime the value must be a valid React element. The host app wires the
 * concrete type; service-core treats it as an opaque object passed through DI.
 */
// biome-ignore lint/suspicious/noExplicitAny: Opaque React element type to avoid react dep in service-core
export type OpaqueReactElement = Record<string, any>;

/**
 * Injected function for building a React element from the campaign template.
 *
 * Used by `sendTestEmail` to pass a ReactElement to the single-recipient
 * email transport. In production this is `NewsletterCampaign` from
 * `@repo/notifications`. In tests it is a `vi.fn()`.
 */
export type BuildCampaignReactElementFn = (input: {
    subject: string;
    bodyHtml: string;
    unsubscribeUrl: string;
    isTest?: boolean;
}) => OpaqueReactElement;

/**
 * Minimal single-recipient email transport interface.
 *
 * Mirrors `EmailTransport` from `@repo/notifications` without importing it.
 */
export interface SingleEmailTransport {
    send(input: {
        to: string;
        subject: string;
        react: OpaqueReactElement;
        from?: string;
    }): Promise<{ messageId: string }>;
}

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

/**
 * Constructor options for `NewsletterDeliveryService`.
 */
export interface NewsletterDeliveryServiceOptions {
    /** Logger from the parent context. */
    logger?: ServiceConfig['logger'];
    /**
     * BullMQ Queue instance for `hospeda-newsletter-dispatch`.
     * Injected by the host app; tests inject a mock.
     * When undefined, `enqueueBatches` returns SERVICE_UNAVAILABLE.
     */
    queue?: NewsletterQueue;
    /**
     * Single-recipient email transport used by `sendTestEmail`.
     * Injected by the host app.
     */
    emailTransport?: SingleEmailTransport;
    /**
     * Brevo batch send function.
     * In production: `sendBatch` from `@repo/notifications`.
     * In tests: `vi.fn()`.
     */
    sendBatchFn?: (input: {
        payload: DeliveryBatchPayload;
        apiKey: string;
    }) => Promise<DeliveryBatchResult>;
    /**
     * TipTap → email HTML renderer.
     * In production: `renderTiptapEmailContent` from `@repo/notifications`.
     * In tests: `vi.fn()`.
     */
    renderTiptapEmailFn?: RenderTiptapEmailFn;
    /**
     * Campaign template → HTML string renderer.
     * In production: wraps `render(NewsletterCampaign({ ... }))`.
     * In tests: `vi.fn()`.
     */
    renderCampaignEmailFn?: RenderCampaignEmailFn;
    /**
     * Campaign template → ReactElement builder for `sendTestEmail`.
     * In production: `NewsletterCampaign` from `@repo/notifications`.
     * In tests: `vi.fn()`.
     */
    buildCampaignReactElementFn?: BuildCampaignReactElementFn;
    /**
     * Brevo API key for the batch helper.
     * Falls back to `process.env.HOSPEDA_EMAIL_API_KEY`.
     */
    apiKey?: string;
    /**
     * Sender email address for outgoing campaign emails.
     * Falls back to `process.env.HOSPEDA_EMAIL_FROM_EMAIL` or `noreply@hospeda.com.ar`.
     */
    senderEmail?: string;
    /**
     * Sender display name for outgoing campaign emails.
     * Falls back to `process.env.HOSPEDA_EMAIL_FROM_NAME` or `Hospeda`.
     */
    senderName?: string;
    /**
     * Site base URL used to construct unsubscribe links.
     * Falls back to `process.env.HOSPEDA_SITE_URL` or `https://hospeda.com.ar`.
     */
    siteUrl?: string;
    /**
     * HMAC secret for generating stable unsubscribe tokens.
     * Falls back to `process.env.HOSPEDA_NEWSLETTER_HMAC_SECRET`.
     */
    hmacSecret?: string;
}

// ---------------------------------------------------------------------------
// Input Zod schemas
// ---------------------------------------------------------------------------

const EnqueueBatchesInputSchema = z.object({
    campaignId: z.string().uuid(),
    deliveryIds: z.array(z.string().uuid()).min(1),
    batchSize: z.number().int().min(1).max(1000).default(100)
});

const ProcessBatchInputSchema = z.object({
    campaignId: z.string().uuid(),
    deliveryIds: z.array(z.string().uuid()).min(1)
});

const BulkSkipPendingInputSchema = z.object({
    campaignId: z.string().uuid()
});

const BulkMarkFailedInputSchema = z.object({
    campaignId: z.string().uuid(),
    deliveryIds: z.array(z.string().uuid()).min(1),
    reason: z.string().min(1).max(500)
});

const SendTestEmailInputSchema = z.object({
    campaignId: z.string().uuid(),
    toEmail: z.string().email()
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Result of `processBatch`. */
export interface ProcessBatchResult {
    /** Number of recipients successfully handed off to Brevo. */
    readonly delivered: number;
    /** Deliveries skipped (non-pending status or inactive subscriber). */
    readonly skipped: number;
    /** Deliveries that Brevo rejected at the individual-recipient level. */
    readonly failed: number;
}

// ---------------------------------------------------------------------------
// System actor for internal operations
// ---------------------------------------------------------------------------

const SYSTEM_ACTOR: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'SUPER_ADMIN' as never,
    permissions: Object.values(PermissionEnum) as never,
    _isSystemActor: true
};

// ---------------------------------------------------------------------------
// Default no-op implementations (allow construction without full wiring)
// ---------------------------------------------------------------------------

const DEFAULT_RENDER_TIPTAP: RenderTiptapEmailFn = () => '';
const DEFAULT_RENDER_CAMPAIGN: RenderCampaignEmailFn = ({ subject }) =>
    `<html><body><p>${subject}</p></body></html>`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * `NewsletterDeliveryService` manages the delivery lifecycle for newsletter
 * campaigns.
 *
 * This class `implements INewsletterDeliveryService` — the interface declared
 * in `newsletter-campaign.service.ts` and consumed by `NewsletterCampaignService`.
 * The host app injects the concrete instance; unit tests inject mocks.
 *
 * All public methods return `ServiceOutput<T>` and are wrapped with
 * `runWithLoggingAndValidation` for consistent logging and error normalisation.
 *
 * @example
 * ```ts
 * import { renderTiptapEmailContent } from '@repo/notifications';
 * import { sendBatch } from '@repo/notifications';
 * import { render } from '@react-email/render';
 * import { NewsletterCampaign } from '@repo/notifications';
 *
 * const deliverySvc = new NewsletterDeliveryService(
 *   { logger },
 *   {
 *     queue,
 *     emailTransport,
 *     sendBatchFn: sendBatch,
 *     renderTiptapEmailFn: renderTiptapEmailContent,
 *     renderCampaignEmailFn: (input) => render(NewsletterCampaign(input)),
 *     buildCampaignReactElementFn: (input) => NewsletterCampaign(input),
 *     apiKey: env.HOSPEDA_EMAIL_API_KEY,
 *     senderEmail: env.HOSPEDA_EMAIL_FROM_EMAIL,
 *     senderName: env.HOSPEDA_EMAIL_FROM_NAME,
 *     siteUrl: env.HOSPEDA_SITE_URL,
 *     hmacSecret: env.HOSPEDA_NEWSLETTER_HMAC_SECRET,
 *   }
 * );
 * ```
 */
export class NewsletterDeliveryService extends BaseService implements INewsletterDeliveryService {
    static readonly ENTITY_NAME = 'newsletterDelivery';

    protected override readonly entityName = NewsletterDeliveryService.ENTITY_NAME;

    private readonly queue: NewsletterQueue | undefined;
    private readonly emailTransport: SingleEmailTransport | undefined;
    private readonly sendBatchFn:
        | ((input: {
              payload: DeliveryBatchPayload;
              apiKey: string;
          }) => Promise<DeliveryBatchResult>)
        | undefined;
    private readonly renderTiptapEmailFn: RenderTiptapEmailFn;
    private readonly renderCampaignEmailFn: RenderCampaignEmailFn;
    private readonly buildCampaignReactElementFn: BuildCampaignReactElementFn | undefined;
    private readonly apiKey: string;
    private readonly senderEmail: string;
    private readonly senderName: string;
    private readonly siteUrl: string;
    private readonly hmacSecret: string;

    constructor(config: ServiceConfig, options: NewsletterDeliveryServiceOptions = {}) {
        super(config, NewsletterDeliveryService.ENTITY_NAME);
        this.queue = options.queue;
        this.emailTransport = options.emailTransport;
        this.sendBatchFn = options.sendBatchFn;
        this.renderTiptapEmailFn = options.renderTiptapEmailFn ?? DEFAULT_RENDER_TIPTAP;
        this.renderCampaignEmailFn = options.renderCampaignEmailFn ?? DEFAULT_RENDER_CAMPAIGN;
        this.buildCampaignReactElementFn = options.buildCampaignReactElementFn;
        this.apiKey = options.apiKey ?? process.env.HOSPEDA_EMAIL_API_KEY ?? '';
        this.senderEmail =
            options.senderEmail ?? process.env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar';
        this.senderName = options.senderName ?? process.env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda';
        this.siteUrl = options.siteUrl ?? process.env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar';
        this.hmacSecret = options.hmacSecret ?? process.env.HOSPEDA_NEWSLETTER_HMAC_SECRET ?? '';
    }

    // -------------------------------------------------------------------------
    // enqueueBatches
    // -------------------------------------------------------------------------

    /**
     * Groups `deliveryIds` into chunks of `batchSize` and enqueues each chunk
     * as a BullMQ job on the `hospeda-newsletter-dispatch` queue.
     *
     * Each job payload is `{ campaignId, deliveryIds: string[] }`. The worker
     * (T-101-44) calls `processBatch` with this payload.
     *
     * Called by `NewsletterCampaignService.send()` AFTER the transaction that
     * inserts delivery rows and updates campaign status commits.
     *
     * @param input - Campaign ID, flat delivery ID list, and batch size.
     * @returns Number of BullMQ jobs enqueued.
     *
     * @example
     * ```ts
     * const result = await svc.enqueueBatches({
     *   campaignId: 'uuid',
     *   deliveryIds: ['d1', 'd2', 'd3', 'd4'],
     *   batchSize: 2,
     * });
     * // result.data?.jobsEnqueued === 2
     * ```
     */
    public async enqueueBatches(input: {
        campaignId: string;
        deliveryIds: string[];
        batchSize: number;
    }): Promise<ServiceOutput<{ jobsEnqueued: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'enqueueBatches',
            input: { actor: SYSTEM_ACTOR, ...input },
            schema: EnqueueBatchesInputSchema,
            execute: async (validated) => {
                if (!this.queue) {
                    throw new ServiceError(
                        ServiceErrorCode.SERVICE_UNAVAILABLE,
                        'BullMQ Queue is not configured. Inject it via NewsletterDeliveryServiceOptions.queue.',
                        undefined,
                        'QUEUE_NOT_CONFIGURED'
                    );
                }

                const { campaignId, deliveryIds, batchSize } = validated;

                // Split delivery IDs into chunks of batchSize
                const chunks: string[][] = [];
                for (let i = 0; i < deliveryIds.length; i += batchSize) {
                    chunks.push(deliveryIds.slice(i, i + batchSize));
                }

                const jobs = chunks.map((chunk, idx) => ({
                    name: `campaign-${campaignId}-batch-${idx}`,
                    data: { campaignId, deliveryIds: chunk },
                    opts: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } }
                }));

                await this.queue.addBulk(jobs);

                return { jobsEnqueued: chunks.length };
            }
        });
    }

    // -------------------------------------------------------------------------
    // processBatch
    // -------------------------------------------------------------------------

    /**
     * Processes a batch of campaign deliveries. Called by the BullMQ worker.
     *
     * 8-step flow (per tech-analysis §4.3):
     * 1. Load campaign; return early if `status !== 'sending'` (campaign cancelled).
     * 2. Load delivery rows; skip any where `status !== 'pending'` (idempotency).
     * 3. Load subscriber rows; skip inactive subscribers.
     * 4. Render campaign `bodyJson` to email HTML once per batch.
     * 5. For each surviving delivery, build per-recipient HTML with unsubscribe URL.
     * 6. Call the injected `sendBatchFn` with the Brevo batch payload.
     * 7. Map Brevo response back: bulk-update `status='delivered'` / `status='failed'`
     *    with `providerMessageId` and `deliveredAt`.
     * 8. On Brevo HTTP failure: throws — BullMQ retries. DB rows are NOT updated.
     *
     * @param input - Campaign ID and batch of delivery IDs (from BullMQ job payload).
     * @returns Counts of delivered, skipped, and failed deliveries.
     *
     * @throws {Error} When the Brevo batch HTTP call fails (triggers BullMQ retry).
     *
     * @example
     * ```ts
     * const result = await deliverySvc.processBatch({
     *   campaignId: job.data.campaignId,
     *   deliveryIds: job.data.deliveryIds,
     * });
     * ```
     */
    public async processBatch(input: {
        campaignId: string;
        deliveryIds: string[];
    }): Promise<ServiceOutput<ProcessBatchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processBatch',
            input: { actor: SYSTEM_ACTOR, ...input },
            schema: ProcessBatchInputSchema,
            execute: async (validated) => {
                const db = getDb();

                // ----------------------------------------------------------------
                // Step 1: Load campaign. Bail if not in 'sending' state.
                // ----------------------------------------------------------------
                const campaignRows = await db
                    .select()
                    .from(newsletterCampaigns)
                    .where(eq(newsletterCampaigns.id, validated.campaignId))
                    .limit(1);

                const campaign = campaignRows[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.campaignId}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                if (campaign.status !== 'sending') {
                    // Campaign was cancelled or already completed — idempotent early return.
                    this.logger.info(
                        `[newsletterDelivery.processBatch] Skipping batch — campaign ${validated.campaignId} status is '${campaign.status}', expected 'sending'.`
                    );
                    return {
                        delivered: 0,
                        skipped: validated.deliveryIds.length,
                        failed: 0
                    };
                }

                // ----------------------------------------------------------------
                // Step 2: Load delivery rows; skip non-pending (idempotency guard).
                // ----------------------------------------------------------------
                const deliveryRows = await db
                    .select()
                    .from(newsletterCampaignDeliveries)
                    .where(
                        and(
                            inArray(newsletterCampaignDeliveries.id, validated.deliveryIds),
                            eq(newsletterCampaignDeliveries.campaignId, validated.campaignId)
                        )
                    );

                const pendingDeliveries = deliveryRows.filter((d) => d.status === 'pending');
                const preSkippedCount = deliveryRows.length - pendingDeliveries.length;

                if (pendingDeliveries.length === 0) {
                    return {
                        delivered: 0,
                        skipped:
                            preSkippedCount + (validated.deliveryIds.length - deliveryRows.length),
                        failed: 0
                    };
                }

                // ----------------------------------------------------------------
                // Step 3: Load subscribers; skip inactive ones.
                // ----------------------------------------------------------------
                const subscriberIds = pendingDeliveries.map((d) => d.subscriberId);
                const subscriberRows = await db
                    .select()
                    .from(newsletterSubscribers)
                    .where(
                        and(
                            inArray(newsletterSubscribers.id, subscriberIds),
                            isNull(newsletterSubscribers.deletedAt)
                        )
                    );

                const activeSubscriberMap = new Map(
                    subscriberRows.filter((s) => s.status === 'active').map((s) => [s.id, s])
                );

                const eligibleDeliveries = pendingDeliveries.filter((d) =>
                    activeSubscriberMap.has(d.subscriberId)
                );
                const inactiveDeliveries = pendingDeliveries.filter(
                    (d) => !activeSubscriberMap.has(d.subscriberId)
                );

                if (eligibleDeliveries.length === 0) {
                    // Bulk-skip all inactive-subscriber deliveries
                    await this._bulkUpdateStatus(
                        db,
                        inactiveDeliveries.map((d) => d.id),
                        'skipped'
                    );
                    return {
                        delivered: 0,
                        skipped:
                            preSkippedCount +
                            inactiveDeliveries.length +
                            (validated.deliveryIds.length - deliveryRows.length),
                        failed: 0
                    };
                }

                // ----------------------------------------------------------------
                // Step 4: Render campaign bodyJson to email HTML once per batch.
                // ----------------------------------------------------------------
                const bodyHtml = this.renderTiptapEmailFn({ content: campaign.bodyJson });

                // ----------------------------------------------------------------
                // Step 5: Build per-recipient HTML with individual unsubscribe URL.
                // `renderCampaignEmailFn` may return `Promise<string>` in
                // production (async path through `@react-email/render` for CSS
                // inlining + Tailwind passes) or `string` in tests. The body
                // of the map is pure (no shared state across iterations) so
                // running renders concurrently with `Promise.all` is safe.
                // ----------------------------------------------------------------
                const recipientData = await Promise.all(
                    eligibleDeliveries.map(async (delivery) => {
                        const subscriber = activeSubscriberMap.get(delivery.subscriberId);
                        const email = subscriber?.email ?? '';
                        const subscriberId = delivery.subscriberId;
                        const locale = subscriber?.locale ?? 'es';

                        const unsubscribeToken = this.hmacSecret
                            ? generateUnsubscribeToken({
                                  subscriberId,
                                  channel: 'email',
                                  secret: this.hmacSecret
                              })
                            : '';

                        const unsubscribeUrl = `${this.siteUrl}/${locale}/newsletter/unsubscribe?token=${unsubscribeToken}`;

                        const recipientHtml = await this.renderCampaignEmailFn({
                            subject: campaign.subject,
                            bodyHtml,
                            unsubscribeUrl
                        });

                        return {
                            deliveryId: delivery.id,
                            email,
                            recipientHtml,
                            unsubscribeUrl
                        };
                    })
                );

                // ----------------------------------------------------------------
                // Step 6: Call the injected sendBatchFn.
                // Throws on HTTP failure → BullMQ retries.
                // ----------------------------------------------------------------
                if (!this.sendBatchFn) {
                    throw new ServiceError(
                        ServiceErrorCode.SERVICE_UNAVAILABLE,
                        'Batch send function is not configured. Inject it via NewsletterDeliveryServiceOptions.sendBatchFn.',
                        undefined,
                        'SEND_BATCH_FN_NOT_CONFIGURED'
                    );
                }

                const batchPayload: DeliveryBatchPayload = {
                    sender: { email: this.senderEmail, name: this.senderName },
                    subject: campaign.subject,
                    htmlContent: bodyHtml,
                    trackOpens: true,
                    trackClicks: true,
                    tags: [`campaign:${validated.campaignId}`],
                    messageVersions: recipientData.map((r) => ({
                        to: { email: r.email },
                        subject: campaign.subject,
                        htmlContent: r.recipientHtml,
                        headers: { 'X-Newsletter-Delivery-Id': r.deliveryId }
                    }))
                };

                // This call throws on Brevo HTTP failure → BullMQ retries the entire batch.
                const brevoResult = await this.sendBatchFn({
                    payload: batchPayload,
                    apiKey: this.apiKey
                });

                // ----------------------------------------------------------------
                // Step 7: Map Brevo response back; bulk-update delivery rows.
                // DB writes happen ONLY after a successful Brevo response.
                // ----------------------------------------------------------------
                const now = new Date();
                const deliveredIds: string[] = [];
                const deliveredMessageIds = new Map<string, string>();
                const failedIds: string[] = [];

                for (let i = 0; i < eligibleDeliveries.length; i++) {
                    const delivery = eligibleDeliveries[i];
                    const outcome = brevoResult.messageIds[i];
                    if (!delivery || !outcome) continue;

                    if (outcome.error) {
                        failedIds.push(delivery.id);
                    } else {
                        deliveredIds.push(delivery.id);
                        if (outcome.messageId) {
                            deliveredMessageIds.set(delivery.id, outcome.messageId);
                        }
                    }
                }

                // Update delivered rows (one-by-one to capture providerMessageId per row)
                for (const deliveryId of deliveredIds) {
                    const messageId = deliveredMessageIds.get(deliveryId);
                    await db
                        .update(newsletterCampaignDeliveries)
                        .set({
                            status: 'delivered',
                            deliveredAt: now,
                            providerMessageId: messageId ?? null,
                            updatedAt: now
                        })
                        .where(eq(newsletterCampaignDeliveries.id, deliveryId));
                }

                // Bulk-update failed recipients
                if (failedIds.length > 0) {
                    await this._bulkUpdateStatus(db, failedIds, 'failed', now);
                }

                // Bulk-skip inactive-subscriber deliveries
                if (inactiveDeliveries.length > 0) {
                    await this._bulkUpdateStatus(
                        db,
                        inactiveDeliveries.map((d) => d.id),
                        'skipped',
                        now
                    );
                }

                const totalSkipped =
                    preSkippedCount +
                    inactiveDeliveries.length +
                    (validated.deliveryIds.length - deliveryRows.length);

                return {
                    delivered: deliveredIds.length,
                    skipped: totalSkipped,
                    failed: failedIds.length
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // bulkSkipPending
    // -------------------------------------------------------------------------

    /**
     * Bulk-updates all pending deliveries for a campaign to `status='skipped'`.
     *
     * Called by `NewsletterCampaignService.cancel()` immediately after the
     * campaign row is flipped to `cancelled`, to prevent workers from dispatching
     * content for a cancelled campaign.
     *
     * @param input - `campaignId` whose pending deliveries are to be skipped.
     * @returns Number of rows updated.
     *
     * @example
     * ```ts
     * const result = await svc.bulkSkipPending({ campaignId: 'uuid' });
     * // result.data === 42 (rows flipped to 'skipped')
     * ```
     */
    public async bulkSkipPending(input: { campaignId: string }): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'bulkSkipPending',
            input: { actor: SYSTEM_ACTOR, ...input },
            schema: BulkSkipPendingInputSchema,
            execute: async (validated) => {
                const db = getDb();
                const now = new Date();

                const result = await db
                    .update(newsletterCampaignDeliveries)
                    .set({ status: 'skipped', updatedAt: now })
                    .where(
                        and(
                            eq(newsletterCampaignDeliveries.campaignId, validated.campaignId),
                            eq(newsletterCampaignDeliveries.status, 'pending')
                        )
                    )
                    .returning({ id: newsletterCampaignDeliveries.id });

                return result.length;
            }
        });
    }

    // -------------------------------------------------------------------------
    // bulkMarkFailed
    // -------------------------------------------------------------------------

    /**
     * Bulk-updates the specified pending deliveries for a campaign to
     * `status='failed'` with the supplied reason recorded in `errorMessage`.
     *
     * Called by the BullMQ dispatch worker when a job exhausts its retry
     * budget (e.g. Brevo down for the full 3-attempt window). Without this
     * write, the deliveries would remain `pending` forever, and the
     * `closeSentCampaigns` cron would never transition the campaign to
     * `sent` because pending rows persist.
     *
     * Only rows whose current status is `pending` are flipped — already-
     * terminal rows (`delivered` / `skipped` / `failed`) are left untouched
     * so a delayed exhaustion signal cannot overwrite a successful delivery
     * recorded by a different attempt or worker.
     *
     * @param input.campaignId - Campaign whose deliveries to mark failed.
     * @param input.deliveryIds - The exact delivery rows to flip (only those still pending).
     * @param input.reason - 1-sentence reason written to `errorMessage`.
     * @returns Number of rows actually flipped to `failed`.
     *
     * @example
     * ```ts
     * const result = await svc.bulkMarkFailed({
     *   campaignId,
     *   deliveryIds: job.data.deliveryIds,
     *   reason: 'Brevo dispatch exhausted retries: HTTP 503'
     * });
     * ```
     */
    public async bulkMarkFailed(input: {
        campaignId: string;
        deliveryIds: string[];
        reason: string;
    }): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'bulkMarkFailed',
            input: { actor: SYSTEM_ACTOR, ...input },
            schema: BulkMarkFailedInputSchema,
            execute: async (validated) => {
                const db = getDb();
                const now = new Date();

                const result = await db
                    .update(newsletterCampaignDeliveries)
                    .set({
                        status: 'failed',
                        errorMessage: validated.reason,
                        updatedAt: now
                    })
                    .where(
                        and(
                            eq(newsletterCampaignDeliveries.campaignId, validated.campaignId),
                            inArray(newsletterCampaignDeliveries.id, validated.deliveryIds),
                            eq(newsletterCampaignDeliveries.status, 'pending')
                        )
                    )
                    .returning({ id: newsletterCampaignDeliveries.id });

                return result.length;
            }
        });
    }

    // -------------------------------------------------------------------------
    // sendTestEmail
    // -------------------------------------------------------------------------

    /**
     * Renders the campaign body and wrapper template then sends a single preview
     * email via the injected single-recipient email transport.
     *
     * Does NOT create delivery rows or change campaign status.
     * The `isTest: true` flag adds a `[PRUEBA]` banner to the rendered email.
     *
     * Requires `NEWSLETTER_CAMPAIGN_SEND` permission on the actor.
     *
     * @param input - Campaign to preview and recipient email address.
     * @param actor - The admin actor (permission check: NEWSLETTER_CAMPAIGN_SEND).
     * @param ctx - Optional service context.
     * @returns The address the preview was sent to.
     *
     * @example
     * ```ts
     * const result = await svc.sendTestEmail(
     *   { campaignId: 'uuid', toEmail: 'admin@example.com' },
     *   actor,
     * );
     * // result.data?.sentTo === 'admin@example.com'
     * ```
     */
    public async sendTestEmail(
        input: {
            campaignId: string;
            toEmail: string;
        },
        actor?: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ sentTo: string }>> {
        const effectiveActor = actor ?? SYSTEM_ACTOR;

        return this.runWithLoggingAndValidation({
            methodName: 'sendTestEmail',
            input: { actor: effectiveActor, ...input },
            schema: SendTestEmailInputSchema,
            ctx,
            execute: async (validated) => {
                checkCanSendCampaign(effectiveActor);

                if (!this.emailTransport) {
                    throw new ServiceError(
                        ServiceErrorCode.SERVICE_UNAVAILABLE,
                        'Email transport is not configured. Inject it via NewsletterDeliveryServiceOptions.emailTransport.',
                        undefined,
                        'EMAIL_TRANSPORT_NOT_CONFIGURED'
                    );
                }

                if (!this.buildCampaignReactElementFn) {
                    throw new ServiceError(
                        ServiceErrorCode.SERVICE_UNAVAILABLE,
                        'Campaign React element builder is not configured. Inject it via NewsletterDeliveryServiceOptions.buildCampaignReactElementFn.',
                        undefined,
                        'CAMPAIGN_REACT_BUILDER_NOT_CONFIGURED'
                    );
                }

                const db = getDb();

                const campaignRows = await db
                    .select()
                    .from(newsletterCampaigns)
                    .where(
                        and(
                            eq(newsletterCampaigns.id, validated.campaignId),
                            isNull(newsletterCampaigns.deletedAt)
                        )
                    )
                    .limit(1);

                const campaign = campaignRows[0];

                if (!campaign) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Campaign not found: ${validated.campaignId}`,
                        undefined,
                        'CAMPAIGN_NOT_FOUND'
                    );
                }

                const bodyHtml = this.renderTiptapEmailFn({ content: campaign.bodyJson });
                const unsubscribeUrl = `${this.siteUrl}/es/newsletter/unsubscribe?test=1`;

                // Build the ReactElement and send via single-recipient transport
                const emailElement = this.buildCampaignReactElementFn({
                    subject: campaign.subject,
                    bodyHtml,
                    unsubscribeUrl,
                    isTest: true
                });

                await this.emailTransport.send({
                    to: validated.toEmail,
                    subject: `[PRUEBA] ${campaign.subject}`,
                    react: emailElement
                });

                return { sentTo: validated.toEmail };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Bulk-updates a list of delivery IDs to a given status in a single query.
     *
     * @param db - Drizzle database client.
     * @param ids - Delivery row IDs to update.
     * @param status - Target status value.
     * @param now - Timestamp for `updatedAt` (defaults to `new Date()`).
     */
    private async _bulkUpdateStatus(
        db: ReturnType<typeof getDb>,
        ids: string[],
        status: 'skipped' | 'failed' | 'delivered',
        now: Date = new Date()
    ): Promise<void> {
        if (ids.length === 0) return;

        await db
            .update(newsletterCampaignDeliveries)
            .set({ status, updatedAt: now })
            .where(inArray(newsletterCampaignDeliveries.id, ids));
    }
}
