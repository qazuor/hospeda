/**
 * Subscription Checkout Service (SPEC-126 D8)
 *
 * Encapsulates the business logic that initiates a paid subscription:
 *   - plan slug -> qzpay plan lookup,
 *   - active monthly price resolution,
 *   - `billing.subscriptions.create({ mode: 'paid' })` call,
 *   - `providerInitPoint` extraction with sandbox fallback,
 *   - response shape (`checkoutUrl`, `localSubscriptionId`, `expiresAt`).
 *
 * The function is intentionally framework-agnostic: it takes the resolved
 * `billing` instance, the validated input, and the env-resolved URL
 * builders, and returns either a success response or throws a
 * {@link SubscriptionCheckoutError} with a discriminated `code` that the
 * caller maps to its own protocol (HTTP, gRPC, CLI exit code, etc.).
 *
 * The annual branch is intentionally NOT implemented here — it remains
 * deferred per the SPEC-126 D1 annual follow-up note in `spec.md`.
 *
 * @module services/subscription-checkout.service
 */

import type {
    QZPayBilling,
    QZPayPollingResourceType,
    QZPaySubscriptionWithHelpers
} from '@qazuor/qzpay-core';
import { resolveFreeTrialExtensionPromo } from '@repo/billing';
import {
    type DrizzleClient,
    billingSubscriptions,
    commerceListingSubscriptions,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum, PromoEffectKindEnum } from '@repo/schemas';
import { PromoCodeService } from '@repo/service-core';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

/**
 * Time-to-live applied to a `pending_provider` subscription before the
 * `abandoned-pending-subs` cron (SPEC-126 D6) flips it to `abandoned`.
 * Exported so callers can reference the same constant when building
 * messages or schedules that should agree with the reaper.
 */
export const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/**
 * Inputs for {@link schedulePollingForSubscription}.
 *
 * Aggregates everything the polling-job storage needs plus a `sourceLabel`
 * for log diagnostics (so an operator can tell which checkout flow
 * enqueued the job from log lines alone). Kept internal because it
 * only makes sense inside this module.
 */
interface SchedulePollingInput {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly providerResourceId: string;
    readonly resourceType: QZPayPollingResourceType;
    readonly planSlug: string;
    readonly sourceLabel: string;
}

/**
 * Shared helper to enqueue a subscription-polling job after a paid
 * subscription is initiated. Both monthly (`subscription`) and annual
 * (`one_time_payment`) flows call this so the env-flag check, error
 * handling, and log shapes stay in one place.
 *
 * Skipped silently when:
 *   - The {@link env.HOSPEDA_BILLING_POLLING_ENABLED} flag is off (test/legacy environments).
 *   - The configured storage adapter does not expose `subscriptionPollingJobs`.
 *   - The provider returned no resource id to poll (defensive guard for
 *     callers that pass an empty string).
 *
 * Non-fatal: a polling-enqueue failure is logged but does not throw —
 * the underlying subscription was created successfully and the webhook
 * remains the primary activation path. This mirrors how the prior
 * inline implementation behaved on the monthly flow.
 */
