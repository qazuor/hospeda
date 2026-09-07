/**
 * Commerce local trial: the verdict, and the grant (HOS-1184).
 *
 * This module is the commerce half of what `accommodation-publish-deps.ts` does
 * for accommodation, and it exists because HOS-1012 built only that half.
 *
 * The history matters, because the missing piece is not a feature nobody wrote —
 * it is a regression. HOS-590 routed commerce through the same trial resolution
 * the accommodation checkout used. HOS-1012 then removed MercadoPago's
 * `free_trial` from EVERY vertical (MP grants a preapproval's trial once per
 * `(payer, preapproval_plan)` and reports a spent one identically to a live one;
 * in production it charged ARS 18.000 one hundred and eighteen seconds after
 * promising fourteen free days — HOS-522) and rebuilt the Hospeda-owned
 * replacement for accommodation ONLY. Commerce was left with `trialDays: 0`
 * hardcoded into its checkout and no local trial to replace it, so a restaurant
 * owner pays from day one while `/planes/gastronomia` promises them thirty free
 * days in three languages — reading `trialDays` live from the same database
 * column the checkout ignores.
 *
 * Everything else was already built and simply had no caller:
 *
 * - `gastronomy-trial` and `experience-trial` are seeded plans
 *   (`trialPlans.seed.ts`, migrations `0074`/`0075`) that nothing ever resolved.
 * - `TRIAL_PLAN_SLUG_BY_PRODUCT_DOMAIN` already carries all three verticals.
 * - `resolveTrialEligibility` is already keyed on `(customerId, productDomain)`
 *   (HOS-1012 D-2), so a host who spent their accommodation trial starts clean
 *   in gastronomy.
 * - `createTrialSubscription` is domain-generic and re-reads the plan's
 *   `product_domain` to refuse a cross-vertical mismatch.
 * - `reconcileCommerceListingVisibility` gates on `isEntitlementGrantingStatus`,
 *   which INCLUDES `trialing` — so the listing publishes itself the moment the
 *   row exists. Nothing in the visibility path needed changing.
 * - The trial crons filter on `{ status: 'trialing' }` with no domain predicate,
 *   so they pick a commerce row up unmodified.
 *
 * @module services/commerce-trial-start.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    type CommerceVertical,
    commerceVerticalToProductDomain,
    resolveTrialPlanSlug
} from '@repo/billing';
import { and, billingPlans, type DrizzleClient, eq, getDb, isNull } from '@repo/db';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import { resolveTrialEligibility } from './billing/trial-eligibility.service.js';
import {
    attachListingToSubscription,
    findOwnerVerticalSubscription
} from './commerce-subscription-attach.service.js';
import { createTrialSubscription } from './subscription-trial-create.service.js';

/**
 * What happens if this owner publishes a listing in this vertical right now.
 *
 * Three STATES, deliberately not a boolean, and this is the one design decision
 * in this module worth defending. The accommodation side already resolves three
 * verdicts server-side (`first_publish` / `has_active_sub` / `subscription_required`)
 * and its UI flattens them into a boolean that means only `has_active_sub` — so
 * it hides the publish button from precisely the owner who still has an intact
 * trial (HOS-1183). That is the same defect as this issue, one layer up: HOS-1012
 * changed the premise of what a trial IS and updated the server without updating
 * the caller.
 *
 * A boolean here would re-create it. `trial_available` and `has_active_sub` both
 * mean "publishing works and costs nothing today", and collapsing them loses the
 * only thing the owner actually needs to be told apart: whether a clock starts.
 */
export type CommerceTrialVerdict =
    /**
     * The owner has no live subscription in this vertical and has not spent this
     * vertical's trial. Publishing starts a free trial — no card, no checkout.
     */
    | 'trial_available'
    /**
     * The owner already pays for this vertical. Publishing attaches the listing
     * to that subscription and opens no checkout (the route's existing branch 2).
     */
    | 'has_active_sub'
    /**
     * The trial for this vertical is spent and there is no live subscription.
     * Publishing opens a MercadoPago checkout — today's behaviour, and after
     * this change the only path that still reaches one on a first publish.
     */
    | 'payment_required';

/** Result of {@link resolveCommerceTrialVerdict}. */
export interface CommerceTrialVerdictResult {
    /** Which of the three states this `(owner, vertical)` pair is in. */
    readonly verdict: CommerceTrialVerdict;
    /**
     * How many days the trial would run, present ONLY on `trial_available`.
     *
     * Read from the resolved trial plan rather than from a constant, so the
     * number the button promises is the number the grant will actually write.
     * The public pricing pages already read `trialDays` live from the database
     * for exactly this reason; a second hardcoded copy here is how the promise
     * and the grant drift apart.
     */
    readonly trialDays?: number;
}

