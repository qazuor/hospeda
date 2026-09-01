/**
 * MercadoPago Preapproval → real trial window lookup (HOS-936).
 *
 * `QZPayProviderSubscription` — the typed shape
 * `paymentAdapter.subscriptions.retrieve()` returns — is a closed camelCase
 * object built by qzpay-mercadopago's `mapToProviderSubscription()`. It carries
 * neither `date_created` nor `next_payment_date`, and it hardcodes
 * `trialStart`/`trialEnd` to `null`. So the only two fields that can tell a
 * granted trial from a denied one are not reachable through the adapter at all.
 *
 * This wraps `GET https://api.mercadopago.com/preapproval/{id}` directly,
 * mirroring the established pattern of `mp-preapproval-plan-lookup.ts` and
 * `mp-authorized-payment.ts` for reaching a raw MercadoPago field the typed
 * adapter does not expose.
 *
 * Why the raw GET and not the `search` endpoint: the finding that produced this
 * module verified both, and `search` reports its own inconsistent view. The
 * single-resource GET is the one that agreed with what MercadoPago went on to
 * actually charge.
 *
 * @module utils/mp-preapproval-trial-window
 */

import {
    type DeriveTrialWindowResult,
    readTrialWindowFromPreapprovalPayload
} from '../services/billing/trial-window-derivation.js';

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Input for {@link fetchPreapprovalTrialWindow}.
 */
export interface FetchPreapprovalTrialWindowInput {
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
 * Outcome of {@link fetchPreapprovalTrialWindow}. Never throws — every error
 * path is encoded here so a best-effort caller on the checkout hot path can
 * degrade instead of failing a checkout that MercadoPago already accepted.
 */
export type FetchPreapprovalTrialWindowResult =
    | { readonly kind: 'ok'; readonly window: DeriveTrialWindowResult }
    | { readonly kind: 'not-found' }
    | { readonly kind: 'unauthorized' }
    | { readonly kind: 'error'; readonly message: string };

/**
 * Fetch a preapproval's real trial window from the raw MercadoPago REST API.
 *
 * The verdict is derived from `next_payment_date - date_created`, never from
 * `auto_recurring.free_trial` — see
 * {@link ../services/billing/trial-window-derivation | trial-window-derivation}
 * for the measurement that rules the latter out.
 *
 * A response that parses but carries neither field yields `kind: 'ok'` with an
 * `unknown` window, not an error: the call succeeded, it simply cannot support a
 * verdict, and the caller must leave the stored trial alone.
 *
 * @param input - Preapproval id, access token, and optional timeout/fetch override.
 * @returns Typed result; never throws.
 *
 * @example
 * ```ts
 * const result = await fetchPreapprovalTrialWindow({ preapprovalId, accessToken });
 * if (result.kind === 'ok' && result.window.outcome === 'not-granted') {
 *   // MercadoPago is charging now — do not advertise a free window.
 * }
 * ```
 */
export async function fetchPreapprovalTrialWindow(
    input: FetchPreapprovalTrialWindowInput
): Promise<FetchPreapprovalTrialWindowResult> {
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
                message: `MercadoPago preapproval trial-window lookup returned HTTP ${response.status}`
            };
        }

        const raw = await response.json();

        return { kind: 'ok', window: readTrialWindowFromPreapprovalPayload(raw) };
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return {
                kind: 'error',
                message: `MercadoPago preapproval trial-window lookup timed out after ${timeoutMs}ms`
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