async function schedulePollingForSubscription(input: SchedulePollingInput): Promise<void> {
    const { billing, subscriptionId, providerResourceId, resourceType, planSlug, sourceLabel } =
        input;

    if (!env.HOSPEDA_BILLING_POLLING_ENABLED) {
        return;
    }

    if (!providerResourceId) {
        apiLogger.warn(
            { subscriptionId, resourceType, sourceLabel },
            'Skipping polling enqueue — provider returned no resource id (cannot poll)'
        );
        return;
    }

    const pollingStorage = billing.getStorage().subscriptionPollingJobs;
    if (!pollingStorage) {
        return;
    }

    try {
        const job = await pollingStorage.create({
            subscriptionId,
            providerResourceId,
            resourceType,
            provider: 'mercadopago',
            metadata: {
                source: sourceLabel,
                planSlug
            }
        });
        if (job) {
            apiLogger.debug(
                {
                    jobId: job.id,
                    subscriptionId,
                    providerResourceId,
                    resourceType,
                    nextPollAt: job.nextPollAt.toISOString()
                },
                'Scheduled subscription polling fallback'
            );
        } else {
            apiLogger.warn(
                { subscriptionId, providerResourceId, resourceType },
                'Active polling job already exists for subscription — skipping enqueue'
            );
        }
    } catch (error) {
        // Non-fatal: subscription was created successfully; failing to
        // schedule polling means we rely entirely on the webhook for
        // activation. Log so an operator can investigate.
        apiLogger.error(
            {
                subscriptionId,
                providerResourceId,
                resourceType,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to enqueue subscription polling job — webhook is the only path now'
        );
    }
}

/**
 * Error codes surfaced by {@link initiatePaidMonthlySubscription}. Each
 * value maps to a distinct user-facing condition; route handlers
 * translate them to HTTP status codes.
 */
export type SubscriptionCheckoutErrorCode =
    | 'PLAN_NOT_FOUND'
    | 'NO_MONTHLY_PRICE'
    | 'NO_ANNUAL_PRICE'
    | 'NO_MATCHING_PRICE'
    | 'CUSTOMER_NOT_FOUND'
    | 'MISSING_INIT_POINT'
    | 'INVALID_PROMO_CODE'
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'SAME_PLAN'
    | 'NOT_AN_UPGRADE';

/**
 * Domain-level error thrown by {@link initiatePaidMonthlySubscription}.
 * Carries a discriminated `code` so callers can branch on the failure
 * mode without parsing `message`.
 */
export class SubscriptionCheckoutError extends Error {
    constructor(
        public readonly code: SubscriptionCheckoutErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'SubscriptionCheckoutError';
    }
}

/**
 * Resolve a plan by its slug. Hospeda treats `QZPayPlan.name` as the
 * slug (mirrors `trial.service.ts:124`). Returns `null` when no plan
 * matches; callers decide whether to throw or fall back.
 */
async function resolvePlanBySlug(billing: QZPayBilling, planSlug: string) {
    const plansResult = await billing.plans.list();
    return plansResult.data.find((p) => p.name === planSlug) ?? null;
}

/**
 * Get the human-facing display name for a plan, falling back to the slug
 * when no display name is configured.
 *
 * Hospeda stores the slug as `billing_plans.name` (the QZPay-facing lookup
 * key) and the human label in `billing_plans.metadata.displayName` (set by
 * the seed from `PlanDefinition.name`). MercadoPago shows whatever string we
 * pass as the line-item title to the buyer, so this helper centralises the
 * "prefer display name, fall back to slug" rule used by every checkout
 * builder in this file. Slugs like `owner-basico` look bad in the MP
 * checkout screen — display names like `Basic` are what we want.
 */
function getPlanDisplayName(plan: { readonly name: string; readonly metadata?: unknown }): string {
    if (
        typeof plan.metadata === 'object' &&
        plan.metadata !== null &&
        'displayName' in plan.metadata
    ) {
        const displayName = (plan.metadata as Record<string, unknown>).displayName;
        if (typeof displayName === 'string' && displayName.length > 0) {
            return displayName;
        }
    }
    return plan.name;
}

interface PriceShape {
    id: string;
    billingInterval: string;
    intervalCount: number;
    active: boolean;
}

/**
 * Resolve the monthly price within a plan. qzpay-core uses `'month'` with
 * `intervalCount: 1` for monthly; the multi-month variants (quarterly,
 * semi_annual) have the same `'month'` interval but different counts and
 * must be excluded — they belong to plan-change flows, not the initial
 * paid-sub entry point.
 */
function findMonthlyPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'month' && p.intervalCount === 1) ??
        null
    );
}

/**
 * Resolve the annual price within a plan. Matches qzpay-core's `'year'`
 * with `intervalCount: 1`. Hospeda's annual variant is a one-time
 * upfront charge with the discounted full-year price (no recurring
 * preapproval), so a single matching row is sufficient.
 */
function findAnnualPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'year' && p.intervalCount === 1) ??
        null
    );
}

/**
 * Inputs for {@link computePlanChangeDelta}. All monetary fields are
 * integers in CENTAVOS (matches `billing_prices.unit_amount` storage).
 */
export interface ComputePlanChangeDeltaInput {
    /** Current plan's recurring price for the active interval. */
    readonly currentPriceCentavos: number;
    /** Target plan's recurring price for the same interval. */
    readonly targetPriceCentavos: number;
    /** Start of the active billing period (from `billing_subscriptions`). */
    readonly currentPeriodStart: Date;
    /** End of the active billing period. */
    readonly currentPeriodEnd: Date;
    /**
     * "Now" reference for the proration. Injected so tests can lock the
     * clock; production callers omit and the helper uses `new Date()`.
     */
    readonly now?: Date;
}

