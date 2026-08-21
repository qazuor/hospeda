/**
 * Classification of errors raised while dispatching a MercadoPago webhook.
 *
 * ## Why this exists (HOS-707)
 *
 * MercadoPago retries any delivery we answer with a 5xx. That is the correct
 * behaviour when WE failed, and the wrong behaviour when the delivery refers to
 * something that can never be processed — a preapproval/payment that does not
 * exist, was deleted, or belongs to another collector. Those deliveries are
 * zombies: every retry re-runs the same lookup, gets the same answer, writes
 * another stack trace, and burns another provider retry slot.
 *
 * The trigger was MercadoPago's own dashboard "test notification" button, which
 * sends the fictitious id `123456`:
 *
 * ```text
 * POST /api/v1/webhooks/mercadopago?source_news=webhooks&data.id=123456&type=subscription_authorized_payment
 * → 500 QZPayMercadoPagoError: Retrieve subscription - The preapproval with id 123456 does not exist
 * ```
 *
 * That `123456` does not exist is CORRECT. Answering 500 is not.
 *
 * ## The three situations this separates
 *
 * 1. **The object does not exist at the provider.** Nothing to do, ever.
 *    → `terminal` → the caller acknowledges with 200.
 * 2. **The object exists but is not ours.** MercadoPago scopes preapprovals and
 *    payments by collector and answers **404**, not 403, for a resource owned by
 *    another account — so at the wire this is indistinguishable from (1) and gets
 *    the same disposition. The local flavour of "not ours" (the fetch succeeds
 *    but no row matches `mp_subscription_id`) never reaches this classifier:
 *    `processSubscriptionUpdated` already returns `success: true` for it.
 * 3. **The provider genuinely failed** — 429, 5xx, timeout, socket error.
 *    → `retryable` → the caller falls through to 5xx and MercadoPago retries,
 *    which is exactly what we want.
 *
 * ## Fail-safe default
 *
 * Anything this module cannot positively identify as terminal is `retryable`.
 * An unrecognised error therefore keeps the pre-HOS-707 behaviour (5xx + retry),
 * so a misclassification can never silently swallow a real failure. In
 * particular `SubscriptionNotResolvedError` (HOS-276 — a settled charge with no
 * resolvable local subscription, deliberately re-thrown to force a retry)
 * carries no provider status and stays `retryable`.
 *
 * ## Error shapes walked
 *
 * `@qazuor/qzpay-mercadopago`'s `mapMercadoPagoError` wraps whatever the
 * MercadoPago SDK threw into a `QZPayMercadoPagoError`:
 *
 * ```ts
 * { name: 'QZPayMercadoPagoError', message, code: QZPayErrorCode, originalError }
 * ```
 *
 * `originalError` is the raw value `mercadopago`'s `RestClient` threw, which for
 * a non-2xx response is the parsed MercadoPago error envelope, NOT an `Error`:
 *
 * ```json
 * { "message": "The preapproval with id 123456 does not exist",
 *   "error": "not_found", "status": 404, "cause": [] }
 * ```
 *
 * The numeric `status` therefore lives one level down, on `originalError`. Note
 * that `code` is NOT a reliable discriminator on its own here: MercadoPago
 * returns `cause: []` for this error, so `mapMercadoPagoError`'s
 * per-`cause[0].code` switch never runs and the wrapper falls through to its
 * generic `provider_error` branch — the exact same code a real outage produces.
 * That is why the walk looks for the nested numeric status first, and only uses
 * the qzpay `code` string as a secondary signal.
 *
 * qzpay-core may additionally wrap the whole thing in a `QZPayProviderSyncError`
 * whose `cause` is the adapter error, so the walk follows `cause` too.
 *
 * @module routes/webhooks/mercadopago/error-classification
 */

/**
 * Whether a webhook dispatch failure can ever succeed on a later delivery.
 *
 * - `terminal` — it cannot. Acknowledge (200) and stop the provider retrying.
 * - `retryable` — it might. Answer 5xx so the provider retries.
 */
export type WebhookErrorDisposition = 'terminal' | 'retryable';

