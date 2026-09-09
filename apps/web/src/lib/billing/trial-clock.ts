/**
 * @file billing/trial-clock.ts
 * @description The ONE client-side read of the trial clock a pricing page
 * performs, shared by every island on it. HOS-1233 D-2 / AC-1 / AC-9.
 *
 * ## Why a module-level cache and not a hook
 *
 * A pricing page mounts one `<PlanPurchaseButton>` per card (three on the host
 * page, plus one per column in the comparison table) and one banner. Every one
 * of them asks the same customer-scoped question, so a per-island fetch would
 * issue N identical requests for one answer. `PlanPurchaseButton` already
 * solves this for `getTrialEligibility` with a module-level promise; this is
 * the same pattern, keyed by product domain because — unlike eligibility — the
 * answer differs per vertical.
 *
 * ## The failure direction is inherited, not re-decided
 *
 * A failed, refused or still-pending read resolves to `null`, and `null` is
 * what {@link resolveTrialStartBranch} turns into the WARNING branch (AC-9).
 * That is the opposite of the usual fail-safe here on purpose: the dangerous
 * outcome is not a blocked purchase but an unannounced one. This module must
 * therefore never invent a reading — in particular it must never map a failure
 * onto `{ isOnTrial: false }`, which reads as "no trial to protect" and lands
 * the visitor in a silent charge.
 *
 * The banner reads the same `null` in the opposite direction and that is also
 * AC-9: an unresolved clock renders NO trial promise (AC-8, never "0 días").
 * One value, two consumers, and neither of them guesses.
 *
 * @module lib/billing/trial-clock
 */

import { billingApi } from '../api/endpoints-protected';
import type { TrialClockReading } from './trial-start-branch';

/**
 * The `?productDomain=` values a pricing page may ask the clock about.
 *
 * Exactly the non-null half of {@link resolveTrialScopeForAudience}'s return
 * type. `partner` is absent because `?productDomain=partner` is a 400, not an
 * unused escape hatch — see that function's docblock.
 */
export type TrialClockScope = 'accommodation' | 'tourist' | 'gastronomy' | 'experience';

/** One in-flight (or settled) read per domain, shared by every island. */
const clockPromiseByDomain = new Map<TrialClockScope, Promise<TrialClockReading | null>>();

/**
 * Reads the trial clock for one vertical, at most once per page load.
 *
 * @param input.productDomain - The vertical to scope the read to. A page with
 *   no trial scope must not call this at all rather than pass a stand-in
 *   domain: showing an allies visitor a host's trial is worse than showing
 *   them nothing.
 * @returns The clock, or `null` when the read failed, was refused, or the
 *   caller is not authenticated. `null` means UNKNOWN and never "no trial" —
 *   the two degrade in opposite directions.
 */
export function fetchTrialClock({
    productDomain
}: {
    readonly productDomain: TrialClockScope;
}): Promise<TrialClockReading | null> {
    const cached = clockPromiseByDomain.get(productDomain);
    if (cached) return cached;

    const pending = billingApi
        .getTrialStatus({ productDomain })
        .then((result): TrialClockReading | null => {
            if (!result.ok) return null;
            return {
                isOnTrial: result.data.isOnTrial,
                isExpired: result.data.isExpired,
                daysRemaining: result.data.daysRemaining,
                startedAt: result.data.startedAt
            };
        })
        .catch(() => null);

    clockPromiseByDomain.set(productDomain, pending);
    return pending;
}

/**
 * Drops every cached read.
 *
 * Exists for tests and is called from nowhere else: the cache is a module
 * singleton, so a test file that needs a running trial in one case and none in
 * the next cannot get both without it. Splitting such a pair across two files
 * would work too, but it puts the "banner is absent" assertion and the "banner
 * is present" assertion that keeps it honest in different files — which is
 * exactly how a selector typo passes as a pass.
 */
export function resetTrialClockCache(): void {
    clockPromiseByDomain.clear();
}