/**
 * Prorated upgrade-delta amount, in centavos, that the user should be
 * charged upfront for the change to take effect for the remainder of
 * the current billing period.
 *
 * Formula (SPEC-122 Sub-decision 3):
 *
 *   delta = (target - current) * remaining_ms / total_ms
 *
 * Returned value is rounded to the nearest centavo. Negative or zero
 * values indicate no charge is needed (downgrade, equal-priced swap,
 * or the cycle already ended) — the caller decides what to do in
 * those cases.
 *
 * Defensive against degenerate periods (start >= end) — returns 0
 * rather than throwing, so a corrupted local row cannot 500 the
 * upgrade route.
 */
export function computePlanChangeDelta(input: ComputePlanChangeDeltaInput): number {
    const { currentPriceCentavos, targetPriceCentavos, currentPeriodStart, currentPeriodEnd } =
        input;
    const now = input.now ?? new Date();

    const totalMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    if (totalMs <= 0) {
        return 0;
    }

    const remainingMs = Math.max(0, currentPeriodEnd.getTime() - now.getTime());
    const remainingRatio = Math.min(1, remainingMs / totalMs);

    const deltaPerPeriod = targetPriceCentavos - currentPriceCentavos;
    return Math.round(deltaPerPeriod * remainingRatio);
}

/**
 * Input for {@link initiatePaidMonthlySubscription}.
 *
 * `urls.paymentMethodReturnUrl` and `urls.notificationUrl` are injected
 * by the caller because they depend on env vars (`HOSPEDA_SITE_URL`,
 * `HOSPEDA_API_URL`). Keeping them as inputs makes the service trivially
 * testable: no env mock required.
 */
export interface InitiatePaidMonthlySubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /** Plan slug — matched against `QZPayPlan.name`. */
    readonly planSlug: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        /** MercadoPago `back_url` for the preapproval. */
        readonly paymentMethodReturnUrl: string;
        /** Override webhook destination for this preapproval. */
        readonly notificationUrl: string;
    };
    /**
     * Optional promo code (SPEC-126 D9). Currently only
     * `type: 'free_trial_extension'` promos are honored — they translate
     * to `freeTrialDays` on the qzpay subscription create input. An
     * unknown or non-extension code surfaces as
     * `SubscriptionCheckoutError('INVALID_PROMO_CODE')`, which the route
     * maps to HTTP 422.
     */
    readonly promoCode?: string;
}

/**
 * Output shape of a successful initiation. Mirrors
 * `StartPaidSubscriptionResponse` from `@repo/schemas` but stays
 * decoupled from the schema package so the service is reusable from
 * non-API contexts (e.g. a CLI seed script).
 */
export interface InitiatePaidMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
}

/**
 * Initiate a paid monthly subscription via qzpay-core's `mode: 'paid'`
 * create flow. The returned subscription is in qzpay's `incomplete`
 * state until the user authorizes the recurring charge in MP and the
 * `subscription_preapproval.created` webhook (SPEC-126 D3) flips it to
 * `active`.
 *
 * @throws SubscriptionCheckoutError When the plan or monthly price is
 *   missing, or when the payment adapter is misconfigured and returns
 *   no init point.
 */
