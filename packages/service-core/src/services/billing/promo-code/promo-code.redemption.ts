/**
 * Promo Code Redemption Module
 *
 * Handles atomic redemption, usage tracking, and application of promo codes
 * to checkout sessions.
 *
 * Uses row-level locking (SELECT FOR UPDATE) inside a transaction to prevent
 * race conditions when multiple concurrent requests attempt to redeem the same code.
 *
 * @module services/billing/promo-code/promo-code.redemption
 */

import {
    type QZPayBillingPromoCode,
    billingPromoCodeUsage,
    billingPromoCodes,
    count,
    eq,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import type { QueryContext } from '@repo/db';
import {
    PromoEffectKindEnum,
    ServiceErrorCode,
    SubscriptionStatusEnum,
    ValueKindEnum
} from '@repo/schemas';
import { calculatePromoCodeEffect } from './effect-reducer.js';
import { getPromoCodeByCode } from './promo-code.crud.js';
import type { PromoCode } from './promo-code.service.js';

/**
 * Input for recording promo code usage.
 */
export interface RecordUsageInput {
    /** Promo code database ID */
    promoCodeId: string;
    /** Billing customer ID or checkout ID */
    customerId: string;
    /** Optional subscription ID */
    subscriptionId?: string;
    /** Discount applied in cents */
    discountAmount: number;
    /** ISO 4217 currency code (defaults to 'ARS' for the Argentine market) */
    currency?: string;
    /** Whether in live mode (default: false) */
    livemode?: boolean;
}

// ---------------------------------------------------------------------------
// ApplyPromoCode result types (SPEC-262 T-005)
// ---------------------------------------------------------------------------

/**
 * Result of `applyPromoCode` for a `discount` effect.
 *
 * Backward-compat shape preserved (AC-4.3) — `type`, `value`, `discountAmount`,
 * `finalAmount`, `originalAmount` are unchanged. New optional fields added
 * for multi-cycle context.
 */
export interface ApplyDiscountResult {
    /** Effect kind discriminant */
    effectKind: 'discount';
    /** Legacy: promo code string */
    code: string;
    /** Legacy: type ('percentage' | 'fixed') */
    type: PromoCode['type'];
    /** Legacy: discount value */
    value: number;
    /** Computed discount amount in cents */
    discountAmount: number;
    /** Final amount after discount in cents */
    finalAmount: number;
    /** Original amount before discount in cents */
    originalAmount: number;
    /** Floating-point rounding delta (optional) */
    roundingDelta?: number;
    /**
     * Number of remaining billing cycles AFTER this apply (set on the subscription).
     * null = forever (no decrement needed).
     * undefined = not a subscription-context apply (pre-checkout preview).
     */
    remainingCycles?: number | null;
}

/**
 * Result of `applyPromoCode` for a `trial_extension` effect.
 */
export interface ApplyTrialExtensionResult {
    /** Effect kind discriminant */
    effectKind: 'trial_extension';
    /** Promo code string */
    code: string;
    /**
     * Number of extra days to add to the trial period.
     * The caller is responsible for translating to `freeTrialDays` on the
     * qzpay subscription-create input (at signup) or pushing `trial_end`
     * (on an existing subscription — T-006).
     */
    extraDays: number;
    /** Discount amount is always 0 for trial extensions */
    discountAmount: 0;
    /** Final amount is the same as original for trial extensions (no price change) */
    finalAmount: number;
    /** Original amount */
    originalAmount: number;
    /**
     * Backward-compat: always undefined for trial extensions.
     * Present so callers can read `.type` / `.value` without narrowing.
     */
    type?: undefined;
    /** @see type */
    value?: undefined;
}

/**
 * Result of `applyPromoCode` for a `comp` effect.
 */
export interface ApplyCompResult {
    /** Effect kind discriminant */
    effectKind: 'comp';
    /** Promo code string */
    code: string;
    /** Always 0 — comp subscriptions are never charged */
    discountAmount: 0;
    /** Always 0 — no charge ever */
    finalAmount: 0;
    /** Original amount (for reference) */
    originalAmount: number;
    /**
     * Backward-compat: always undefined for comp.
     * Present so callers can read `.type` / `.value` without narrowing.
     */
    type?: undefined;
    /** @see type */
    value?: undefined;
    /** @internal Not applicable for comp */
    extraDays?: undefined;
}

/** Union of all apply results */
export type ApplyPromoCodeResult =
    | ApplyDiscountResult
    | ApplyTrialExtensionResult
    | ApplyCompResult;

/**
 * Atomically redeem a promo code using a row-level lock.
 *
 * Steps:
 * 1. Lock the promo code row with `SELECT ... FOR UPDATE`
 * 2. Check that usedCount < maxUses (if maxUses is set)
 * 3. Increment usedCount within the same transaction
 *
 * This prevents over-redemption under concurrent load.
 *
 * @param promoCodeId - UUID of the promo code to redeem
 * @returns Updated promo code row, or an error if max uses is exceeded
 *
 * @example
 * ```ts
 * const result = await tryRedeemAtomically('550e8400-e29b-41d4-a716-446655440000');
 * if (!result.success) {
 *   // max uses reached or not found
 * }
 * ```
 */
export async function tryRedeemAtomically(promoCodeId: string): Promise<{
    success: boolean;
    data?: QZPayBillingPromoCode;
    error?: { code: string; message: string };
}> {
    try {
        const result = await withTransaction(async (tx) => {
            // Use Drizzle's typed select with `.for('update')` rather than
            // a raw `tx.execute(SELECT *)`. Raw execute returns rows with
            // snake_case column names (`used_count`, `max_uses`) but the
            // surrounding code accesses camelCase (`usedCount`, `maxUses`),
            // which silently coerced `currentUsed` to 0 and let every
            // concurrent caller pass the over-redemption guard. Surfaced by
            // SPEC-064 IT-7 (`spec-064-billing-concurrency.test.ts`).
            const lockedRows = await tx
                .select()
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.id, promoCodeId))
                .for('update');
            const lockedPromoCode = lockedRows[0];

            if (!lockedPromoCode) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            const currentUsed = lockedPromoCode.usedCount ?? 0;
            const maxUses = lockedPromoCode.maxUses;

            if (maxUses !== null && currentUsed >= maxUses) {
                return {
                    success: false,
                    error: {
                        code: 'PROMO_CODE_MAX_USES',
                        message: 'This promo code has reached its maximum number of uses'
                    }
                };
            }

            const [updated] = await tx
                .update(billingPromoCodes)
                .set({ usedCount: sql`${billingPromoCodes.usedCount} + 1` })
                .where(eq(billingPromoCodes.id, promoCodeId))
                .returning();

            if (!updated) {
                throw new Error('Failed to update promo code usage count');
            }

            return { success: true, data: updated };
        });

        return result;
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to redeem promo code'
            }
        };
    }
}

