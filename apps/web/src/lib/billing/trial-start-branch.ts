/**
 * @file billing/trial-start-branch.ts
 * @description The ONE module that turns a trial reading into what the
 * "Empezar" button does. HOS-1233 D-2.
 *
 * Until HOS-1233 the button on `/planes/anfitriones/precios/` and
 * `/planes/turistas/precios/` went straight to MercadoPago without ever
 * consulting the trial. A host three days into a 30-day trial was charged on
 * the spot and silently lost the remaining 27 (measured on staging,
 * `staging-tanda-2026-09-07`). This module is the decision that was missing.
 *
 * **It is deliberately the only place a trial reading is turned into a
 * branch.** `test/lib/billing/trial-start-branch-canonical.guard.test.ts` is
 * the web-side twin of the API's
 * `publish-eligibility-canonical-predicate.guard.test.ts` (HOS-1233 F-6 /
 * AC-11) and fails CI on a second call site that compares these branch names
 * inline. Two surfaces deriving the same verdict is the bug HOS-1183 finished
 * fixing one instance of, and R-1 names it as this spec's own risk.
 *
 * **It derives nothing.** The clock's only source is
 * `GET /protected/billing/trial/status?productDomain=…`, whose narrowing runs
 * `hydrateSubscriptionProductDomains` before `subscriptionMatchesDomain` so a
 * live subscription in another vertical cannot mask the answer. This module
 * reads that response and nothing else — no second resolver, no re-derivation.
 */

import type { PricingAudience } from '../billing-i18n';

/**
 * Days remaining at or below which the visitor is sent straight to checkout.
 *
 * AC-6 requires this to be one named constant rather than a literal `3` at a
 * call site, so that moving the threshold is one edit and so the boundary is
 * testable by name. OQ-3 left it a product constant: whether it later becomes
 * plan- or vertical-configurable is a product call, and nothing here needs it
 * to be.
 */
export const TRIAL_WARNING_THRESHOLD_DAYS = 3;

/**
 * What "Empezar" does, per HOS-1233 D-2.
 *
 * - `create_form` — the trial has never started. The visitor goes to step 1 of
 *   that vertical's create form, NOT to payment. Starting a trial is what that
 *   form does; charging them first would sell what they can have free.
 * - `warn_then_checkout` — a trial is running with more than
 *   {@link TRIAL_WARNING_THRESHOLD_DAYS} days left. The days are real value the
 *   charge destroys, so the visitor is told how many they lose and that the
 *   charge is immediate, and may cancel.
 * - `checkout` — either the remaining days are down to the threshold (little
 *   left to lose, and the warning would only add friction to a conversion the
 *   visitor already wants), or there is no running trial to protect.
 */
export type TrialStartBranch = 'create_form' | 'warn_then_checkout' | 'checkout';

/**
 * The fields this decision reads off `billingApi.getTrialStatus()`.
 *
 * Deliberately a structural subset rather than the wrapper's full return type:
 * the decision must not quietly grow a dependency on a field it does not need,
 * and a narrower input is what lets the unit tests state each branch's
 * preconditions exactly.
 */
export interface TrialClockReading {
    /** Whether a trial is running right now for the domain that was asked. */
    readonly isOnTrial: boolean;
    /** Whether a trial ran for this domain and has already elapsed. */
    readonly isExpired: boolean;
    /** Whole days left on a running trial. `null` when none is running. */
    readonly daysRemaining: number | null;
    /** When the trial began; `null` when this domain never had one. */
    readonly startedAt: string | null;
}

/**
 * Which `?productDomain=` value each pricing page asks the trial clock about.
 *
 * `partner` is absent ON PURPOSE and is not an oversight. The API's
 * `ProductDomainScopeEnumSchema` excludes `partner` and `addon` because
 * neither owns a trial site, so `?productDomain=partner` is a 400, not an
 * unused escape hatch. `/planes/aliados/precios/` therefore has no clock to
 * read — and needs none: with no trial running there is nothing to warn about
 * and, per AC-8, no banner to render. Mapping it to `accommodation` "so it
 * returns something" would show an allies visitor a host's trial.
 */