export async function initiatePaidMonthlySubscription(
    input: InitiatePaidMonthlySubscriptionInput
): Promise<InitiatePaidMonthlySubscriptionResult> {
    const { customerId, planSlug, billing, urls, promoCode } = input;

    // Resolve the promo code BEFORE the qzpay call so an invalid code does
    // not leave a half-created subscription behind.
    //
    // SPEC-262 T-005: For trial_extension effects we now read `extraDays` from
    // the DB-persisted effect (via PromoCodeService) rather than the hardcoded
    // config (resolveFreeTrialExtensionPromo). This ensures that changes to
    // trial periods made in the admin (once the admin form lands in T-009/T-010)
    // are honored at checkout without a deploy.
    //
    // For codes NOT in the DB (or without a trial_extension effect), we fall
    // back to the config-backed resolveFreeTrialExtensionPromo for backward
    // compat (covers FREEMONTH before the backfill migration in T-003 runs).
    //
    // TODO(SPEC-262 T-008): when the full route rewrite ships, retire the
    // config-backed fallback and require all trial-extension codes to be in
    // the DB with effect_kind='trial_extension'.
    let freeTrialDays: number | undefined;
    if (promoCode !== undefined && promoCode.length > 0) {
        // --- DB-backed path (SPEC-262 T-005) ---
        const promoService = new PromoCodeService();
        const promoResult = await promoService.getByCode(promoCode);

        if (promoResult.success && promoResult.data) {
            const dbCode = promoResult.data;

            if (!dbCode.active) {
                throw new SubscriptionCheckoutError(
                    'INVALID_PROMO_CODE',
                    `Promo code '${promoCode}' is not active`
                );
            }

            if (dbCode.effect?.kind === PromoEffectKindEnum.TRIAL_EXTENSION) {
                // DB-persisted trial extension — use extraDays from the effect.
                freeTrialDays = dbCode.effect.extraDays;
            } else if (dbCode.effect?.kind === PromoEffectKindEnum.COMP) {
                // Comp (free-forever, Model β) must NEVER create an MP preapproval.
                // This self-serve monthly path can only create a PAID subscription
                // (mode:'paid' → preapproval), which would BILL a code that must be
                // free — a fail-open on the charge surface (AC-2.1). So we reject:
                // comp grants are admin-driven (US-2). The full comp-subscription
                // creation flow (status='comp', no preapproval) is wired in T-008.
                throw new SubscriptionCheckoutError(
                    'INVALID_PROMO_CODE',
                    `Promo code '${promoCode}' is a complimentary (free-forever) code and cannot be redeemed at self-serve checkout. Comp grants are applied by an administrator.`
                );
            } else if (dbCode.effect?.kind === PromoEffectKindEnum.DISCOUNT) {
                // Discount codes are not honored at monthly subscription creation
                // (SPEC-126 D9 / master plan Decision 4 — only trial extensions
                // apply to monthly recurring at signup). Fall through to error.
                throw new SubscriptionCheckoutError(
                    'INVALID_PROMO_CODE',
                    `Promo code '${promoCode}' is a discount code and cannot be applied at monthly subscription signup. Use a trial extension code.`
                );
            } else {
                // DB code exists but has no typed effect (legacy row, not yet
                // backfilled). Fall through to the config-backed path below.
                const resolved = resolveFreeTrialExtensionPromo(promoCode);
                if (!resolved) {
                    throw new SubscriptionCheckoutError(
                        'INVALID_PROMO_CODE',
                        `Promo code '${promoCode}' is not a valid free-trial extension`
                    );
                }
                freeTrialDays = resolved.extraTrialDays;
            }
        } else {
            // Code not in DB — fall back to config-backed resolution.
            // This covers the period before the admin create-promo-code route
            // is updated (T-008) or before FREEMONTH is backfilled (T-003).
            const resolved = resolveFreeTrialExtensionPromo(promoCode);
            if (!resolved) {
                throw new SubscriptionCheckoutError(
                    'INVALID_PROMO_CODE',
                    `Promo code '${promoCode}' is not a valid free-trial extension`
                );
            }
            freeTrialDays = resolved.extraTrialDays;
        }
    }

    const plan = await resolvePlanBySlug(billing, planSlug);

    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);

    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MONTHLY_PRICE',
            `Plan '${planSlug}' has no active monthly price`
        );
    }

    const subscription: QZPaySubscriptionWithHelpers = await billing.subscriptions.create({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        mode: 'paid',
        billingInterval: 'monthly',
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        // SPEC-126 D9: extra free-trial days are forwarded to the MP
        // preapproval so the first recurring charge is delayed by N days.
        // Omitted when no qualifying promo code was supplied.
        ...(freeTrialDays !== undefined ? { freeTrialDays } : {}),
        metadata: {
            source: 'start-paid-monthly',
            createdBy: 'subscription-flow',
            ...(promoCode !== undefined ? { promoCode } : {})
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;

    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // SPEC-143 Finding #17 fallback: enqueue a polling job that will flip
    // the local subscription to `active` if the `subscription_preapproval.created`
    // webhook fails to arrive in time. Webhook still wins the race when it
    // does arrive — the poller treats an already-active subscription as a
    // no-op. The helper handles the env-flag check, missing-storage guard,
    // and error logging.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: subscription.id,
        providerResourceId: subscription.providerSubscriptionIds?.mercadopago ?? '',
        resourceType: 'subscription',
        planSlug,
        sourceLabel: 'start-paid-monthly'
    });

    return {
        checkoutUrl,
        localSubscriptionId: subscription.id,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}

/**
 * Input for {@link initiateCommerceMonthlySubscription} (SPEC-239 T-048).
 *
 * Mirrors {@link InitiatePaidMonthlySubscriptionInput} but adds the commerce
 * entity coordinates so the function can stamp the new subscription as a
 * commerce-domain sub (D3) and upsert the `commerce_listing_subscriptions`
 * link row (D4). No promo support — commerce listings have no trial promos.
 */
export interface InitiateCommerceMonthlySubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID of the listing owner). */
    readonly customerId: string;
    /** Plan slug — matched against `QZPayPlan.name` (the commerce plan slug). */
    readonly planSlug: string;
    /** Commerce entity discriminator (e.g. `'gastronomy'`). */
    readonly entityType: string;
    /** UUID of the commerce entity being subscribed (gastronomies.id, etc.). */
    readonly entityId: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        readonly paymentMethodReturnUrl: string;
        readonly notificationUrl: string;
    };
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
}