/**
 * Increment the usage count of a promo code by 1 (non-atomic path).
 *
 * Use `tryRedeemAtomically` for race-condition-safe redemption during checkout.
 * This method is exposed for cases where an external system has already validated
 * the code and only needs to record the increment.
 *
 * When `ctx` is provided and `ctx.tx` is set, the operation participates in the
 * caller's transaction boundary. Otherwise, it executes against the default connection.
 *
 * @param id - Promo code database ID
 * @param ctx - Optional query context carrying a transaction client
 * @returns Success or error
 *
 * @internal Only callable from within the promo-code module via PromoCodeService wrappers.
 * External consumers should use PromoCodeService.incrementUsage() instead.
 *
 * @example
 * ```ts
 * // Without transaction
 * await incrementPromoCodeUsage('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Enlisted in a caller-provided transaction
 * await incrementPromoCodeUsage('550e8400-e29b-41d4-a716-446655440000', ctx);
 * ```
 */
export async function incrementPromoCodeUsage(id: string, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();

        const [updated] = await db
            .update(billingPromoCodes)
            .set({ usedCount: sql`${billingPromoCodes.usedCount} + 1` })
            .where(eq(billingPromoCodes.id, id))
            .returning();

        if (!updated) {
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        return { success: true, data: undefined };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to increment usage count'
            }
        };
    }
}

