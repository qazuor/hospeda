/**
 * Promo Code Validation Module
 *
 * Validates a promo code against a given context (plan, user, amount).
 *
 * Checks performed:
 * - Code exists and is active
 * - Not expired
 * - Usage count < maxUses
 * - Plan restriction (if any)
 * - Minimum amount requirement (if any)
 * - Calculates discount preview when amount is provided
 *
 * @module services/billing/promo-code/promo-code.validation
 */

import {
    billingPromoCodeUsage,
    billingPromoCodes,
    billingSubscriptions,
    count,
    eq,
    getDb,
    sql
} from '@repo/db';
import type { QueryContext } from '@repo/db';
import { getPromoCodeByCode } from './promo-code.crud.js';
import type {
    PromoCode,
    PromoCodeValidationContext,
    PromoCodeValidationResult
} from './promo-code.service.js';

/**
 * Validate a promo code for a specific checkout context.
 *
 * **IMPORTANT — best-effort validation only.**
 *
 * This function performs all business rule checks (existence, expiry, usage count, plan
 * restrictions, minimum amount) but does NOT acquire a database lock on the promo code row.
 * As a result, the result is subject to a time-of-check / time-of-use (TOCTOU) race condition:
 *
 * - Two concurrent requests can both call `validatePromoCode` and both see `valid: true`.
 * - If only one redemption remains, one of the two subsequent writes will exceed `maxUses`.
 *
 * **For authoritative, race-safe redemption use `redeemAndRecordUsage`**, which re-validates
 * the code inside a `SELECT FOR UPDATE` transaction lock (see ADR-019). The lock prevents any
 * other writer from reading or modifying the promo code row until the transaction commits.
 *
 * This function is appropriate for:
 * - UI feedback before checkout (show discount preview to the user).
 * - Non-financial validation checks where a brief race window is acceptable.
 *
 * It is NOT appropriate for:
 * - Final redemption decisions.
 * - Any path where two concurrent actors must be mutually excluded.
 *
 * Performs all business rule checks in order and returns the first failure
 * encountered. If all checks pass, returns `valid: true` with an optional
 * `discountAmount` preview (when `context.amount` is provided).
 *
 * @param code - Promo code string (case-insensitive)
 * @param context - Validation context (planId, userId, optional amount)
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, internal DB calls participate in the caller's transaction.
 *   Passing `ctx` here does NOT make this call race-safe on its own — you
 *   must also use `FOR UPDATE` in the same transaction (see `redeemAndRecordUsage`).
 * @returns Validation result with optional discount preview
 *
 * @example Best-effort preview (UI use)
 * ```ts
 * const result = await validatePromoCode('SAVE10', {
 *   userId: 'user_123',
 *   planId: 'plan_pro',
 *   amount: 5000,
 * });
 * if (result.valid) {
 *   console.log('Discount preview:', result.discountAmount);
 * } else {
 *   console.error(result.errorMessage);
 * }
 * ```
 *
 * @example Authoritative redemption (use redeemAndRecordUsage instead)
 * ```ts
 * // DO NOT use validatePromoCode for final redemption.
 * // Use redeemAndRecordUsage which validates under SELECT FOR UPDATE:
 * const result = await redeemAndRecordUsage({ code: 'SAVE10', userId, planId, amount });
 * ```
 */
