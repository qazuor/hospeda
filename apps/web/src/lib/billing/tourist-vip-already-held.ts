/**
 * @file billing/tourist-vip-already-held.ts
 * @description Does this visitor already hold the tourist-VIP benefits?
 * HOS-1233 D-4 / AC-16..AC-19.
 *
 * A visitor with a live subscription in accommodation, gastronomy or
 * experiences already holds every tourist-VIP entitlement — `plans.config.ts`
 * records HOS-975 D-A (owner, 2026-09-01): every one of those tiers spreads
 * `TOURIST_VIP_ENTITLEMENTS` and `TOURIST_VIP_LIMITS` whole, "because a
 * commerce owner is a tourist on this platform too". Selling them the tourist
 * plan takes money for an empty delta, so the card says they already have it
 * and the button is disabled.
 *
 * **This module fails in the opposite direction to
 * `./trial-start-branch.ts`, on purpose.** There, an unknown answer WARNS,
 * because the harm is charging without asking. Here, an unknown answer leaves
 * the button ENABLED, because the harm named by R-7 is the reverse: telling
 * someone they already hold a benefit they do not, which is invisible in
 * testing and costs a sale. F-9 says to copy the codebase's fail-safe
 * asymmetries deliberately rather than reinvent them — these are two, and they
 * point opposite ways because the money moves opposite ways.
 */

/**
 * The verticals whose live subscription blocks a tourist purchase (D-4).
 *
 * Tourist itself is absent: someone already subscribed to tourist is handled
 * by the ordinary plan-change path, not by this predicate. Partner is absent
 * because a partner subscription does not spread the tourist-VIP constants —
 * AC-19's guard is what keeps that assumption honest, since the moment a
 * vertical stops spreading them this predicate starts lying and nothing else
 * would notice.
 */
export const TOURIST_VIP_BLOCKING_DOMAINS = ['accommodation', 'gastronomy', 'experience'] as const;

/** One of the three verticals whose subscription blocks a tourist purchase. */
export type TouristVipBlockingDomain = (typeof TOURIST_VIP_BLOCKING_DOMAINS)[number];

/**
 * Subscription statuses under which the visitor actually holds the benefits.
 *
 * An ALLOWLIST, never a denylist. A denylist ("anything that is not cancelled")
 * fails OPEN: a status added next year would silently start disabling the
 * button for people who can buy. This list only ever grows by a deliberate
 * edit, and {@link holdsTouristVipBenefits} treats everything outside it as
 * "does not hold".
 *
 * Note the wire spellings, which are NOT the domain enum's. The API maps
 * `trialing` to `'trial'` (`routes/user/protected/subscription.ts:53`), and
 * there is no `'comp'` on this side at all — a complimentary subscription
 * arrives as `status: 'active'` with `isComplimentary: true`. A predicate
 * written against the domain spellings would compare `'trialing'`, never
 * match, and read as "not on trial" while failing silently.
 *
 * A status in this list is necessary but NOT sufficient: a soft-cancelled
 * subscription reports `active` on the wire until its period ends and is
 * excluded by {@link holdsTouristVipBenefits} on the `cancelAtPeriodEnd` flag,
 * for AC-17's own reason. See that function.
 *
 * Per-status reasoning, and D-4 only decided the first three:
 *
 * - `active` — the plain case, and the one that also covers `comp` (owner:
 *   treated as active; a perpetual grant sells the same empty delta).
 * - `past_due` — owner's assumption, flagged in D-4 rather than asked:
 *   entitlements still resolve during the 7-day dunning grace. Staging holds a
 *   `past_due` `tourist-vip` row, so this state is not hypothetical.
 * - `courtesy` — NOT decided by D-4, assumed here in the same style as the two
 *   above and flagged for the same reason. A gifted courtesy window grants the
 *   entitlements exactly as `comp` does, so D-4's own principle — "offering
 *   this takes money for an empty delta" — applies unchanged. Reverse it if
 *   the intent was narrower.
 *
 * Deliberately absent:
 *
 * - `trial` — **AC-17, and it is the one a future reader will "simplify".**
 *   Someone mid-trial holds the entitlements today but may not tomorrow;
 *   disabling their tourist purchase would leave them no way to keep the
 *   benefits if they let the trial lapse.
 * - `cancelled`, `expired`, `pending`, `paused` — no live entitlements.
 *
 * A fourth boundary is flagged in the same style as `past_due` and `courtesy`,
 * but it is not a status at all — see `cancelAtPeriodEnd` on
 * {@link SubscriptionStatusReading}.
 */
