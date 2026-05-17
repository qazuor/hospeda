/**
 * MercadoPago Authorized Payment fetch helper (SPEC-141 D4).
 *
 * Wraps `GET https://api.mercadopago.com/authorized_payments/{id}` because
 * neither `@qazuor/qzpay-core`'s `billing.*` facade nor the MercadoPago
 * SDK 2.12.0 expose an `AuthorizedPayment` resource. The IPN payload
 * for `subscription_authorized_payment.{created,updated}` only carries
 * the authorized-payment ID — resolving the linked `preapproval_id`,
 * `transaction_amount`, and real `payment.id` requires this REST call.
 *
 * TODO(SPEC-127/128): drop this helper and migrate callers to the
 * `paymentAdapter.authorizedPayments.get(id)` slot when qzpay-mercadopago
 * adds it. Tracked as a follow-up alongside the addon-checkout migration.
 *
 * @module utils/mp-authorized-payment
 */

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Parsed authorized-payment response from MercadoPago.
 *
 * Only the fields needed to record a `billing_payments` row are
 * surfaced; the raw payload contains many more attributes (retry_attempt,
 * external_reference, payment_method_id, etc.) that this layer ignores.
 */
export interface MPAuthorizedPaymentDetails {
    /** Authorized payment ID (the input that was used to fetch). */
    readonly authorizedPaymentId: string;
    /** Linked preapproval (subscription) ID. */
    readonly preapprovalId: string;
    /** Charge amount in MAJOR units of `currencyId` (e.g. 999.50 ARS). */
    readonly transactionAmount: number;
    /** ISO 4217 currency code (e.g. `'ARS'`). */
    readonly currencyId: string;
    /** Linked real `payment.id` once the charge resolves; null if pending. */
    readonly paymentId: string | null;
    /** Top-level status: `'scheduled' | 'processed' | 'recycling' | 'cancelled' | ...`. */
    readonly status: string;
    /** Detailed status from the inner payment block, if available. */
    readonly paymentStatus: string | null;
    /** Scheduled debit date (ISO 8601) for this charge. */
    readonly debitDate: string | null;
}

/**
 * Outcome of a {@link fetchAuthorizedPaymentDetails} call.
 *
 * Discriminated union so callers can branch on `kind` without exception
 * handling. Errors are returned as data, not thrown, because the calling
 * webhook handler must always ACK the event regardless of upstream
 * failures.
 */
export type MPAuthorizedPaymentResult =
    | { readonly kind: 'ok'; readonly details: MPAuthorizedPaymentDetails }
    | { readonly kind: 'not-found'; readonly authorizedPaymentId: string }
    | { readonly kind: 'unauthorized'; readonly authorizedPaymentId: string }
    | { readonly kind: 'error'; readonly authorizedPaymentId: string; readonly message: string };

export interface FetchAuthorizedPaymentInput {
    readonly authorizedPaymentId: string;
    readonly accessToken: string;
    /** Override default timeout in milliseconds (default: 10_000). */
    readonly timeoutMs?: number;
    /** Injection seam for tests. Defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
}

/**
 * Fetch an authorized payment from MercadoPago's REST API.
 *
 * Never throws — all error paths are encoded in the returned
 * {@link MPAuthorizedPaymentResult} discriminator.
 */
export async function fetchAuthorizedPaymentDetails(
    input: FetchAuthorizedPaymentInput
): Promise<MPAuthorizedPaymentResult> {
    const {
        authorizedPaymentId,
        accessToken,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        fetchImpl = fetch
    } = input;

    const url = `${MP_API_BASE}/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            },
            signal: controller.signal
        });

        if (response.status === 404) {
            return { kind: 'not-found', authorizedPaymentId };
        }
        if (response.status === 401 || response.status === 403) {
            return { kind: 'unauthorized', authorizedPaymentId };
        }
        if (!response.ok) {
            return {
                kind: 'error',
                authorizedPaymentId,
                message: `MercadoPago authorized_payments returned HTTP ${response.status}`
            };
        }

        const raw = (await response.json()) as Record<string, unknown>;
        const parsed = parseAuthorizedPaymentResponse(raw, authorizedPaymentId);

        if (!parsed) {
            return {
                kind: 'error',
                authorizedPaymentId,
                message: 'MercadoPago authorized_payments response missing required fields'
            };
        }

        return { kind: 'ok', details: parsed };
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return {
                kind: 'error',
                authorizedPaymentId,
                message: `MercadoPago authorized_payments request timed out after ${timeoutMs}ms`
            };
        }
        return {
            kind: 'error',
            authorizedPaymentId,
            message: err instanceof Error ? err.message : String(err)
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Defensive parser for an authorized_payment response.
 *
 * Returns `null` if any required field is missing or has the wrong type.
 * `payment.id` may be absent when the charge has not yet been settled
 * (status `'scheduled'`), so it is treated as optional.
 */
function parseAuthorizedPaymentResponse(
    raw: Record<string, unknown>,
    authorizedPaymentId: string
): MPAuthorizedPaymentDetails | null {
    const preapprovalId = typeof raw.preapproval_id === 'string' ? raw.preapproval_id : null;
    const transactionAmount =
        typeof raw.transaction_amount === 'number' ? raw.transaction_amount : null;
    const currencyId = typeof raw.currency_id === 'string' ? raw.currency_id : null;
    const status = typeof raw.status === 'string' ? raw.status : null;

    if (!preapprovalId || transactionAmount === null || !currencyId || !status) {
        return null;
    }

    const debitDate = typeof raw.debit_date === 'string' ? raw.debit_date : null;

    let paymentId: string | null = null;
    let paymentStatus: string | null = null;
    const payment = raw.payment;
    if (payment && typeof payment === 'object') {
        const p = payment as Record<string, unknown>;
        if (typeof p.id === 'number') {
            paymentId = String(p.id);
        } else if (typeof p.id === 'string') {
            paymentId = p.id;
        }
        if (typeof p.status === 'string') {
            paymentStatus = p.status;
        }
    }

    return {
        authorizedPaymentId,
        preapprovalId,
        transactionAmount,
        currencyId,
        paymentId,
        status,
        paymentStatus,
        debitDate
    };
}

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    parseAuthorizedPaymentResponse
};
