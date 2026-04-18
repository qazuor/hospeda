/**
 * Webhook signature verification middleware for MercadoPago IPN notifications.
 *
 * Validates incoming webhook requests by verifying the HMAC-SHA256 signature
 * present in the `x-signature` header. Also enforces a timestamp window to
 * prevent replay attacks.
 *
 * ## MercadoPago signature format
 *
 * The `x-signature` header uses the format `ts=<unix_seconds>,v1=<hmac_hex>`.
 * The HMAC is computed over:
 * ```
 * id:<data.id>;request-id:<ts>;ts:<ts>;
 * ```
 * where `data.id` comes from the JSON body and `ts` is the Unix timestamp from
 * the header.
 *
 * ## Replay protection
 *
 * The timestamp embedded in the signature is checked against the server clock.
 * Requests whose timestamp deviates more than `timestampToleranceSecs` seconds
 * (default: 300 — five minutes) are rejected with HTTP 401.
 *
 * @module middlewares/webhook-signature
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default tolerance window in seconds for timestamp replay protection. */
const DEFAULT_TIMESTAMP_TOLERANCE_SECS = 300; // 5 minutes

/** Name of the HTTP header that carries the MercadoPago signature. */
const SIGNATURE_HEADER = 'x-signature';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Result of parsing the `x-signature` header value.
 */
interface ParsedSignature {
    /** Unix timestamp in seconds extracted from the `ts=` component. */
    readonly ts: number;
    /** HMAC-SHA256 hex digest extracted from the `v1=` component. */
    readonly v1: string;
}

/**
 * Parse the `x-signature` header value into its components.
 *
 * Expected format: `ts=<unix_seconds>,v1=<hmac_hex>`
 *
 * @param headerValue - Raw value of the `x-signature` header
 * @returns Parsed components or `null` when the format is invalid
 */
function parseSignatureHeader(headerValue: string): ParsedSignature | null {
    // Split on comma, then parse key=value pairs
    const parts = headerValue.split(',');
    const map: Record<string, string> = {};

    for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) return null;
        const key = part.slice(0, eqIdx).trim();
        const value = part.slice(eqIdx + 1).trim();
        if (key && value) {
            map[key] = value;
        }
    }

    const tsRaw = map.ts;
    const v1 = map.v1;

    if (!tsRaw || !v1) return null;

    const ts = Number(tsRaw);
    if (!Number.isFinite(ts) || ts <= 0) return null;

    return { ts, v1 };
}

/**
 * Extract the `data.id` field from the raw request body.
 *
 * MercadoPago IPN payloads always contain a top-level `data.id` string that
 * is included in the signed payload.
 *
 * @param rawBody - Raw UTF-8 request body
 * @returns The `data.id` value or `null` when the body is not parseable or the
 *   field is absent
 */
