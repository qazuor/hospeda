import { createHmac } from 'node:crypto';

/**
 * MercadoPago webhook helper for E2E tests (SPEC-092 T-034).
 *
 * Simulates a real MP webhook callback by posting a signed HTTP request to
 * the API's `/api/v1/webhooks/mercadopago/*` endpoint. Used by HOST-02,
 * HOST-04, HOST-05, RES-04 because the CI runner has no public URL for MP
 * sandbox to reach (ngrok is OUT — see SPEC-092 spec.md § Operational
 * Decisions).
 *
 * The signed payload format mirrors the MP IPN spec (see
 * `apps/api/src/middlewares/webhook-signature.ts`):
 *
 *   x-signature: ts=<unix_seconds>,v1=<hmac_hex>
 *   HMAC body  : id:<data.id>;request-id:<ts>;ts:<ts>;
 *
 * The helper signs with `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` from env so
 * the API's signature middleware accepts it as if it came from MP itself.
 */

// Port matches apps/e2e/.env.e2e (SSOT). Override via HOSPEDA_E2E_API_URL.
const DEFAULT_API_BASE_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

type SupportedEventType =
    | 'payment.created'
    | 'payment.updated'
    | 'subscription_preapproval.updated'
    | 'payment.dispute'
    | 'chargebacks';

export interface SignWebhookPayloadOptions {
    /** Value used as `data.id` in the body and in the HMAC payload. */
    readonly dataId: string;
    /** Unix timestamp in seconds. Defaults to `Math.floor(Date.now()/1000)`. */
    readonly ts?: number;
    /** Webhook signing secret (matches HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET). */
    readonly secret: string;
}

export interface SignedWebhook {
    /** Header value to send as `x-signature`. */
    readonly signatureHeader: string;
    /** Unix timestamp used during signing. */
    readonly ts: number;
}

/**
 * Computes the HMAC and builds the `x-signature` header value.
 *
 * @example
 * ```ts
 * const { signatureHeader } = signWebhookPayload({
 *     dataId: 'pay_123',
 *     secret: process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET!
 * });
 * ```
 */
export function signWebhookPayload(options: SignWebhookPayloadOptions): SignedWebhook {
    const ts = options.ts ?? Math.floor(Date.now() / 1000);
    const signedPayload = `id:${options.dataId};request-id:${ts};ts:${ts};`;
    const v1 = createHmac('sha256', options.secret).update(signedPayload).digest('hex');
    return {
        signatureHeader: `ts=${ts},v1=${v1}`,
        ts
    };
}

export interface PostWebhookOptions {
    /** MercadoPago event type. */
    readonly type: SupportedEventType;
    /** ID of the entity (payment, subscription, etc.) referenced in `data.id`. */
    readonly dataId: string;
    /** API base URL. Defaults to localhost:3001. */
    readonly baseUrl?: string;
    /**
     * Webhook signing secret. Defaults to
     * `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` from env.
     */
    readonly secret?: string;
    /** Optional extra fields to merge into the body. */
    readonly extraBody?: Record<string, unknown>;
    /** Force a specific timestamp (useful for replay-protection tests). */
    readonly ts?: number;
}

export interface WebhookResponse {
    readonly status: number;
    readonly body: unknown;
}

/**
 * Posts a signed simulated webhook to the API and returns the response.
 *
 * The POST goes to `/api/v1/webhooks/mercadopago/{path}` where `path`
 * matches the event type (the QZPay webhook router dispatches by URL).
 *
 * @example
 * ```ts
 * const res = await postWebhook({
 *     type: 'payment.updated',
 *     dataId: paymentIdFromCheckout,
 *     baseUrl: previewHandle.apiUrl
 * });
 * expect(res.status).toBe(200);
 * ```
 */
export async function postWebhook(options: PostWebhookOptions): Promise<WebhookResponse> {
    const baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL;
    const secret = options.secret ?? process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error(
            'postWebhook: webhook secret not provided and HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET is not set'
        );
    }

    const { signatureHeader, ts } = signWebhookPayload({
        dataId: options.dataId,
        secret,
        ts: options.ts
    });

    const body = {
        action: options.type,
        type: options.type.split('.')[0],
        data: { id: options.dataId },
        date_created: new Date(ts * 1000).toISOString(),
        ...options.extraBody
    };

    const url = `${baseUrl}/api/v1/webhooks/mercadopago/${routeForEvent(options.type)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-signature': signatureHeader,
            // x-request-id mirrors what MP includes; we set it to ts to match
            // the signature payload (`request-id:<ts>`).
            'x-request-id': String(ts)
        },
        body: JSON.stringify(body)
    });

    let parsedBody: unknown;
    try {
        parsedBody = await response.json();
    } catch {
        parsedBody = null;
    }

    return { status: response.status, body: parsedBody };
}

/**
 * Maps event type to the route segment expected by the QZPay webhook router.
 *
 * MP sends `type` in the body, but the router dispatches by URL too. Most
 * deployments accept both `/payment` and `/notifications` as the endpoint;
 * we use `/payment` for payment-* events and `/notifications` for the rest
 * to stay close to the MP IPN convention.
 */
function routeForEvent(type: SupportedEventType): string {
    if (type.startsWith('payment.')) return 'payment';
    return 'notifications';
}

/**
 * Convenience wrapper for the most common scenario in E2E tests:
 * "user just completed checkout, simulate the webhook that confirms
 * payment".
 */
export async function postPaymentApprovedWebhook(options: {
    readonly paymentId: string;
    readonly baseUrl?: string;
}): Promise<WebhookResponse> {
    return postWebhook({
        type: 'payment.updated',
        dataId: options.paymentId,
        baseUrl: options.baseUrl,
        extraBody: {
            user_id: 'mp-test-user',
            api_version: 'v1',
            live_mode: false
        }
    });
}
