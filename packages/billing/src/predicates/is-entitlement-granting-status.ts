/**
 * Canonical set of subscription statuses that grant a plan's entitlements
 * *right now*, independent of any date/grace-window consideration.
 *
 * Intended as the single source of truth for the coarse "is this subscription
 * currently live (in an entitlement-granting status)?" question that several
 * call-sites re-implement inline today and drift on. As of this commit
 * (HOS-238) only `entitlement.ts` (`loadEntitlements`) uses it; the remaining
 * call-sites are migrated in HOS-239. Snapshot of the drift being consolidated:
 *
 * - `entitlement.ts` (`loadEntitlements`): `active | trialing | comp` — now
 *   uses this predicate.
 * - `entitlements.ts` route (plan context): `active | trialing` — drops
 *   `comp`, so `GET /me/entitlements` returns `plan: null` for comped
 *   subscribers (the HOS-239 bug; migration pending).
 * - `subscription.ts` (account-management view): `active | trialing |
 *   past_due | paused` — deliberately broader (it renders paused/past_due
 *   subs so the user can resume/pay), but ALSO drops `comp`, so a comped
 *   subscriber's account page shows no subscription. HOS-239 will re-express it
 *   as "this set PLUS the management-only statuses".
 *
 * **Status-only, by design.** It deliberately does NOT look at
 * `currentPeriodEnd` / `trialEnd`. The entitlement finds are status-only
 * finds: an `active` subscription past its period end is still resolved here
 * (cron-lag grace is informational and access is ALWAYS granted — see the
 * cron-lag detection block in `entitlement.ts`). Date-aware liveness (soft-
 * cancel grace, cron-lag windows) is a separate concern owned by
 * {@link isSubscriptionLive}, which the publish gate uses. NOTE:
 * `isSubscriptionLive` does NOT yet recognise `comp` (it returns `false` for
 * it) — so a comped subscriber is currently live for entitlements but not for
 * the date-aware publish gate. Reconciling the two on `comp` is HOS-239 scope.
 *
 * The three entitlement-granting statuses:
 * - `'active'`   — a paid subscription in good standing.
 * - `'trialing'` — a card-first trial (MercadoPago free-trial preapproval,
 *   HOS-171); grants the full plan entitlements during the trial.
 * - `'comp'`     — a permanently-complimentary subscription (SPEC-262); a
 *   comped subscriber retains the full entitlements of the plan they were
 *   comped on. Omitting it is exactly what stranded comp subscribers on
 *   `plan: null` / wrong entitlements (HOS-238 / HOS-239).
 */
export const ENTITLEMENT_GRANTING_STATUSES = ['active', 'trialing', 'comp'] as const;

/**
 * Whether a subscription status grants its plan's entitlements right now
 * (status-only, date-agnostic). See {@link ENTITLEMENT_GRANTING_STATUSES}.
 *
 * @param status - The billing subscription status string.
 * @returns `true` for `'active'`, `'trialing'`, or `'comp'`; `false` otherwise.
 *
 * @example
 * ```ts
 * const activeSub = subscriptions.find(
 *   (sub) => isEntitlementGrantingStatus(sub.status) && isAccommodationSubscription(sub)
 * );
 * ```
 */
export function isEntitlementGrantingStatus(status: string): boolean {
    // Derive from the const set so the two can never drift out of sync.
    return (ENTITLEMENT_GRANTING_STATUSES as readonly string[]).includes(status);
}
