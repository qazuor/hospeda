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

import { apiLogger } from './logger';

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
    /**
     * `coupon_amount` from the inner payment block, in MAJOR units — the
     * discount MercadoPago's OWN campaign engine applied to this charge.
     *
     * Hospeda never sets this on any call path, so a non-zero value means an
     * account-level discount campaign (seller panel → Ofrecer Descuentos)
     * matched the charge and we were paid less than the plan says. See
     * `detectExternalChargeInterference` in `@repo/service-core` (HOS-171 §7.5).
     */
    readonly couponAmount: number | null;
    /**
     * `campaign_id` from the inner payment block — which MercadoPago discount
     * campaign matched. Also never set by us; see {@link couponAmount}.
     */
    readonly campaignId: string | null;
    /**
     * `payer_id` — MercadoPago's own user ID for the subscriber who is being
     * charged, reported as a TOP-LEVEL field on the authorized-payment
     * resource (NOT nested under `payment`). Unlike `preapproval_id` /
     * `transaction_amount` / `currency_id` / `status`, this is treated as
     * OPTIONAL rather than required: it is only consumed to back-fill
     * `billing_customers.mp_customer_id` (HOS-225 defect #4), a best-effort
     * enrichment, so its absence must never fail the whole parse and block
     * payment recording.
     */
    readonly mpPayerId: string | null;
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

        // HOS-234/HOS-233: when the parse found no usable `payer_id`, log the
        // SHAPE of the payload (top-level keys + inner `payment` keys) — never the
        // values, which may be sensitive — so a smoke can CONFIRM whether MP
        // actually sends a `payer_id` on this authorized-payment flow (the leading
        // hypothesis for the NULL `mp_customer_id`). INFO on purpose: it is only
        // needed live during a diagnostic run (`hops logs api -f -g payer`), not
        // as a persistent prod signal (that is the WARN in backfillMpCustomerId).
        if (!parsed.mpPayerId) {
            const paymentKeys =
                raw.payment && typeof raw.payment === 'object'
                    ? Object.keys(raw.payment as Record<string, unknown>)
                    : null;
            apiLogger.info(
                {
                    authorizedPaymentId,
                    topLevelKeys: Object.keys(raw),
                    paymentKeys,
                    payerIdType: typeof raw.payer_id
                },
                'MercadoPago authorized_payment: no usable payer_id — logging payload shape for HOS-233 root-cause confirmation'
            );
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

    // MercadoPago reports the subscriber's own user id as a top-level
    // `payer_id` on the authorized-payment resource (numeric in practice,
    // per MP's SDK — see `InvoiceResponse.payer_id?: number` in
    // sdk-nodejs). Coerce defensively and degrade to null rather than fail
    // the whole parse — HOS-225 #4 only uses it as a best-effort enrichment.
    let mpPayerId: string | null = null;
    if (typeof raw.payer_id === 'number') {
        mpPayerId = String(raw.payer_id);
    } else if (typeof raw.payer_id === 'string' && raw.payer_id.length > 0) {
        mpPayerId = raw.payer_id;
    }

    let paymentId: string | null = null;
    let paymentStatus: string | null = null;
    // MercadoPago reports its own campaign discounts on the inner payment block.
    // Read defensively: absent is the normal case (no campaign matched), and a
    // malformed value must degrade to null rather than break payment recording.
    let couponAmount: number | null = null;
    let campaignId: string | null = null;
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
        if (typeof p.coupon_amount === 'number') {
            couponAmount = p.coupon_amount;
        }
        if (typeof p.campaign_id === 'number') {
            campaignId = String(p.campaign_id);
        } else if (typeof p.campaign_id === 'string' && p.campaign_id.length > 0) {
            campaignId = p.campaign_id;
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
        debitDate,
        couponAmount,
        campaignId,
        mpPayerId
    };
}

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    parseAuthorizedPaymentResponse
};
