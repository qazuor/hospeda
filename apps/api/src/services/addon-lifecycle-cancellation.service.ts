/**
 * Addon Lifecycle Cancellation Service
 *
 * Handles bulk addon cleanup when a MercadoPago subscription cancellation webhook
 * is received. Processes all active addon purchases for a subscription sequentially,
 * preserving partial progress across retries.
 *
 * This module is re-exported from `addon-lifecycle.service.ts` to keep each file
 * under the 500-line limit.
 *
 * @module services/addon-lifecycle-cancellation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { DrizzleClient } from '@repo/db';
import { billingSubscriptionEvents, withTransaction } from '@repo/db';
import { AddonCatalogService, BILLING_EVENT_TYPES } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import type { RevocationResult } from './addon-lifecycle.service';
import { revokeAddonForSubscriptionCancellation } from './addon-lifecycle.service';
import { closeAddonPreapproval } from './addon-preapproval-cancel.js';
import { softCancelRecurringAddon } from './addon-soft-cancel.js';

// ─── Catalog service (DB-backed addon reads — SPEC-192 T-014) ─────────────────
// Instantiated once, on first use; stateless, no DB connection held.
//
// HOS-847 PR 6: this used to be a bare `new AddonCatalogService()` evaluated as
// a module side effect, so merely IMPORTING this module threw in any suite
// whose `@repo/service-core` mock did not happen to name that class. This PR
// widened who reaches the module transitively, which turned that latent
// fragility into a failing shard. Deferring construction to the single call
// site keeps the "once" guarantee and makes the import inert.
let catalogService: AddonCatalogService | undefined;

const getCatalogService = (): AddonCatalogService => {
    catalogService ??= new AddonCatalogService();
    return catalogService;
};

// ─── Cancellation cause (HOS-847 PR 7a — owner decision) ──────────────────────

/**
 * WHY the customer's plan subscription ended, which decides what happens to the
 * add-ons hanging off it.
 *
 * The owner's rule (2026-09-07): **we do not revoke what we already charged
 * for**. A recurring add-on has a MercadoPago preapproval of its very own, with
 * its own cycle, so its period and the plan's do not line up — a plan that ends
 * on the 10th over an add-on charged on the 25th used to cost the customer
 * fifteen days they had paid for. The add-on therefore lives until ITS OWN
 * `current_period_end`.
 *
 * Two causes are exceptions and revoke on the spot: non-payment (nothing was
 * collected, so there is nothing to honour) and a deliberate admin lever (an
 * operational action has to bite immediately or it is not a lever).
 *
 * This is about the CAUSE, not the caller: {@link AddonPreapprovalCancelSource}
 * in `addon-preapproval-cancel.ts` already enumerates the paths. Two paths can
 * share a cause, and one path — the MercadoPago webhook — can carry more than
 * one, which is exactly why {@link SubscriptionCancellationCause.unknown} is a
 * real member of this set and not a placeholder.
 */
export type SubscriptionCancellationCause =
    /**
     * The subscription died because the money stopped: dunning ran out of
     * retries, or MercadoPago auto-cancelled the preapproval after its own
     * recycling failed. Nothing was collected for the coming period, so the
     * add-ons go with it.
     */
    | 'non-payment'
    /**
     * An admin cancelled or revoked from the admin panel. Deliberate operator
     * action: it cuts now.
     *
     * NOTE: the live admin cancel does NOT come through this function — it has
     * its own parallel revocation in
     * `routes/billing/admin/qzpay-admin-hooks.ts`, which already revokes
     * immediately. The member exists because the decision is written in these
     * terms and any future admin path routed here must land on the immediate
     * branch by naming itself, not by defaulting into it.
     */
    | 'admin-action'
    /**
     * The customer (or a product action such as retiring their plan) ended the
     * subscription at the end of its paid period. Each add-on keeps its own
     * paid period.
     */
    | 'voluntary'
    /**
     * The signal genuinely does not say. The MercadoPago
     * `subscription_preapproval.updated` webhook reports `cancelled` with no
     * reason field, and the one local tell that would separate the two —
     * `previousStatus === 'past_due'` — never fires, because **no writer in
     * this repo ever puts `past_due` into `billing_subscriptions.status`**
     * (`cron/jobs/dunning.job.ts`'s docblock states the same: its status
     * mutations are off, HOS-191 F5).
     *
     * The reason is worth stating precisely, because MAPPINGS to `past_due` do
     * exist — `subscription-status-provider.ts` and
     * `subscription-status-normalize.ts` (`unpaid → PAST_DUE`) — and finding
     * them makes a claim of "unreachable" read like a lie. They are read
     * directions: they translate a provider status INTO the enum. What is
     * missing is the write: nothing persists the result to the column this
     * check would read. Restore a local writer and the tell becomes usable, and
     * this member's population shrinks accordingly.
     *
     * Handled per {@link UNKNOWN_CANCELLATION_CAUSE_POLICY}.
     */
    | 'unknown';