/**
 * Resolve the trial plan row for a vertical.
 *
 * `billing_plans.name` IS the slug (SPEC-168 convention — the table has no
 * `slug` column). Soft-deleted plans are excluded; `active` deliberately is NOT
 * filtered, exactly as `getPlanBySlug` does not, because a trial plan is seeded
 * INACTIVE precisely because it is never sellable. Filtering on it would make
 * every commerce trial fail to resolve and silently fall through to checkout —
 * which is the bug this module exists to fix, re-introduced one layer down.
 *
 * @param input.vertical - The commerce vertical.
 * @param input.db - Drizzle client (or an open transaction) to read through.
 * @returns The plan's id and configured trial days, or `null` when the vertical
 *   declares no trial plan or the row is missing.
 */
async function resolveCommerceTrialPlan(input: {
    readonly vertical: CommerceVertical;
    readonly db: DrizzleClient;
}): Promise<{ readonly planId: string; readonly trialDays: number } | null> {
    const { vertical, db } = input;
    const productDomain = commerceVerticalToProductDomain(vertical);
    const planSlug = resolveTrialPlanSlug({ productDomain });

    if (!planSlug) {
        apiLogger.error(
            { vertical, productDomain },
            'HOS-1184: no trial plan is declared for this commerce vertical'
        );
        return null;
    }

    const [plan] = await db
        .select({ id: billingPlans.id, metadata: billingPlans.metadata })
        .from(billingPlans)
        .where(and(eq(billingPlans.name, planSlug), isNull(billingPlans.deletedAt)))
        .limit(1);

    if (!plan) {
        apiLogger.error(
            { vertical, planSlug },
            'HOS-1184: commerce trial plan not found in billing_plans'
        );
        return null;
    }

    // The plan row is the source of truth for the length, not the config
    // constant: HOS-39 reclassified `metadata.trialDays` as commercial-layer,
    // which means an operator can change it from the admin panel and the seed
    // will not revert it. Falling back to the config default keeps a plan whose
    // metadata predates the field working instead of granting zero days — and
    // `createTrialSubscription` rejects a non-positive value outright, so a
    // malformed row fails loudly rather than minting an already-expired trial.
    const rawTrialDays = (plan.metadata as { trialDays?: unknown } | null)?.trialDays;
    const trialDays =
        typeof rawTrialDays === 'number' && Number.isInteger(rawTrialDays) && rawTrialDays > 0
            ? rawTrialDays
            : undefined;

    if (trialDays === undefined) {
        apiLogger.warn(
            { vertical, planSlug, rawTrialDays },
            'HOS-1184: commerce trial plan declares no usable trialDays — falling back to the creator default'
        );
    }

    return { planId: plan.id, trialDays: trialDays ?? 0 };
}

/**
 * The verdict for an owner already known to be eligible: `trial_available` when
 * the vertical has a resolvable trial plan, `payment_required` when it does not.
 *
 * A missing plan row answers `payment_required` rather than promising a trial
 * the grant would then fail to create. The owner reaching a checkout they did
 * not expect is recoverable; a button that promises thirty free days and then
 * errors is not.
 */
async function verdictForEligibleOwner(input: {
    readonly vertical: CommerceVertical;
    readonly db: DrizzleClient;
}): Promise<CommerceTrialVerdictResult> {
    const plan = await resolveCommerceTrialPlan(input);

    if (!plan) {
        return { verdict: 'payment_required' };
    }

    return {
        verdict: 'trial_available',
        ...(plan.trialDays > 0 ? { trialDays: plan.trialDays } : {})
    };
}

/**
 * What publishing in this vertical would do for this owner, right now.
 *
 * Read-only: reserves nothing and mutates nothing, so it is safe to call on
 * every render of the owner's listing page.
 *
 * The order of the two questions is load-bearing. A live subscription is checked
 * FIRST, because an owner who already pays is not "trial eligible" in any useful
 * sense even when they never spent the trial — telling them a clock is about to
 * start would be a lie, and telling the button to say "free for 30 days" when the
 * listing is simply being attached to a plan they already bought is worse.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.customerId - The owner's billing customer id, or `null` when they
 *   have none yet. See below — `null` is an answerable state, not an error.
 * @param input.vertical - The commerce vertical being published into.
 * @returns The verdict, plus the trial length when one would be granted.
 */
export async function resolveCommerceTrialVerdict(input: {
    readonly billing: QZPayBilling;
    readonly customerId: string | null;
    readonly vertical: CommerceVertical;
    readonly db?: DrizzleClient;
}): Promise<CommerceTrialVerdictResult> {
    const { billing, customerId, vertical } = input;
    const db = input.db ?? getDb();

    // No billing customer is an ANSWER, not a refusal, and getting this wrong
    // would aim the bug at the most common owner there is: the brand-new one.
    //
    // A customer with no row has no subscription and no spent trial by
    // construction — there is no history to query, which is exactly why not
    // querying is safe here rather than a shortcut. And publishing will not
    // fail on them: the start-subscription route creates the customer on demand
    // (HOS-596) before it does anything else. So the honest verdict is the one
    // publishing is about to produce.
    //
    // This function stays read-only and does NOT create the row itself. A GET
    // that renders a button must not mint billing records for anyone who merely
    // opened the page.
    if (!customerId) {
        return verdictForEligibleOwner({ vertical, db });
    }

    const ownerSubscription = await findOwnerVerticalSubscription({
        billing,
        customerId,
        vertical
    });
    if (ownerSubscription) {
        return { verdict: 'has_active_sub' };
    }

    const { eligible } = await resolveTrialEligibility({
        billing,
        customerId,
        productDomain: commerceVerticalToProductDomain(vertical)
    });
    if (!eligible) {
        return { verdict: 'payment_required' };
    }

    return verdictForEligibleOwner({ vertical, db });
}