/**
 * Machine-readable reason codes. Emitted in the acknowledgement body and in the
 * structured log so a delivery can be traced back to the branch that decided it.
 */
export type WebhookErrorReason =
    | 'provider-resource-missing'
    | 'provider-rejected-request'
    | 'provider-unavailable'
    | 'provider-unreachable'
    | 'unclassified';

/**
 * Result of {@link classifyWebhookError}.
 */
export interface WebhookErrorClassification {
    /** What the caller should do about it. */
    readonly disposition: WebhookErrorDisposition;
    /** Why — stable string, safe to log and to return in the ack body. */
    readonly reason: WebhookErrorReason;
    /** Numeric HTTP status recovered from the provider error, when present. */
    readonly providerStatus?: number | undefined;
    /** `QZPayMercadoPagoError.code`, when present. */
    readonly providerCode?: string | undefined;
}

/**
 * HTTP statuses from the provider that no retry can turn into a success.
 *
 * - `400` — the request we build is a pure function of the delivery payload, so
 *   an identical retry produces an identical rejection.
 * - `404` — the referenced object does not exist for our credentials (never
 *   existed, was deleted, or belongs to another collector).
 * - `410` — explicitly gone.
 */
const TERMINAL_PROVIDER_STATUSES: ReadonlySet<number> = new Set([400, 404, 410]);

/**
 * `QZPayMercadoPagoError.code` values that map onto a terminal condition.
 *
 * Deliberately excludes `provider_error`, which the adapter also emits for real
 * outages (see the module JSDoc).
 */
const TERMINAL_PROVIDER_CODES: ReadonlySet<string> = new Set([
    'resource_not_found',
    'invalid_request'
]);

/**
 * MercadoPago envelope `error` slugs that mean "no such object".
 * Secondary signal, used only when no numeric status was recovered.
 */
const TERMINAL_PROVIDER_ERROR_SLUGS: ReadonlySet<string> = new Set([
    'not_found',
    'resource_not_found'
]);

/**
 * Node/undici/node-fetch error codes that mean the request never got an answer.
 * Always retryable — the provider was not reached, so it never said anything.
 */
const NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ERR_SOCKET_CONNECTION_TIMEOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET',
    'ABORT_ERR'
]);

/**
 * Error `name`s that mean the request timed out or was aborted in flight.
 */
const NETWORK_ERROR_NAMES: ReadonlySet<string> = new Set([
    'AbortError',
    'FetchError',
    'TimeoutError',
    'ConnectTimeoutError',
    'HeadersTimeoutError'
]);

/**
 * Node cap for the breadth-first `originalError` / `cause` / `response` walk.
 * Bounds the work on a cyclic or pathologically deep chain; six is well past
 * anything qzpay produces (adapter error → MP envelope is two).
 */
const MAX_CHAIN_NODES = 6;

/**
 * Read a numeric field off an unknown object, ignoring non-numeric values.
 *
 * @param node - Candidate object.
 * @param key - Property name to read.
 * @returns The number, or `undefined`.
 */