/**
 * What an add-on gets when the cancellation cause is {@link
 * SubscriptionCancellationCause.unknown} — **answered by the owner on
 * 2026-09-07: the doubt is resolved in the customer's favour.**
 *
 * Both answers cost somebody something, which is why this was never an
 * engineering call: `'revoke-now'` can take a period away from a customer who
 * paid for it, and `'honour-paid-period'` can hand a free period to someone who
 * stopped paying. The owner weighed the two and chose the second — the same
 * principle the whole of PR 7a rests on ("we do not revoke what we already
 * charged for"), applied to the case where we cannot prove which side of it we
 * are on.
 *
 * Note what that means for the size of the mistake in each direction. Revoking
 * wrongly takes a period the customer's card was already debited for and hands
 * back nothing; honouring wrongly costs at most ONE unpaid cycle, because the
 * add-on's MercadoPago preapproval is hard-cancelled before this decision is
 * ever reached, so nothing renews behind it either way.
 *
 * This is deliberately still a single named constant rather than an inlined
 * literal: it is the one line that has to move if the answer is ever revisited,
 * and `causeHonoursPaidPeriod` plus its tests read it rather than restating it.
 *
 * **This is no longer identical to the pre-HOS-847 behaviour.** Before PR 7a
 * every add-on under a cancelled plan was revoked on the spot, `unknown`
 * included; today the MercadoPago webhook — the one call site that genuinely
 * cannot tell "they cancelled" from "they stopped paying" — defers instead.
 */
export const UNKNOWN_CANCELLATION_CAUSE_POLICY: 'revoke-now' | 'honour-paid-period' =
    'honour-paid-period';

/**
 * Whether a cause lets an add-on keep the period it was already charged for.
 *
 * @param cause - Why the plan subscription ended.
 * @returns `true` when the add-on's own `current_period_end` must be respected.
 *
 * @example
 * ```ts
 * causeHonoursPaidPeriod('voluntary');   // true
 * causeHonoursPaidPeriod('non-payment'); // false
 * ```
 */