/**
 * Record a promo code usage event in the audit table.
 *
 * Creates a row in `billing_promo_code_usage` with the discount applied,
 * customer, and optional subscription reference.
 *
 * When `ctx` is provided and `ctx.tx` is set, the insert participates in the
 * caller's transaction boundary. Otherwise, it executes against the default connection.
 *
 * @param data - Usage record data (includes optional livemode flag)
 * @param ctx - Optional query context carrying a transaction client
 * @returns Created usage record or error
 *
 * @internal Only callable from within the promo-code module via PromoCodeService wrappers.
 * External consumers should use PromoCodeService.recordUsage() instead.
 *
 * @example
 * ```ts
 * // Without transaction
 * await recordPromoCodeUsage({
 *   promoCodeId: 'abc',
 *   customerId: 'cust_123',
 *   discountAmount: 500,
 *   currency: 'ARS',
 *   livemode: true,
 * });
 *
 * // Enlisted in a caller-provided transaction
 * await recordPromoCodeUsage({ promoCodeId: 'abc', customerId: 'cust_123', discountAmount: 500, currency: 'ARS' }, ctx);
 * ```
 */
export async function recordPromoCodeUsage(data: RecordUsageInput, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();

        const result = await db
            .insert(billingPromoCodeUsage)
            .values({
                promoCodeId: data.promoCodeId,
                customerId: data.customerId,
                subscriptionId: data.subscriptionId ?? null,
                discountAmount: data.discountAmount,
                currency: data.currency ?? 'ARS',
                livemode: data.livemode ?? false
            })
            .returning();

        const usage = result[0];

        if (!usage) {
            throw new Error('Failed to record promo code usage');
        }

        return { success: true, data: usage };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to record promo code usage'
            }
        };
    }
}

/**
 * Input for the atomic redeem-and-record helper.
 */
export interface RedeemAndRecordInput {
    /** Promo code database ID */
    promoCodeId: string;
    /** Billing customer ID */
    customerId: string;
    /** Optional subscription ID to associate with this redemption */
    subscriptionId?: string;
    /** Discount applied in cents */
    discountAmount: number;
    /** ISO 4217 currency code (defaults to 'ARS' for the Argentine market) */
    currency?: string;
    /** Whether in live mode (default: false) */
    livemode?: boolean;
    /** Optional outer transaction client — when provided, operations enlist in it */
    tx?: QueryContext['tx'];
}

/**
 * Result of the atomic redeem-and-record operation.
 */
export interface RedeemAndRecordResult {
    /** Updated promo code row with the incremented usage count */
    promoCode: QZPayBillingPromoCode;
    /** Newly created usage record */
    usageRecord: { id: string };
}

/**
 * Atomically increment a promo code's usage count and record the usage event
 * in a single database transaction.
 *
 * This helper is the safe, concurrency-proof replacement for calling
 * {@link incrementPromoCodeUsage} and {@link recordPromoCodeUsage} separately.
 * It eliminates the race window between the two writes by:
 *
 * 1. Acquiring a row-level lock via `SELECT ... FOR UPDATE` on the promo code.
 * 2. Re-validating all usage limits inside the lock (global `maxUses` and
 *    per-customer `maxPerCustomer`) so that two concurrent requests both reading
 *    the same counter before either write cannot both succeed.
 * 3. Incrementing `usedCount` with an atomic SQL expression.
 * 4. Inserting a row into `billing_promo_code_usage` in the same transaction.
 *
 * If the caller already holds a transaction (passes `input.tx`), all operations
 * participate in that boundary. Otherwise a new transaction is opened.
 *
 * @param input - Redeem-and-record parameters (see {@link RedeemAndRecordInput})
 * @returns `{ success: true, data }` with the updated promo code and usage record,
 *   or `{ success: false, error }` with a typed error code.
 *
 * @example
 * ```ts
 * // Standalone — opens its own transaction
 * const result = await redeemAndRecordUsage({
 *   promoCodeId: '550e8400-e29b-41d4-a716-446655440000',
 *   customerId: 'cust_abc',
 *   discountAmount: 500,
 *   currency: 'ARS',
 *   livemode: true,
 * });
 * if (!result.success) {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Enlisted in a caller-provided transaction
 * await withTransaction(async (tx) => {
 *   const result = await redeemAndRecordUsage({
 *     promoCodeId: 'abc',
 *     customerId: 'cust_xyz',
 *     discountAmount: 1000,
 *     currency: 'ARS',
 *     tx,
 *   });
 * });
 * ```
 *
 */
export async function redeemAndRecordUsage(
    input: RedeemAndRecordInput
): Promise<
    | { success: true; data: RedeemAndRecordResult }
    | { success: false; error: { code: string; message: string } }