export async function validatePromoCode(
    code: string,
    context: PromoCodeValidationContext,
    ctx?: QueryContext
): Promise<PromoCodeValidationResult> {
    try {
        const normalizedCode = code.toUpperCase();

        const dbResult = await getPromoCodeByCode(normalizedCode, ctx);

        if (!dbResult.success || !dbResult.data) {
            return {
                valid: false,
                errorCode: 'PROMO_CODE_NOT_FOUND',
                errorMessage: 'Promo code not found'
            };
        }

        const promoData: PromoCode = dbResult.data;

        if (!promoData.active) {
            return {
                valid: false,
                errorCode: 'PROMO_CODE_INACTIVE',
                errorMessage: 'This promo code is no longer active'
            };
        }

        if (promoData.expiresAt && new Date() > new Date(promoData.expiresAt)) {
            return {
                valid: false,
                errorCode: 'PROMO_CODE_EXPIRED',
                errorMessage: 'This promo code has expired'
            };
        }

        if (promoData.maxUses && promoData.timesRedeemed >= promoData.maxUses) {
            return {
                valid: false,
                errorCode: 'PROMO_CODE_MAX_USES',
                errorMessage: 'This promo code has reached its maximum number of uses'
            };
        }

        // Check per-user redemption limit (maxPerCustomer) if set.
        // Query the raw DB row to access maxPerCustomer which is not surfaced on the DTO.
        if (context.userId) {
            const perUserExceeded = await checkUserRedemptionLimitExceeded({
                promoCodeId: promoData.id,
                userId: context.userId,
                ctx
            });
            if (perUserExceeded) {
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_MAX_USES_PER_USER',
                    errorMessage:
                        'You have already used this promo code the maximum number of times'
                };
            }
        }

        if (promoData.validPlans && promoData.validPlans.length > 0 && context.planId) {
            if (!promoData.validPlans.includes(context.planId)) {
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_PLAN_RESTRICTION',
                    errorMessage: 'This promo code is not valid for the selected plan'
                };
            }
        }

        if (promoData.newCustomersOnly && context.userId) {
            // Scope the "new customer" check to the specific plan being purchased.
            // A user who previously subscribed to plan A is still "new" to plan B.
            // Falls back to checking any subscription when planId is not provided.
            const hasExistingSubscription = await checkUserHasExistingPlanSubscription({
                userId: context.userId,
                planId: context.planId,
                ctx
            });
            if (hasExistingSubscription) {
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_NEW_USERS_ONLY',
                    errorMessage: 'This promo code is only valid for new customers'
                };
            }
        }

        if (context.amount !== undefined && promoData.metadata?.minAmount) {
            const minAmount = promoData.metadata.minAmount as number;
            if (context.amount < minAmount) {
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_MIN_AMOUNT',
                    errorMessage: `Minimum amount of ${minAmount} required to use this promo code`
                };
            }
        }

        let discountAmount: number | undefined;
        if (context.amount !== undefined) {
            if (promoData.type === 'percentage') {
                discountAmount = Math.round((context.amount * promoData.value) / 100);
            } else {
                discountAmount = Math.min(promoData.value, context.amount);
            }
        }

        return { valid: true, discountAmount };
    } catch (_error) {
        return {
            valid: false,
            errorCode: 'PROMO_CODE_VALIDATION_ERROR',
            errorMessage: 'Failed to validate promo code'
        };
    }
}

/**
 * Check if a user has an existing subscription to a specific plan (or any plan).
 *
 * Used to enforce the `newCustomersOnly` restriction, scoped to the target plan so
 * that a user who previously subscribed to plan A is still considered "new" when
 * purchasing plan B for the first time.
 *
 * When `planId` is undefined, falls back to checking whether the user has ANY active
 * subscription (original behaviour, preserved for backward compatibility).
 *
 * @param params - userId, optional planId to scope the check, and optional query context
 * @returns true if the user already has a subscription matching the criteria
 */
async function checkUserHasExistingPlanSubscription({
    userId,
    planId,
    ctx
}: {
    readonly userId: string;
    readonly planId?: string;
    readonly ctx?: QueryContext;
}): Promise<boolean> {
    try {
        const db = ctx?.tx ?? getDb();

        const conditions = planId
            ? sql`${billingSubscriptions.customerId} = ${userId}
                  AND ${billingSubscriptions.planId} = ${planId}`
            : eq(billingSubscriptions.customerId, userId);

        const [row] = await db
            .select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(conditions)
            .limit(1);

        return !!row;
    } catch (_error) {
        return false; // Fail-open: don't block validation on DB errors
    }
}

/**
 * Check if a specific user has exceeded the per-user redemption limit for a promo code.
 *
 * Reads `maxPerCustomer` from the raw DB row (not exposed on the DTO) and compares
 * it against the count of existing usage records for this user + code combination.
 *
 * Returns false (not exceeded) when:
 * - `maxPerCustomer` is null/0 (no limit configured)
 * - The DB query fails (fail-open to avoid blocking legitimate checkouts)
 *
 * @param params - promoCodeId, userId, and optional query context
 * @returns true if the user has reached or exceeded their per-user limit
 */
async function checkUserRedemptionLimitExceeded({
    promoCodeId,
    userId,
    ctx
}: {
    readonly promoCodeId: string;
    readonly userId: string;
    readonly ctx?: QueryContext;
}): Promise<boolean> {
    try {
        const db = ctx?.tx ?? getDb();

        // Read maxPerCustomer from the raw row — this field is not exposed on PromoCode DTO.
        const [rawRow] = await db
            .select({ maxPerCustomer: billingPromoCodes.maxPerCustomer })
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, promoCodeId))
            .limit(1);

        const maxPerCustomer = rawRow?.maxPerCustomer;

        if (!maxPerCustomer || maxPerCustomer <= 0) {
            return false; // No per-user limit configured
        }

        const [usageRow] = await db
            .select({ total: count() })
            .from(billingPromoCodeUsage)
            .where(
                sql`${billingPromoCodeUsage.promoCodeId} = ${promoCodeId}
                    AND ${billingPromoCodeUsage.customerId} = ${userId}`
            );

        const customerUseCount = usageRow?.total ?? 0;

        return customerUseCount >= maxPerCustomer;
    } catch (_error) {
        return false; // Fail-open: don't block validation on DB errors
    }
}
