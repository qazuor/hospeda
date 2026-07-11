/**
 * Shared low-level annual-subscription-create helper (HOS-123 T-001).
 *
 * Extracted verbatim from `initiatePaidAnnualSubscription`
 * (`subscription-checkout.service.ts:1114-1453`) so the exact one-time-charge
 * MercadoPago contract — the `pending_provider` local `billing_subscriptions`
 * insert, the `billing.checkout.create({ mode: 'payment', ... })` call, the
 * `providerInitPoint` / `providerSandboxInitPoint` resolution, and the
 * fail-closed `MISSING_INIT_POINT` guard — has exactly ONE implementation.
 * Both the first-subscription annual checkout flow
 * (`initiatePaidAnnualSubscription`, refactored to consume this helper in
 * HOS-123 T-002) and the annual-reactivation flow (HOS-123 T-008/T-009) call
 * this helper instead of duplicating the create-and-persist block.
 *
 * Mirrors the sibling `createPaidSubscription` (`billing/paid-subscription-create.ts`,
 * HOS-114 T-002) — same low-level, no-promo/no-trial discipline — but for the
 * annual `mode: 'payment'` one-time charge instead of the monthly `mode: 'paid'`
 * recurring preapproval.
 *
 * Deliberately low-level (HOS-123 spec OQ-2): it does NOT resolve a plan by
 * slug, does NOT run promo/trial/comp logic, and does NOT enforce any
 * "already subscribed" guard. Callers resolve a concrete `plan` + `priceId`
 * and compute the final `chargeAmountCentavos` (post-discount, if any) first
 * — this is what lets a slug-keyed caller (checkout, which resolves via
 * `resolvePlanBySlug`) and a UUID-keyed caller (reactivation, which resolves
 * via `resolveReactivationPlan`) share the same helper without either owning
 * the other's identifier space.
 *
 * `metadata` is propagated verbatim onto the `billing.checkout.create` call's
 * `metadata` (merged with the fixed `annualSubscriptionId` / `billingInterval`
 * keys the webhook matcher relies on) AND onto the local row's own `metadata`
 * column, so a caller-supplied field — e.g. the reactivation flow's
 * `supersedesSubscriptionId` / `convertedFromTrial` (HOS-123 T-008/T-009) — is
 * visible to both the `payment.updated` webhook handler and any reconciliation
 * query that reads the local row directly.
 *
 * The polling-fallback enqueue (mirrors `schedulePollingForSubscription` in
 * `subscription-checkout.service.ts`) is deliberately re-implemented locally
 * rather than imported: that function is private to (not exported from)
 * `subscription-checkout.service.ts`, and this module must not import from
 * it (that file already imports `TrialService`, and `trial.service.ts` is
 * the eventual caller of this helper — importing back would create the same
 * ESM cycle `subscription-checkout-error.ts` was extracted to avoid). This
 * mirrors the established precedent in `addon.checkout.ts`'s
 * `scheduleAddonCheckoutPolling`, which duplicates the same pattern for the
 * identical reason.
 *
 * @module services/billing/create-annual-subscription
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptions, type DrizzleClient, getDb } from '@repo/db';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Minimal plan shape this helper needs. Callers pass whatever resolved plan
 * object they already have (a full `QZPayPlan`, or a narrower reactivation
 * projection) — only `id` (persisted as `billing_subscriptions.plan_id`) and
 * `name` / `metadata` (used to build the MP line-item title, same as
 * `getPlanDisplayName` in `subscription-checkout.service.ts`) are read.
 */
export interface CreateAnnualSubscriptionPlan {
    /** Resolved qzpay plan ID (`billing_plans.id`, a UUID). */
    readonly id: string;
    /** qzpay plan slug (`billing_plans.name`) — the display-name fallback. */
    readonly name: string;
    /** Plan metadata; `metadata.displayName` (if a non-empty string) wins over `name` for the MP line-item title. */
    readonly metadata?: unknown;
}

/**
 * Input for {@link createAnnualSubscription}.
 */
export interface CreateAnnualSubscriptionInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /**
     * Resolved plan. The caller is responsible for resolving this
     * beforehand — by slug (checkout) or by whatever identifier its own
     * contract carries (reactivation) — this helper never looks a plan up
     * itself.
     */
    readonly plan: CreateAnnualSubscriptionPlan;
    /** Resolved qzpay annual price ID (`billing_prices.id`) for {@link plan}. */
    readonly priceId: string;
    /**
     * Final amount to charge, in centavos. Already reflects any discount the
     * caller applied — this helper performs NO promo computation of its own.
     */
    readonly chargeAmountCentavos: number;
    /** MP hosted-checkout return URLs (annual uses `mode: 'payment'`, which has two return paths, unlike monthly's single `paymentMethodReturnUrl`). */
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
     * Arbitrary metadata merged onto BOTH the local row's `metadata` column
     * and the MP checkout session's `metadata` (which the `payment.updated`
     * webhook matches on). Reactivation callers (HOS-123 T-008/T-009) pass
     * `supersedesSubscriptionId` / `convertedFromTrial` here.
     */
    readonly metadata?: Readonly<Record<string, string>>;
    /**
     * Pre-generated local subscription id override (HOS-123 T-002). When a
     * caller must reference the row's id BEFORE it exists — e.g. the annual
     * checkout's discount-redemption gate, which records
     * `promo_code_usages.subscription_id` optimistically ahead of the
     * `redeemAndRecordUsage` call that GATES whether this helper may even
     * run — it generates the id itself and passes it here so the persisted
     * row (and the checkout metadata's `annualSubscriptionId`) end up using
     * that SAME id instead of a second, unrelated one. Omitted by every
     * other caller, which gets a fresh `crypto.randomUUID()` as before.
     */
    readonly localSubscriptionId?: string;
    /**
     * Drizzle client override for tests. Production callers omit it
     * and `getDb()` resolves the runtime client.
     */
    readonly db?: DrizzleClient;
}

/**
 * Result of a successful {@link createAnnualSubscription} call. `checkoutUrl`
 * is guaranteed non-empty: the helper throws
 * {@link SubscriptionCheckoutError} (`MISSING_INIT_POINT`) instead of ever
 * returning a result with no checkout URL.
 */
export interface CreateAnnualSubscriptionResult {
    /** The `pending_provider` local subscription row's id. */
    readonly localSubscriptionId: string;
    /** MercadoPago hosted-checkout URL the caller must redirect the user to. */
    readonly checkoutUrl: string;
    /** ISO timestamp of when the `pending_provider` row becomes reapable by the abandoned-pending-subs cron. */
    readonly expiresAt: string;
}

/**
 * Time-to-live applied to a `pending_provider` annual subscription before the
 * `abandoned-pending-subs` cron collects it. Mirrors
 * `PENDING_PROVIDER_TTL_MS` in `subscription-checkout.service.ts` — kept as a
 * local literal (not imported) for the same ESM-cycle reason documented at
 * the top of this module.
 */
const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/** One year in milliseconds — the annual subscription's local period length. */
const ANNUAL_PERIOD_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Get the human-facing display name for a plan, falling back to the slug
 * when no display name is configured. Duplicated from the private
 * `getPlanDisplayName` in `subscription-checkout.service.ts` (not exported —
 * see the module-level JSDoc for why this file cannot import from there).
 */