> {
    const {
        promoCodeId,
        customerId,
        subscriptionId,
        discountAmount,
        currency = 'ARS',
        livemode = false,
        tx: outerTx
    } = input;

    const runInTransaction = async (
        tx: NonNullable<QueryContext['tx']>
    ): Promise<
        | { success: true; data: RedeemAndRecordResult }
        | { success: false; error: { code: string; message: string } }
    > => {
        // Step 1: Acquire a row-level lock to prevent concurrent over-redemption.
        // Drizzle-typed select instead of raw `tx.execute(SELECT *)`: raw
        // execute returns snake_case keys (`used_count`, `max_uses`) that
        // silently coerce camelCase reads to undefined, defeating the guard.
        // See SPEC-064 IT-7.
        const lockedCodeRows = await tx
            .select()
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, promoCodeId))
            .for('update');
        const lockedCode = lockedCodeRows[0];

        if (!lockedCode) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: 'Promo code not found'
                }
            };
        }

        // Step 2: Validate global usage limit inside the lock.
        const currentUsed = lockedCode.usedCount ?? 0;
        const maxUses = lockedCode.maxUses;

        if (maxUses !== null && maxUses !== undefined && currentUsed >= maxUses) {
            return {
                success: false,
                error: {
                    code: 'PROMO_CODE_MAX_USES',
                    message: 'This promo code has reached its maximum number of uses'
                }
            };
        }

        // Step 3: Validate per-customer usage limit (maxPerCustomer) inside the lock.
        const maxPerCustomer = lockedCode.maxPerCustomer;

        if (maxPerCustomer !== null && maxPerCustomer !== undefined && maxPerCustomer > 0) {
            const [usageRow] = await tx
                .select({ total: count() })
                .from(billingPromoCodeUsage)
                .where(
                    sql`${billingPromoCodeUsage.promoCodeId} = ${promoCodeId}
                        AND ${billingPromoCodeUsage.customerId} = ${customerId}`
                );

            const customerUseCount = usageRow?.total ?? 0;

            if (customerUseCount >= maxPerCustomer) {
                return {
                    success: false,
                    error: {
                        code: 'PROMO_CODE_MAX_USES_PER_CUSTOMER',
                        message: 'You have already used this promo code the maximum number of times'
                    }
                };
            }
        }

        // Step 4: Increment the global usage counter atomically.
        const [updatedCode] = await tx
            .update(billingPromoCodes)
            .set({ usedCount: sql`${billingPromoCodes.usedCount} + 1` })
            .where(eq(billingPromoCodes.id, promoCodeId))
            .returning();

        if (!updatedCode) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to increment promo code usage count'
                }
            };
        }

        // Step 5: Insert the usage record in the same transaction boundary.
        const [usageRecord] = await tx
            .insert(billingPromoCodeUsage)
            .values({
                promoCodeId,
                customerId,
                subscriptionId: subscriptionId ?? null,
                discountAmount,
                currency,
                livemode
            })
            .returning({ id: billingPromoCodeUsage.id });

        if (!usageRecord) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to record promo code usage'
                }
            };
        }

        return {
            success: true,
            data: {
                promoCode: updatedCode,
                usageRecord
            }
        };
    };

    try {
        if (outerTx) {
            return await runInTransaction(outerTx);
        }

        return await withTransaction(runInTransaction);
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to redeem and record promo code usage'
            }
        };
    }
}

