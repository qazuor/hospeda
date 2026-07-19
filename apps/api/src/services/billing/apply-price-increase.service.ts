/**
 * Manual price-increase mechanism for a plan's existing subscribers (HOS-191 F6).
 *
 * ## Why this exists (empirical finding, 2026-07-18 research)
 *
 * `PUT /preapproval_plan` (MercadoPago's plan-level endpoint, used by
 * `apps/api/src/services/billing/mp-plan-provisioning.service.ts` to change the
 * price NEW checkouts see) does NOT retro-propagate to subscriptions that
 * already authorized a preapproval on the old amount — verified in prod: the
 * plan was changed 5000→6000 and existing subscriptions kept charging 5000.
 * Raising the price for CURRENT subscribers therefore requires mutating each
 * subscription's live preapproval individually via
 * `paymentAdapter.subscriptions.update(preapprovalId, { transactionAmount })`
 * (a `PUT /preapproval/{id}` call) — the exact primitive already used by the
 * discount/plan-change mutation call sites (`promo-renewal-mp.service.ts`,
 * `apply-scheduled-plan-changes.ts`, `subscription-poll.job.ts`'s discount
 * reconciler).
 *
 * ## Scope — mechanism only, invoked manually
 *
 * This module is deliberately just the MECHANISM. There is NO cron wired to
 * it. Deciding the cadence of increases and giving subscribers the legally
 * required advance notice are owner-driven operational decisions, out of
 * scope here. Trigger it by hand — e.g. via the admin route in
 * `apps/api/src/routes/billing/admin/plan-price-increase.ts`
 * (`POST /api/v1/admin/billing/plans/:planId/apply-price-increase`,
 * `PermissionEnum.BILLING_MANAGE`) — after confirming the report from a
 * `dryRun: true` pass.
 *
 * ## Per-subscription decision tree
 *
 * 1. **Comp / actively-discounted subscriptions are excluded.** A `comp`
 *    subscription never has a live `mp_subscription_id` (it is a direct DB
 *    insert with no MercadoPago preapproval — see the `SubscriptionStatusEnum.COMP`
 *    doc in the root `CLAUDE.md`), so the `isNotNull(mpSubscriptionId)` filter
 *    already excludes it from the query. A subscription with an ACTIVE
 *    multi-cycle or forever discount (`promoCodeId` set AND
 *    `promoEffectRemainingCycles` is `null` or `> 0`) IS matched by the query
 *    but is explicitly skipped here — mirrors `isCompOrActivelyDiscounted` in
 *    `apps/api/src/cron/jobs/dunning.job.ts`. Overwriting a discounted
 *    `transaction_amount` with the blanket new price would silently kill the
 *    discount; those subscriptions need separate, discount-aware treatment.
 * 2. **Idempotent skip.** The LIVE MercadoPago preapproval amount is read via
 *    `subscriptions.retrieve` and compared (±1 ARS major tolerance for
 *    floating-point rounding) against the target. Already-at-target
 *    subscriptions are skipped, so re-running this function twice never
 *    double-applies the increase.
 * 3. **Dry run (default).** `dryRun: true` (the default) never calls
 *    `subscriptions.update` — every subscription that would be mutated is
 *    still reported with `outcome: 'updated'` and `reason: 'dry_run'` so the
 *    owner can review the exact blast radius before re-running with
 *    `dryRun: false`.
 * 4. **Real mutation.** Bounded retry (3 attempts) with backoff + jitter
 *    between attempts on failure, longer backoff when the failure looks like
 *    a MercadoPago rate-limit response. A small delay + jitter is also
 *    inserted BETWEEN every subscription processed (whether it mutates or
 *    not) to stay under MP's per-second rate limits on a moderately sized
 *    batch, since this is a manual/one-off operation, not a hot path.
 *
 * @module services/billing/apply-price-increase
 */

