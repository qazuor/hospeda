/**
 * MercadoPago Preapproval → live `transaction_amount` lookup (HOS-991).
 *
 * `QZPayProviderSubscription` (the typed shape `paymentAdapter.subscriptions.retrieve()`
 * returns — `subscription.adapter.ts`'s `mapToProviderSubscription` in
 * `@qazuor/qzpay-mercadopago`) is a CLOSED object: `id`, `status`,
 * `currentPeriodStart`/`currentPeriodEnd`, `cancelAtPeriodEnd`, `canceledAt`,
 * `trialStart`/`trialEnd`, `metadata`, plus a few optional fields. It NEVER
 * includes `auto_recurring`, so any code that reads `retrieve()`'s result for
 * `auto_recurring.transaction_amount` always gets `undefined` — the exact same
 * class of bug HOS-936 found and fixed for `auto_recurring.free_trial` in the
 * webhook handler (see `subscription-logic.ts`'s history for
 * `livePreapprovalHasFreeTrial`).
 *
 * This wraps `GET https://api.mercadopago.com/preapproval/{id}` directly, the
 * SAME established pattern `mp-preapproval-plan-lookup.ts` uses to reach a raw
 * MP field the typed qzpay adapter does not expose.
 *
 * @module utils/mp-preapproval-amount-lookup
 */

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Input for {@link fetchLivePreapprovalAmountMajor}.
 */
export interface FetchLivePreapprovalAmountInput {
    /** The MercadoPago preapproval (subscription) id. */
    readonly preapprovalId: string;
    /** MercadoPago access token (`HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`). */
    readonly accessToken: string;
    /** Override default timeout in milliseconds (default: 10_000). */
    readonly timeoutMs?: number;
    /** Injection seam for tests. Defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
}

/**
 * Outcome of {@link fetchLivePreapprovalAmountMajor}. Never throws — all error
 * paths are encoded here so a caller doing best-effort reconciliation can
 * degrade gracefully instead of propagating a network failure.
 */
export type FetchLivePreapprovalAmountResult =
    | { readonly kind: 'ok'; readonly transactionAmountMajor: number | null }
    | { readonly kind: 'not-found' }
    | { readonly kind: 'unauthorized' }
    | { readonly kind: 'error'; readonly message: string };

/**
 * Fetch a MercadoPago preapproval's live recurring `transaction_amount`
 * (`auto_recurring.transaction_amount`, in ARS **major** units) via the raw
 * REST API.
 *
 * `transactionAmountMajor` is `null` when the response has no
 * `auto_recurring.transaction_amount` number — a real MP response shape the
 * caller must treat the same as "cannot determine the live amount", never as
 * "amount is zero".
 *
 * @param input - Preapproval id, access token, and optional timeout/fetch override.
 * @returns Typed result; never throws.
 */
export async function fetchLivePreapprovalAmountMajor(
    input: FetchLivePreapprovalAmountInput
): Promise<FetchLivePreapprovalAmountResult> {
    const { preapprovalId, accessToken, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = input;

    const url = `${MP_API_BASE}/preapproval/${encodeURIComponent(preapprovalId)}`;

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
            return { kind: 'not-found' };
        }
        if (response.status === 401 || response.status === 403) {
            return { kind: 'unauthorized' };
        }
        if (!response.ok) {
            return {
                kind: 'error',
                message: `MercadoPago preapproval lookup returned HTTP ${response.status}`
            };
        }

        const raw = (await response.json()) as Record<string, unknown>;
        const autoRecurring =
            typeof raw.auto_recurring === 'object' && raw.auto_recurring !== null
                ? (raw.auto_recurring as Record<string, unknown>)
                : {};
        const transactionAmountMajor =
            typeof autoRecurring.transaction_amount === 'number'
                ? autoRecurring.transaction_amount
                : null;

        return { kind: 'ok', transactionAmountMajor };
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return {
                kind: 'error',
                message: `MercadoPago preapproval lookup timed out after ${timeoutMs}ms`
            };
        }
        return {
            kind: 'error',
            message: err instanceof Error ? err.message : String(err)
        };
    } finally {
        clearTimeout(timeoutId);
    }
}