/**
 * Apply a promo code to a checkout session or existing subscription.
 *
 * Validates the code is active and not expired, then **branches by effect kind**
 * (SPEC-262 T-005):
 *
 * - **`discount`** — computes `finalAmount` and `discountAmount` (identical to
 *   the pre-SPEC-262 behavior for `durationCycles = 1`, AC-4.1 regression lock).
 *   When `subscriptionId` is provided, stamps `promo_effect_remaining_cycles`
 *   on the subscription for multi-cycle tracking (T-007 reads this on renewal).
 *
 * - **`trial_extension`** — returns `extraDays` from the persisted DB effect.
 *   At signup the caller translates this to `freeTrialDays` on the qzpay
 *   subscription-create input (AC-3.2). On an existing sub the caller pushes
 *   `trial_end` (T-006). No monetary discount is applied.
 *
 * - **`comp`** — marks a subscription permanently free (`status = 'comp'` via
 *   raw SQL when `subscriptionId` is supplied) and records 0 discount.
 *   The caller MUST NOT create a MercadoPago preapproval for comp subscriptions
 *   (AC-2.1, Model β — OQ-1 CLOSED).
 *
 * Legacy codes (no `effect` on the DTO) fall through to the existing discount
 * path, preserving backward compat (AC-4.1 / AC-4.3).
 *
 * When `ctx` is provided and `ctx.tx` is set, the initial DB read participates
 * in the caller's transaction boundary. The internal atomic redeem still opens
 * its own transaction (or enlists in `ctx.tx` if present).
 *
 * @param code - Promo code string (case-insensitive)
 * @param customerId - Billing customer ID (used in usage record)
 * @param amount - Optional original amount in cents to calculate discount against
 * @param options - Optional settings
 * @param options.livemode - Whether in live mode (default: false)
 * @param options.subscriptionId - Optional subscription ID to link usage and set effect state
 * @param options.subscriptionStatus - Optional current subscription status for state machine
 *   validation (AC-3.4). When provided:
 *   - `canceled` or `expired` → any code kind is rejected.
 *   - `trial_extension` effect → only accepted when status is `trialing` or `undefined`.
 *   - `comp` and `discount` → accepted for any non-canceled/expired status.
 * @param ctx - Optional query context carrying a transaction client
 * @returns Typed apply result or error
 *
 * @example
 * ```ts
 * // Discount (AC-4.1 backward compat):
 * const result = await applyPromoCode('SAVE10', 'cust_abc', 5000, { livemode: true });
 * if (result.success) {
 *   console.log(`Discount: ${result.data.discountAmount}, Final: ${result.data.finalAmount}`);
 * }
 *
 * // Trial extension at signup:
 * const result = await applyPromoCode('FREEMONTH', 'cust_abc', 0, { livemode: true });
 * if (result.success && result.data.effectKind === 'trial_extension') {
 *   const freeTrialDays = result.data.extraDays; // pass to qzpay
 * }
 *
 * // Comp:
 * const result = await applyPromoCode('HOSPEDA_FREE', 'cust_abc', 5000, {
 *   livemode: true,
 *   subscriptionId: 'sub_xyz',
 * });
 * // Subscription sub_xyz now has status='comp'; do NOT create MP preapproval.
 * ```
 */