import { createMercadoPagoAdapter } from '@repo/billing';
import { and, billingSubscriptions, eq, getDb, inArray, isNotNull, isNull } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { isAccommodationSubscription } from '@repo/service-core';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { apiLogger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Hard cap on the number of subscriptions processed in a single invocation
 * when the caller does not supply an explicit `limit`.
 *
 * Kept at 100 so a full batch stays within the reverse-proxy request timeout
 * (~60-100s): each subscription costs a MercadoPago `retrieve` (+ a possible
 * `update`) plus a ~250ms inter-subscription delay, so ~100 subs comfortably
 * finish well under the timeout while 500 could exceed it. Larger plans are
 * driven in explicit pages via `limit` + re-invocation by the operator.
 */
const DEFAULT_BATCH_LIMIT = 100;

/** Bounded attempts (1 initial + retries) for a single subscription's MP mutation. */
const MAX_MUTATION_ATTEMPTS = 3;

/** Base delay (ms) between per-subscription mutation retry attempts on a non-rate-limit failure. */
const RETRY_BASE_DELAY_MS = 500;

/** Base delay (ms) between per-subscription mutation retry attempts when the failure looks like a rate limit. */
const RATE_LIMIT_BASE_DELAY_MS = 2000;

/** Delay (ms) inserted between every subscription processed, to spread out calls to MercadoPago. */
const INTER_SUBSCRIPTION_DELAY_MS = 250;

/** Max random jitter (ms) added on top of any computed delay. */
const JITTER_MAX_MS = 150;

/**
 * Tolerance, in ARS major units, when comparing the live MP `transaction_amount`
 * against the target amount. Absorbs floating-point rounding — mirrors the
 * tolerance used by `subscription-poll.job.ts`'s discount-amount reconciler.
 */
const AMOUNT_TOLERANCE_MAJOR = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-subscription outcome of a single {@link applyPriceIncreaseToPlanSubscribers} run. */
export type PriceIncreaseOutcome = 'updated' | 'skipped' | 'failed';

/** Per-subscription report row returned in {@link ApplyPriceIncreaseResult.details}. */
export interface PriceIncreaseSubscriptionDetail {
    /** Local `billing_subscriptions.id`. */
    readonly subscriptionId: string;
    /** MercadoPago preapproval id (`billing_subscriptions.mp_subscription_id`). */
    readonly mpSubscriptionId: string;
    readonly outcome: PriceIncreaseOutcome;
    /**
     * Short machine-readable reason. One of `'active_discount'`,
     * `'already_at_target'`, `'dry_run'`, or a free-text failure message.
     */
    readonly reason?: string;
}

/** Input for {@link applyPriceIncreaseToPlanSubscribers}. */
export interface ApplyPriceIncreaseInput {
    /** UUID of the commercial plan (`billing_plans.id`) whose subscribers are targeted. */
    readonly planId: string;
    /** New `transaction_amount` in ARS **centavos** to apply to every matched, eligible subscription. */
    readonly newAmountCentavos: number;
    /**
     * When `true` (the default), no MercadoPago mutation is performed — every
     * subscription that WOULD be updated is still reported so the caller can
     * review the report before re-running with `dryRun: false`.
     */
    readonly dryRun?: boolean;
    /**
     * Optional cap on the number of matched subscriptions processed in this
     * call. Defaults to {@link DEFAULT_BATCH_LIMIT}.
     */
    readonly limit?: number;
}

/** Result of {@link applyPriceIncreaseToPlanSubscribers}. */
export interface ApplyPriceIncreaseResult {
    /** Number of subscriptions matched by the plan/status/domain query. */
    readonly matched: number;
    /** Number of subscriptions actually mutated (or, in `dryRun`, that WOULD be). */
    readonly updated: number;
    /** Number of subscriptions skipped (active discount or already at target). */
    readonly skipped: number;
    /** Number of subscriptions where the MP retrieve/update call failed after retries. */
    readonly failed: number;
    /** Per-subscription detail rows, same order as matched. */
    readonly details: readonly PriceIncreaseSubscriptionDetail[];
}

/**
 * Row shape selected from `billing_subscriptions` for the eligibility query.
 * `mpSubscriptionId` is guaranteed non-null at runtime by the `isNotNull`
 * WHERE clause; the column type stays nullable since Drizzle cannot narrow a
 * SELECT projection from a WHERE predicate.
 */
interface EligibleSubscriptionRow {
    readonly id: string;
    readonly mpSubscriptionId: string | null;
    readonly promoCodeId: string | null;
    readonly promoEffectRemainingCycles: number | null;
    readonly productDomain: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Promise-based sleep with a small random jitter added on top of `baseMs`. */
function sleepWithJitter(baseMs: number): Promise<void> {
    const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
    return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

/**
 * Best-effort duck-typed detection of a MercadoPago rate-limit failure.
 *
 * The raw MercadoPago adapter (`createMercadoPagoAdapter`'s
 * `QZPayMercadoPagoAdapter`, called directly here — the SAME call site
 * pattern as `subscription-poll.job.ts`'s discount reconciler and
 * `promo-renewal-mp.service.ts`) throws `QZPayMercadoPagoError`, not the
 * router-layer `QZPayProviderSyncError` that `lib/billing-provider-error.ts`
 * detects (that helper only applies to errors surfaced through qzpay-core's
 * higher-level `billing.subscriptions.*` API, not the raw adapter used here).
 * No other raw-adapter call site in this codebase does status-aware retry
 * (`promo-renewal-mp.service.ts`'s `restoreFullPriceMutation` uses a fixed
 * bounded retry regardless of error shape) — this duck-type is a best-effort
 * improvement on that baseline, not a load-bearing assumption.
 */
function looksLikeRateLimitError(err: unknown): boolean {
    if (!(err instanceof Error)) {
        return false;
    }
    const record = err as unknown as Record<string, unknown>;
    if (record.code === 'rate_limit_error') {
        return true;
    }
    const status = record.status ?? record.statusCode;
    if (status === 429) {
        return true;
    }
    return /rate.?limit|429/i.test(err.message);
}

/**
 * Extracts the live recurring `transaction_amount` (ARS major units) from a
 * MercadoPago preapproval object returned by `subscriptions.retrieve`.
 *
 * The amount lives under `auto_recurring.transaction_amount`, NOT at the top
 * level (top-level `transaction_amount` only exists on payment objects — see
 * `subscription-poll.job.ts`'s `reconcileActiveDiscountAmounts` for the same
 * extraction, duplicated here rather than imported since it is a 6-line
 * private helper local to each caller's file, not a shared utility).
 *
 * @returns The live amount in major units, or `null` when it cannot be read.
 */
function extractLiveTransactionAmountMajor(livePreapproval: unknown): number | null {
    if (typeof livePreapproval !== 'object' || livePreapproval === null) {
        return null;
    }
    const record = livePreapproval as Record<string, unknown>;
    const autoRecurring =
        typeof record.auto_recurring === 'object' && record.auto_recurring !== null
            ? (record.auto_recurring as Record<string, unknown>)
            : {};
    return typeof autoRecurring.transaction_amount === 'number'
        ? autoRecurring.transaction_amount
        : null;
}

/**
 * Attempts the `transaction_amount` mutation for a single subscription, with
 * bounded retry + backoff (longer backoff on an apparent rate-limit failure).
 * Never throws — always returns a typed result.
 */
async function mutateTransactionAmountWithRetry(params: {
    readonly paymentAdapter: ReturnType<typeof createMercadoPagoAdapter>;
    readonly mpSubscriptionId: string;
    readonly targetAmountMajor: number;
    readonly subscriptionId: string;
}): Promise<{ success: true } | { success: false; message: string }> {
    const { paymentAdapter, mpSubscriptionId, targetAmountMajor, subscriptionId } = params;

    let lastMessage = '';
    for (let attempt = 1; attempt <= MAX_MUTATION_ATTEMPTS; attempt += 1) {
        try {
            await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                transactionAmount: targetAmountMajor
            });
            return { success: true };
        } catch (err) {
            lastMessage = err instanceof Error ? err.message : String(err);
            const rateLimited = looksLikeRateLimitError(err);
            apiLogger.warn(
                {
                    subscriptionId,
                    mpSubscriptionId,
                    targetAmountMajor,
                    attempt,
                    maxAttempts: MAX_MUTATION_ATTEMPTS,
                    rateLimited,
                    error: lastMessage
                },
                'apply-price-increase: MP mutation attempt failed'
            );
            if (attempt < MAX_MUTATION_ATTEMPTS) {
                await sleepWithJitter(
                    rateLimited ? RATE_LIMIT_BASE_DELAY_MS * attempt : RETRY_BASE_DELAY_MS * attempt
                );
            }
        }
    }
    return { success: false, message: lastMessage };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Applies a new `transaction_amount` to every eligible, currently-active
 * subscriber of a plan by mutating each subscription's live MercadoPago
 * preapproval individually.
 *
 * MUST be invoked manually (there is no automatic cron). Always run with
 * `dryRun: true` (the default) first and review `details` before re-running
 * with `dryRun: false`.
 *
 * @param input - Plan id, new centavos amount, and optional dryRun/limit.
 * @returns Aggregate counts plus a per-subscription detail report.
 *
 * @throws {Error} If the MercadoPago adapter cannot be constructed (missing
 *   `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`) or the initial subscription query fails.
 *
 * @example
 * ```ts
 * // 1. Preview.
 * const preview = await applyPriceIncreaseToPlanSubscribers({
 *   planId: '11111111-1111-1111-1111-111111111111',
 *   newAmountCentavos: 600000, // ARS 6000.00
 * });
 * console.log(preview.matched, preview.updated, preview.skipped);
 *
 * // 2. Apply for real once the preview looks right.
 * const applied = await applyPriceIncreaseToPlanSubscribers({
 *   planId: '11111111-1111-1111-1111-111111111111',
 *   newAmountCentavos: 600000,
 *   dryRun: false,
 * });
 * ```
 */
export async function applyPriceIncreaseToPlanSubscribers(
    input: ApplyPriceIncreaseInput
): Promise<ApplyPriceIncreaseResult> {
    const { planId, newAmountCentavos, limit } = input;
    const dryRun = input.dryRun ?? true;
    const targetAmountMajor = newAmountCentavos / 100;

    apiLogger.info({ planId, newAmountCentavos, dryRun, limit }, 'apply-price-increase: starting');

    const db = getDb();
    const rows = (await db
        .select({
            id: billingSubscriptions.id,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            promoCodeId: billingSubscriptions.promoCodeId,
            promoEffectRemainingCycles: billingSubscriptions.promoEffectRemainingCycles,
            productDomain: billingSubscriptions.productDomain
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.planId, planId),
                inArray(billingSubscriptions.status, [
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.TRIALING
                ]),
                isNotNull(billingSubscriptions.mpSubscriptionId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(limit && limit > 0 ? limit : DEFAULT_BATCH_LIMIT)) as EligibleSubscriptionRow[];

    // NOTE (FIX 5): the SQL `.limit()` above bounds the ROW SCAN, and the
    // product-domain filter below runs in-memory AFTER it — so a page could
    // return fewer than `limit` accommodation subscriptions when it happens to
    // include commerce/partner rows. Low risk in practice: since SPEC-239 the
    // accommodation and commerce plans are distinct `planId`s, and this query is
    // already scoped to a single `planId`, so a matched page is effectively all
    // one domain. Documented, not changed — pushing the domain predicate into
    // SQL would require encoding `isAccommodationSubscription`'s logic in Drizzle
    // and is unnecessary given the plan-id scoping.
    //
    // Product-domain isolation (SPEC-239 T-034): never touch commerce/partner
    // subscriptions from the accommodation price-increase tool. Reuses the
    // shared single-source-of-truth filter from @repo/service-core.
    const eligibleRows = rows.filter((row) => isAccommodationSubscription(row));

    const details: PriceIncreaseSubscriptionDetail[] = [];
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    if (eligibleRows.length === 0) {
        apiLogger.info(
            { planId, dryRun },
            'apply-price-increase: no eligible subscriptions matched'
        );
        return { matched: 0, updated: 0, skipped: 0, failed: 0, details: [] };
    }

    const paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });

    for (const row of eligibleRows) {
        // mpSubscriptionId is guaranteed non-null by the WHERE clause above.
        const mpSubscriptionId = row.mpSubscriptionId as string;

        // 1. Active-discount / comp guard (comp is already excluded structurally
        //    by isNotNull(mpSubscriptionId) — a comp sub never has a live
        //    preapproval — so only the active-discount case is checked here).
        const hasActiveDiscount =
            row.promoCodeId !== null &&
            (row.promoEffectRemainingCycles === null || row.promoEffectRemainingCycles > 0);
        if (hasActiveDiscount) {
            skipped += 1;
            details.push({
                subscriptionId: row.id,
                mpSubscriptionId,
                outcome: 'skipped',
                reason: 'active_discount'
            });
            continue;
        }

        // 2. Idempotent skip — compare the LIVE MP amount against the target.
        let liveAmountMajor: number | null;
        try {
            const live = await paymentAdapter.subscriptions.retrieve(mpSubscriptionId);
            liveAmountMajor = extractLiveTransactionAmountMajor(live);
        } catch (retrieveErr) {
            const message =
                retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr);
            failed += 1;
            details.push({
                subscriptionId: row.id,
                mpSubscriptionId,
                outcome: 'failed',
                reason: `retrieve_failed: ${message}`
            });
            apiLogger.warn(
                { subscriptionId: row.id, mpSubscriptionId, error: message },
                'apply-price-increase: failed to retrieve live preapproval, skipping this subscription'
            );
            await sleepWithJitter(INTER_SUBSCRIPTION_DELAY_MS);
            continue;
        }

        if (
            liveAmountMajor !== null &&
            Math.abs(liveAmountMajor - targetAmountMajor) <= AMOUNT_TOLERANCE_MAJOR
        ) {
            skipped += 1;
            details.push({
                subscriptionId: row.id,
                mpSubscriptionId,
                outcome: 'skipped',
                reason: 'already_at_target'
            });
            await sleepWithJitter(INTER_SUBSCRIPTION_DELAY_MS);
            continue;
        }

        // 3. Dry run — report what WOULD change, never mutate.
        if (dryRun) {
            updated += 1;
            details.push({
                subscriptionId: row.id,
                mpSubscriptionId,
                outcome: 'updated',
                reason: 'dry_run'
            });
            continue;
        }

        // 4. Real mutation, bounded retry + backoff.
        const mutationResult = await mutateTransactionAmountWithRetry({
            paymentAdapter,
            mpSubscriptionId,
            targetAmountMajor,
            subscriptionId: row.id
        });

        if (mutationResult.success) {
            updated += 1;
            details.push({ subscriptionId: row.id, mpSubscriptionId, outcome: 'updated' });
            apiLogger.info(
                { subscriptionId: row.id, mpSubscriptionId, targetAmountMajor },
                'apply-price-increase: subscription updated to new amount'
            );
        } else {
            failed += 1;
            details.push({
                subscriptionId: row.id,
                mpSubscriptionId,
                outcome: 'failed',
                reason: `mutation_failed: ${mutationResult.message}`
            });
            apiLogger.error(
                {
                    subscriptionId: row.id,
                    mpSubscriptionId,
                    targetAmountMajor,
                    error: mutationResult.message
                },
                'apply-price-increase: subscription mutation exhausted all retries'
            );
        }

        // Spread requests out regardless of outcome — this is a manual/one-off
        // batch operation, not a hot path, so a small delay per subscription is
        // an acceptable trade-off to stay comfortably under MP's rate limits.
        await sleepWithJitter(INTER_SUBSCRIPTION_DELAY_MS);
    }

    const result: ApplyPriceIncreaseResult = {
        matched: eligibleRows.length,
        updated,
        skipped,
        failed,
        details
    };

    apiLogger.info(
        { planId, dryRun, matched: result.matched, updated, skipped, failed },
        'apply-price-increase: finished'
    );

    return result;
}
