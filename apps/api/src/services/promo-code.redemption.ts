/**
 * Promo Code Redemption Module
 *
 * Handles atomic redemption, usage tracking, and application of promo codes
 * to checkout sessions.
 *
 * Uses row-level locking (SELECT FOR UPDATE) inside a transaction to prevent
 * race conditions when multiple concurrent requests attempt to redeem the same code.
 *
 * @module services/promo-code.redemption
 */

import {
    type QZPayBillingPromoCode,
    billingPromoCodeUsage,
    billingPromoCodes,
    eq,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { apiLogger } from '../utils/logger';
import { getPromoCodeByCode } from './promo-code.crud';
import type { PromoCode } from './promo-code.service';

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
    /** ISO 4217 currency code */
    currency: string;
}

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
        apiLogger.info({ promoCodeId }, 'Attempting atomic promo code redemption');

        const result = await withTransaction(async (tx) => {
            const queryResult = await tx.execute<QZPayBillingPromoCode>(
                sql`SELECT * FROM ${billingPromoCodes}
                    WHERE id = ${promoCodeId}
                    FOR UPDATE`
            );
            const lockedPromoCode = queryResult.rows?.[0];

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
                apiLogger.warn(
                    { promoCodeId, currentUsed, maxUses },
                    'Promo code max uses exceeded (detected with lock)'
                );
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

            apiLogger.info(
                {
                    promoCodeId,
                    previousUsed: currentUsed,
                    newUsed: updated.usedCount,
                    maxUses
                },
                'Promo code redeemed atomically'
            );

            return { success: true, data: updated };
        });

        return result;
    } catch (error) {
        apiLogger.error(
            'Failed to atomically redeem promo code',
            error instanceof Error ? error.message : String(error)
        );

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
 * @param id - Promo code database ID
 * @returns Success or error
 *
 * @example
 * ```ts
 * await incrementPromoCodeUsage('550e8400-e29b-41d4-a716-446655440000');
 * ```
 */
export async function incrementPromoCodeUsage(id: string) {
    try {
        const db = getDb();

        apiLogger.info({ id }, 'Incrementing promo code usage');

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

        apiLogger.info({ id, newCount: updated.usedCount }, 'Promo code usage incremented');

        return { success: true, data: undefined };
    } catch (error) {
        apiLogger.error(
            'Failed to increment promo code usage',
            error instanceof Error ? error.message : String(error)
        );

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
 * @param data - Usage record data
 * @returns Created usage record or error
 *
 * @example
 * ```ts
 * await recordPromoCodeUsage({
 *   promoCodeId: 'abc',
 *   customerId: 'cust_123',
 *   discountAmount: 500,
 *   currency: 'ARS',
 * });
 * ```
 */
export async function recordPromoCodeUsage(data: RecordUsageInput) {
    try {
        const db = getDb();

        apiLogger.info(
            { promoCodeId: data.promoCodeId, customerId: data.customerId },
            'Recording promo code usage'
        );

        const result = await db
            .insert(billingPromoCodeUsage)
            .values({
                promoCodeId: data.promoCodeId,
                customerId: data.customerId,
                subscriptionId: data.subscriptionId ?? null,
                discountAmount: data.discountAmount,
                currency: data.currency,
                livemode: process.env.NODE_ENV === 'production'
            })
            .returning();

        const usage = result[0];

        if (!usage) {
            throw new Error('Failed to record promo code usage');
        }

        apiLogger.info({ id: usage.id }, 'Promo code usage recorded successfully');

        return { success: true, data: usage };
    } catch (error) {
        apiLogger.error(
            'Failed to record promo code usage',
            error instanceof Error ? error.message : String(error)
        );

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
 * Apply a promo code to a checkout session.
 *
 * Validates the code is active and not expired, calculates the discount,
 * then atomically redeems it and records the usage event.
 *
 * @param code - Promo code string (case-insensitive)
 * @param customerId - Billing customer ID (used in usage record)
 * @param amount - Optional original amount in cents to calculate discount against
 * @returns Discount calculation result or error
 *
 * @example
 * ```ts
 * const result = await applyPromoCode('SAVE10', 'cust_abc', 5000);
 * if (result.success) {
 *   console.log(`Discount: ${result.data.discountAmount}, Final: ${result.data.finalAmount}`);
 * }
 * ```
 */
export async function applyPromoCode(code: string, customerId: string, amount?: number) {
    const normalizedCode = code.toUpperCase();

    apiLogger.info({ code: normalizedCode, customerId }, 'Applying promo code');

    try {
        const result = await getPromoCodeByCode(normalizedCode);

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

        let discountAmount = 0;
        const effectiveAmount = amount || 0;

        if (effectiveAmount > 0) {
            if (promoCode.type === 'percentage') {
                discountAmount = Math.round((effectiveAmount * promoCode.value) / 100);
            } else {
                discountAmount = Math.min(promoCode.value, effectiveAmount);
            }
        }

        const finalAmount = Math.max(0, effectiveAmount - discountAmount);

        const redeemResult = await tryRedeemAtomically(promoCode.id);

        if (!redeemResult.success) {
            return {
                success: false as const,
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message:
                        redeemResult.error?.message ||
                        'This promo code has reached its maximum number of uses'
                }
            };
        }

        await recordPromoCodeUsage({
            promoCodeId: promoCode.id,
            customerId,
            discountAmount,
            currency: 'ARS'
        });

        apiLogger.info(
            {
                code: normalizedCode,
                customerId,
                originalAmount: effectiveAmount,
                discountAmount,
                finalAmount,
                discountType: promoCode.type,
                discountValue: promoCode.value
            },
            'Promo code applied successfully'
        );

        return {
            success: true as const,
            data: {
                code: promoCode.code,
                type: promoCode.type,
                value: promoCode.value,
                discountAmount,
                finalAmount,
                originalAmount: effectiveAmount
            }
        };
    } catch (error) {
        apiLogger.error(
            'Failed to apply promo code',
            error instanceof Error ? error.message : String(error)
        );

        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: error instanceof Error ? error.message : 'Failed to apply promo code'
            }
        };
    }
}
