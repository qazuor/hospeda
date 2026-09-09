/**
 * Comp subscription creator (SPEC-262 T-012 P2, re-pointed by HOS-1171).
 *
 * Creates a permanently-complimentary (`status='comp'`, Model β) subscription
 * directly, WITHOUT any MercadoPago preapproval or charge.
 *
 * **The only caller is the admin route**
 * `POST /api/v1/admin/billing/subscriptions/grant-comp`
 * (`routes/billing/admin/subscription-comp.ts`, `BILLING_MANAGE`). It used to be
 * reached by redeeming a `comp` promo code at self-serve checkout, with no
 * permission check anywhere on the path; HOS-1171 closed that door, so a
 * complimentary subscription is now an operator's act on a named customer,
 * exactly like courtesy. The `promoCodeId` / `code` pair survives as OPTIONAL
 * provenance — the two comp subscriptions live in production were granted by
 * redeeming `HOSPEDA_FREE`, and a grant that names a code still records the
 * redemption so that history stays legible.
 *
 * A comp subscription short-circuits billing entirely:
 *   - No MP preapproval is created, so no `mp_subscription_id`.
 *   - The dunning cron excludes `status='comp'` rows (never delinquent).
 *   - `loadEntitlements` treats `comp` as an active subscription, so the
 *     subscriber retains the full entitlements of the comped plan.
 *
 * HOS-1160: a comp is no longer accommodation-only. The vertical is the
 * caller's `productDomain`, asserted against the plan, so gastronomy,
 * experiences and partners can be comped too — which is what HOS-278 §6.3
 * promised and what nothing implemented. The exclusion of `comp` from the
 * billing machinery was measured across the whole workspace for this change:
 * ~21 sites, of which 17 compare STATUS and are therefore blind to the vertical
 * and already correct, and 4 read the canonical `isEntitlementGrantingStatus`
 * predicate. None of them needed widening. The single thing that did was the
 * domain written here.
 *
 * The whole operation (insert + promo stamp + redemption record) runs in ONE DB
 * transaction so a comp grant is atomic: a partial write can never leave a
 * subscription stamped `comp` without its redemption record (or vice versa).
 * A grant with no promo code writes no redemption row and stamps no
 * `promo_code_id`; everything else is identical.
 *
 * INV-1 (HOS-453 / H-91): a comp grant never goes through MercadoPago, so it
 * never fires a webhook — unlike every other lifecycle event, there is no
 * other handler that will clear this customer's entitlement cache. This
 * function calls `clearEntitlementCache(customerId)` itself, right after the
 * transaction commits, so the new plan is visible immediately instead of
 * waiting out the 5-minute in-memory cache TTL.
 *
 * @module services/subscription-comp-create.service
 */

import {
    billingPlans,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue, SubscriptionStatusEnum } from '@repo/schemas';
import { redeemAndRecordUsage } from '@repo/service-core';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';

/**
 * Far-future period end for a comp subscription, in milliseconds from now.
 *
 * A comp sub is "never billed", so it has no real renewal boundary. We set a
 * far-future `currentPeriodEnd` (100 years) rather than NULL because:
 *   - the column is NOT NULL in the qzpay schema (the annual path always sets it),
 *   - any consumer that compares `now < currentPeriodEnd` (e.g. period checks)
 *     correctly treats the comp sub as perpetually current,
 *   - `loadEntitlements`'s cron-lag grace only inspects `currentPeriodEnd` for
 *     `status='active'`, so a comp sub never trips it regardless of the value.
 */
const COMP_PERIOD_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/**
 * Result of creating a comp subscription.
 */
export interface CreateCompSubscriptionResult {
    /** The id of the freshly-created `status='comp'` subscription. */
    readonly localSubscriptionId: string;
}