export function causeHonoursPaidPeriod(cause: SubscriptionCancellationCause): boolean {
    switch (cause) {
        case 'non-payment':
        case 'admin-action':
            return false;
        case 'voluntary':
            return true;
        case 'unknown':
            return UNKNOWN_CANCELLATION_CAUSE_POLICY === 'honour-paid-period';
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One add-on whose benefit was NOT revoked because the customer had already
 * paid for the period it is in.
 */
export interface DeferredAddonResult {
    /** The `billing_addon_purchases.id` that was deferred. */
    purchaseId: string;
    /** The slug identifying the addon product. */
    addonSlug: string;
    /** When the benefit actually stops — the add-on's own `current_period_end`. */
    accessUntil: Date;
}

/**
 * Aggregate result of processing all active addon purchases for a cancelled subscription.
 */
export interface CancellationResult {
    /** The QZPay subscription ID that was cancelled. */
    subscriptionId: string;
    /** The QZPay billing customer ID. */
    customerId: string;
    /** Total number of active addon purchases found and processed. */
    totalProcessed: number;
    /** Revocation results for purchases that succeeded. */
    succeeded: RevocationResult[];
    /** Revocation results for purchases that failed. */
    failed: RevocationResult[];
    /**
     * Purchases left GRANTED on purpose because the customer had already paid
     * for the period they are in (HOS-847 PR 7a). Their MercadoPago preapproval
     * is closed — nothing will be charged again — and the `addon-expiry` cron
     * finishes the job at `current_period_end`.
     *
     * Deliberately its own list rather than a member of `succeeded`: a caller
     * reading `succeeded` is asking "what stopped granting", and these did not.
     */
    deferred: DeferredAddonResult[];
    /** Wall-clock time elapsed for the entire operation in milliseconds. */
    elapsedMs: number;
}

/**
 * Input for `handleSubscriptionCancellationAddons`.
 */
export interface HandleCancellationAddonsInput {
    /** The QZPay subscription ID that was cancelled. */
    subscriptionId: string;
    /** The QZPay billing customer ID. */
    customerId: string;
    /** Initialised QZPay billing instance. */
    billing: QZPayBilling;
    /** Drizzle database instance (from `getDb()`). */
    db: DrizzleClient;
    /**
     * WHY the subscription was cancelled — what decides whether an add-on
     * still inside a period the customer paid for keeps its benefit
     * (HOS-847 PR 7a).
     *
     * Optional in the TYPE only so ~70 existing test call sites keep compiling;
     * every production call site must pass it explicitly, and
     * `test/services/addon-cancellation-cause-call-sites.guard.test.ts` fails CI
     * if one does not. Omitting it means {@link
     * SubscriptionCancellationCause.unknown}, which is an honest answer rather
     * than a guess — and since the owner resolved that case in the customer's
     * favour, an omission is now PERMISSIVE, which is exactly why the guard
     * above is load-bearing rather than tidy. See
     * {@link UNKNOWN_CANCELLATION_CAUSE_POLICY}.
     */
    cause?: SubscriptionCancellationCause;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Processes all active addon purchases for a cancelled subscription.
 *
 * This function is intended to be called from the MercadoPago webhook handler
 * when a subscription cancellation event is received. It:
 *
 * 1. Queries `billing_addon_purchases` for all active, non-deleted rows
 *    linked to the given `subscriptionId`.
 * 2. Processes each purchase **sequentially** (not in parallel) to avoid
 *    overwhelming QZPay and to ensure partial progress is preserved atomically
 *    per purchase.
 * 3. For each purchase:
 *    - **HOS-847 PR 6**: hard-cancels the add-on's OWN MercadoPago preapproval
 *      (`mp_subscription_id`) before anything local is written, and treats a
 *      refusal as a failed revocation. A recurring add-on's preapproval is
 *      invisible to every plan-side sweep, so a `canceled` row over a live one
 *      keeps charging a customer whose plan is already gone (the HOS-751 shape).
 *      A no-op for one-time add-ons, whose `mp_subscription_id` is null.
 *    - **HOS-847 PR 7a**: once the provider side is closed, decides whether the
 *      BENEFIT ends now or at the add-on's OWN `current_period_end`, from the
 *      {@link SubscriptionCancellationCause} the caller supplied. A recurring
 *      add-on bills on its own cycle, so the plan's period end says nothing
 *      about what the customer already paid the add-on for. When the period is
 *      honoured the row is soft-cancelled (`cancel_at_period_end = true`,
 *      `status` still `'active'`, entitlement still granted) and the
 *      `addon-expiry` cron finishes the job at that date.
 *    - Resolves the addon definition via `AddonCatalogService.getBySlug` (DB-backed,
 *      SPEC-192 T-014). NOT_FOUND → `undefined`, handled gracefully by
 *      `revokeAddonForSubscriptionCancellation` as the "unknown/retired" addon path.
 *    - Calls `revokeAddonForSubscriptionCancellation` to remove QZPay grants.
 *    - On **success**: updates the purchase row to `status='canceled'` and sets
 *      `canceledAt` to the current timestamp. Adds to `succeeded` list.
 *    - On **failure**: does NOT update the purchase status (remains `'active'`
 *      so the next webhook retry can attempt it again). Increments
 *      `metadata.revocationRetryCount` and sets `metadata.lastRevocationAttempt`.
 *      Reports to Sentry. Adds to `failed` list. Continues to the next purchase.
 * 4. Calls `clearEntitlementCache(customerId)` unconditionally (even on partial failure).
 * 5. Logs a summary audit entry.
 * 6. Warns if total elapsed time exceeds 15 seconds.
 * 7. If ANY purchase failed, **throws** so the webhook handler returns HTTP 500
 *    and MercadoPago retries the event. Successfully revoked purchases are already
 *    persisted as `'canceled'` — partial progress is preserved across retries.
 *
 * ### Spelling note
 * - `billing_addon_purchases.status` uses `'canceled'` (American English, 1 L).
 * - `billing_subscriptions.status` uses `'cancelled'` (British English, 2 L's).
 *
 * @param input - Subscription ID, customer ID, billing instance, and DB handle.
 * @returns {@link CancellationResult} summarising what was processed.
 *
 * @throws If one or more addon revocations fail (to trigger MercadoPago retry).
 *
 * @example
 * ```ts
 * const result = await handleSubscriptionCancellationAddons({
 *   subscriptionId: 'sub_abc123',
 *   customerId: 'cus_xyz456',
 *   billing,
 *   db: getDb(),
 * });
 * // result.succeeded and result.failed contain per-addon outcomes
 * ```
 */
export async function handleSubscriptionCancellationAddons(
    input: HandleCancellationAddonsInput
): Promise<CancellationResult> {
    const { subscriptionId, customerId, billing, db } = input;
    const cause: SubscriptionCancellationCause = input.cause ?? 'unknown';
    const honoursPaidPeriod = causeHonoursPaidPeriod(cause);
    const startMs = Date.now();

    // ── 1. Load Drizzle schema helpers via dynamic import (matches addon.checkout.ts pattern) ──
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
    const { eq, and, isNull, isNotNull } = await import('drizzle-orm');

    // ── 0. Feature flag guard ─────────────────────────────────────────────────
    // HOS-847 PR 6: the flag gates the ENTITLEMENT half of this handler, never
    // the provider half. `HOSPEDA_ADDON_LIFECYCLE_ENABLED` off already leaves an
    // entitlement dangling after a plan cancellation — bad, and the status quo.
    // Leaving a recurring add-on's MercadoPago preapproval authorized would also
    // keep CHARGING a customer whose plan is cancelled, and a preapproval
    // outlives whatever flag created it. So the closes run either way; only the
    // revocation loop is skipped.
    const addonLifecycleEnabled = env.HOSPEDA_ADDON_LIFECYCLE_ENABLED;
    if (!addonLifecycleEnabled) {
        apiLogger.info(
            { subscriptionId, customerId },
            'Addon lifecycle processing disabled via HOSPEDA_ADDON_LIFECYCLE_ENABLED — closing add-on preapprovals anyway'
        );

        const liveRecurring = await db
            .select({
                id: billingAddonPurchases.id,
                addonSlug: billingAddonPurchases.addonSlug,
                mpSubscriptionId: billingAddonPurchases.mpSubscriptionId
            })
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.subscriptionId, subscriptionId),
                    eq(billingAddonPurchases.status, 'active'),
                    isNull(billingAddonPurchases.deletedAt),
                    isNotNull(billingAddonPurchases.mpSubscriptionId)
                )
            );

        const unclosed: string[] = [];
        for (const purchase of liveRecurring) {
            const close = await closeAddonPreapproval({
                purchase,
                source: 'plan-cancellation',
                billing
            });
            if (!close.closed) {
                unclosed.push(purchase.id);
            }
        }

        if (unclosed.length > 0) {
            // Throwing here is what makes MercadoPago redeliver the webhook. A
            // preapproval that is still charging a cancelled customer is worth
            // a retry loop; silence is not.
            throw new Error(
                `Add-on preapproval close failed for subscription ${subscriptionId}: ` +
                    `${unclosed.length} of ${liveRecurring.length} preapprovals are still open. ` +
                    `Purchase IDs: ${unclosed.join(', ')}`
            );
        }

        return {
            subscriptionId,
            customerId,
            totalProcessed: 0,
            succeeded: [],
            failed: [],
            deferred: [],
            elapsedMs: Date.now() - startMs
        };
    }

    // ── 2. Query active, non-deleted addon purchases for this subscription ────
    const activePurchases = await db
        .select()
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.subscriptionId, subscriptionId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    // ── 3. Short-circuit if nothing to process ───────────────────────────────
    if (activePurchases.length === 0) {
        apiLogger.debug(
            { subscriptionId, customerId },
            `No active addon purchases for subscription ${subscriptionId}, skipping cleanup`
        );

        return {
            subscriptionId,
            customerId,
            totalProcessed: 0,
            succeeded: [],
            failed: [],
            deferred: [],
            elapsedMs: Date.now() - startMs
        };
    }

    apiLogger.info(
        { subscriptionId, customerId, count: activePurchases.length, cause, honoursPaidPeriod },
        `Processing ${activePurchases.length} active addon purchase(s) for cancelled subscription`
    );

    const succeeded: RevocationResult[] = [];
    const failed: RevocationResult[] = [];
    const deferred: DeferredAddonResult[] = [];
    const failedPurchaseIds: string[] = [];

    // ── 4. Sequential processing — NOT Promise.all ───────────────────────────
    for (const purchase of activePurchases) {
        const { id: purchaseId, addonSlug } = purchase;
        // SPEC-192 T-014: resolve addon definition from DB-backed catalog.
        // NOT_FOUND → addonDef=undefined (triggers "unknown/retired" path in revoke helper,
        // same semantics as the old config getAddonBySlug returning undefined).
        const catalogResult = await getCatalogService().getBySlug(addonSlug);
        const addonDef = catalogResult.success ? catalogResult.data : undefined;

        try {
            // ── 4a HOS-847 PR 6: close the add-on's own preapproval FIRST ────
            // Before any local write, and fail closed. `throw` here lands in the
            // same catch as a failed revocation, so the row stays `active`, the
            // purchase joins `failed`, and step 8 rethrows → HTTP 500 → MP
            // redelivers. The existing retry machinery is exactly the right
            // machinery for "the provider is still charging this".
            const providerClose = await closeAddonPreapproval({
                purchase: {
                    id: purchaseId,
                    addonSlug,
                    mpSubscriptionId: purchase.mpSubscriptionId
                },
                source: 'plan-cancellation',
                billing
            });

            if (!providerClose.closed) {
                throw new Error(
                    `MercadoPago preapproval for add-on purchase ${purchaseId} could not be cancelled: ${providerClose.reason}`
                );
            }

            // ── 4b HOS-847 PR 7a: do not revoke what was already charged ─────
            // The add-on's preapproval is closed by now, so nothing will be
            // charged again. Whether the BENEFIT stops today or at the end of
            // the period the customer already paid for is a separate question,
            // and the plan's own period does not answer it: a recurring add-on
            // bills on its own cycle, so the two rarely line up.
            //
            // `currentPeriodEnd === null` is the one-time add-on (and every
            // recurring row sold before the flag was ever on): no paid period is
            // recorded, so there is nothing to honour and the historical
            // immediate revocation stands.
            const paidPeriodEnd = purchase.currentPeriodEnd;
            const keepUntilPaidPeriodEnd =
                honoursPaidPeriod &&
                paidPeriodEnd instanceof Date &&
                paidPeriodEnd.getTime() > Date.now();

            if (honoursPaidPeriod && !paidPeriodEnd && purchase.mpSubscriptionId) {
                // A recurring add-on with a preapproval but no recorded period
                // is the same anomaly `cancelUserAddon` refuses outright on. Here
                // refusing is not an option — the plan is already gone — so the
                // add-on is revoked now and the anomaly is reported instead of
                // being papered over with a guessed end date.
                apiLogger.error(
                    {
                        subscriptionId,
                        customerId,
                        purchaseId,
                        addonSlug,
                        mpSubscriptionId: purchase.mpSubscriptionId,
                        cause
                    },
                    'HOS-847: recurring add-on has no current_period_end — revoking immediately because there is no paid period to honour',
                    { capture: true }
                );
            }

            if (keepUntilPaidPeriodEnd && paidPeriodEnd) {
                // Flags the row `cancel_at_period_end` and leaves `status`
                // 'active' — the QZPay entitlement/limit stays granted on
                // purpose, and `findExpiredAddons` picks the row up once
                // `current_period_end` passes.
                const softCancel = await softCancelRecurringAddon({
                    purchaseId,
                    customerId,
                    addonSlug,
                    addonName: addonDef?.name || addonSlug,
                    currentPeriodEnd: paidPeriodEnd,
                    reason: `plan-cancellation:${cause}`,
                    billing,
                    db
                });

                if (!softCancel.success) {
                    // Same failure machinery as a refused revocation: the row is
                    // left as-is and the function rethrows at step 8, so the
                    // webhook answers 500 and MercadoPago redelivers.
                    throw new Error(
                        `Add-on purchase ${purchaseId} could not be scheduled to end at its paid period: ${softCancel.error.message}`
                    );
                }

                deferred.push({
                    purchaseId,
                    addonSlug,
                    accessUntil: paidPeriodEnd
                });

                apiLogger.info(
                    {
                        subscriptionId,
                        customerId,
                        purchaseId,
                        addonSlug,
                        cause,
                        accessUntil: paidPeriodEnd.toISOString()
                    },
                    'HOS-847: plan cancelled, but this add-on keeps its benefit until its own paid period ends'
                );

                continue;
            }

            // Delegate actual QZPay revocation to the single-purchase helper
            const revocationResult = await revokeAddonForSubscriptionCancellation({
                customerId,
                purchase: { id: purchaseId, addonSlug },
                addonDef,
                billing
            });

            // ── 4c SUCCESS: persist canceled status to DB ────────────────────
            await withTransaction(async (tx) => {
                await tx
                    .update(billingAddonPurchases)
                    .set({
                        status: 'canceled',
                        canceledAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(
                        and(
                            eq(billingAddonPurchases.id, purchaseId),
                            eq(billingAddonPurchases.status, 'active')
                        )
                    );
            }, db);

            apiLogger.info(
                {
                    subscriptionId,
                    customerId,
                    purchaseId,
                    addonSlug,
                    addonType: revocationResult.addonType
                },
                'Addon purchase revoked and marked canceled in DB'
            );

            succeeded.push(revocationResult);
        } catch (err) {
            // ── 4d FAILURE: track retry metadata, do NOT update status ───────
            const errorMessage = err instanceof Error ? err.message : String(err);
            const existingMetadata = (purchase.metadata ?? {}) as Record<string, unknown>;
            const currentRetryCount = existingMetadata.revocationRetryCount;
            const retryCount = typeof currentRetryCount === 'number' ? currentRetryCount + 1 : 1;

            // ── T-046: set addonCancellationIncomplete flag in purchase metadata ─
            // ── T-047: insert compensating ADDON_REVOCATION_FAILED event ──────────
            // Both ops run inside a single transaction. Failure is non-fatal: the
            // function logs + continues so the main loop can process remaining addons
            // and the outer caller still receives the error throw at the end.
            try {
                await withTransaction(async (tx) => {
                    // T-046: flag the purchase as having an incomplete cancellation so
                    // the reconciliation cron can identify and retry it operationally.
                    await tx
                        .update(billingAddonPurchases)
                        .set({
                            metadata: {
                                ...existingMetadata,
                                revocationRetryCount: retryCount,
                                lastRevocationAttempt: new Date().toISOString(),
                                // T-046: operational flag for reconciliation tooling
                                addonCancellationIncomplete: true
                            },
                            updatedAt: new Date()
                        })
                        .where(eq(billingAddonPurchases.id, purchaseId));

                    // T-047: insert a compensating event for observability and recovery.
                    // The event is non-rethrowing: the main error path (HTTP 500) is
                    // preserved by the outer `failed.length > 0` check. The event row
                    // is advisory only and does NOT affect the webhook retry logic.
                    //
                    // subscriptionId is used as the FK for billing_subscription_events.
                    // If subscriptionId is null (addon not linked to a subscription),
                    // skip the insert — billing_subscription_events.subscription_id is NOT NULL.
                    if (subscriptionId) {
                        // Classify the failure as retryable (transient) vs non-retryable
                        // (e.g. "not found" / "already revoked" type errors).
                        const retryable =
                            !errorMessage.toLowerCase().includes('not found') &&
                            !errorMessage.toLowerCase().includes('already revoked') &&
                            !errorMessage.toLowerCase().includes('does not exist');

                        await tx.insert(billingSubscriptionEvents).values({
                            subscriptionId,
                            eventType: BILLING_EVENT_TYPES.ADDON_REVOCATION_FAILED,
                            triggerSource: 'webhook',
                            metadata: {
                                addonPurchaseId: purchaseId,
                                addonSlug,
                                errorMessage,
                                timestamp: new Date().toISOString(),
                                retryable,
                                retryCount
                            }
                        });
                    }
                }, db);
            } catch (metaErr) {
                apiLogger.warn(
                    {
                        purchaseId,
                        addonSlug,
                        error: metaErr instanceof Error ? metaErr.message : String(metaErr)
                    },
                    'Failed to update retry metadata / insert revocation-failed event on addon purchase (non-fatal)'
                );
            }

            apiLogger.error(
                {
                    retryNeeded: true,
                    purchaseId,
                    addonSlug,
                    errorMessage,
                    retryCount,
                    subscriptionId,
                    customerId
                },
                `Addon revocation failed for purchase ${purchaseId} (slug: ${addonSlug})`
            );

            failedPurchaseIds.push(purchaseId);

            const failedResult: RevocationResult = {
                purchaseId,
                addonSlug,
                addonType: addonDef?.grantsEntitlement
                    ? 'entitlement'
                    : addonDef?.affectsLimitKey
                      ? 'limit'
                      : 'unknown',
                outcome: 'failed',
                error: errorMessage
            };

            failed.push(failedResult);

            // Continue to next addon — do NOT abort the loop
        }
    }

    // ── 5. Clear entitlement cache unconditionally ───────────────────────────
    clearEntitlementCache(customerId);

    // ── 6. Summary audit log ─────────────────────────────────────────────────
    const elapsedMs = Date.now() - startMs;

    apiLogger.info(
        {
            eventType: 'subscription_canceled',
            subscriptionId,
            customerId,
            cause,
            totalProcessed: activePurchases.length,
            succeededCount: succeeded.length,
            failedCount: failed.length,
            deferredCount: deferred.length,
            failedPurchaseIds,
            elapsedMs,
            revokedPurchases: [...succeeded, ...failed].map((r) => ({
                purchaseId: r.purchaseId,
                addonSlug: r.addonSlug,
                type: r.addonType,
                outcome: r.outcome
            }))
        },
        'Subscription cancellation addon cleanup summary'
    );

    // ── 7. Warn on slow processing ───────────────────────────────────────────
    if (elapsedMs > 15_000) {
        apiLogger.warn(
            { subscriptionId, elapsedMs },
            `Webhook processing time exceeded 15s threshold: ${elapsedMs}ms for subscription ${subscriptionId}`
        );
    }

    // ── 8. Throw on any failure so webhook handler returns 500 ───────────────
    if (failed.length > 0) {
        Sentry.captureException(
            new Error(
                `Subscription cancellation addon cleanup failed for ${failed.length}/${activePurchases.length} purchases`
            ),
            {
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'subscription_cancelled'
                },
                extra: {
                    customerId,
                    subscriptionId,
                    failedPurchaseIds
                }
            }
        );

        throw new Error(
            `Addon cleanup failed for subscription ${subscriptionId}: ` +
                `${failed.length} of ${activePurchases.length} purchases could not be revoked. ` +
                `Failed IDs: ${failedPurchaseIds.join(', ')}`
        );
    }

    return {
        subscriptionId,
        customerId,
        totalProcessed: activePurchases.length,
        succeeded,
        failed,
        deferred,
        elapsedMs
    };
}
