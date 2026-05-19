/**
 * @module newsletter-tracking.service
 *
 * NewsletterTrackingService — applies Brevo webhook events to our local
 * delivery / subscriber state (SPEC-101 §4.4 — T-101-17).
 *
 * The Brevo webhook endpoint (T-101-32) verifies the request signature
 * BEFORE invoking this service. There is no actor permission check here —
 * by the time `processBrevoWebhookEvent()` runs, the caller has already
 * proven the event is genuinely from Brevo.
 *
 * Event mapping (per tech-analysis §4.4):
 *
 *   delivered      → delivery: deliveredAt = date (idempotent: WHERE delivered_at IS NULL)
 *   hard_bounce    → delivery: status = FAILED, errorMessage = 'hard_bounce'
 *                    subscriber: status = BOUNCED, bouncedAt = date
 *   soft_bounce    → delivery: retryCount += 1 (no status change, subscriber untouched)
 *   spam | complained → subscriber: status = COMPLAINED, complainedAt = date
 *   unsubscribed   → subscriber: status = UNSUBSCRIBED, unsubscribedAt = date
 *   invalid_email  → subscriber: status = BOUNCED, bouncedAt = date
 *   opened         → delivery: openedAt = date (idempotent: WHERE opened_at IS NULL)
 *   click          → delivery: firstClickAt = date (idempotent: WHERE first_click_at IS NULL)
 *
 * Lookup strategy:
 *
 *   1. Prefer `messageId` (matches `delivery.provider_message_id`).
 *   2. Fall back to subscriber lookup by `email` when `messageId` is missing
 *      or no delivery row matches (race: webhook arrives before we persisted
 *      the message id, or the event is subscriber-scoped like `unsubscribed`).
 *
 * Idempotency:
 *
 *   `opened` and `click` events use `WHERE *_at IS NULL` so only the FIRST
 *   event of each kind records a timestamp. Subsequent duplicates are no-ops.
 *   Delivery / subscriber status writes are blind UPDATEs — replays land on
 *   the same terminal state.
 *
 * @see packages/notifications/src/transports/email/brevo-batch.ts — emits the
 *      `X-Newsletter-Delivery-Id` header that Brevo echoes in webhook events.
 *      Future work (post-MVP) may use that header for a direct delivery lookup
 *      instead of `provider_message_id`.
 */

import { getDb } from '@repo/db';
import { newsletterCampaignDeliveries, newsletterSubscribers } from '@repo/db';
import {
    NewsletterDeliveryStatusEnum,
    NewsletterSubscriberStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceOutput } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The set of Brevo webhook events we care about (per tech-analysis §4.4).
 *
 * Brevo's `event` field can carry other values (e.g. `error`, `request`,
 * `proxy_open`) — the webhook endpoint filters those out before calling us.
 */
export const BrevoWebhookEventTypeSchema = z.enum([
    'delivered',
    'hard_bounce',
    'soft_bounce',
    'spam',
    'complained',
    'unsubscribed',
    'invalid_email',
    'opened',
    'click'
]);

/** Brevo webhook event type (compile-time alias for the Zod enum). */
export type BrevoWebhookEventType = z.infer<typeof BrevoWebhookEventTypeSchema>;

/**
 * Normalised input passed to {@link NewsletterTrackingService.processBrevoWebhookEvent}.
 *
 * The Brevo payload arrives at the route as raw JSON; the route maps the
 * provider-specific shape into this object. Keep this stable — it is the
 * service-layer contract.
 */
export const ProcessBrevoWebhookEventInputSchema = z.object({
    event: BrevoWebhookEventTypeSchema,
    email: z.string().email().toLowerCase(),
    /** Brevo `message-id` (maps to `delivery.provider_message_id`). */
    messageId: z.string().min(1).optional(),
    /** Timestamp Brevo reports for the event. */
    date: z.date()
});

/** TS type for {@link ProcessBrevoWebhookEventInputSchema}. */
export type ProcessBrevoWebhookEventInput = z.infer<typeof ProcessBrevoWebhookEventInputSchema>;

/** Outcome reported by {@link NewsletterTrackingService.processBrevoWebhookEvent}. */
export interface ProcessBrevoWebhookEventOutput {
    /** True iff at least one row was actually updated. */
    readonly updated: boolean;
    /** Whether the lookup matched a delivery row via `messageId`. */
    readonly matchedByMessageId: boolean;
    /** Whether the lookup fell back to subscriber lookup by `email`. */
    readonly matchedBySubscriberEmail: boolean;
    /** Diagnostic free-form reason for `updated=false` (e.g. `no_match`). */
    readonly skippedReason?: string;
}

