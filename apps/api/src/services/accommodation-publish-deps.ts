/**
 * @file accommodation-publish-deps.ts
 * @description Factory that adapts the API-level billing data into the
 * `AccommodationPublishDeps` interface `AccommodationService.publish()` consumes
 * from `@repo/service-core`.
 *
 * Why the factory lives in `apps/api`: `service-core` cannot import from
 * `apps/api` (one-way dependency rule).
 *
 * ## The trial is back, and it is nothing like the old one (HOS-1012)
 *
 * Before HOS-171 this file owned `startTrial` / `cancelTrial`, and they were a
 * SAGA: `startTrial` created a MercadoPago preapproval — an external HTTP call,
 * so it ran OUTSIDE the local transaction behind an 8s timeout — and if the
 * local write then failed, `cancelTrial` compensated, logging
 * "CRITICAL: manual reconciliation required" when the compensation ALSO failed.
 * HOS-171 deleted the whole thing along with the no-card trial itself.
 *
 * HOS-1012 brings back the trial and NOT the saga. MercadoPago is never told a
 * trial exists (it grants a preapproval's `free_trial` once per
 * `(payer, preapproval_plan)` and reports a spent trial identically to a live
 * one — it has already charged ARS 18.000 in production 118 seconds after
 * promising 14 free days). A trial is now a local `billing_subscriptions` row
 * with `mp_subscription_id = NULL`, so `startLocalTrial` performs local reads
 * and one local INSERT, INSIDE the caller's transaction, where the database
 * rolls it back for free. No external call may ever be added to it: it runs with
 * a transaction open (ADR-019), and adding one would resurrect the timeout and
 * the compensation that spec guard G-2 exists to keep out.
 *
 * Two reads back the eligibility answer: the local billing tables (for a live
 * owner subscription) and, when there is none, the shared per-vertical trial
 * eligibility resolver — hence the billing client this factory takes again.
 */
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { isSubscriptionLive, resolveTrialPlanSlug } from '@repo/billing';
import {
    and,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    type DrizzleClient,
    desc,
    eq,
    getDb,
    isNull
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import {
    type AccommodationPublishDeps,
    isAccommodationSubscription,
    isOwnerCategorySubscription,
    type PublishEligibility,
    type StartLocalTrialResult
} from '@repo/service-core';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { resolveTrialEligibility } from './billing/trial-eligibility.service';
import { createTrialSubscription } from './subscription-trial-create.service';

/**
 * The vertical this factory speaks for. Every eligibility answer, and the trial
 * it may start, is scoped to accommodation — HOS-1012 D-2 keys eligibility on
 * `(customerId, productDomain)`, so an owner who spent their gastronomy trial
 * still has their accommodation one.
 */
const PUBLISH_PRODUCT_DOMAIN = ProductDomainEnum.ACCOMMODATION;

/**
 * The plan the accommodation trial runs on (HOS-1012 D-5, spec §6.8).
 *
 * Resolved FROM the vertical rather than named directly, and that is the whole
 * point: `resolveTrialPlanSlug` is the single place a product domain becomes a
 * trial plan slug, so gastronomy and experiences reach their OWN trial plans
 * instead of falling back to the accommodation one when their publish paths
 * arrive. Hardcoding `'owner-trial'` here would work today and be the first of
 * three copies tomorrow.
 *
 * It is no longer `owner-basico` (`DEFAULT_TRIAL_PLAN_SLUG`, the correct
 * placeholder before D-5 was decided). A trial on the entry tier shows the host
 * a version of Hospeda nobody pays for and then asks them, on day 30, to pay for
 * exactly what they already had. `owner-trial` carries `owner-pro`'s
 * entitlements with `owner-basico`'s limits — the host experiences what sells,
 * and cannot end up over any paid tier's cap.
 *
 * `undefined` is unreachable for accommodation (it is one of the three declared
 * verticals) but is handled rather than asserted away: the failure mode of a
 * wrong assumption here is a publish with no clock, and a refusal is the correct
 * degradation.
 */
const PUBLISH_TRIAL_PLAN_SLUG = resolveTrialPlanSlug({ productDomain: PUBLISH_PRODUCT_DOMAIN });

/**
 * Builds the publish dependencies that `AccommodationService.publish()` needs.
 * Pass the result to the `AccommodationService` constructor as the fifth
 * argument.
 *
 * Accepts a *getter* for the QZPay billing client rather than the client itself,
 * so route modules instantiated at boot resolve the instance lazily on the first
 * request instead of capturing a `null` from `getQZPayBilling()` when module
 * load races billing initialisation.
 *
 * ## What each eligibility answer means here
 *
 * - `has_active_sub` — the owner holds a LIVE subscription that is both in the
 *   accommodation product domain and on an `owner`/`complex`-category plan.
 * - `first_publish` — no such subscription, but the owner is still eligible for
 *   an accommodation trial. Publishing starts it.
 * - `subscription_required` — everything else, including three cases worth
 *   naming:
 *     - **No `billing_customers` row.** This used to answer `first_publish`.
 *       It is now a rejection, for two reasons: the customer row is created
 *       eagerly at signup (`lib/auth.ts`) and again in `host-onboarding/start`,
 *       so its absence is a genuine edge rather than the normal first-publish
 *       shape; and without a customer there is no trial to create, so sending
 *       the owner to the plans page is the correct degradation instead of
 *       publishing them with no clock.
 *     - **Billing disabled** (the getter returns `null`). Eligibility cannot be
 *       resolved, and a trial cannot be granted on a guess.
 *     - **Trial already consumed in THIS vertical** — a lapsed host renewing.
 *
 * **HOS-217**: a live subscription alone is not enough to publish — it must
 * also be an `owner`/`complex`-category plan. Without this, a HOST who reached
 * that role via host-onboarding (without ever subscribing to an owner plan) but
 * still has a live *tourist* subscription (e.g. `tourist-vip`) would answer
 * `has_active_sub` and be allowed to publish with no host plan at all.
 *
 * @param getBilling - Lazy accessor for the QZPay billing client.
 * @returns The publish dependencies.
 */
export function buildAccommodationPublishDeps(
    getBilling: () => QZPayBilling | null
): AccommodationPublishDeps {
    return {
        checkEligibility: async (ownerId: string): Promise<PublishEligibility> => {
            const db = getDb();
            const customer = await findBillingCustomerByOwnerId({ db, ownerId });
            if (!customer) {
                return 'subscription_required';
            }
            const subscriptions = await db
                .select()
                .from(billingSubscriptions)
                .where(
                    and(
                        eq(billingSubscriptions.customerId, customer.id),
                        isNull(billingSubscriptions.deletedAt)
                    )
                )
                .orderBy(desc(billingSubscriptions.createdAt))
                .limit(10);
            const liveSubscriptions = subscriptions.filter((s) =>
                isSubscriptionLive({
                    status: s.status,
                    trialEnd: s.trialEnd,
                    currentPeriodEnd: s.currentPeriodEnd
                })
            );
            // SPEC-239 T-034 / commerce-listing quirk: `commerce-listing` and
            // `partner-listing` plans have `metadata.category = 'owner'` on
            // purpose (see isOwnerCategorySubscription's docstring), so they
            // would otherwise pass the owner/complex check below despite
            // being a different product entirely. Filter to the accommodation
            // product domain FIRST — before ever asking whether a plan is
            // owner/complex-category — so a host whose only live subscription
            // is a commerce-domain plan answers subscription_required, not
            // has_active_sub.
            const accommodationLiveSubscriptions = liveSubscriptions.filter((sub) =>
                isAccommodationSubscription(sub)
            );
            // Sequential (not Promise.all) by design: short-circuits on the
            // first owner/complex match instead of resolving every live
            // subscription's plan category up front — a customer has at most
            // 1-2 live subscriptions in practice (one per product domain).
            for (const sub of accommodationLiveSubscriptions) {
                if (await isOwnerCategorySubscription({ planId: sub.planId, tx: db })) {
                    return 'has_active_sub';
                }
            }

            // No live owner subscription. The question is no longer "has this
            // owner ever had a subscription" (which denied a trial to anyone
            // who had ever bought anything in any vertical — HOS-931) but
            // "does this owner still have their ACCOMMODATION trial".
            const billing = getBilling();
            if (!billing) {
                return 'subscription_required';
            }
            const { eligible } = await resolveTrialEligibility({
                billing,
                customerId: customer.id,
                productDomain: PUBLISH_PRODUCT_DOMAIN
            });
            return eligible ? 'first_publish' : 'subscription_required';
        },

        startLocalTrial: async ({ ownerId, ctx }): Promise<StartLocalTrialResult | null> => {
            // Every read and the insert use the caller's transaction client, so
            // the whole thing rolls back with the publish (HOS-1012 G-2).
            const tx = ctx.tx;
            if (!getBilling()) {
                // Unreachable via checkEligibility (billing-off already answers
                // subscription_required), kept so a future caller cannot mint a
                // trial while billing is down.
                return null;
            }
            const customer = await findBillingCustomerByOwnerId({ db: tx, ownerId });
            if (!customer) {
                apiLogger.warn(
                    { ownerId },
                    'HOS-1012: cannot start publish trial — no billing customer row'
                );
                return null;
            }
            if (!PUBLISH_TRIAL_PLAN_SLUG) {
                apiLogger.error(
                    { ownerId, productDomain: PUBLISH_PRODUCT_DOMAIN },
                    'HOS-1012: cannot start publish trial — no trial plan is declared for this vertical'
                );
                return null;
            }
            // `billing_plans.name` IS the slug (SPEC-168 convention; the table
            // has no `slug` column), and soft-deleted plans are excluded — the
            // same filter `getPlanBySlug` applies. `active` is deliberately NOT
            // filtered, exactly as `getPlanBySlug` does not: a trial plan is
            // seeded inactive precisely because it is never sellable, and
            // filtering on it here would make every first publish fail.
            const [plan] = await tx
                .select({ id: billingPlans.id })
                .from(billingPlans)
                .where(
                    and(
                        eq(billingPlans.name, PUBLISH_TRIAL_PLAN_SLUG),
                        isNull(billingPlans.deletedAt)
                    )
                )
                .limit(1);
            if (!plan) {
                apiLogger.error(
                    { ownerId, planSlug: PUBLISH_TRIAL_PLAN_SLUG },
                    'HOS-1012: cannot start publish trial — trial plan not found'
                );
                return null;
            }

            // `trialDays` is deliberately NOT passed: the creator's own default
            // IS `OWNER_TRIAL_DAYS`, and naming it here would create a second
            // place the accommodation trial length is decided. (The DB-side
            // override lives on the plan row — see T-2 in the spec.)
            // `createTrialSubscription` re-reads the plan's `product_domain` and
            // throws when it does not match `productDomain`. That check is what
            // turns a wrong slug→vertical mapping into a loud failure instead of
            // a silent trial consumed in the wrong vertical.
            const { localSubscriptionId, trialEnd } = await createTrialSubscription({
                customerId: customer.id,
                planId: plan.id,
                productDomain: PUBLISH_PRODUCT_DOMAIN,
                // Same single source of truth as `middlewares/billing.ts` and
                // every other local-insert path.
                livemode: !env.HOSPEDA_MERCADO_PAGO_SANDBOX,
                tx
            });
            apiLogger.info(
                {
                    ownerId,
                    customerId: customer.id,
                    subscriptionId: localSubscriptionId,
                    trialEnd: trialEnd.toISOString()
                },
                'HOS-1012: publish started a local trial (no MercadoPago preapproval)'
            );
            return { subscriptionId: localSubscriptionId, customerId: customer.id, trialEnd };
        },

        onTrialStarted: async ({ customerId }): Promise<void> => {
            // INV-1. `createTrialSubscription` deliberately skips this when it
            // is handed a transaction — clearing before the commit would publish
            // entitlements for a row that can still roll back — so this is the
            // ONLY place the trial's cache invalidation happens. A local trial
            // has no preapproval and therefore no webhook: without this the
            // owner keeps their previous (empty) entitlements for the full
            // 5-minute TTL, right after being told their listing is live.
            clearEntitlementCache(customerId);
        }
    };
}

/**
 * Resolves the (non-soft-deleted) billing customer for an owner.
 *
 * Shared by both callbacks so they can never disagree on which row is "the"
 * customer: newest first, soft-deleted excluded (HOS-777), `id` as the
 * tie-breaker so the choice is deterministic when two rows share a timestamp.
 *
 * @param input.db - Drizzle client — the publish transaction's client inside
 *   `startLocalTrial`, the pooled one for the read-only eligibility check.
 * @param input.ownerId - The accommodation owner's user id.
 * @returns The customer row, or `undefined` when none exists.
 */
async function findBillingCustomerByOwnerId({
    db,
    ownerId
}: {
    readonly db: DrizzleClient;
    readonly ownerId: string;
}) {
    const [customer] = await db
        .select()
        .from(billingCustomers)
        .where(and(eq(billingCustomers.externalId, ownerId), isNull(billingCustomers.deletedAt)))
        .orderBy(desc(billingCustomers.createdAt), desc(billingCustomers.id))
        .limit(1);
    return customer;
}
