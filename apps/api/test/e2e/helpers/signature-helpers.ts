/**
 * MercadoPago webhook signature helpers for E2E tests (SPEC-143 T-143-06).
 *
 * Builds the `x-signature` header that `apps/api/src/middlewares/webhook-signature.ts`
 * validates. Algorithm mirrors the middleware exactly:
 * - Format: `ts=<unix_seconds>,v1=<hmac-sha256-hex>`
 * - Signed payload: `id:<data.id>;request-id:<ts>;ts:<ts>;`
 * - HMAC key: `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` from env (set in `.env.test`
 *   to `test-webhook-secret-hospeda-spec-143`).
 *
 * Use {@link signWebhookPayload} to build valid headers and
 * {@link invalidSignatureHeaders} to build headers that intentionally fail
 * verification for testing the rejection branches (T-143-16).
 *
 * @module test/e2e/helpers/signature-helpers
 */

import { createHmac, randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Secret accessor
// ---------------------------------------------------------------------------

/**
 * Read the webhook signing secret from the environment. Throws when missing
 * so signature builders fail loud rather than producing a signature the
 * middleware silently rejects.
 *
 * In test runs this comes from `.env.test`.
 */
export function getTestWebhookSecret(): string {
    const secret = process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error(
            'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET is not set. The .env.test file must define it for signature tests to work.'
        );
    }
    return secret;
}

// ---------------------------------------------------------------------------
// Valid signature builder
// ---------------------------------------------------------------------------

interface SignedWebhookHeaders {
    readonly 'x-signature': string;
    readonly 'x-request-id': string;
}

interface SignWebhookPayloadInput {
    /** Raw request body. Pass the exact string the test will POST. */
    readonly body: string;
    /** Optional override; defaults to a fresh UUID. */
    readonly requestId?: string;
    /** Optional override; defaults to `Math.floor(Date.now() / 1000)`. */
    readonly timestamp?: number;
    /** Optional override; defaults to {@link getTestWebhookSecret}. */
    readonly secret?: string;
}

/**
 * Build a valid `x-signature` + `x-request-id` pair for a webhook body.
 *
 * Signed payload format (matches `webhook-signature.ts`):
 *
 * ```
 * id:<data.id>;request-id:<ts>;ts:<ts>;
 * ```
 *
 * @param input - Body + optional overrides
 * @returns Headers ready to spread into a fetch / Hono request init
 * @throws When the body cannot be parsed as JSON, when `data.id` is missing,
 *   or when the signing secret is not configured.
 */
export function signWebhookPayload(input: SignWebhookPayloadInput): SignedWebhookHeaders {
    const secret = input.secret ?? getTestWebhookSecret();
    const ts = input.timestamp ?? Math.floor(Date.now() / 1000);
    const requestId = input.requestId ?? randomUUID();

    const dataId = extractDataIdFromBody(input.body);
    if (!dataId) {
        throw new Error('signWebhookPayload: body does not parse to JSON with a `data.id` field.');
    }

    const signedPayload = `id:${dataId};request-id:${ts};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(signedPayload).digest('hex');

    return {
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': requestId
    };
}

// ---------------------------------------------------------------------------
// Invalid signature builders
// ---------------------------------------------------------------------------

/**
 * Modes for {@link invalidSignatureHeaders}. Each forces a different rejection
 * branch in `webhookSignatureMiddleware`.
 */
export type InvalidSignatureMode =
    | 'missing'
    | 'wrong-hmac'
    | 'wrong-format'
    | 'replayed-timestamp'
    | 'tampered-body';

interface InvalidSignatureInput {
    readonly body: string;
    readonly mode: InvalidSignatureMode;
    readonly requestId?: string;
}

/**
 * Build headers that intentionally fail signature verification.
 *
 * Modes:
 * - `missing`: omits the `x-signature` header.
 * - `wrong-hmac`: valid format + timestamp, signature computed with a
 *   different secret.
 * - `wrong-format`: garbled header value (not parseable into `ts=` + `v1=`).
 * - `replayed-timestamp`: signature is valid for a timestamp older than
 *   the 5-minute tolerance window.
 * - `tampered-body`: signature computed over the ORIGINAL body, but the
 *   caller is expected to send a MODIFIED body — useful for proving that
 *   any body change invalidates the signature.
 *
 * @returns Header dict with `x-request-id` and (conditionally) `x-signature`.
 */
export function invalidSignatureHeaders(input: InvalidSignatureInput): Record<string, string> {
    const requestId = input.requestId ?? randomUUID();

    switch (input.mode) {
        case 'missing': {
            return { 'x-request-id': requestId };
        }
        case 'wrong-format': {
            return {
                'x-signature': 'this-is-not-a-valid-mp-signature-header',
                'x-request-id': requestId
            };
        }
        case 'wrong-hmac': {
            const secret = 'a-completely-different-secret-not-the-real-one';
            return {
                ...signWebhookPayload({ body: input.body, requestId, secret })
            };
        }
        case 'replayed-timestamp': {
            // 10 minutes in the past — exceeds the 5-minute tolerance.
            const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
            return signWebhookPayload({
                body: input.body,
                requestId,
                timestamp: tenMinutesAgo
            });
        }
        case 'tampered-body': {
            // Signature is valid for the body as given. The caller is
            // expected to send a DIFFERENT body in the actual request.
            return signWebhookPayload({ body: input.body, requestId });
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract `data.id` from a JSON string. Mirrors `extractDataId` in the
 * middleware (handles string or number id, returns string).
 */
function extractDataIdFromBody(rawBody: string): string | null {
    try {
        const parsed: unknown = JSON.parse(rawBody);
        if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'data' in parsed &&
            parsed.data !== null &&
            typeof parsed.data === 'object' &&
            'id' in parsed.data
        ) {
            const id = (parsed.data as Record<string, unknown>).id;
            if (typeof id === 'string' || typeof id === 'number') {
                return String(id);
            }
        }
        return null;
    } catch {
        return null;
    }
}
