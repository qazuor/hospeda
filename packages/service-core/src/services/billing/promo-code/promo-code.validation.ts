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

import { billingPromoCodeUsage, eq, getDb } from '@repo/db';
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
 * Performs all business rule checks in order and returns the first failure
 * encountered. If all checks pass, returns `valid: true` with an optional
 * `discountAmount` preview (when `context.amount` is provided).
 *
 * @param code - Promo code string (case-insensitive)
 * @param context - Validation context (planId, userId, optional amount)
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, internal DB calls participate in the caller's transaction.
 * @returns Validation result with optional discount preview
 *
 * @example
 * ```ts
 * const result = await validatePromoCode('SAVE10', {
 *   userId: 'user_123',
 *   planId: 'plan_pro',
 *   amount: 5000,
 * });
 * if (result.valid) {
 *   console.log('Discount:', result.discountAmount);
 * } else {
 *   console.error(result.errorMessage);
 * }
 * ```
 *
 * @example With transaction context
 * ```ts
 * await withServiceTransaction(async (ctx) => {
 *   const result = await validatePromoCode('SAVE10', { userId: 'u1' }, ctx);
 * });
 * ```
 */
export async function validatePromoCode(
    code: string,
    context: PromoCodeValidationContext,
    ctx?: QueryContext
): Promise<PromoCodeValidationResult> {
    try {
        const normalizedCode = code.toUpperCase();

        const dbResult = await getPromoCodeByCode(normalizedCode);

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
            const hasExistingUsage = await checkUserHasPromoUsage({ userId: context.userId, ctx });
            if (hasExistingUsage) {
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
 * Check if a user has any existing promo code usage records.
 *
 * Used to enforce the `newCustomersOnly` restriction by querying the
 * `billing_promo_code_usage` table for any previous redemptions.
 *
 * @param params - Object with userId to check and optional query context
 * @returns true if the user has at least one promo code usage record
 */
async function checkUserHasPromoUsage({
    userId,
    ctx
}: {
    readonly userId: string;
    readonly ctx?: QueryContext;
}): Promise<boolean> {
    try {
        const db = ctx?.tx ?? getDb();
        const [usage] = await db
            .select({ id: billingPromoCodeUsage.id })
            .from(billingPromoCodeUsage)
            .where(eq(billingPromoCodeUsage.customerId, userId))
            .limit(1);

        return !!usage;
    } catch (_error) {
        return false;
    }
}
