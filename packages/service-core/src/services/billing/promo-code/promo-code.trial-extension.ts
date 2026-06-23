/**
 * Promo Code Trial Extension Module (SPEC-262 T-006)
 *
 * Provides the `extendExistingSubscriptionTrial` operation — the service-layer
 * entry point for applying a `trial_extension` promo code to an **already-active**
 * subscription. This is distinct from the signup path (`applyPromoCode` in
 * `promo-code.redemption.ts`) which translates the extension to `freeTrialDays`
 * on the qzpay subscription-create input.
 *
 * Authorization is enforced at the API route layer (T-009). This service trusts
 * that the caller has already verified the actor has the required permissions.
 *
 * @module services/billing/promo-code/promo-code.trial-extension
 */

import { billingSubscriptions, eq, sql, withTransaction } from '@repo/db';
import type { QueryContext } from '@repo/db';
import { PromoEffectKindEnum, ServiceErrorCode, SubscriptionStatusEnum } from '@repo/schemas';
import { calculatePromoCodeEffect } from './effect-reducer.js';
import { getPromoCodeById } from './promo-code.crud.js';
import { redeemAndRecordUsage } from './promo-code.redemption.js';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/**
 * Input for extending an existing subscription's trial period via a promo code.
 *
 * Authorization must be validated by the caller (API route layer, T-009) before
 * invoking this operation.
 */
export interface ExtendExistingSubscriptionTrialInput {
    /** UUID of the `billing_subscriptions` row to extend */
    subscriptionId: string;
    /** UUID of the `billing_promo_codes` row to apply (must have effect_kind='trial_extension') */
    promoCodeId: string;
    /**
     * UUID of the actor (user/admin) performing the operation.
     * Used for authorization at the route layer only — NOT used as the usage-record
     * customer. The usage record is attributed to the subscription's own `customerId`
     * so that `maxPerCustomer` limits are correctly enforced on the customer who
     * benefits from the extension, not on the admin who applies it.
     */
    actorId: string;
    /** Whether to operate in live mode (default: false) */
    livemode?: boolean;
    /** Optional outer query context — when provided, operations use `ctx.tx` */
    ctx?: QueryContext;
}

/**
 * Result of a successful trial extension operation.
 */
export interface ExtendExistingSubscriptionTrialData {
    /** UUID of the subscription that was extended */
    subscriptionId: string;
    /** The new `trial_end` value after the extension was applied */
    newTrialEnd: Date;
    /** Number of calendar days that were added */
    daysAdded: number;
    /**
     * Whether the subscription has a live MercadoPago preapproval that may need
     * its next-charge date reconciled.
     *
     * When `true`, the webhook/reconciler path (T-007) must adjust the MP-side
     * preapproval so that MP does not charge before `newTrialEnd`.
     *
     * `false` for annual subscriptions (`mp_subscription_id IS NULL`) — they
     * use a one-time charge model and do not have a recurring preapproval.
     *
     * @see TODO(T-007) - MP preapproval date reconciliation
     */
    mpReconciliationPending: boolean;
    /** UUID of the `billing_promo_code_usage` row created for auditability */
    usageRecordId: string;
}

/**
 * Typed service result for `extendExistingSubscriptionTrial`.
 */
export type ExtendExistingSubscriptionTrialResult =
    | { readonly success: true; readonly data: ExtendExistingSubscriptionTrialData }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

// ---------------------------------------------------------------------------
// Internal subscription row type
// ---------------------------------------------------------------------------

/**
 * Minimal subscription row shape read from the DB for this operation.
 *
 * `billing_subscriptions` is owned by `@qazuor/qzpay-drizzle` (an external
 * package), so its Drizzle TS schema does not include the `trialEnd`,
 * `mpSubscriptionId`, and `customerId` columns as typed declarations. We
 * declare the expected shape here and rely on the fact that Drizzle passes
 * the raw Postgres row through at runtime — the values are present even though
 * the TypeScript type on the Drizzle table object does not declare them.
 *
 * @internal
 */
interface SubscriptionRow {
    id: string;
    /** Billing customer ID — used as the `customerId` in the usage record */
    customerId: string;
    status: string;
    /** ISO 8601 string or Date from Postgres; null when no trial was set */
    trialEnd: Date | string | null;
    /** MercadoPago preapproval ID; null for annual (one-time-charge) subscriptions */
    mpSubscriptionId: string | null;
}

// ---------------------------------------------------------------------------
// Main operation
// ---------------------------------------------------------------------------

