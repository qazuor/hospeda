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
    eq,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import type { QueryContext } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
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
    /** ISO 4217 currency code */
    currency: string;
    /** Whether in live mode (default: false) */
    livemode?: boolean;
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
                currency: data.currency,
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
 * Apply a promo code to a checkout session.
 *
 * Validates the code is active and not expired, calculates the discount,
 * then atomically redeems it and records the usage event.
 *
 * @param code - Promo code string (case-insensitive)
 * @param customerId - Billing customer ID (used in usage record)
 * @param amount - Optional original amount in cents to calculate discount against
 * @param options - Optional settings
 * @param options.livemode - Whether in live mode (default: false)
 * @returns Discount calculation result or error
 *
 * @example
 * ```ts
 * const result = await applyPromoCode('SAVE10', 'cust_abc', 5000, { livemode: true });
 * if (result.success) {
 *   console.log(`Discount: ${result.data.discountAmount}, Final: ${result.data.finalAmount}`);
 * }
 * ```
 */
export async function applyPromoCode(
    code: string,
    customerId: string,
    amount?: number,
    options: { readonly livemode?: boolean } = {}
) {
    const normalizedCode = code.toUpperCase();

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

        // Redeem and record usage in a single transaction so that if the
        // purchase fails downstream the usage record is also rolled back.
        const redeemResult = await withTransaction(async (tx) => {
            // Lock and increment usage count
            const queryResult = await tx.execute<QZPayBillingPromoCode>(
                sql`SELECT * FROM ${billingPromoCodes}
                    WHERE id = ${promoCode.id}
                    FOR UPDATE`
            );
            const lockedPromoCode = queryResult.rows?.[0];

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

            if (maxUses !== null && currentUsed >= maxUses) {
                return {
                    success: false as const,
                    error: {
                        code: 'PROMO_CODE_MAX_USES' as string,
                        message: 'This promo code has reached its maximum number of uses'
                    }
                };
            }

            // Defense-in-depth: re-validate expiration inside the lock
            if (lockedPromoCode.expiresAt && new Date(lockedPromoCode.expiresAt) < new Date()) {
                return {
                    success: false as const,
                    error: {
                        code: 'PROMO_CODE_EXPIRED' as string,
                        message: 'This promo code has expired'
                    }
                };
            }

            await tx
                .update(billingPromoCodes)
                .set({ usedCount: sql`${billingPromoCodes.usedCount} + 1` })
                .where(eq(billingPromoCodes.id, promoCode.id));

            // Record usage in same transaction
            await tx.insert(billingPromoCodeUsage).values({
                promoCodeId: promoCode.id,
                customerId,
                subscriptionId: null,
                discountAmount,
                currency: 'ARS',
                livemode: options.livemode ?? false
            });

            return { success: true as const };
        });

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
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: error instanceof Error ? error.message : 'Failed to apply promo code'
            }
        };
    }
}
