/**
 * @file checkout-pending.ts
 * @description Shared sessionStorage plumbing for the paid-checkout return flow
 * (HOS-151 Bug A).
 *
 * A recurring MercadoPago preapproval redirect back to the checkout success
 * page carries NO `collection_status` and no local subscription id — MP only
 * appends its own `preapproval_id`. So the page cannot know which local
 * subscription to poll. To bridge that gap, `PlanPurchaseButton` stashes the
 * `localSubscriptionId` returned by `createCheckout` here BEFORE redirecting to
 * MercadoPago, and the `CheckoutStatusPoller` island reads it back on return to
 * poll `GET /billing/subscriptions/:localId/status` until the subscription
 * activates.
 *
 * The value is intentionally scoped to `sessionStorage` (per-tab, cleared on
 * tab close) and cleared as soon as polling resolves, so a stale id never
 * leaks into a later, unrelated checkout.
 *
 * All accessors are defensive: `sessionStorage` can throw (Safari private
 * mode, disabled storage, SSR) — every failure degrades to a no-op / `null`.
 */

/** sessionStorage key holding the pending local subscription id (single source). */
export const CHECKOUT_PENDING_SUB_KEY = 'hospeda:checkout:pendingSubscriptionId';

/**
 * Persist the local subscription id of an in-flight paid checkout before the
 * MercadoPago redirect. No-op on any storage failure.
 *
 * @param localId - The local subscription UUID from `createCheckout`.
 */
export function storePendingCheckoutSubId(localId: string): void {
    try {
        window.sessionStorage.setItem(CHECKOUT_PENDING_SUB_KEY, localId);
    } catch {
        // sessionStorage unavailable (private mode / disabled) — the success
        // page falls back to its "check your account" state, no crash.
    }
}

/**
 * Read the pending local subscription id set before a checkout redirect.
 *
 * @returns The stored UUID, or `null` when absent or storage is unavailable.
 */
export function readPendingCheckoutSubId(): string | null {
    try {
        const value = window.sessionStorage.getItem(CHECKOUT_PENDING_SUB_KEY);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

/**
 * Clear the pending local subscription id once polling resolves (success or
 * timeout) so it can never bleed into a later checkout. No-op on failure.
 */
export function clearPendingCheckoutSubId(): void {
    try {
        window.sessionStorage.removeItem(CHECKOUT_PENDING_SUB_KEY);
    } catch {
        // Nothing to clean up if storage is unavailable.
    }
}