/**
 * Output shape for a commerce subscription initiation. Mirrors the
 * accommodation monthly result so the route returns either uniformly.
 */
export interface InitiateCommerceMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
}

/**
 * Initiate a monthly commerce-listing subscription (SPEC-239 T-048).
 *
 * Reuses the accommodation `mode: 'paid'` MP preapproval flow, then:
 *   1. (D3) stamps `billing_subscriptions.product_domain = 'commerce'` via a raw
 *      SQL UPDATE — the column is NOT in qzpay-core's TS schema (extras carril).
 *   2. (D4) upserts the `commerce_listing_subscriptions` link row keyed on the
 *      UNIQUE(entity_type, entity_id) constraint (one link per entity), so a
 *      re-subscription overwrites `subscriptionId` + `status` rather than
 *      inserting a duplicate.
 *
 * The link row is created with `status = subscription.status` (qzpay's
 * `incomplete` until the preapproval webhook activates it). The visibility
 * reconciler flips the listing to PUBLIC once the webhook/cron applies an
 * active status.
 *
 * @throws SubscriptionCheckoutError When the plan or monthly price is missing,
 *   or when the payment adapter returns no init point.
 */
export async function initiateCommerceMonthlySubscription(
    input: InitiateCommerceMonthlySubscriptionInput
): Promise<InitiateCommerceMonthlySubscriptionResult> {
    const { customerId, planSlug, entityType, entityId, billing, urls } = input;

    const plan = await resolvePlanBySlug(billing, planSlug);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);
    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MONTHLY_PRICE',
            `Plan '${planSlug}' has no active monthly price`
        );
    }

    const subscription: QZPaySubscriptionWithHelpers = await billing.subscriptions.create({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        mode: 'paid',
        billingInterval: 'monthly',
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        metadata: {
            source: 'start-commerce-monthly',
            createdBy: 'commerce-subscription-flow',
            productDomain: ProductDomainEnum.COMMERCE,
            entityType,
            entityId
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // D3 + D4 are wrapped in a single transaction so the commerce path can never
    // end up with a billing_subscriptions row stamped 'commerce' but no link row
    // (or vice versa). A partial write would leave the listing unrecoverable: it
    // could never be reconciled to PUBLIC even after the owner pays.
    await withTransaction(async (tx) => {
        // D3: stamp product_domain='commerce' on the freshly-created subscription.
        // (tx reuses a caller-provided boundary via input.db when present.)
        // The column is not in QZPay's TS schema, so we set it with raw SQL.
        await tx.execute(
            sql`UPDATE billing_subscriptions SET product_domain = ${ProductDomainEnum.COMMERCE} WHERE id = ${subscription.id}`
        );

        // D4: upsert the commerce_listing_subscriptions link row (one per entity).
        // On the UNIQUE(entity_type, entity_id) conflict, update subscriptionId +
        // status so re-subscribing an entity reuses the same link row.
        await tx
            .insert(commerceListingSubscriptions)
            .values({
                subscriptionId: subscription.id,
                productDomain: ProductDomainEnum.COMMERCE,
                entityType,
                entityId,
                status: subscription.status
            })
            .onConflictDoUpdate({
                target: [
                    commerceListingSubscriptions.entityType,
                    commerceListingSubscriptions.entityId
                ],
                set: {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    updatedAt: new Date()
                }
            });
    }, input.db);

    // Polling fallback — same as the accommodation monthly flow.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: subscription.id,
        providerResourceId: subscription.providerSubscriptionIds?.mercadopago ?? '',
        resourceType: 'subscription',
        planSlug,
        sourceLabel: 'start-commerce-monthly'
    });

    return {
        checkoutUrl,
        localSubscriptionId: subscription.id,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}

/**
 * Input for {@link initiatePaidAnnualSubscription}.
 *
 * Annual subscriptions skip MercadoPago's preapproval API entirely:
 * we charge the full annual amount upfront via `billing.checkout`
 * (`mode: 'payment'`) and persist a local `billing_subscriptions`
 * row directly. Because qzpay-core's `subscriptions.create()` path
 * hard-codes monthly billing-interval and a +30d period in the
 * storage adapter, it cannot be parameterized for the annual
 * lifecycle — hence the direct Drizzle insert.
 *
 * `urls` is split into `successUrl` / `cancelUrl` (not the monthly's
 * single `paymentMethodReturnUrl`) because MP's hosted checkout
 * distinguishes both return paths.
 */
export interface InitiatePaidAnnualSubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /** Plan slug — matched against `QZPayPlan.name`. */
    readonly planSlug: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        /** Where MP sends the user after a successful payment. */
        readonly successUrl: string;
        /** Where MP sends the user if they abandon the checkout. */
        readonly cancelUrl: string;
        /** Webhook destination for this checkout. */
        readonly notificationUrl: string;
    };
    /**
     * Provider-side statement descriptor (cardholder bank statement).
     * MP expects 1-11 ASCII uppercase chars / digits / spaces. When
     * omitted the adapter applies its provider default.
     */
    readonly statementDescriptor?: string;
    /**
     * Drizzle client override for tests. Production callers omit it
     * and `getDb()` resolves the runtime client.
     */
    readonly db?: DrizzleClient;
}