function extractDataId(rawBody: string): string | null {
    try {
        const parsed: unknown = JSON.parse(rawBody);
        if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'data' in parsed &&
            parsed.data !== null &&
            typeof parsed.data === 'object' &&
            'id' in parsed.data &&
            (typeof (parsed.data as Record<string, unknown>).id === 'string' ||
                typeof (parsed.data as Record<string, unknown>).id === 'number')
        ) {
            return String((parsed.data as Record<string, unknown>).id);
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Compute the expected HMAC-SHA256 hex digest for a MercadoPago webhook.
 *
 * The signed payload format is:
 * ```
 * id:<dataId>;request-id:<ts>;ts:<ts>;
 * ```
 *
 * @param params - Parameters for HMAC computation
 * @param params.dataId - Value from `data.id` in the webhook body
 * @param params.ts - Unix timestamp from the `x-signature` header
 * @param params.secret - Webhook signing secret
 * @returns Lowercase hex HMAC-SHA256 digest
 */
function computeExpectedSignature({
    dataId,
    ts,
    secret
}: {
    readonly dataId: string;
    readonly ts: number;
    readonly secret: string;
}): string {
    const signedPayload = `id:${dataId};request-id:${ts};ts:${ts};`;
    return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Perform a constant-time comparison of two hex strings.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing-based side-channel attacks.
 * Both strings are encoded to UTF-8 buffers before comparison; strings of
 * differing lengths always return `false` without leaking length information
 * via timing (because comparison is skipped entirely).
 *
 * @param a - First hex string
 * @param b - Second hex string
 * @returns `true` when both strings are identical
 */
function safeCompareHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Middleware options
// ---------------------------------------------------------------------------

/**
 * Configuration options for {@link createWebhookSignatureMiddleware}.
 */
export interface WebhookSignatureOptions {
    /**
     * Maximum age in seconds that a webhook timestamp may differ from the
     * server clock before the request is rejected as a potential replay.
     *
     * @default 300 (5 minutes)
     */
    readonly timestampToleranceSecs?: number;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Create a Hono middleware that verifies MercadoPago webhook signatures.
 *
 * The middleware:
 * 1. Reads the `x-signature` header (`ts=<unix>,v1=<hmac-hex>`).
 * 2. Validates the timestamp against the server clock (replay protection).
 * 3. Reads the raw request body and extracts `data.id`.
 * 4. Recomputes the HMAC-SHA256 over `id:<dataId>;request-id:<ts>;ts:<ts>;`
 *    using `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`.
 * 5. Compares signatures via `crypto.timingSafeEqual`.
 * 6. Calls `next()` on success or throws `HTTPException(401)` on failure.
 *
 * When `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is not configured the middleware
 * logs a warning and passes the request through without verification. This
 * allows the API to start in environments where billing is not yet configured.
 *
 * @param options - Optional configuration (see {@link WebhookSignatureOptions})
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createWebhookSignatureMiddleware } from '../../middlewares/webhook-signature';
 *
 * mercadoPagoRouter.use('*', createWebhookSignatureMiddleware());
 * mercadoPagoRouter.post('/', handler);
 * ```
 */
export function createWebhookSignatureMiddleware(
    options: WebhookSignatureOptions = {}
): MiddlewareHandler {
    const toleranceSecs = options.timestampToleranceSecs ?? DEFAULT_TIMESTAMP_TOLERANCE_SECS;

    return async (c: Context, next: Next): Promise<void> => {
        const secret = env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET;

        // When the secret is not configured, skip verification with a warning.
        // This avoids hard failures in environments where billing is not set up.
        if (!secret) {
            apiLogger.warn(
                'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET is not set — webhook signature verification skipped'
            );
            await next();
            return;
        }

        // ----------------------------------------------------------------
        // 1. Extract and parse the signature header
        // ----------------------------------------------------------------
        const signatureHeader = c.req.header(SIGNATURE_HEADER);

        if (!signatureHeader) {
            apiLogger.warn(
                { path: c.req.path },
                'Webhook request missing x-signature header — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Missing webhook signature'
            });
        }

        const parsed = parseSignatureHeader(signatureHeader);

        if (!parsed) {
            apiLogger.warn(
                { path: c.req.path, headerValue: signatureHeader },
                'Webhook x-signature header has invalid format — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Invalid webhook signature format'
            });
        }

        const { ts, v1: receivedSignature } = parsed;

        // ----------------------------------------------------------------
        // 2. Replay protection — check timestamp window
        // ----------------------------------------------------------------
        const nowSecs = Math.floor(Date.now() / 1000);
        const ageSecs = Math.abs(nowSecs - ts);

        if (ageSecs > toleranceSecs) {
            apiLogger.warn(
                {
                    path: c.req.path,
                    ts,
                    nowSecs,
                    ageSecs,
                    toleranceSecs
                },
                'Webhook timestamp outside tolerance window — potential replay attack, rejecting'
            );
            throw new HTTPException(401, {
                message: 'Webhook timestamp is outside the allowed window'
            });
        }

        // ----------------------------------------------------------------
        // 3. Read raw body and extract data.id
        // ----------------------------------------------------------------
        const rawBody = await c.req.text();

        if (!rawBody) {
            apiLogger.warn({ path: c.req.path }, 'Webhook request has empty body — rejecting');
            throw new HTTPException(401, {
                message: 'Webhook request body is empty'
            });
        }

        const dataId = extractDataId(rawBody);

        if (!dataId) {
            apiLogger.warn(
                { path: c.req.path },
                'Webhook body does not contain data.id field — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Webhook body missing required data.id field'
            });
        }

        // ----------------------------------------------------------------
        // 4 & 5. Compute expected signature and compare (timing-safe)
        // ----------------------------------------------------------------
        const expectedSignature = computeExpectedSignature({ dataId, ts, secret });

        if (!safeCompareHex(expectedSignature, receivedSignature)) {
            apiLogger.warn(
                { path: c.req.path, dataId, ts },
                'Webhook signature mismatch — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Webhook signature verification failed'
            });
        }

        apiLogger.debug({ path: c.req.path, dataId, ts }, 'Webhook signature verified');

        await next();
    };
}

// ---------------------------------------------------------------------------
// Convenience export — pre-built middleware with default options
// ---------------------------------------------------------------------------

/**
 * Pre-built webhook signature middleware with default options (5-minute window).
 *
 * Use {@link createWebhookSignatureMiddleware} when you need to customize the
 * timestamp tolerance.
 *
 * @example
 * ```typescript
 * import { webhookSignatureMiddleware } from '../../middlewares/webhook-signature';
 *
 * mercadoPagoRouter.use('*', webhookSignatureMiddleware);
 * ```
 */
export const webhookSignatureMiddleware: MiddlewareHandler = createWebhookSignatureMiddleware();
