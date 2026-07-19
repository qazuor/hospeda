/**
 * MercadoPago Preapproval → `preapproval_plan_id` lookup (HOS-191 F3).
 *
 * `QZPayProviderSubscription` (the typed shape `paymentAdapter.subscriptions.retrieve()`
 * returns) surfaces `externalReference` and `payerEmail` but NOT the MercadoPago
 * `preapproval_plan_id` the preapproval was created against — the qzpay-mercadopago
 * adapter's `mapToProviderSubscription` never reads that field off the raw response.
 *
 * The share-link checkout webhook fallback (`linkPreapprovalToLocalSub`'s
 * reconcile-candidates path, used when a `subscription_preapproval` webhook arrives
 * with NO `external_reference` — the customer authorized on MercadoPago but never
 * came back through the `back_url` handler) needs exactly this field to narrow
 * `billing_pending_checkouts` candidates by `mpPreapprovalPlanId` (the plan the
 * checkout redirected to). Without it, reconciliation could only key on
 * `payerEmail` + a time window, which is far weaker.
 *
 * This wraps `GET https://api.mercadopago.com/preapproval/{id}` directly, mirroring
 * `mp-authorized-payment.ts`'s established pattern for reaching a raw MP field the
 * typed qzpay adapter does not expose.
 *
 * @module utils/mp-preapproval-plan-lookup
 */

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Input for {@link fetchPreapprovalPlanId}.
 */
export interface FetchPreapprovalPlanIdInput {
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
 * Outcome of {@link fetchPreapprovalPlanId}. Never throws — all error paths are
 * encoded here so the caller (a best-effort reconciliation fallback) can degrade
 * gracefully instead of propagating a network failure into the webhook handler.
 */
export type FetchPreapprovalPlanIdResult =
    | { readonly kind: 'ok'; readonly preapprovalPlanId: string | null }
    | { readonly kind: 'not-found' }
    | { readonly kind: 'unauthorized' }
    | { readonly kind: 'error'; readonly message: string };

/**
 * Fetch a MercadoPago preapproval's `preapproval_plan_id` via the raw REST API.
 *
 * `preapproval_plan_id` is `null` on the response for an ad-hoc (non-plan-based)
 * preapproval — Path C always creates plan-based preapprovals, so a `null` here
 * for a share-link checkout preapproval is itself a signal worth logging, but is
 * not treated as an error by this function (the caller decides what to do with it).
 *
 * @param input - Preapproval id, access token, and optional timeout/fetch override.
 * @returns Typed result; never throws.
 */
export async function fetchPreapprovalPlanId(
    input: FetchPreapprovalPlanIdInput
): Promise<FetchPreapprovalPlanIdResult> {
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
        const preapprovalPlanId =
            typeof raw.preapproval_plan_id === 'string' && raw.preapproval_plan_id.length > 0
                ? raw.preapproval_plan_id
                : null;

        return { kind: 'ok', preapprovalPlanId };
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