/**
 * Output shape of a successful annual initiation. Mirrors the monthly
 * shape so the route handler can return either uniformly.
 */
export interface InitiatePaidAnnualSubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
}

/**
 * Initiate a paid annual subscription via qzpay-core's
 * `billing.checkout.create({ mode: 'payment' })` one-time flow. The
 * returned local subscription sits in `pending_provider` until the
 * `payment.updated` webhook (status `approved` / `accredited`) flips
 * it to `active` by matching `metadata.annualSubscriptionId`.
 *
 * Unlike the monthly path, the local row is inserted directly into
 * `billing_subscriptions` (see {@link InitiatePaidAnnualSubscriptionInput}
 * for why qzpay's facade cannot be used here). The
 * `abandoned-pending-subs` cron (SPEC-126 D6) will collect the row if
 * the user never completes the checkout within `PENDING_PROVIDER_TTL_MS`.
 *
 * @throws SubscriptionCheckoutError When the plan, annual price, or
 *   customer is missing, or when the checkout adapter returns no init
 *   point.
 */
export async function initiatePaidAnnualSubscription(
    input: InitiatePaidAnnualSubscriptionInput
): Promise<InitiatePaidAnnualSubscriptionResult> {
    const { customerId, planSlug, billing, urls, statementDescriptor } = input;
    const db = input.db ?? getDb();

    const plan = await resolvePlanBySlug(billing, planSlug);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    const annualPrice = findAnnualPrice(plan.prices);
    if (!annualPrice) {
        throw new SubscriptionCheckoutError(
            'NO_ANNUAL_PRICE',
            `Plan '${planSlug}' has no active annual price`
        );
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const localSubscriptionId = crypto.randomUUID();

    // Insert the local sub row BEFORE creating the provider checkout so
    // the localSubscriptionId can be embedded in the checkout metadata
    // (the webhook handler matches on it to flip the row to `active`).
    // If the checkout call fails downstream, the row is left in
    // `pending_provider` and the abandoned-pending-subs cron will
    // collect it after the TTL — no manual rollback needed.
    await db.insert(billingSubscriptions).values({
        id: localSubscriptionId,
        customerId,
        planId: plan.id,
        billingInterval: 'year',
        intervalCount: 1,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: 'pending_provider',
        livemode: customer.livemode,
        metadata: {
            source: 'start-paid-annual',
            createdBy: 'subscription-flow',
            planSlug,
            annualPriceId: annualPrice.id,
            billingInterval: 'annual'
        }
    });

    // Split customer.name on the first whitespace for MP's payer fields
    // (mirrors the qzpay-core monthly subscription create path).
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                unitAmount: annualPrice.unitAmount,
                currency: 'ARS',
                quantity: 1,
                title: `${getPlanDisplayName(plan)} (Annual)`,
                categoryId: 'services'
            }
        ],
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        customerId,
        customerEmail: customer.email,
        ...(customer.name ? { customerName: customer.name } : {}),
        ...(firstName ? { payerFirstName: firstName } : {}),
        ...(rest.length > 0 ? { payerLastName: rest.join(' ') } : {}),
        notificationUrl: urls.notificationUrl,
        ...(statementDescriptor ? { statementDescriptor } : {}),
        idempotencyKey: localSubscriptionId,
        metadata: {
            annualSubscriptionId: localSubscriptionId,
            planSlug,
            billingInterval: 'annual'
        }
    });

    const checkoutUrl = checkout.providerInitPoint ?? checkout.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // SPEC-143 Finding #21 fallback: enqueue a polling job that flips
    // the local subscription to `active` if the `payment.created`/
    // `payment.updated` webhook for the annual one-time charge fails
    // to arrive (current production state: MP Preferences only deliver
    // legacy IPN, which the marker filter drops as duplicate).
    //
    // `checkout.id` is the LOCAL checkout-session UUID assigned by the
    // qzpay-core orchestrator and propagated to MP as `external_reference`
    // — the cron searches MP payments by that field. The webhook still
    // wins when it does arrive; both call sites go through the
    // idempotent `confirmAnnualSubscription`.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: localSubscriptionId,
        providerResourceId: checkout.id,
        resourceType: 'one_time_payment',
        planSlug,
        sourceLabel: 'start-paid-annual'
    });

    return {
        checkoutUrl,
        localSubscriptionId,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}