export async function applyPromoCode(
    code: string,
    customerId: string,
    amount?: number,
    options: {
        readonly livemode?: boolean;
        readonly subscriptionId?: string;
        readonly subscriptionStatus?: string;
    } = {},
    ctx?: QueryContext
) {
    const normalizedCode = code.toUpperCase();

    try {
        const result = await getPromoCodeByCode(normalizedCode, ctx);

        if (!result.success || !result.data) {
            return {
                success: false as const,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        const promoCode: PromoCode = result.data;

        if (!promoCode.active) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'This promo code is no longer active'
                }
            };
        }

        if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'This promo code has expired'
                }
            };
        }

        const effectiveAmount = amount ?? 0;
        const livemode = options.livemode ?? false;
        const subscriptionId = options.subscriptionId;
        const subscriptionStatus = options.subscriptionStatus;

        // ------------------------------------------------------------------
        // State machine validation (SPEC-262 §14, AC-3.4)
        // ------------------------------------------------------------------

        // Determine the effect kind early for state machine checks
        const effectKindForValidation = promoCode.effect?.kind ?? null;

        // Rule 1: No code kind is valid on a cancelled or expired subscription.
        if (
            subscriptionStatus === SubscriptionStatusEnum.CANCELLED ||
            subscriptionStatus === SubscriptionStatusEnum.EXPIRED
        ) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Cannot apply promo code to a canceled or expired subscription'
                }
            };
        }

        // Rule 2: trial_extension is only valid when the subscription is in 'trialing' status.
        // If subscriptionStatus is undefined (checkout signup path, no existing sub), allow it.
        if (
            effectKindForValidation === PromoEffectKindEnum.TRIAL_EXTENSION &&
            subscriptionStatus !== undefined &&
            subscriptionStatus !== SubscriptionStatusEnum.TRIALING
        ) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        'Trial extension can only be applied to a subscription in trialing status'
                }
            };
        }

        // ------------------------------------------------------------------
        // Branch by effect kind (SPEC-262 T-005)
        // ------------------------------------------------------------------

        // effectKindForValidation was computed above for state-machine checks;
        // re-use it here to avoid a second optional-chain.
        const effectKind = effectKindForValidation;

        // ── COMP effect ──────────────────────────────────────────────────────
        if (effectKind === PromoEffectKindEnum.COMP) {
            const redeemResult = await withTransaction(async (tx) => {
                const inner = await redeemAndRecordInTx(
                    tx,
                    promoCode,
                    customerId,
                    0,
                    livemode,
                    subscriptionId
                );
                if (!inner.success) {
                    return inner;
                }
                // Stamp subscription status = 'comp' INSIDE the same transaction so
                // the redeem (usage increment) and the comp flip are atomic: if the
                // UPDATE fails, the redemption rolls back too (fail-closed — S-1/AC-2.1).
                if (subscriptionId) {
                    await tx.execute(
                        sql`UPDATE billing_subscriptions
                            SET status = ${SubscriptionStatusEnum.COMP}
                            WHERE id = ${subscriptionId}`
                    );
                }
                return inner;
            });

            if (!redeemResult.success) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: redeemResult.error?.message ?? 'Failed to apply promo code'
                    }
                };
            }

            return {
                success: true as const,
                data: {
                    effectKind: 'comp' as const,
                    code: promoCode.code,
                    discountAmount: 0 as const,
                    finalAmount: 0 as const,
                    originalAmount: effectiveAmount,
                    // Backward-compat: callers may access .type/.value without
                    // narrowing on effectKind (AC-4.3). Set to undefined so the
                    // property exists in the type and the access doesn't error.
                    type: undefined as undefined,
                    value: undefined as undefined,
                    extraDays: undefined as undefined
                }
            };
        }

        // ── TRIAL_EXTENSION effect ───────────────────────────────────────────
        if (effectKind === PromoEffectKindEnum.TRIAL_EXTENSION) {
            // extraDays comes from the PERSISTED DB effect, not the config (AC-3.2)
            const extraDays =
                promoCode.effect?.kind === PromoEffectKindEnum.TRIAL_EXTENSION
                    ? promoCode.effect.extraDays
                    : 0;

            if (!extraDays || extraDays <= 0) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Trial extension promo code has no valid extra days configured'
                    }
                };
            }

            const redeemResult = await withTransaction(async (tx) => {
                return redeemAndRecordInTx(tx, promoCode, customerId, 0, livemode, subscriptionId);
            });

            if (!redeemResult.success) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: redeemResult.error?.message ?? 'Failed to apply promo code'
                    }
                };
            }

            return {
                success: true as const,
                data: {
                    effectKind: 'trial_extension' as const,
                    code: promoCode.code,
                    extraDays,
                    discountAmount: 0 as const,
                    finalAmount: effectiveAmount,
                    originalAmount: effectiveAmount,
                    // Backward-compat: callers may access .type/.value without
                    // narrowing on effectKind (AC-4.3).
                    type: undefined as undefined,
                    value: undefined as undefined
                }
            };
        }

        // ── DISCOUNT effect (or legacy code with no `effect`) ────────────────
        // This branch covers:
        //   - New SPEC-262 discount effects (with typed `effect.kind === 'discount'`)
        //   - Legacy codes with no `effect` field (AC-4.1 regression lock)
        //
        // Computation is DELEGATED to the pure `calculatePromoCodeEffect` function
        // which is the single source of truth for monetary calculations (SPEC-262 T-005).
        // For legacy codes with no `effect`, a synthetic discount effect is built from
        // the legacy `type` + `value` fields with durationCycles=1 (AC-4.1 compat).

        // Build a normalized effect for the pure reducer — prefer the typed effect,
        // fall back to the legacy flat fields for backward compat (AC-4.3).
        const legacyValueKind: ValueKindEnum =
            promoCode.type === 'percentage' ? ValueKindEnum.PERCENTAGE : ValueKindEnum.FIXED;
        const normalizedEffect =
            promoCode.effect?.kind === PromoEffectKindEnum.DISCOUNT
                ? promoCode.effect
                : {
                      kind: PromoEffectKindEnum.DISCOUNT as const,
                      valueKind: legacyValueKind,
                      value: promoCode.value,
                      // Cast to `number | null` so the object satisfies the
                      // DiscountEffect branch of PromoEffect (AC-4.1 legacy path).
                      durationCycles: 1 as number | null
                  };

        const discountMutation = calculatePromoCodeEffect(normalizedEffect, effectiveAmount);

        // calculatePromoCodeEffect always returns a DiscountMutation here because
        // we passed a discount-kind effect above. Narrow for type safety.
        if (discountMutation.type !== 'apply-discount') {
            // This branch is unreachable but TypeScript needs the narrowing.
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Effect reducer returned unexpected mutation type'
                }
            };
        }

        const {
            discountAmount,
            finalAmount,
            remainingCycles: rawRemainingCycles,
            roundingDelta
        } = discountMutation;

        // For subscriptionId context, remainingCycles is the value from the reducer.
        // When no subscriptionId is provided, we keep it undefined (preview path).
        const remainingCycles: number | null | undefined =
            subscriptionId !== undefined ? rawRemainingCycles : undefined;

        // Redeem and record usage atomically.
        const redeemResult = await withTransaction(async (tx) => {
            const inner = await redeemAndRecordInTx(
                tx,
                promoCode,
                customerId,
                discountAmount,
                livemode,
                subscriptionId
            );
            if (!inner.success) return inner;

            // Set remaining_cycles on the subscription when applicable.
            // durationCycles=1 → set to 0 (exhausted); durationCycles=null → set NULL (forever).
            // Only write when subscriptionId is known and effect is typed (not legacy).
            if (
                subscriptionId &&
                promoCode.effect?.kind === PromoEffectKindEnum.DISCOUNT &&
                remainingCycles !== undefined
            ) {
                await tx.execute(
                    sql`UPDATE billing_subscriptions
                        SET promo_effect_remaining_cycles = ${remainingCycles}
                        WHERE id = ${subscriptionId}`
                );
            }

            return inner;
        });

        if (!redeemResult.success) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        redeemResult.error?.message ??
                        'This promo code has reached its maximum number of uses'
                }
            };
        }

        return {
            success: true as const,
            data: {
                effectKind: 'discount' as const,
                code: promoCode.code,
                type: promoCode.type,
                value: promoCode.value,
                discountAmount,
                finalAmount,
                originalAmount: effectiveAmount,
                ...(roundingDelta !== undefined && roundingDelta > 0 && { roundingDelta }),
                ...(subscriptionId !== undefined ? { remainingCycles } : {})
            }
        };
    } catch (error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: error instanceof Error ? error.message : 'Failed to apply promo code'
            }
        };
    }
}

