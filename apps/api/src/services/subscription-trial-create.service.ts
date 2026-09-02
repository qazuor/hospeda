/**
 * Local trial subscription creator (HOS-1012 T-003).
 *
 * Creates a `status='trialing'` subscription directly, with **no MercadoPago
 * preapproval and no card**, when an owner publishes their first listing in a
 * product domain. MercadoPago is never told that a trial exists — it enters the
 * picture only when the person decides to pay.
 *
 * This shape is not new. `createCompSubscription`
 * (`subscription-comp-create.service.ts`, SPEC-262) already creates a
 * provider-less subscription by direct insert, and this is deliberately modelled
 * on it rather than on the checkout: a trial row is a comp row plus an end date.
 * The consequence worth stating is that `isEntitlementGrantingStatus` already
 * includes `trialing`, so **entitlement resolution needs no change at all** —
 * the trial grants the plan's entitlements exactly the way it does today.
 *
 * Why the trial belongs to Hospeda again (HOS-956, owner decision 2026-09-01):
 * MercadoPago grants a preapproval's `free_trial` once per
 * `(payer, preapproval_plan)` and reports a spent trial identically to a live
 * one. It has already charged ARS 18.000 in production 118 seconds after
 * promising 14 free days (HOS-522). If we never ask for a `free_trial`,
 * MercadoPago cannot lie about one.
 *
 * @module services/subscription-trial-create.service
 */