function readNumber(node: Record<string, unknown>, key: string): number | undefined {
    const value = node[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Read a string field off an unknown object, ignoring non-string values.
 *
 * @param node - Candidate object.
 * @param key - Property name to read.
 * @returns The string, or `undefined`.
 */
function readString(node: Record<string, unknown>, key: string): string | undefined {
    const value = node[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Signals harvested from the whole `originalError` / `cause` chain.
 */
interface ChainSignals {
    readonly status?: number | undefined;
    readonly qzpayCode?: string | undefined;
    readonly errorSlug?: string | undefined;
    readonly networkFailure: boolean;
}

/**
 * Walk the error and every nested `originalError` / `cause` / `response`,
 * collecting the first numeric HTTP status, the first recognised qzpay error
 * code, the first MercadoPago envelope `error` slug, and whether any node in
 * the chain looks like a transport failure.
 *
 * @param error - The value caught by the webhook dispatcher.
 * @returns The harvested signals.
 */
function collectChainSignals(error: unknown): ChainSignals {
    const queue: unknown[] = [error];
    const seen = new Set<unknown>();

    let status: number | undefined;
    let qzpayCode: string | undefined;
    let errorSlug: string | undefined;
    let networkFailure = false;
    let visited = 0;

    while (queue.length > 0 && visited < MAX_CHAIN_NODES) {
        visited += 1;
        const current = queue.shift();

        if (current === null || typeof current !== 'object' || seen.has(current)) {
            continue;
        }
        seen.add(current);

        const node = current as Record<string, unknown>;

        status ??= readNumber(node, 'status') ?? readNumber(node, 'statusCode');

        const rawCode = readString(node, 'code');
        if (rawCode !== undefined) {
            if (NETWORK_ERROR_CODES.has(rawCode)) {
                networkFailure = true;
            } else {
                qzpayCode ??= rawCode;
            }
        }

        const name = readString(node, 'name');
        if (name !== undefined && NETWORK_ERROR_NAMES.has(name)) {
            networkFailure = true;
        }

        errorSlug ??= readString(node, 'error');

        for (const key of ['originalError', 'cause', 'response'] as const) {
            const nested = node[key];
            if (nested !== undefined && nested !== null && typeof nested === 'object') {
                queue.push(nested);
            }
        }
    }

    return { status, qzpayCode, errorSlug, networkFailure };
}

/**
 * Decide whether a webhook dispatch failure should be acknowledged (200) or
 * handed back to the provider as a 5xx so it retries.
 *
 * Decision order — first match wins:
 *
 * 1. Transport failure anywhere in the chain → `retryable` /
 *    `provider-unreachable`. Checked first because a socket error can carry a
 *    stale/absent status that would otherwise be misread.
 * 2. Numeric provider status in {400, 404, 410} → `terminal`.
 * 3. Numeric provider status 408/429/5xx → `retryable`.
 * 4. `QZPayMercadoPagoError.code` in {resource_not_found, invalid_request} →
 *    `terminal`.
 * 5. MercadoPago envelope `error` slug in {not_found, resource_not_found} →
 *    `terminal`.
 * 6. Anything else → `retryable` / `unclassified` (the pre-HOS-707 behaviour).
 *
 * @param error - The value caught by the webhook dispatcher.
 * @returns The classification.
 *
 * @example
 * ```ts
 * const mpError = Object.assign(new Error('Retrieve subscription - ... does not exist'), {
 *     name: 'QZPayMercadoPagoError',
 *     code: 'provider_error',
 *     originalError: { message: '...', error: 'not_found', status: 404, cause: [] }
 * });
 * classifyWebhookError(mpError);
 * // → { disposition: 'terminal', reason: 'provider-resource-missing', providerStatus: 404, ... }
 * ```
 */
export function classifyWebhookError(error: unknown): WebhookErrorClassification {
    const { status, qzpayCode, errorSlug, networkFailure } = collectChainSignals(error);

    const base = { providerStatus: status, providerCode: qzpayCode } as const;

    if (networkFailure) {
        return { disposition: 'retryable', reason: 'provider-unreachable', ...base };
    }

    if (status !== undefined) {
        if (TERMINAL_PROVIDER_STATUSES.has(status)) {
            return {
                disposition: 'terminal',
                reason: status === 400 ? 'provider-rejected-request' : 'provider-resource-missing',
                ...base
            };
        }

        if (status === 408 || status === 429 || status >= 500) {
            return { disposition: 'retryable', reason: 'provider-unavailable', ...base };
        }
    }

    if (qzpayCode !== undefined && TERMINAL_PROVIDER_CODES.has(qzpayCode)) {
        return {
            disposition: 'terminal',
            reason:
                qzpayCode === 'invalid_request'
                    ? 'provider-rejected-request'
                    : 'provider-resource-missing',
            ...base
        };
    }

    if (errorSlug !== undefined && TERMINAL_PROVIDER_ERROR_SLUGS.has(errorSlug)) {
        return { disposition: 'terminal', reason: 'provider-resource-missing', ...base };
    }

    return { disposition: 'retryable', reason: 'unclassified', ...base };
}
