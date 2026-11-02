/**
 * @file subscription-return.ts
 * @description Pure logic of the Mercado Pago return screen (HOS-1979, HOS-1992).
 *
 * The payer comes back from Mercado Pago to `/{lang}/mi-cuenta/suscripcion/?subscription=<id>`
 * (the API composes that `back_url`). The screen reads the REAL status of that
 * attempt and shows one of three outcomes: confirmed, processing, or rejected.
 *
 * Status spelling: this is the API's `SubscriptionRead.status` (upper-case row
 * status, e.g. `CHARGE_DECLINED`), not the domain enum of the old billing.
 */
import { resolveSignupRejection, type SignupRejection } from '@/lib/billing/signup-checkout';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

/** Query parameter holding our subscription id on the return trip. */
export const RETURN_SUBSCRIPTION_PARAM = 'subscription';

/** Poll cadence while the webhook has not arrived: bounded, never open-ended. */
export const RETURN_POLL_INTERVAL_MS = 3000;
/** Maximum number of status reads after the first one (about 30 seconds). */
export const RETURN_POLL_MAX_ATTEMPTS = 10;

/** The outcome the screen renders. */
export type ReturnView =
    | 'confirmed'
    | 'processing'
    | 'stillProcessing'
    | 'rejected'
    | 'closed'
    | 'unknown';

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Read our subscription id from the return URL's query string.
 *
 * Tolerant on purpose: if the provider glued its own `?preapproval_id=` onto a
 * back_url that already had a query, the value arrives as `<uuid>?preapproval_id=...`;
 * only the leading UUID is taken.
 *
 * @param input.search - `Astro.url.search` or `window.location.search`.
 * @returns The subscription id, or `null` when absent or malformed.
 */
export function parseReturnSubscriptionId({ search }: { readonly search: string }): string | null {
    const value = new URLSearchParams(search).get(RETURN_SUBSCRIPTION_PARAM);
    const match = value ? UUID_PREFIX.exec(value) : null;
    return match ? match[0].toLowerCase() : null;
}

/**
 * Map a subscription status read to the outcome shown.
 *
 * Fail-safe direction: anything unrecognised never claims success.
 *
 * @param input.status - `SubscriptionRead.status`, or `null` when the read failed.
 * @param input.pollsExhausted - The bounded polling ended while still pending.
 */
export function resolveReturnView({
    status,
    pollsExhausted
}: {
    readonly status: string | null;
    readonly pollsExhausted: boolean;
}): ReturnView {
    switch (status) {
        case 'ACTIVE':
        case 'CANCEL_SCHEDULED':
            return 'confirmed';
        case 'PENDING_AUTHORIZATION':
            return pollsExhausted ? 'stillProcessing' : 'processing';
        case 'CHARGE_DECLINED':
            return 'rejected';
        case 'ABANDONED':
        case 'CANCELLED':
            return 'closed';
        default:
            return 'unknown';
    }
}

/**
 * Whether another status read should be scheduled.
 *
 * @param input.view - Current outcome.
 * @param input.attempt - Reads already done after the first one.
 */
export function shouldPollAgain({
    view,
    attempt
}: {
    readonly view: ReturnView;
    readonly attempt: number;
}): boolean {
    return view === 'processing' && attempt < RETURN_POLL_MAX_ATTEMPTS;
}

/** Result of the one-click retry. */
export type RetryOutcome =
    | { readonly kind: 'redirect'; readonly url: string }
    | { readonly kind: 'rejected'; readonly rejection: SignupRejection };

/** Minimal slice of `billingSubscriptionApi.start` the retry depends on. */
export type StartCheckout = (input: {
    readonly billingOptionId: string;
    readonly payerEmail: string;
}) => Promise<
    | { readonly ok: true; readonly data: { readonly checkoutUrl: string } }
    | { readonly ok: false; readonly error: unknown }
>;

/**
 * Start ONE new checkout for the same billing option after a rejected attempt.
 *
 * Exactly one call, no loop and no retry on failure: Mercado Pago rate-limits
 * authorizations (HOS-1968), so a throttled answer is surfaced as a message and
 * the person decides when to press again.
 *
 * @param input.start - The start-checkout call (`billingSubscriptionApi.start`).
 * @param input.billingOptionId - Option of the rejected attempt.
 * @param input.payerEmail - Email to declare for the new authorization.
 */
export async function retryCheckout({
    start,
    billingOptionId,
    payerEmail
}: {
    readonly start: StartCheckout;
    readonly billingOptionId: string;
    readonly payerEmail: string;
}): Promise<RetryOutcome> {
    try {
        const result = await start({ billingOptionId, payerEmail });
        if (!result.ok) {
            return { kind: 'rejected', rejection: resolveSignupRejection({ error: result.error }) };
        }
        const url = resolveSafeExternalUrl(result.data.checkoutUrl);
        if (url) return { kind: 'redirect', url };
        return { kind: 'rejected', rejection: resolveSignupRejection({}) };
    } catch {
        return { kind: 'rejected', rejection: resolveSignupRejection({}) };
    }
}