/**
 * Input for {@link initiatePaidPlanUpgrade}.
 *
 * Unlike monthly/annual the caller already has the local subscription
 * id on hand (from the active sub lookup the route does anyway), so
 * we accept it directly instead of re-resolving via
 * `billing.subscriptions.getByCustomerId`. This also makes the test
 * surface simpler — no need to mock a list query just to pick the
 * active row.
 *
 * `billingInterval` uses qzpay-core's enum (`'month'` / `'year'`) and
 * `intervalCount` matches the storage column. The caller is responsible
 * for mapping its public-facing enum (monthly/annual/quarterly/…) into
 * this pair — `plan-change.ts` already has `mapBillingIntervalToQZPay`
 * for that, and reusing it keeps the conversion in one place.
 */
export interface InitiatePaidPlanUpgradeInput {
    /** Local billing customer id (the qzpay customer id). */
    readonly customerId: string;
    /** Local subscription id of the currently-active sub being upgraded. */
    readonly currentSubscriptionId: string;
    /** Target plan id (UUID — from `billing_plans.id`, NOT the slug). */
    readonly newPlanId: string;
    /** Billing interval the upgrade keeps using (e.g. `'month'`). */
    readonly billingInterval: 'month' | 'year';
    /** Interval count (e.g. 1 for monthly, 3 for quarterly). */
    readonly intervalCount: number;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        readonly successUrl: string;
        readonly cancelUrl: string;
        readonly notificationUrl: string;
    };
    /** Provider-side statement descriptor (1–11 ASCII chars). */
    readonly statementDescriptor?: string;
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
    /** Clock override for tests (used by `computePlanChangeDelta`). */
    readonly now?: Date;
}

/**
 * Output shape of a successful upgrade initiation. The caller exposes
 * `checkoutUrl` to the front and persists `deltaCentavos` /
 * `newPlanId` for the audit trail. The local subscription id is
 * returned for symmetry with monthly/annual, even though here it is
 * the same id the caller already had (the sub being upgraded).
 */
export interface InitiatePaidPlanUpgradeResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
    readonly newPlanId: string;
    readonly deltaCentavos: number;
}

/**
 * Initiate a paid plan upgrade via a one-time MP checkout for the
 * prorated delta (SPEC-141 D7).
 *
 * Flow:
 *   1. Load the active sub (`currentSubscriptionId`), reject if missing
 *      or `same plan`.
 *   2. Load current + target plans, resolve their price rows for the
 *      sub's billing interval.
 *   3. Compute prorated delta via {@link computePlanChangeDelta}.
 *   4. Reject with `NOT_AN_UPGRADE` when delta ≤ 0 — downgrades have
 *      their own (scheduled) flow in Fase 4.
 *   5. Load the customer for payer fields and `livemode` consistency.
 *   6. Create a one-time MP checkout with metadata
 *      `{ planChangeUpgradeId, oldPlanId, newPlanId, newPriceId,
 *      targetTransactionAmountMajor }` so the
 *      `payment.updated` webhook can finish the transition.
 *
 * IMPORTANT: this function does NOT mutate the local subscription. The
 * change is committed by `confirmPlanUpgrade` in the webhook layer
 * after the user actually pays the delta.
 *
 * @throws SubscriptionCheckoutError When any precondition is missing.
 */