const TRIAL_SCOPE_BY_PRICING_AUDIENCE: Readonly<
    Record<PricingAudience, 'accommodation' | 'tourist' | 'gastronomy' | 'experience' | null>
> = {
    owner: 'accommodation',
    tourist: 'tourist',
    gastronomy: 'gastronomy',
    experience: 'experience',
    partner: null
};

/**
 * The trial-clock scope for a pricing page, or `null` when that page has no
 * trial to read.
 *
 * @param input.audience - The audience the pricing grid was rendered for.
 * @returns The `?productDomain=` value to ask for, or `null` to skip the read
 *   entirely. A `null` means "this vertical has no trial", never "the read
 *   failed" — the two must not collapse, because they degrade in opposite
 *   directions (see {@link resolveTrialStartBranch}).
 */
export function resolveTrialScopeForAudience({
    audience
}: {
    readonly audience: PricingAudience;
}): 'accommodation' | 'tourist' | 'gastronomy' | 'experience' | null {
    return TRIAL_SCOPE_BY_PRICING_AUDIENCE[audience];
}

/**
 * Decides which of the three branches applies for one visitor on one page.
 *
 * The unresolved case is the one that matters most and it is why `reading` is
 * nullable rather than required. **AC-9: a failed or unresolved read degrades
 * toward charging-with-warning, never toward a silent charge.** The usual
 * fail-safe direction is inverted here — the dangerous outcome is not a
 * blocked purchase but an unannounced one, because real money moves and the
 * trial days are gone before the visitor can object. So an absent reading
 * warns rather than proceeding, matching `fetchCommerceTrialVerdict`'s own
 * asymmetry (it falls back to `payment_required`, never `trial_available`:
 * undersell, never over-promise free).
 *
 * The boundary is decided by that same rule rather than by taste. D-2 spells
 * the two live branches as "more than 3" and "fewer than 3" and says nothing
 * about exactly 3; AC-6 requires the boundary to be defined and tested rather
 * than incidental. Exactly {@link TRIAL_WARNING_THRESHOLD_DAYS} days therefore
 * WARNS — the side that asks before taking money.
 *
 * A trial that already elapsed is not a fourth branch. Its days are spent,
 * there is nothing left to lose, and the visitor has to pay to continue — so
 * it goes to checkout exactly as it does today. HOS-1233 changes behaviour
 * only where its acceptance criteria say to.
 *
 * @param input.reading - The clock for this page's vertical, or `null` when
 *   the read failed, has not resolved yet, or the page has no trial scope at
 *   all ({@link resolveTrialScopeForAudience} returned `null`).
 * @returns Which branch the button takes.
 */
export function resolveTrialStartBranch({
    reading
}: {
    readonly reading: TrialClockReading | null;
}): TrialStartBranch {
    // AC-9. An unknown clock must not be read as "no trial to protect".
    if (reading === null) {
        return 'warn_then_checkout';
    }

    // A running trial is the only state with days to lose.
    if (reading.isOnTrial) {
        const daysRemaining = reading.daysRemaining;

        // `isOnTrial` without a usable day count is a contradiction in the
        // payload, not a state to guess at: warn rather than charge silently.
        if (typeof daysRemaining !== 'number' || Number.isNaN(daysRemaining)) {
            return 'warn_then_checkout';
        }

        // `>=`, not `>`. D-2 spells only "more than 3" and "fewer than 3";
        // exactly 3 is the case it leaves open, and AC-9 decides it for the
        // warning side. Flipping this to `>` charges the boundary visitor
        // without asking — which is the whole bug, one day earlier.
        return daysRemaining >= TRIAL_WARNING_THRESHOLD_DAYS ? 'warn_then_checkout' : 'checkout';
    }

    // Never started: the create form is where a trial begins. `startedAt` is
    // the field that separates this from an elapsed trial — `isExpired` alone
    // would send a visitor who never had one to checkout.
    if (!reading.isExpired && reading.startedAt === null) {
        return 'create_form';
    }

    // Elapsed, or otherwise nothing left to protect.
    return 'checkout';
}