/**
 * Apply a `trial_extension` promo code to an existing subscription.
 *
 * Extends `billing_subscriptions.trial_end` by the number of days configured
 * on the promo code's `extra_days` column (added via extras/018). All three
 * writes — usage-count increment, usage-row insert, and trial_end UPDATE — run
 * in a single atomic transaction so they commit or roll back together.
 *
 * **Usage limits are enforced** via `redeemAndRecordUsage` (which acquires a
 * `SELECT FOR UPDATE` row lock on the promo code, re-validates `maxUses` and
 * `maxPerCustomer` inside the lock, and atomically increments `usedCount`).
 * If the code is at its limit, the operation returns the limit error and the
 * `trial_end` UPDATE is never applied.
 *
 * **Customer attribution:** The usage record is attributed to the
 * `billing_subscriptions.customerId` — the customer who benefits from the
 * extension — NOT to `actorId` (which may be an admin). This ensures that
 * per-customer limits (`maxPerCustomer`) are correctly enforced on the right
 * account.
 *
 * **Acceptance criteria covered:**
 * - **AC-3.1** — `trial_end` pushed by `extraDays` days; usage row created.
 * - **AC-3.4** — subscriptions that are NOT in `trialing` status are rejected
 *   with a typed `VALIDATION_ERROR` before the promo counter is touched; no
 *   state change occurs.
 * - **AC-3.5** — annual subscriptions (`mp_subscription_id IS NULL`):
 *   - In trial → `trial_end` extended (proceed).
 *   - Past trial (non-trialing) → `VALIDATION_ERROR` (already caught by AC-3.4
 *     check, but the annual-specific guard is explicit for clarity).
 *   - Never a silent no-op.
 *
 * **MP reconciliation (AC-3.3 — deferred to T-007):**
 * Monthly subscriptions have a live MercadoPago preapproval. The caller MUST
 * watch `result.data.mpReconciliationPending` and, when `true`, trigger the
 * MP-side next-charge-date adjustment (implemented in T-007). This operation
 * persists the new `trial_end` regardless so the local DB reflects truth even
 * before MP is reconciled.
 *
 * **`trial_end` null edge:**
 * If the subscription's current `trial_end` is `null` (no explicit trial set),
 * the extension is calculated from the current UTC timestamp (`new Date()`),
 * effectively granting a brand-new trial window from now. The caller/admin UI
 * (T-009) should surface a warning that no prior `trial_end` existed.
 *
 * **Transaction ordering (fail-closed):**
 * 1. Load subscription; validate `status === 'trialing'` — return early on failure.
 * 2. Call `redeemAndRecordUsage` (lock + increment + insert) — return its error
 *    if the limit is exceeded; `trial_end` is NOT updated.
 * 3. Only on successful redemption: run the raw-SQL `UPDATE trial_end`.
 *
 * @param input - RO-RO input bag (see {@link ExtendExistingSubscriptionTrialInput})
 * @returns Typed result with the new `trial_end` and MP reconciliation status,
 *   or a typed error (VALIDATION_ERROR / NOT_FOUND / INTERNAL_ERROR /
 *   PROMO_CODE_MAX_USES / PROMO_CODE_MAX_USES_PER_CUSTOMER)
 *
 * @example
 * ```ts
 * // Trialing monthly subscription
 * const result = await extendExistingSubscriptionTrial({
 *   subscriptionId: 'sub-uuid',
 *   promoCodeId: 'pc-uuid',
 *   actorId: 'admin-user-uuid',
 *   livemode: true,
 * });
 * if (result.success) {
 *   console.log('New trial_end:', result.data.newTrialEnd);
 *   if (result.data.mpReconciliationPending) {
 *     // T-007: adjust the MP preapproval next-charge date
 *   }
 * } else {
 *   // result.error.code may be VALIDATION_ERROR, NOT_FOUND,
 *   // PROMO_CODE_MAX_USES, PROMO_CODE_MAX_USES_PER_CUSTOMER, etc.
 * }
 * ```
 */