// ---------------------------------------------------------------------------
// Internal transaction helper
// ---------------------------------------------------------------------------

/**
 * Execute the atomic "lock, validate limits, increment usage, record" steps
 * inside an already-open transaction.
 *
 * Extracted so both the discount path and the effect-specific paths can
 * share identical concurrency-safe redemption logic without duplicating the
 * FOR UPDATE locking pattern.
 *
 * @internal
 */
async function redeemAndRecordInTx(
    tx: NonNullable<QueryContext['tx']>,
    promoCode: PromoCode,
    customerId: string,
    discountAmount: number,
    livemode: boolean,
    subscriptionId: string | undefined
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
    // Lock the row. Drizzle-typed select (not raw execute) avoids the snake_case
    // vs camelCase coercion bug from SPEC-064 IT-7.
    const lockedRows = await tx
        .select()
        .from(billingPromoCodes)
        .where(eq(billingPromoCodes.id, promoCode.id))
        .for('update');
    const lockedPromoCode = lockedRows[0];

    if (!lockedPromoCode) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.NOT_FOUND,
                message: 'Promo code not found'
            }
        };
    }

    const currentUsed = lockedPromoCode.usedCount ?? 0;
    const maxUses = lockedPromoCode.maxUses;

    if (maxUses !== null && maxUses !== undefined && currentUsed >= maxUses) {
        return {
            success: false as const,
            error: {
                code: 'PROMO_CODE_MAX_USES',
                message: 'This promo code has reached its maximum number of uses'
            }
        };
    }

    // Defense-in-depth: re-validate expiration inside the lock.
    if (lockedPromoCode.expiresAt && new Date(lockedPromoCode.expiresAt) < new Date()) {
        return {
            success: false as const,
            error: {
                code: 'PROMO_CODE_EXPIRED',
                message: 'This promo code has expired'
            }
        };
    }

    await tx
        .update(billingPromoCodes)
        .set({ usedCount: sql`${billingPromoCodes.usedCount} + 1` })
        .where(eq(billingPromoCodes.id, promoCode.id));

    await tx.insert(billingPromoCodeUsage).values({
        promoCodeId: promoCode.id,
        customerId,
        subscriptionId: subscriptionId ?? null,
        discountAmount,
        currency: 'ARS',
        livemode
    });

    return { success: true as const };
}
