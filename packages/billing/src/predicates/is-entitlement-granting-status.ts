/**
 * Canonical set of subscription statuses that grant a plan's entitlements
 * *right now*, independent of any date/grace-window consideration.
 *
 * Single source of truth for the coarse "is this subscription currently live
 * (in an entitlement-granting status)?" question that several call-sites used
 * to re-implement inline and drift on. Call-sites that route through it:
 *
 * - `entitlement.ts` (`loadEntitlements`): the entitlement find (HOS-238).
 * - `entitlements.ts` route (plan context): the plan-context find — dropping
 *   `comp` here was what returned `plan: null` for comped subscribers (HOS-239).
 * - `start-paid.ts` (already-subscribed guard): the "has active accommodation
 *   sub" check (HOS-239).
 * - `subscription.ts` (account-management view): composes this set PLUS the
 *   management-only statuses `past_due` / `paused`. It maps `comp` → `active`
 *   in its response and carries a separate `isComplimentary` flag so the UI can
 *   hide the Cancel/Pause/Change-plan self-service actions the (non-comp-aware)
 *   backends reject (HOS-242).
 *
 * **Status-only, by design.** It deliberately does NOT look at
 * `currentPeriodEnd` / `trialEnd`. The entitlement finds are status-only
 * finds: an `active` subscription past its period end is still resolved here
 * (cron-lag grace is informational and access is ALWAYS granted — see the
 * cron-lag detection block in `entitlement.ts`). Date-aware liveness (soft-
 * cancel grace, cron-lag windows) is a separate concern owned by
 * {@link isSubscriptionLive}, which the publish gate uses. The two predicates
 * agree on `comp` (both treat it as live as of HOS-239); `isSubscriptionLive`
 * layers date grace on top for the statuses where a period/trial end matters.
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