import { OWNER_TRIAL_DAYS } from '@repo/billing';
import {
    billingPlans,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    withTransaction
} from '@repo/db';
import { type ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';

/** Milliseconds in one day, for computing `trialEnd` from `trialStart`. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Input for {@link createTrialSubscription}.
 */
export interface CreateTrialSubscriptionInput {
    /** The billing customer id (qzpay customer id) starting the trial. */
    readonly customerId: string;
    /** The qzpay plan UUID (`billing_plans.id`) the trial runs on. */
    readonly planId: string;
    /**
     * The vertical this trial belongs to. Eligibility is keyed on
     * `(customerId, productDomain)` — one trial per DOMAIN, not one per account
     * for life (HOS-1012 D-2, which absorbs HOS-931). Someone who spent their
     * accommodation trial starts clean when they enter gastronomy.
     */
    readonly productDomain: ProductDomainEnum;
    /** Trial length in days. Defaults to {@link OWNER_TRIAL_DAYS}. */
    readonly trialDays?: number;
    /** Whether the customer/record is in live mode. */
    readonly livemode: boolean;
    /**
     * An ALREADY-OPEN transaction to enlist in. When provided, this function
     * performs its writes inside the caller's transaction and does NOT commit
     * anything itself — that is what lets `AccommodationService.publish` make
     * the publish and the trial start atomic (HOS-1012 G-2).
     *
     * When this is set, the caller also becomes responsible for clearing the
     * entitlement cache after ITS transaction commits — see
     * {@link CreateTrialSubscriptionResult.entitlementCacheCleared}.
     */
    readonly tx?: DrizzleClient;
    /** Drizzle client override for tests. Defaults to {@link getDb}. */
    readonly db?: DrizzleClient;
    /**
     * Clock injection for deterministic tests. Defaults to `new Date()`.
     * `trialEnd` is always computed from THIS value, never from a second
     * `new Date()` call, so the window cannot straddle a tick.
     */
    readonly now?: Date;
}

/**
 * Result of creating a local trial subscription.
 */
export interface CreateTrialSubscriptionResult {
    /** The id of the freshly-created `status='trialing'` subscription. */
    readonly localSubscriptionId: string;
    /** When the trial clock started. */
    readonly trialStart: Date;
    /** When the trial expires and the listing is unpublished. */
    readonly trialEnd: Date;
    /**
     * Whether this function already cleared the customer's entitlement cache.
     *
     * `false` means it ran inside a caller-owned transaction and deliberately
     * did not — clearing the cache before that transaction commits would
     * publish entitlements for a row that may still be rolled back. The caller
     * MUST call `clearEntitlementCache(customerId)` once its own transaction
     * commits, or the owner keeps seeing their previous (empty) entitlements
     * for up to the full 5-minute cache TTL.
     */
    readonly entitlementCacheCleared: boolean;
}

/**
 * Create a local `status='trialing'` subscription with no MercadoPago object.
 *
 * The row carries `mp_subscription_id = NULL` by construction: the insert names
 * no such column. That NULL is the whole point — it is what distinguishes a
 * subscription Hospeda owns outright from one whose lifecycle a provider
 * controls.
 *
 * @param input - See {@link CreateTrialSubscriptionInput}.
 * @returns The created subscription id and its trial window.
 * @throws Error when the plan does not exist, when the plan belongs to a
 *   different product domain than the one requested, or when `trialDays` is not
 *   a positive integer.
 */
export async function createTrialSubscription(
    input: CreateTrialSubscriptionInput
): Promise<CreateTrialSubscriptionResult> {
    const { customerId, planId, productDomain, livemode, tx } = input;
    const trialDays = input.trialDays ?? OWNER_TRIAL_DAYS;

    if (!Number.isInteger(trialDays) || trialDays <= 0) {
        throw new Error(
            `createTrialSubscription: trialDays must be a positive integer, got ${trialDays}`
        );
    }

    // Validate the plan BEFORE any write so a bad planId fails fast, mirroring
    // createCompSubscription. A plan from another vertical must not be able to
    // back a trial in this one: the domain is the eligibility key (D-2), so a
    // mismatch here would silently consume the wrong vertical's trial.
    const readClient = tx ?? input.db ?? getDb();
    const [planRow] = await readClient
        .select({ productDomain: billingPlans.productDomain })
        .from(billingPlans)
        .where(eq(billingPlans.id, planId))
        .limit(1);

    if (!planRow) {
        throw new Error(`createTrialSubscription: plan '${planId}' not found`);
    }

    // `productDomain` is NULL on plans that pre-date the column. NULL reads as
    // accommodation (the historical default) — the same asymmetry
    // `subscriptionMatchesDomain()` applies, and for the same reason: the
    // column post-dates most rows, so accommodation fails open and every other
    // domain fails closed.
    const planDomain = planRow.productDomain ?? 'accommodation';
    if (planDomain !== productDomain) {
        throw new Error(
            `createTrialSubscription: plan '${planId}' is domain '${planDomain}' but the trial was requested for '${productDomain}'`
        );
    }

    const trialStart = input.now ?? new Date();
    const trialEnd = new Date(trialStart.getTime() + trialDays * MS_PER_DAY);
    const localSubscriptionId = crypto.randomUUID();

    await withTransaction(async (client) => {
        // No `mpSubscriptionId` is named here, and that is load-bearing rather
        // than an omission: there is no MercadoPago object to point at.
        await client.insert(billingSubscriptions).values({
            id: localSubscriptionId,
            customerId,
            planId,
            billingInterval: 'month',
            intervalCount: 1,
            // The trial IS the current period. `currentPeriodEnd` is NOT NULL in
            // the qzpay schema, and pointing it at `trialEnd` keeps every
            // `now < currentPeriodEnd` consumer agreeing with the trial window
            // instead of disagreeing with it.
            currentPeriodStart: trialStart,
            currentPeriodEnd: trialEnd,
            trialStart,
            trialEnd,
            status: SubscriptionStatusEnum.TRIALING,
            productDomain,
            livemode,
            metadata: {
                source: 'first-publish-trial',
                createdBy: 'publish-flow',
                trialDays
            }
        });
    }, tx ?? input.db);

    // INV-1: a local trial has no preapproval and therefore no webhook, so no
    // other lifecycle event will ever clear this customer's entitlement cache.
    // Inside a caller-owned transaction we must NOT clear it yet — the row can
    // still be rolled back, and publishing entitlements for a row that never
    // commits is worse than a stale cache. The caller clears it post-commit.
    const entitlementCacheCleared = tx === undefined;
    if (entitlementCacheCleared) {
        clearEntitlementCache(customerId);
    }

    apiLogger.info(
        {
            localSubscriptionId,
            customerId,
            planId,
            productDomain,
            trialDays,
            trialEnd: trialEnd.toISOString(),
            entitlementCacheCleared
        },
        'HOS-1012: local trial subscription created (no MercadoPago preapproval)'
    );

    return { localSubscriptionId, trialStart, trialEnd, entitlementCacheCleared };
}