function getPlanDisplayName(plan: CreateAnnualSubscriptionPlan): string {
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

/**
 * Enqueue a polling fallback for the just-created annual checkout session.
 * Non-fatal: a failure here is logged and does not throw — the checkout
 * session was already created successfully and the `payment.updated`
 * webhook remains the primary activation path.
 *
 * Skipped silently when:
 *   - The {@link env.HOSPEDA_BILLING_POLLING_ENABLED} flag is off.
 *   - The configured storage adapter does not expose `subscriptionPollingJobs`.
 *   - The provider returned no resource id to poll.
 */
async function schedulePollingForAnnualSubscription(input: {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly providerResourceId: string;
}): Promise<void> {
    const { billing, subscriptionId, providerResourceId } = input;

    if (!env.HOSPEDA_BILLING_POLLING_ENABLED) {
        return;
    }

    if (!providerResourceId) {
        apiLogger.warn(
            { subscriptionId },
            'Skipping annual polling enqueue — provider returned no resource id (cannot poll)'
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
            resourceType: 'one_time_payment',
            provider: 'mercadopago',
            metadata: {
                source: 'create-annual-subscription'
            }
        });
        if (job) {
            apiLogger.debug(
                {
                    jobId: job.id,
                    subscriptionId,
                    providerResourceId,
                    nextPollAt: job.nextPollAt.toISOString()
                },
                'Scheduled annual subscription polling fallback'
            );
        } else {
            apiLogger.warn(
                { subscriptionId, providerResourceId },
                'Active polling job already exists for subscription — skipping annual enqueue'
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
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to enqueue annual subscription polling job — webhook is the only path now'
        );
    }
}

/**
 * Create a one-time-charge (`mode: 'payment'`) annual subscription and
 * resolve its checkout URL.
 *
 * Extracted verbatim from `initiatePaidAnnualSubscription`
 * (`subscription-checkout.service.ts:1342-1445`, HOS-123 T-001) — no
 * behavior change versus the original inline block, minus the promo/trial/
 * comp branches (see the module-level JSDoc).
 *
 * Unlike the monthly path (`createPaidSubscription`), the local row is
 * inserted directly into `billing_subscriptions` (qzpay-core's
 * `subscriptions.create()` hard-codes monthly billing-interval, so its
 * facade cannot be used for an annual one-time charge) and returns
 * `pending_provider` until the `payment.updated` webhook (status
 * `approved` / `accredited`) confirms it by matching
 * `metadata.annualSubscriptionId`.
 *
 * @param input - Resolved billing instance, customer/plan/price ids, the
 *   already-computed charge amount, return URLs, and optional
 *   statement descriptor/metadata.
 * @returns The created local subscription id plus its non-empty checkout URL.
 * @throws SubscriptionCheckoutError With code `CUSTOMER_NOT_FOUND` when the
 *   billing customer does not exist, or `MISSING_INIT_POINT` when the
 *   payment adapter returns neither a live nor a sandbox init point.
 *
 * @example
 * ```ts
 * const { checkoutUrl, localSubscriptionId, expiresAt } = await createAnnualSubscription({
 *   billing,
 *   customerId,
 *   plan: { id: plan.id, name: plan.name, metadata: plan.metadata },
 *   priceId: annualPrice.id,
 *   chargeAmountCentavos: annualPrice.unitAmount,
 *   urls: { successUrl, cancelUrl, notificationUrl },
 *   metadata: { supersedesSubscriptionId, convertedFromTrial: 'true' }
 * });
 * ```
 */
export async function createAnnualSubscription(
    input: CreateAnnualSubscriptionInput
): Promise<CreateAnnualSubscriptionResult> {
    const {
        billing,
        customerId,
        plan,
        priceId,
        chargeAmountCentavos,
        urls,
        statementDescriptor,
        metadata
    } = input;
    const db = input.db ?? getDb();

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + ANNUAL_PERIOD_MS);
    const localSubscriptionId = input.localSubscriptionId ?? crypto.randomUUID();

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
            source: 'create-annual-subscription',
            createdBy: 'subscription-flow',
            annualPriceId: priceId,
            billingInterval: 'annual',
            ...(metadata ?? {})
        }
    });

    // Split customer.name on the first whitespace for MP's payer fields
    // (mirrors the qzpay-core monthly subscription create path).
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                unitAmount: chargeAmountCentavos,
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
            billingInterval: 'annual',
            ...(metadata ?? {})
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
    // to arrive. `checkout.id` is the LOCAL checkout-session UUID
    // assigned by the qzpay-core orchestrator and propagated to MP as
    // `external_reference` — the cron searches MP payments by that field.
    await schedulePollingForAnnualSubscription({
        billing,
        subscriptionId: localSubscriptionId,
        providerResourceId: checkout.id
    });

    return {
        localSubscriptionId,
        checkoutUrl,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}