/**
 * Create a `status='comp'` subscription for a self-serve checkout comp redemption.
 *
 * @param input.customerId - The billing customer id (qzpay customer id).
 * @param input.planId - The qzpay plan UUID (`billing_plans.id`) being comped.
 * @param input.promoCodeId - OPTIONAL DB promo code id. When supplied (together
 *   with `code`) the grant stamps `promo_code_id` and records a redemption, so
 *   an operator can attribute the grant to a campaign code. Omit it for a plain
 *   administrative grant, which is the normal case since HOS-1171.
 * @param input.code - OPTIONAL normalized promo code string, paired with
 *   `promoCodeId`.
 * @param input.interval - The billing interval (`'monthly'` | `'annual'`).
 *   Stored on the row for audit; comp is never charged either way.
 * @param input.productDomain - The vertical this grant belongs to. REQUIRED and
 *   asserted against the plan's own `billing_plans.product_domain`: the caller
 *   states the vertical it believes it is comping, and a mismatch is refused
 *   rather than silently resolved in the plan's favour. See the domain guard
 *   below for why this is a parameter and not a read.
 * @param input.livemode - Whether the customer/record is in live mode.
 * @param input.db - Optional Drizzle client override for tests.
 * @returns The created subscription id.
 * @throws Error when the atomic transaction fails (caller maps to 500).
 */