export async function initiatePaidPlanUpgrade(
    input: InitiatePaidPlanUpgradeInput
): Promise<InitiatePaidPlanUpgradeResult> {
    const {
        customerId,
        currentSubscriptionId,
        newPlanId,
        billingInterval,
        intervalCount,
        billing,
        urls,
        statementDescriptor
    } = input;

    const sub = await billing.subscriptions.get(currentSubscriptionId);
    if (!sub) {
        throw new SubscriptionCheckoutError(
            'SUBSCRIPTION_NOT_FOUND',
            `Subscription '${currentSubscriptionId}' not found`
        );
    }

    // SAME_PLAN is true ONLY when both the plan id AND the billing
    // interval+count match the user's current subscription. Allowing the
    // same plan with a different interval enables cycle change flows
    // (monthly ↔ annual on the same tier) — see SPEC-143 T-143-61.
    const currentInterval = sub.interval;
    const currentIntervalCount = sub.intervalCount ?? 1;
    const isSamePlan = sub.planId === newPlanId;
    const isSameInterval =
        currentInterval === billingInterval && currentIntervalCount === intervalCount;
    if (isSamePlan && isSameInterval) {
        throw new SubscriptionCheckoutError(
            'SAME_PLAN',
            'Cannot upgrade to the same plan with the same billing interval'
        );
    }

    const [currentPlan, targetPlan] = await Promise.all([
        billing.plans.get(sub.planId),
        billing.plans.get(newPlanId)
    ]);

    if (!currentPlan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Current plan '${sub.planId}' not found`
        );
    }
    if (!targetPlan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Target plan '${newPlanId}' not found`
        );
    }

    const matchesInterval = (
        wantedInterval: string,
        wantedIntervalCount: number
    ): ((p: {
        billingInterval: string;
        intervalCount?: number | null;
        active: boolean;
    }) => boolean) => {
        return (p) =>
            p.active &&
            p.billingInterval === wantedInterval &&
            (p.intervalCount ?? 1) === wantedIntervalCount;
    };

    // currentPrice MUST be resolved against the user's CURRENT
    // subscription interval — otherwise cycle change flows compute a
    // zero delta (same-plan annual current price === same-plan annual
    // target price) and the upgrade flow rejects with NOT_AN_UPGRADE.
    // The target price keeps using the REQUESTED interval since that
    // is what the user will be billed for going forward.
    const currentPrice = currentPlan.prices.find(
        matchesInterval(currentInterval, currentIntervalCount)
    );
    const targetPrice = targetPlan.prices.find(matchesInterval(billingInterval, intervalCount));

    if (!currentPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MATCHING_PRICE',
            `Current plan has no active price for the subscription's current interval '${currentInterval}'/${currentIntervalCount}`
        );
    }
    if (!targetPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MATCHING_PRICE',
            `Target plan has no active price for interval '${billingInterval}'/${intervalCount}`
        );
    }

    const deltaCentavos = computePlanChangeDelta({
        currentPriceCentavos: currentPrice.unitAmount,
        targetPriceCentavos: targetPrice.unitAmount,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        ...(input.now ? { now: input.now } : {})
    });

    if (deltaCentavos <= 0) {
        throw new SubscriptionCheckoutError(
            'NOT_AN_UPGRADE',
            `Computed delta is ${deltaCentavos}; route caller must handle downgrades separately`
        );
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    // qzpay stores prices in centavos; MP `auto_recurring.transaction_amount`
    // expects major units. We forward MAJOR units in metadata so the
    // webhook handler can pass it straight to paymentAdapter.subscriptions.update
    // without re-deriving it from a DB lookup.
    const targetTransactionAmountMajor = targetPrice.unitAmount / 100;

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                unitAmount: deltaCentavos,
                currency: 'ARS',
                quantity: 1,
                title: `${getPlanDisplayName(targetPlan)} (Upgrade prorated)`,
                categoryId: 'services'
            }
        ],
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        customerId,
        customerEmail: customer.email,
        ...(customer.name ? { customerName: customer.name } : {}),
        ...(firstName ? { payerFirstName: firstName } : {}),
        ...(rest.length > 0 ? { payerLastName: rest.join(' ') } : {}),
        notificationUrl: urls.notificationUrl,
        ...(statementDescriptor ? { statementDescriptor } : {}),
        idempotencyKey: `${currentSubscriptionId}:upgrade:${newPlanId}`,
        metadata: {
            planChangeUpgradeId: currentSubscriptionId,
            oldPlanId: sub.planId,
            newPlanId,
            newPriceId: targetPrice.id,
            targetTransactionAmountMajor,
            deltaCentavos
        }
    });

    const checkoutUrl = checkout.providerInitPoint ?? checkout.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    return {
        checkoutUrl,
        localSubscriptionId: currentSubscriptionId,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
        newPlanId,
        deltaCentavos
    };
}

/**
 * Test-only exports for unit-testing the pure helpers without round-
 * tripping through the public initiators.
 */
export const _internals = {
    resolvePlanBySlug,
    findMonthlyPrice,
    findAnnualPrice,
    computePlanChangeDelta
};