export async function extendExistingSubscriptionTrial(
    input: ExtendExistingSubscriptionTrialInput
): Promise<ExtendExistingSubscriptionTrialResult> {
    const { subscriptionId, promoCodeId, livemode = false, ctx } = input;

    try {
        // ------------------------------------------------------------------
        // Step 1: Load the promo code and validate effect kind.
        // Fail early — before opening a write transaction — if the code is wrong.
        // ------------------------------------------------------------------
        const promoCodeResult = await getPromoCodeById(promoCodeId, ctx);

        if (!promoCodeResult.success || !promoCodeResult.data) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            };
        }

        const promoCode = promoCodeResult.data;

        // Validate that the code has a trial_extension effect
        if (!promoCode.effect || promoCode.effect.kind !== PromoEffectKindEnum.TRIAL_EXTENSION) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        'Promo code does not have a trial_extension effect. ' +
                        'Only trial_extension codes can be applied to an existing subscription trial.'
                }
            };
        }

        // Compute the days to add using the pure effect reducer
        const mutation = calculatePromoCodeEffect(promoCode.effect, 0);
        if (mutation.type !== 'extend-trial') {
            // Unreachable — calculatePromoCodeEffect always returns extend-trial for
            // trial_extension effects. Defensive guard for type narrowing.
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Effect reducer returned unexpected mutation type for trial_extension'
                }
            };
        }

        const { daysAdded } = mutation;

        if (daysAdded <= 0) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Trial extension promo code has no valid extra days configured'
                }
            };
        }

        // ------------------------------------------------------------------
        // Steps 2–5: Load subscription, validate, redeem atomically, then
        // extend trial_end. All three writes share a single transaction so they
        // commit or roll back together (fail-closed, per coordinator instruction).
        // ------------------------------------------------------------------
        return await withTransaction(async (tx) => {
            // Step 2: Load the subscription row — include customerId so we can
            // attribute the usage record to the right customer (not the actor).
            const subRows = await tx
                .select({
                    id: billingSubscriptions.id,
                    customerId: billingSubscriptions.customerId,
                    status: billingSubscriptions.status,
                    trialEnd: billingSubscriptions.trialEnd,
                    mpSubscriptionId: billingSubscriptions.mpSubscriptionId
                })
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
                .limit(1);

            const sub = subRows[0] as SubscriptionRow | undefined;

            if (!sub) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `Subscription not found: ${subscriptionId}`
                    }
                };
            }

            // Step 3: Validate subscription status — must be 'trialing' (AC-3.4).
            // This check runs BEFORE touching the promo code counter so a
            // non-trialing subscription never consumes a use of the code.
            if (sub.status !== SubscriptionStatusEnum.TRIALING) {
                // AC-3.5: explicit check for annual (no-preapproval) subscriptions that
                // are past trial — reject with a descriptive error, never a silent no-op.
                const isAnnual =
                    sub.mpSubscriptionId === null || sub.mpSubscriptionId === undefined;
                const annualSuffix = isAnnual
                    ? ' Annual subscriptions outside their trial period cannot be extended ' +
                      '(granting free time post-charge is a different effect — extend_period — ' +
                      'which is out of scope for this spec).'
                    : '';
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: `Subscription is not in trialing status (current status: ${sub.status}). Trial extension can only be applied to a subscription in trialing status.${annualSuffix}`
                    }
                };
            }

            // Step 4: Atomically lock + validate limits + increment usedCount +
            // insert the usage row — all inside the same transaction.
            //
            // redeemAndRecordUsage is enlisted in the outer `tx` via the `tx`
            // parameter, so all three writes (lock, increment, usage insert) and
            // the subsequent trial_end UPDATE in step 5 are part of the same
            // atomic boundary. If redeemAndRecordUsage returns !success (e.g.
            // PROMO_CODE_MAX_USES / PROMO_CODE_MAX_USES_PER_CUSTOMER), the whole
            // transaction rolls back and trial_end is NOT updated.
            //
            // Usage is attributed to sub.customerId (the subscription owner) rather
            // than actorId (who may be an admin) so that maxPerCustomer limits are
            // enforced on the correct account.
            const redeemResult = await redeemAndRecordUsage({
                promoCodeId,
                customerId: sub.customerId,
                subscriptionId,
                discountAmount: 0,
                currency: 'ARS',
                livemode,
                tx
            });

            if (!redeemResult.success) {
                // Propagate the limit error (PROMO_CODE_MAX_USES,
                // PROMO_CODE_MAX_USES_PER_CUSTOMER, NOT_FOUND, INTERNAL_ERROR).
                // trial_end is NOT updated — transaction rolls back.
                return {
                    success: false,
                    error: redeemResult.error
                };
            }

            // Step 5: Compute and persist the new trial_end.
            //
            // trial_end null edge: if the subscription has no prior trial_end set
            // (legacy row or edge case), we anchor the extension from `new Date()`
            // (current UTC timestamp). The caller/admin UI (T-009) should surface a
            // warning that no prior trial_end existed and the extension is from now.
            const currentTrialEnd =
                sub.trialEnd !== null && sub.trialEnd !== undefined
                    ? new Date(sub.trialEnd)
                    : new Date();

            const newTrialEnd = new Date(currentTrialEnd.getTime() + daysAdded * 86_400_000);

            // Persist new trial_end. AC-3.3: persisted regardless of whether MP
            // reconciliation succeeds (T-007 handles the MP-side adjustment).
            await tx.execute(
                sql`UPDATE billing_subscriptions
                    SET trial_end = ${newTrialEnd.toISOString()}
                    WHERE id = ${subscriptionId}`
            );

            // Determine MP reconciliation flag.
            // Monthly subscriptions have a live preapproval that must be adjusted
            // so MP does not charge before newTrialEnd (AC-3.3 / T-007).
            // Annual subscriptions (mp_subscription_id IS NULL) use a one-time charge
            // model — no recurring preapproval to reconcile.
            //
            // TODO(T-007): when mpReconciliationPending is true, the API route (T-009)
            // or a background job must call:
            //   paymentAdapter.subscriptions.update(mpSubscriptionId, { ... })
            // to push the MP-side next-charge date to newTrialEnd. See the spike doc:
            // packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md
            const mpReconciliationPending =
                typeof sub.mpSubscriptionId === 'string' && sub.mpSubscriptionId.length > 0;

            return {
                success: true,
                data: {
                    subscriptionId,
                    newTrialEnd,
                    daysAdded,
                    mpReconciliationPending,
                    usageRecordId: redeemResult.data.usageRecord.id
                }
            };
        });
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    _error instanceof Error ? _error.message : 'Failed to extend subscription trial'
            }
        };
    }
}