/** Result of {@link startCommerceListingTrial}. */
export interface StartCommerceListingTrialResult {
    /** The id of the freshly-created `status='trialing'` subscription. */
    readonly localSubscriptionId: string;
    /** When the trial expires and the listing goes back to PRIVATE. */
    readonly trialEnd: Date;
}

/**
 * Grant this owner their vertical's local trial and attach the listing to it.
 *
 * Mirrors `startLocalTrial` in `accommodation-publish-deps.ts`, with one
 * structural difference that is a property of commerce rather than a choice:
 * accommodation resolves its listings from `accommodations.owner_id`, so its
 * publish flow has nothing to link. Commerce resolves them through
 * `entity_subscriptions`, so the trial is only half-granted until the listing is
 * attached to it — an unattached trial leaves the listing PRIVATE with a live
 * subscription behind it, which is invisible from the API and looks to the owner
 * exactly like the bug being fixed.
 *
 * The attach is what publishes the listing: `attachListingToSubscription` calls
 * `reconcileSubscriptionLinkedEntities`, and the visibility reconciler flips a
 * COMPLETE listing to PUBLIC/ACTIVE for any entitlement-granting status —
 * `trialing` included. No visibility write happens here.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.customerId - The owner's billing customer id.
 * @param input.vertical - The commerce vertical being published into.
 * @param input.entityId - The listing being published.
 * @returns The created subscription's id and trial window, or `null` when the
 *   trial plan could not be resolved (the caller falls back to checkout).
 */
export async function startCommerceListingTrial(input: {
    readonly billing: QZPayBilling;
    readonly customerId: string;
    readonly vertical: CommerceVertical;
    readonly entityId: string;
    readonly db?: DrizzleClient;
}): Promise<StartCommerceListingTrialResult | null> {
    const { billing, customerId, vertical, entityId } = input;
    const db = input.db ?? getDb();
    const productDomain = commerceVerticalToProductDomain(vertical);

    // The eligibility gate lives HERE, inside the function that grants, not only
    // at the call site that asks. A caller that forgets it would mint a second
    // trial for a customer who already spent theirs — free entitlements, no
    // card, and nothing in the response to reveal it. Callers are welcome to
    // check first to decide what to render; this check is what makes the grant
    // itself safe, and it is the reason this function answers `null` rather than
    // trusting the branch it was called from.
    const { eligible } = await resolveTrialEligibility({
        billing,
        customerId,
        productDomain
    });
    if (!eligible) {
        apiLogger.info(
            { customerId, vertical, entityId },
            'HOS-1184: commerce trial refused — this vertical trial is already spent'
        );
        return null;
    }

    const plan = await resolveCommerceTrialPlan({ vertical, db });
    if (!plan) {
        return null;
    }

    // `trialDays` is passed only when the plan row carries a usable one.
    // Omitting it lets `createTrialSubscription` apply its own default rather
    // than this module inventing a second place the length is decided.
    const { localSubscriptionId, trialStart, trialEnd } = await createTrialSubscription({
        customerId,
        planId: plan.planId,
        productDomain,
        ...(plan.trialDays > 0 ? { trialDays: plan.trialDays } : {}),
        // Same single source of truth as `middlewares/billing.ts` and every
        // other local-insert path.
        livemode: !env.HOSPEDA_MERCADO_PAGO_SANDBOX
    });

    // Attach AFTER the subscription row exists, and outside its transaction:
    // `attachListingToSubscription` reconciles visibility as its last step, and
    // reconciling from inside an uncommitted transaction would publish a listing
    // on the strength of a row that can still roll back.
    await attachListingToSubscription({
        subscription: {
            id: localSubscriptionId,
            status: 'trialing',
            planId: plan.planId
        },
        entityType: vertical,
        entityId
    });

    // `createTrialSubscription` clears the cache itself when it opens its own
    // transaction (which it does here — no `tx` is passed), so this is belt and
    // braces rather than the only clear. It stays because the attach above can
    // change what the owner is entitled to see, and INV-1 asks every
    // money-mutating lifecycle event to end with the cache dropped.
    clearEntitlementCache(customerId);

    apiLogger.info(
        {
            localSubscriptionId,
            customerId,
            vertical,
            productDomain,
            entityId,
            trialStart: trialStart.toISOString(),
            trialEnd: trialEnd.toISOString()
        },
        'HOS-1184: commerce listing published on a local trial (no MercadoPago preapproval)'
    );

    return { localSubscriptionId, trialEnd };
}
