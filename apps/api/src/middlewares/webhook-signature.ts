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
 * id:<dataId>;request-id:<x-request-id>;ts:<ts>;
 * ```
 * where:
 * - `dataId` is the lowercased `data.id` value (from query param or body)
 * - `x-request-id` is the value of the `x-request-id` HTTP header
 * - `ts` is the Unix timestamp from the `x-signature` header
 *
 * Reference: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
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

/** Name of the HTTP header that carries the MercadoPago request id. */
const REQUEST_ID_HEADER = 'x-request-id';

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
 * Extract the `data.id` value from the request query string.
 *
 * MP sends webhooks with the id available as either `?data.id=…` (Webhooks v1
 * format) or `?id=…` (legacy IPN). The signed manifest uses the URL value, so
 * we prefer the query over the body.
 *
 * Returns `null` when neither parameter is present.
 */
function extractDataIdFromQuery(c: Context): string | null {
    const fromDataDotId = c.req.query('data.id');
    if (fromDataDotId) return fromDataDotId;
    const fromId = c.req.query('id');
    if (fromId) return fromId;
    return null;
}

/**
 * Extract the `data.id` field from the raw JSON request body.
 *
 * Fallback for payload variants that only carry the id in the body. Returns
 * `null` when the body is not valid JSON or the field is absent.
 */
function extractDataIdFromBody(rawBody: string): string | null {
    if (!rawBody) return null;
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
 * The signed payload (manifest) format per MP docs is:
 * ```
 * id:<dataId>;request-id:<requestId>;ts:<ts>;
 * ```
 *
 * @param params - Parameters for HMAC computation
 * @param params.dataId - Value of `data.id` (lowercased, see {@link normalizeDataId})
 * @param params.requestId - Value of the `x-request-id` HTTP header
 * @param params.ts - Unix timestamp from the `x-signature` header
 * @param params.secret - Webhook signing secret
 * @returns Lowercase hex HMAC-SHA256 digest
 */
function computeExpectedSignature({
    dataId,
    requestId,
    ts,
    secret
}: {
    readonly dataId: string;
    readonly requestId: string;
    readonly ts: number;
    readonly secret: string;
}): string {
    const signedPayload = `id:${dataId};request-id:${requestId};ts:${ts};`;
    return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Normalize `data.id` values to lowercase before HMAC computation.
 *
 * MP docs note that alphanumeric `data.id` values may arrive uppercased on the
 * URL but must be used in lowercase when constructing the manifest. Numeric ids
 * are unaffected. We apply this defensively to every id.
 */
function normalizeDataId(value: string): string {
    return value.toLowerCase();
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
 * 1. Reads the `x-signature` (`ts=<unix>,v1=<hmac-hex>`) and `x-request-id`
 *    headers.
 * 2. Validates the timestamp against the server clock (replay protection).
 * 3. Extracts `data.id` from either the query string (`?data.id=...` or
 *    `?id=...`) or the JSON body.
 * 4. Recomputes the HMAC-SHA256 over
 *    `id:<dataId>;request-id:<requestId>;ts:<ts>;` using
 *    `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`.
 * 5. Compares signatures via `crypto.timingSafeEqual`.
 * 6. Calls `next()` on success or throws `HTTPException(401)` on failure.
 *
 * When `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is not configured the middleware
 * fails closed in production (`HTTPException(503)`); in non-production
 * environments it logs a warning and passes the request through without
 * verification, so local dev / CI without billing configured can still boot
 * and exercise the route.
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

        // When the secret is not configured we fail closed in production
        // (defense in depth — even though the adapter factory also enforces
        // this, the webhook endpoint must never accept unverified payloads
        // in prod). In non-production we keep the legacy warn-and-pass
        // behaviour so local dev / CI without billing configured can still
        // boot and exercise the route.
        if (!secret) {
            if (env.NODE_ENV === 'production') {
                apiLogger.error(
                    { path: c.req.path },
                    'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET is not set in production — rejecting webhook request'
                );
                throw new HTTPException(503, {
                    message: 'Webhook signature verification is not configured'
                });
            }

            apiLogger.warn(
                'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET is not set — webhook signature verification skipped'
            );
            await next();
            return;
        }

        // ----------------------------------------------------------------
        // 1. Extract and parse the signature + request-id headers
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

        const requestId = c.req.header(REQUEST_ID_HEADER);

        if (!requestId) {
            apiLogger.warn(
                { path: c.req.path },
                'Webhook request missing x-request-id header — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Missing x-request-id header'
            });
        }

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
        // 3. Extract data.id (query string preferred — MP signs using the
        //    URL value, see docs; falls back to JSON body for compatibility
        //    with payloads that omit it from the query).
        // ----------------------------------------------------------------
        const dataId = extractDataIdFromQuery(c) ?? extractDataIdFromBody(await c.req.text());

        if (!dataId) {
            apiLogger.warn(
                { path: c.req.path },
                'Webhook request missing data.id (query and body) — rejecting'
            );
            throw new HTTPException(401, {
                message: 'Webhook missing required data.id'
            });
        }

        const normalizedDataId = normalizeDataId(dataId);

        // ----------------------------------------------------------------
        // 4 & 5. Compute expected signature and compare (timing-safe)
        // ----------------------------------------------------------------
        const expectedSignature = computeExpectedSignature({
            dataId: normalizedDataId,
            requestId,
            ts,
            secret
        });

        if (!safeCompareHex(expectedSignature, receivedSignature)) {
            // TEMPORARY DIAGNOSTIC LOG (SPEC-143 smoke 2026-05-21): when
            // signature does not match, dump enough info to compare manifests
            // and HMAC fragments byte-by-byte against what MP sent. Remove or
            // downgrade to debug once root cause is identified.
            //
            // Hypothesis under test: the reverse proxy stack (Cloudflare /
            // Traefik / Coolify) overwrites the `x-request-id` header that MP
            // signs with. Railway had the exact same bug (see
            // https://station.railway.com/questions/railway-is-overwriting-an-important-head-2026cdb4).
            // Dumping every request header lets us find where the original
            // value ended up (e.g. `x-original-request-id`, `cf-ray`).
            const signedPayloadDiagnostic = `id:${normalizedDataId};request-id:${requestId};ts:${ts};`;
            const allHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(c.req.header())) {
                allHeaders[key] = value;
            }
            apiLogger.warn(
                {
                    path: c.req.path,
                    dataId: normalizedDataId,
                    requestId,
                    ts,
                    manifest: signedPayloadDiagnostic,
                    expectedHmacPrefix: expectedSignature.substring(0, 24),
                    receivedHmacPrefix: receivedSignature.substring(0, 24),
                    rawSignatureHeader: signatureHeader,
                    queryString: c.req.url.split('?')[1] ?? '',
                    bodyDataIdSeen: extractDataIdFromQuery(c) ?? '(via body fallback)',
                    allRequestHeaders: allHeaders
                },
                'Webhook signature mismatch — rejecting (with diagnostic dump)'
            );
            throw new HTTPException(401, {
                message: 'Webhook signature verification failed'
            });
        }

        apiLogger.debug(
            { path: c.req.path, dataId: normalizedDataId, requestId, ts },
            'Webhook signature verified'
        );

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
