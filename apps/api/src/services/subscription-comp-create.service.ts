/**
 * Comp subscription creator for self-serve checkout (SPEC-262 T-012 P2).
 *
 * Creates a permanently-complimentary (`status='comp'`, Model β) subscription
 * directly, WITHOUT any MercadoPago preapproval or charge, when a `comp` promo
 * code is redeemed at NEW-SUBSCRIBER checkout (monthly or annual — comp is never
 * billed regardless of the chosen interval).
 *
 * A comp subscription short-circuits billing entirely:
 *   - No MP preapproval is created, so no `mp_subscription_id`.
 *   - The dunning cron excludes `status='comp'` rows (never delinquent).
 *   - `loadEntitlements` treats `comp` as an active accommodation subscription,
 *     so the subscriber retains the full entitlements of the comped plan.
 *
 * The whole operation (insert + promo stamp + redemption record) runs in ONE DB
 * transaction so a comp grant is atomic: a partial write can never leave a
 * subscription stamped `comp` without its redemption record (or vice versa).
 *
 * @module services/subscription-comp-create.service
 */

import { type DrizzleClient, billingSubscriptions, getDb, sql, withTransaction } from '@repo/db';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { redeemAndRecordUsage } from '@repo/service-core';
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
 * @param input.promoCodeId - The DB promo code id (for stamping + redemption).
 * @param input.code - The normalized promo code string (logging / redemption).
 * @param input.interval - The checkout interval (`'monthly'` | `'annual'`).
 *   Stored on the row for audit; comp is never charged either way.
 * @param input.livemode - Whether the customer/record is in live mode.
 * @param input.db - Optional Drizzle client override for tests.
 * @returns The created subscription id.
 * @throws Error when the atomic transaction fails (caller maps to 500).
 */
export async function createCompSubscription(input: {
    readonly customerId: string;
    readonly planId: string;
    readonly promoCodeId: string;
    readonly code: string;
    readonly interval: 'monthly' | 'annual';
    readonly livemode: boolean;
    readonly db?: DrizzleClient;
}): Promise<CreateCompSubscriptionResult> {
    const { customerId, planId, promoCodeId, code, interval, livemode } = input;

    // SPEC-262 M2: assert the plan is accommodation-domain before comping.
    // `product_domain` is an extras-carril column (not on the Drizzle TS schema),
    // so we read it via raw SQL. We SELECT from billing_plans to check whether the
    // plan exists at all and what domain it belongs to. A null/missing row rejects
    // (plan not found). A non-accommodation domain rejects (wrong product context).
    // This guard runs BEFORE the transaction so a bad planId fails fast.
    const db = input.db ?? getDb();
    const planResult = await db.execute(
        sql`SELECT product_domain FROM billing_plans WHERE id = ${planId} LIMIT 1`
    );
    // TYPE-WORKAROUND: db.execute() returns rows typed as Record<string, unknown>
    // (extras-carril column not on the Drizzle TS schema), cast via unknown.
    const planRow = (planResult.rows?.[0] ?? null) as unknown as {
        product_domain: string | null;
    } | null;
    if (!planRow) {
        throw new Error(`createCompSubscription: plan '${planId}' not found`);
    }
    // product_domain is NULL for plans that pre-date the extras-carril migration OR
    // for accommodation plans that weren't explicitly stamped (the column was added
    // later). NULL is treated as accommodation (historical default). Only an
    // explicit non-accommodation domain is rejected.
    if (
        planRow.product_domain !== null &&
        planRow.product_domain !== ProductDomainEnum.ACCOMMODATION
    ) {
        throw new Error(
            `createCompSubscription: plan '${planId}' is domain '${planRow.product_domain}' — only accommodation plans can be comped at checkout`
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
        //    product_domain='accommodation' so loadEntitlements resolves it (the
        //    entitlement engine filters to accommodation-domain subs).
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
            metadata: {
                source: 'start-paid-comp',
                createdBy: 'subscription-flow',
                promoCode: code,
                billingInterval: interval
            }
        });

        // 2. Stamp product_domain + promo_code_id via raw SQL — these columns are
        //    NOT on the qzpay Drizzle TS schema (extras carril), exactly like the
        //    commerce flow stamps product_domain in initiateCommerceMonthlySubscription.
        await tx.execute(
            sql`UPDATE billing_subscriptions
                SET product_domain = ${ProductDomainEnum.ACCOMMODATION},
                    promo_code_id = ${promoCodeId}
                WHERE id = ${localSubscriptionId}`
        );

        // 3. Record the redemption (usage increment + usage row) against the new
        //    sub, INSIDE the same transaction so the grant is atomic.
        //
        // M1 idempotency note: idempotency is cached post-2xx-response, so a
        // dropped-connection retry could re-enter this transaction and re-redeem.
        // Mitigated by requiring maxPerCustomer=1 on all comp codes (the second
        // redeemAndRecordUsage call would fail, rolling back the whole tx and
        // preventing a double grant). Operators must configure comp codes with
        // maxPerCustomer=1 for this mitigation to hold.
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
            // Throw to roll back the whole transaction (fail-closed): a comp that
            // cannot be recorded (e.g. max-uses exhausted) must NOT be granted.
            throw new Error(
                `Comp redemption failed for code '${code}': ${redeemResult.error.message}`
            );
        }
    }, input.db);

    apiLogger.info(
        { localSubscriptionId, customerId, planId, code, interval },
        'Comp subscription created at self-serve checkout (no MercadoPago preapproval)'
    );

    return { localSubscriptionId };
}