export async function createCompSubscription(input: {
    readonly customerId: string;
    readonly planId: string;
    readonly promoCodeId?: string;
    readonly code?: string;
    readonly interval: 'monthly' | 'annual';
    readonly productDomain: ProductDomainValue;
    readonly livemode: boolean;
    readonly db?: DrizzleClient;
}): Promise<CreateCompSubscriptionResult> {
    const { customerId, planId, promoCodeId, code, interval, productDomain, livemode } = input;

    // HOS-1160: assert the plan's domain MATCHES the one the caller asked for,
    // rather than asserting it is accommodation. Until this issue the guard read
    // `!== ACCOMMODATION → throw`, which is why HOS-278 §6.3's promise of a
    // COMP redemption for partners had no code behind it, and why gastronomy and
    // experiences could not be comped either.
    //
    // The domain is a PARAMETER, not a read of the plan row, and the difference
    // is the whole point. Writing whatever the plan happens to say would make a
    // caller that names the wrong vertical succeed silently; and a row that
    // comes out stamped `accommodation` when the plan was gastronomy is the one
    // genuine fail-open on this path — `subscriptionMatchesDomain` fails OPEN
    // for accommodation, so that row hands the customer the full accommodation
    // entitlements with no error and no log. Opening the door without writing
    // the domain is strictly worse than today's closed door, so the caller has
    // to state its intent and have it checked.
    //
    // Mirrors `createTrialSubscription` (`subscription-trial-create.service.ts`),
    // whose own comment says it was modelled on this function back when this
    // function only knew one vertical. This aligns the original with its copy.
    //
    // Runs BEFORE the transaction so a bad planId fails fast.
    const db = input.db ?? getDb();
    const [planRow] = await db
        .select({ productDomain: billingPlans.productDomain })
        .from(billingPlans)
        .where(eq(billingPlans.id, planId))
        .limit(1);
    if (!planRow) {
        throw new Error(`createCompSubscription: plan '${planId}' not found`);
    }
    // NULL reads as accommodation — the same asymmetry `subscriptionMatchesDomain`
    // and `resolvePlanProductDomain` apply, for the same reason: the column
    // post-dates most rows, so accommodation fails open and every other domain
    // fails closed. This is a read of an existing row, not a write that omits
    // the value.
    const planDomain = planRow.productDomain ?? ProductDomainEnum.ACCOMMODATION;
    if (planDomain !== productDomain) {
        throw new Error(
            `createCompSubscription: plan '${planId}' is domain '${planDomain}' but the comp was requested for '${productDomain}'`
        );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + COMP_PERIOD_MS);
    const localSubscriptionId = crypto.randomUUID();
    // Comp is never charged; store interval for audit only. Map to the qzpay
    // billing-interval column shape used by the annual direct-insert.
    const billingInterval = interval === 'annual' ? 'year' : 'month';

    await withTransaction(async (tx) => {
        // 1. Insert the comp subscription row. No mp_subscription_id (never billed).
        //    `product_domain` carries the caller's asserted vertical, so an
        //    accommodation comp still resolves through `loadEntitlements` (which
        //    filters to accommodation) while a gastronomy/experience/partner comp
        //    is found by ITS vertical's resolver instead — `findOwnerVerticalSubscription`
        //    for commerce, `reconcilePartnerForSubscription` for alliances — and
        //    is invisible to the accommodation entitlement engine.
        await tx.insert(billingSubscriptions).values({
            id: localSubscriptionId,
            customerId,
            planId,
            billingInterval,
            intervalCount: 1,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            status: SubscriptionStatusEnum.COMP,
            livemode,
            // HOS-1233 T-035: stated in the INSERT rather than stamped by a
            // follow-up UPDATE, because "the column's default happens to agree
            // with us" is not the same claim as "this row states its vertical"
            // — and it stops being true the day the default changes or
            // disappears (T-036), where the INSERT is rejected before its
            // correction can run.
            //
            // HOS-1160: the value is the caller's asserted domain, checked
            // against the plan above, rather than the `ACCOMMODATION` literal
            // this line used to hold. That literal was the single genuine
            // fail-open of this whole surface: the ~21 sites that special-case
            // `comp` compare STATUS, which is blind to the vertical and so
            // already correct for all of them, and the one place a wrong
            // vertical could be introduced was here.
            productDomain,
            // Folded in from the UPDATE that used to follow this insert. Unlike
            // the domain above, a conditional spread is the RIGHT shape here:
            // omitting the key means "this grant names no promo code", which is
            // the normal case since HOS-1171, and the column has no default
            // standing by to answer for it.
            ...(promoCodeId === undefined ? {} : { promoCodeId }),
            metadata: {
                // HOS-1171: the only caller is the admin grant route. The old
                // 'start-paid-comp' / 'subscription-flow' pair described the
                // self-serve checkout door, which no longer exists — rows
                // written before this change keep the old pair, and that is
                // exactly how you tell the two eras apart.
                source: 'admin-grant-comp',
                createdBy: 'admin',
                ...(code === undefined ? {} : { promoCode: code }),
                billingInterval: interval
            }
        });

        // 2. Record the redemption (usage increment + usage row) against the new
        //    sub, INSIDE the same transaction so the grant is atomic.
        //
        //    Only when the grant NAMES a promo code. Since HOS-1171 a comp is
        //    normally a plain administrative act with no code behind it, and
        //    there is nothing to redeem — the subscription row itself, plus the
        //    admin's own audit log entry, is the record.
        //
        // M1 idempotency note: idempotency is cached post-2xx-response, so a
        // dropped-connection retry could re-enter this transaction and re-redeem.
        // Mitigated by requiring maxPerCustomer=1 on all comp codes (the second
        // redeemAndRecordUsage call would fail, rolling back the whole tx and
        // preventing a double grant). Operators must configure comp codes with
        // maxPerCustomer=1 for this mitigation to hold.
        if (promoCodeId !== undefined) {
            const redeemResult = await redeemAndRecordUsage({
                promoCodeId,
                customerId,
                subscriptionId: localSubscriptionId,
                discountAmount: 0,
                currency: 'ARS',
                livemode,
                tx
            });

            if (!redeemResult.success) {
                // Throw to roll back the whole transaction (fail-closed): a comp
                // that cannot be recorded (e.g. max-uses exhausted) must NOT be
                // granted.
                throw new Error(
                    `Comp redemption failed for code '${code}': ${redeemResult.error.message}`
                );
            }
        }
    }, input.db);

    // INV-1 (HOS-453 / H-91 fix): a comp grant has no MercadoPago preapproval
    // and therefore no webhook, so there is no other lifecycle event that will
    // ever clear this customer's entitlement cache. Without this call the
    // subscriber sees their PREVIOUS plan's entitlements for up to the full
    // 5-minute cache TTL after the grant, even though the transaction above
    // already committed the new `comp` subscription.
    clearEntitlementCache(customerId);

    apiLogger.info(
        { localSubscriptionId, customerId, planId, code, interval },
        'Comp subscription granted by an operator (no MercadoPago preapproval)'
    );

    return { localSubscriptionId };
}
