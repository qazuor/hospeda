/**
 * MercadoPago webhook IPN payload builders for E2E tests (SPEC-143 T-143-06).
 *
 * Builds the body shape that MercadoPago POSTs to `/api/v1/webhooks/mercadopago`.
 * Always `{ id, type, action, data: { id }, api_version, live_mode, date_created }`.
 *
 * The router in `apps/api/src/routes/webhooks/mercadopago/router.ts` dispatches
 * by combining `type` (or `action` for some variants). Every handler reads
 * `data.id` to fetch the full object from MP via the adapter — that fetch is
 * what `mp-stub.ts` intercepts in tests.
 *
 * Pair this with {@link signWebhookPayload} (from `./signature-helpers`) to
 * produce signed headers, then POST to the webhook endpoint.
 *
 * @module test/e2e/helpers/webhook-events
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of an inbound MercadoPago IPN payload.
 */
export interface WebhookEventPayload {
    /** Outer event id (distinct from data.id). */
    readonly id: number;
    /**
     * Top-level event type. One of: `payment`, `subscription_preapproval`,
     * `subscription_authorized_payment`, `chargebacks`.
     */
    readonly type: string;
    /**
     * Specific action that fired the event. Examples:
     * `payment.created`, `payment.updated`, `subscription_preapproval.created`,
     * `chargebacks`, `payment.dispute`.
     */
    readonly action: string;
    /** Payload reference — handlers read `data.id` and fetch the full object. */
    readonly data: { readonly id: string };
    readonly api_version?: string;
    readonly live_mode?: boolean;
    readonly date_created?: string;
}

interface WebhookBuilderInput {
    /** Outer event id (random when omitted). */
    readonly eventId?: number;
    /** ISO date_created (current time when omitted). */
    readonly dateCreated?: string;
    /** live_mode flag (false when omitted). */
    readonly liveMode?: boolean;
}

interface PaymentEventInput extends WebhookBuilderInput {
    readonly paymentId: string;
}

interface PreapprovalEventInput extends WebhookBuilderInput {
    readonly preapprovalId: string;
}

interface AuthorizedPaymentEventInput extends WebhookBuilderInput {
    readonly paymentId: string;
    readonly preapprovalId: string;
}

// ---------------------------------------------------------------------------
// Internal defaults
// ---------------------------------------------------------------------------

function defaultEventId(): number {
    return Math.floor(Math.random() * 1_000_000_000) + 100_000_000;
}

function defaultDateCreated(): string {
    return new Date().toISOString();
}

function baseEvent(input: WebhookBuilderInput): {
    readonly id: number;
    readonly api_version: string;
    readonly live_mode: boolean;
    readonly date_created: string;
} {
    return {
        id: input.eventId ?? defaultEventId(),
        api_version: 'v1',
        live_mode: input.liveMode ?? false,
        date_created: input.dateCreated ?? defaultDateCreated()
    };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Builders for inbound webhook payloads keyed by MP event type. Each builder
 * returns a fully-formed `WebhookEventPayload` ready to `JSON.stringify` into
 * the test's POST body.
 */
export const webhookEventFixtures = {
    paymentCreated(input: PaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'payment',
            action: 'payment.created',
            data: { id: input.paymentId }
        };
    },
    paymentUpdated(input: PaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'payment',
            action: 'payment.updated',
            data: { id: input.paymentId }
        };
    },
    subscriptionPreapprovalCreated(input: PreapprovalEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'subscription_preapproval',
            action: 'subscription_preapproval.created',
            data: { id: input.preapprovalId }
        };
    },
    subscriptionPreapprovalUpdated(input: PreapprovalEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'subscription_preapproval',
            action: 'subscription_preapproval.updated',
            data: { id: input.preapprovalId }
        };
    },
    subscriptionAuthorizedPaymentCreated(input: AuthorizedPaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'subscription_authorized_payment',
            action: 'subscription_authorized_payment.created',
            data: { id: input.paymentId }
        };
    },
    subscriptionAuthorizedPaymentUpdated(input: AuthorizedPaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'subscription_authorized_payment',
            action: 'subscription_authorized_payment.updated',
            data: { id: input.paymentId }
        };
    },
    chargebackOpened(input: PaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'chargebacks',
            action: 'chargebacks',
            data: { id: input.paymentId }
        };
    },
    paymentDispute(input: PaymentEventInput): WebhookEventPayload {
        return {
            ...baseEvent(input),
            type: 'payment',
            action: 'payment.dispute',
            data: { id: input.paymentId }
        };
    }
} as const;