export const VIP_BENEFIT_HOLDING_STATUSES: ReadonlyArray<string> = [
    'active',
    'past_due',
    'courtesy'
];

/**
 * The two fields this predicate is allowed to read.
 *
 * AC-18 pins the condition to a LIVE subscription — never a role, and never the
 * mere presence of a plan object. Modelling the input as exactly these fields
 * is what makes that structural rather than a promise: there is no role here to
 * accidentally read, and a caller cannot pass "a subscription exists" as the
 * argument.
 *
 * It was one field until a soft-cancelled subscriber was measured hitting the
 * disabled state. Widening it is a real interface change and was preferred to
 * fixing the reader, because this module is the documented home of the rule and
 * a reader-side fix would be invisible to every unit test of the predicate.
 */
export interface SubscriptionStatusReading {
    /** The wire status, as the protected subscription endpoint spells it. */
    readonly status: string;
    /**
     * Whether this subscription is already scheduled to end (a soft cancel).
     *
     * **The fourth flagged boundary, alongside D-4's three** (`trial` excluded,
     * `comp` arriving as active, `past_due` counted as active) — and the only
     * one that is not a status. A soft-cancelled subscription reports
     * `status: 'active'` on the wire right up to `currentPeriodEnd`, so reading
     * the status alone told a subscriber with a known end date "ya tenés estos
     * beneficios" and disabled their tourist purchase. That is verbatim the
     * position AC-17 keeps a `trialing` visitor ENABLED for — "holds the
     * entitlements today but may not tomorrow; disabling would leave them no
     * way to keep the benefits" — and R-7's harm, a claim that becomes false on
     * a date already scheduled.
     *
     * The wire field is required (`z.boolean()` on the protected subscription
     * endpoint), so an ABSENT value can only come from a hand-built reading —
     * and {@link holdsTouristVipBenefits} resolves that to "does not hold",
     * which is this module's fail-safe direction rather than a special case.
     */
    readonly cancelAtPeriodEnd: boolean;
}

/**
 * Whether this visitor already holds the tourist-VIP benefits (AC-16).
 *
 * `status` is typed `string` rather than the eight-value union on purpose. The
 * union describes what the endpoint sends TODAY; a ninth value shipped by a
 * later spec would arrive at runtime regardless, and comparing it against the
 * allowlist is what makes it fall to "does not hold" instead of matching some
 * denylist gap. `test/lib/billing/tourist-vip-already-held.test.ts` pins the
 * eight so a ninth forces a decision rather than passing unnoticed.
 *
 * @param input.subscriptionsByDomain - The visitor's subscription in each
 *   blocking vertical, `null` where they have none. A domain left out of the
 *   record is treated exactly like `null` — an unread domain must never be
 *   assumed to hold benefits.
 * @returns `true` only when at least one blocking vertical carries a status in
 *   {@link VIP_BENEFIT_HOLDING_STATUSES} AND is not already scheduled to end.
 */
export function holdsTouristVipBenefits({
    subscriptionsByDomain
}: {
    readonly subscriptionsByDomain: Readonly<
        Partial<Record<TouristVipBlockingDomain, SubscriptionStatusReading | null>>
    >;
}): boolean {
    return TOURIST_VIP_BLOCKING_DOMAINS.some((domain) => {
        const reading = subscriptionsByDomain[domain];

        // Absent, unread, or no subscription: never a reason to claim the
        // benefit is held. This is the R-7 direction.
        if (reading === null || reading === undefined) {
            return false;
        }

        // Already scheduled to end: holds them today, will not tomorrow.
        // `!== false` and not a plain truthiness check, so an ABSENT flag
        // resolves the same way an absent reading does — to "does not hold",
        // the R-7 direction — instead of silently claiming a benefit.
        if (reading.cancelAtPeriodEnd !== false) {
            return false;
        }

        return VIP_BENEFIT_HOLDING_STATUSES.includes(reading.status);
    });
}