/** Options accepted by the {@link NewsletterTrackingService} constructor. */
export type NewsletterTrackingServiceOptions = Record<string, never>;

// ---------------------------------------------------------------------------
// System actor — webhook events have no user actor
// ---------------------------------------------------------------------------

const SYSTEM_ACTOR: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'SUPER_ADMIN' as never,
    permissions: Object.values(PermissionEnum) as never,
    _isSystemActor: true
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * NewsletterTrackingService — translates Brevo webhook events into local
 * delivery / subscriber state changes.
 *
 * No actor / permission check. Construct once and inject into the route
 * handler (T-101-32).
 */
export class NewsletterTrackingService extends BaseService {
    static readonly ENTITY_NAME = 'newsletterTracking';

    protected override readonly entityName = NewsletterTrackingService.ENTITY_NAME;

    /**
     * @param config - Base service config (logger).
     */
    constructor(config: ServiceConfig) {
        super(config, NewsletterTrackingService.ENTITY_NAME);
    }

    /**
     * Apply one Brevo webhook event to local state.
     *
     * The caller (webhook endpoint) MUST have verified the request signature
     * before invoking this method. The service does no signature checks of
     * its own.
     *
     * @param input - Normalised event payload.
     * @returns Whether any row was updated, plus diagnostic flags.
     */
    public async processBrevoWebhookEvent(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ServiceOutput<ProcessBrevoWebhookEventOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'processBrevoWebhookEvent',
            input: { actor: SYSTEM_ACTOR, ...input },
            schema: ProcessBrevoWebhookEventInputSchema.extend({
                actor: z.any()
            }),
            execute: async (validated) => {
                switch (validated.event) {
                    case 'delivered':
                        return this.applyDelivered(validated);
                    case 'hard_bounce':
                        return this.applyHardBounce(validated);
                    case 'soft_bounce':
                        return this.applySoftBounce(validated);
                    case 'spam':
                    case 'complained':
                        return this.applyComplained(validated);
                    case 'unsubscribed':
                        return this.applyUnsubscribed(validated);
                    case 'invalid_email':
                        return this.applyInvalidEmail(validated);
                    case 'opened':
                        return this.applyOpened(validated);
                    case 'click':
                        return this.applyClick(validated);
                    default:
                        return this.noMatch('unknown_event');
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    private async applyDelivered(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        if (!input.messageId) {
            return this.noMatch('missing_message_id');
        }
        const db = getDb();
        const result = await db
            .update(newsletterCampaignDeliveries)
            .set({ deliveredAt: input.date, updatedAt: new Date() })
            .where(
                and(
                    eq(newsletterCampaignDeliveries.providerMessageId, input.messageId),
                    isNull(newsletterCampaignDeliveries.deliveredAt)
                )
            )
            .returning({ id: newsletterCampaignDeliveries.id });
        return {
            updated: result.length > 0,
            matchedByMessageId: result.length > 0,
            matchedBySubscriberEmail: false,
            skippedReason: result.length > 0 ? undefined : 'no_match_or_already_delivered'
        };
    }

    private async applyOpened(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        if (!input.messageId) {
            return this.noMatch('missing_message_id');
        }
        const db = getDb();
        const result = await db
            .update(newsletterCampaignDeliveries)
            .set({ openedAt: input.date, updatedAt: new Date() })
            .where(
                and(
                    eq(newsletterCampaignDeliveries.providerMessageId, input.messageId),
                    isNull(newsletterCampaignDeliveries.openedAt)
                )
            )
            .returning({ id: newsletterCampaignDeliveries.id });
        return {
            updated: result.length > 0,
            matchedByMessageId: result.length > 0,
            matchedBySubscriberEmail: false,
            skippedReason: result.length > 0 ? undefined : 'no_match_or_already_opened'
        };
    }

    private async applyClick(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        if (!input.messageId) {
            return this.noMatch('missing_message_id');
        }
        const db = getDb();
        const result = await db
            .update(newsletterCampaignDeliveries)
            .set({ firstClickAt: input.date, updatedAt: new Date() })
            .where(
                and(
                    eq(newsletterCampaignDeliveries.providerMessageId, input.messageId),
                    isNull(newsletterCampaignDeliveries.firstClickAt)
                )
            )
            .returning({ id: newsletterCampaignDeliveries.id });
        return {
            updated: result.length > 0,
            matchedByMessageId: result.length > 0,
            matchedBySubscriberEmail: false,
            skippedReason: result.length > 0 ? undefined : 'no_match_or_already_clicked'
        };
    }

    private async applySoftBounce(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        if (!input.messageId) {
            return this.noMatch('missing_message_id');
        }
        const db = getDb();
        const result = await db
            .update(newsletterCampaignDeliveries)
            .set({
                retryCount: sql`${newsletterCampaignDeliveries.retryCount} + 1`,
                updatedAt: new Date()
            })
            .where(eq(newsletterCampaignDeliveries.providerMessageId, input.messageId))
            .returning({ id: newsletterCampaignDeliveries.id });
        return {
            updated: result.length > 0,
            matchedByMessageId: result.length > 0,
            matchedBySubscriberEmail: false,
            skippedReason: result.length > 0 ? undefined : 'no_delivery_for_message_id'
        };
    }

    private async applyHardBounce(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        const db = getDb();
        let deliveryUpdated = false;
        let matchedByMessageId = false;
        if (input.messageId) {
            const deliveryResult = await db
                .update(newsletterCampaignDeliveries)
                .set({
                    status: NewsletterDeliveryStatusEnum.FAILED,
                    errorMessage: 'hard_bounce',
                    updatedAt: new Date()
                })
                .where(eq(newsletterCampaignDeliveries.providerMessageId, input.messageId))
                .returning({ id: newsletterCampaignDeliveries.id });
            deliveryUpdated = deliveryResult.length > 0;
            matchedByMessageId = deliveryUpdated;
        }
        const subscriberResult = await this.markSubscriberStatusByEmail({
            email: input.email,
            status: NewsletterSubscriberStatusEnum.BOUNCED,
            timestampColumn: 'bouncedAt',
            date: input.date
        });
        return {
            updated: deliveryUpdated || subscriberResult > 0,
            matchedByMessageId,
            matchedBySubscriberEmail: subscriberResult > 0,
            skippedReason:
                deliveryUpdated || subscriberResult > 0
                    ? undefined
                    : 'no_match_for_email_or_message_id'
        };
    }

    private async applyComplained(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        const rows = await this.markSubscriberStatusByEmail({
            email: input.email,
            status: NewsletterSubscriberStatusEnum.COMPLAINED,
            timestampColumn: 'complainedAt',
            date: input.date
        });
        return {
            updated: rows > 0,
            matchedByMessageId: false,
            matchedBySubscriberEmail: rows > 0,
            skippedReason: rows > 0 ? undefined : 'no_subscriber_for_email'
        };
    }

    private async applyUnsubscribed(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        const rows = await this.markSubscriberStatusByEmail({
            email: input.email,
            status: NewsletterSubscriberStatusEnum.UNSUBSCRIBED,
            timestampColumn: 'unsubscribedAt',
            date: input.date
        });
        return {
            updated: rows > 0,
            matchedByMessageId: false,
            matchedBySubscriberEmail: rows > 0,
            skippedReason: rows > 0 ? undefined : 'no_subscriber_for_email'
        };
    }

    private async applyInvalidEmail(
        input: ProcessBrevoWebhookEventInput
    ): Promise<ProcessBrevoWebhookEventOutput> {
        const rows = await this.markSubscriberStatusByEmail({
            email: input.email,
            status: NewsletterSubscriberStatusEnum.BOUNCED,
            timestampColumn: 'bouncedAt',
            date: input.date
        });
        return {
            updated: rows > 0,
            matchedByMessageId: false,
            matchedBySubscriberEmail: rows > 0,
            skippedReason: rows > 0 ? undefined : 'no_subscriber_for_email'
        };
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Single bulk-UPDATE that flips every active matching subscriber row by
     * email to the supplied terminal status (`bounced`, `complained` or
     * `unsubscribed`) and stamps the matching timestamp column.
     *
     * Idempotent: re-running the same event for an already-terminal subscriber
     * is a no-op (returns `0`).
     *
     * @returns Number of rows updated.
     */
    private async markSubscriberStatusByEmail(input: {
        email: string;
        status: NewsletterSubscriberStatusEnum;
        timestampColumn: 'bouncedAt' | 'complainedAt' | 'unsubscribedAt';
        date: Date;
    }): Promise<number> {
        const db = getDb();
        const now = new Date();
        const setValues: Record<string, unknown> = {
            status: input.status,
            updatedAt: now,
            [input.timestampColumn]: input.date
        };
        const result = await db
            .update(newsletterSubscribers)
            .set(setValues)
            .where(
                and(
                    eq(newsletterSubscribers.email, input.email),
                    eq(newsletterSubscribers.status, NewsletterSubscriberStatusEnum.ACTIVE),
                    isNull(newsletterSubscribers.deletedAt)
                )
            )
            .returning({ id: newsletterSubscribers.id });
        return result.length;
    }

    /** Pre-built no-match result. */
    private noMatch(reason: string): ProcessBrevoWebhookEventOutput {
        return {
            updated: false,
            matchedByMessageId: false,
            matchedBySubscriberEmail: false,
            skippedReason: reason
        };
    }
}
