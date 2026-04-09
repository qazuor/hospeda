/**
 * Promo Code CRUD Module
 *
 * Handles database CRUD operations for promo codes:
 * - Create, read, update, soft-delete, and list promo codes
 * - Maps database records to the PromoCode response format
 *
 * @module services/billing/promo-code/promo-code.crud
 */

import {
    type QZPayBillingPromoCode,
    and,
    billingPromoCodes,
    count,
    desc,
    eq,
    getDb,
    isNull,
    lte,
    or,
    safeIlike,
    sql
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type {
    CreatePromoCodeInput,
    ListPromoCodesFilters,
    PromoCode,
    UpdatePromoCodeInput
} from './promo-code.service.js';

/**
 * Map a database promo code row to the PromoCode response shape.
 *
 * @param dbPromoCode - Raw database row from billingPromoCodes
 * @returns Mapped PromoCode DTO
 */
export function mapDbToPromoCode(dbPromoCode: QZPayBillingPromoCode): PromoCode {
    return {
        id: dbPromoCode.id,
        code: dbPromoCode.code,
        type: dbPromoCode.type as 'percentage' | 'fixed',
        value: dbPromoCode.value,
        active: dbPromoCode.active ?? false,
        expiresAt: dbPromoCode.expiresAt?.toISOString(),
        maxUses: dbPromoCode.maxUses ?? undefined,
        timesRedeemed: dbPromoCode.usedCount ?? 0,
        metadata: (dbPromoCode.config as Record<string, unknown>) ?? undefined,
        validPlans: dbPromoCode.validPlans ?? undefined,
        newCustomersOnly: dbPromoCode.newCustomersOnly ?? false,
        createdAt: dbPromoCode.createdAt.toISOString(),
        updatedAt: dbPromoCode.createdAt.toISOString() // QZPay schema doesn't have updatedAt
    };
}

/**
 * Create a new promo code in the database.
 *
 * Uppercases the code, builds a config object from optional description and
 * minAmount fields, and inserts the record.
 *
 * @param input - Promo code creation data
 * @param options - Optional settings
 * @param options.livemode - Whether to create in live mode (default: false)
 * @returns Created PromoCode or error
 *
 * @example
 * ```ts
 * const result = await createPromoCode({
 *   code: 'SAVE10',
 *   discountType: 'percentage',
 *   discountValue: 10,
 * });
 * ```
 */
export async function createPromoCode(
    input: CreatePromoCodeInput,
    options: { readonly livemode?: boolean } = {}
) {
    try {
        const db = getDb();
        const code = input.code.toUpperCase();

        const config: Record<string, unknown> = {};
        if (input.description) {
            config.description = input.description;
        }
        if (input.minAmount) {
            config.minAmount = input.minAmount;
        }

        const result = await db
            .insert(billingPromoCodes)
            .values({
                code,
                type: input.discountType,
                value: input.discountValue,
                config: Object.keys(config).length > 0 ? config : null,
                maxUses: input.maxUses ?? null,
                usedCount: 0,
                validPlans: input.planRestrictions ?? null,
                newCustomersOnly: input.firstPurchaseOnly ?? false,
                active: input.isActive ?? true,
                expiresAt: input.expiryDate ?? null,
                livemode: options.livemode ?? false
            })
            .returning();

        const promoCode = result[0];

        if (!promoCode) {
            throw new Error('Failed to create promo code');
        }

        return { success: true, data: mapDbToPromoCode(promoCode) };
    } catch (_error) {
        return {
            success: false,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to create promo code' }
        };
    }
}

/**
 * Get a promo code by its code string.
 *
 * Normalizes the code to uppercase before querying.
 *
 * @param code - Promo code string (case-insensitive)
 * @returns PromoCode or NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getPromoCodeByCode('save10');
 * if (result.success) {
 *   console.log(result.data.id);
 * }
 * ```
 */
export async function getPromoCodeByCode(code: string) {
    try {
        const db = getDb();
        const normalizedCode = code.toUpperCase();

        const [dbPromoCode] = await db
            .select()
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.code, normalizedCode))
            .limit(1);

        if (dbPromoCode) {
            return { success: true, data: mapDbToPromoCode(dbPromoCode) };
        }

        return {
            success: false,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
        };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to retrieve promo code'
            }
        };
    }
}

/**
 * Get a promo code by its database ID.
 *
 * @param id - UUID of the promo code record
 * @returns PromoCode or NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getPromoCodeById('550e8400-e29b-41d4-a716-446655440000');
 * ```
 */
export async function getPromoCodeById(id: string) {
    try {
        const db = getDb();

        const [promoCode] = await db
            .select()
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, id))
            .limit(1);

        if (!promoCode) {
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        return { success: true, data: mapDbToPromoCode(promoCode) };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to retrieve promo code'
            }
        };
    }
}

/**
 * Update a promo code's mutable fields.
 *
 * Only updates fields that are explicitly provided. The description is merged
 * into the existing config JSON object.
 *
 * @param id - Promo code ID
 * @param input - Fields to update (all optional)
 * @returns Updated PromoCode or error
 *
 * @example
 * ```ts
 * const result = await updatePromoCode('abc', { isActive: false });
 * ```
 */
export async function updatePromoCode(id: string, input: UpdatePromoCodeInput) {
    try {
        const db = getDb();

        const updateData: Partial<QZPayBillingPromoCode> = {};

        if (input.description !== undefined) {
            const [existing] = await db
                .select()
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.id, id))
                .limit(1);

            if (!existing) {
                return {
                    success: false,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
                };
            }

            const config = (existing.config as Record<string, unknown>) ?? {};
            config.description = input.description;
            updateData.config = config;
        }

        if (input.expiryDate !== undefined) {
            updateData.expiresAt = input.expiryDate;
        }

        if (input.maxUses !== undefined) {
            updateData.maxUses = input.maxUses;
        }

        if (input.isActive !== undefined) {
            updateData.active = input.isActive;
        }

        const [updatedPromoCode] = await db
            .update(billingPromoCodes)
            .set(updateData)
            .where(eq(billingPromoCodes.id, id))
            .returning();

        if (!updatedPromoCode) {
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        return { success: true, data: mapDbToPromoCode(updatedPromoCode) };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to update promo code'
            }
        };
    }
}

/**
 * Soft-delete a promo code by setting active = false.
 *
 * @param id - Promo code ID
 * @returns Success or NOT_FOUND error
 *
 * @example
 * ```ts
 * await deletePromoCode('550e8400-e29b-41d4-a716-446655440000');
 * ```
 */
export async function deletePromoCode(id: string) {
    try {
        const db = getDb();

        const [deletedPromoCode] = await db
            .update(billingPromoCodes)
            .set({ active: false })
            .where(eq(billingPromoCodes.id, id))
            .returning();

        if (!deletedPromoCode) {
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
                message: 'Failed to delete promo code'
            }
        };
    }
}

/**
 * List promo codes with optional filters and pagination.
 *
 * Supports filtering by active status, expiry status, and code substring search.
 * Results are ordered by createdAt descending.
 *
 * @param filters - Filter and pagination options
 * @returns Paginated list of promo codes with total count
 *
 * @example
 * ```ts
 * const result = await listPromoCodes({ active: true, page: 1, pageSize: 20 });
 * if (result.success) {
 *   console.log(result.data.items, result.data.pagination);
 * }
 * ```
 */
export async function listPromoCodes(filters: ListPromoCodesFilters = {}) {
    try {
        const db = getDb();
        const { page = 1, pageSize = 20, active, expired, codeSearch } = filters;

        const conditions = [];

        if (active !== undefined) {
            conditions.push(eq(billingPromoCodes.active, active));
        }

        if (expired !== undefined) {
            if (expired) {
                conditions.push(lte(billingPromoCodes.expiresAt, new Date()));
            } else {
                conditions.push(
                    or(
                        isNull(billingPromoCodes.expiresAt),
                        sql`${billingPromoCodes.expiresAt} > NOW()`
                    )
                );
            }
        }

        if (codeSearch) {
            conditions.push(safeIlike(billingPromoCodes.code, codeSearch));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ value: count() })
            .from(billingPromoCodes)
            .where(whereClause);

        const total = countResult[0]?.value ?? 0;

        const items = await db
            .select()
            .from(billingPromoCodes)
            .where(whereClause)
            .orderBy(desc(billingPromoCodes.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const mappedItems = items.map((item) => mapDbToPromoCode(item));

        return {
            success: true,
            data: {
                items: mappedItems,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            }
        };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to list promo codes'
            }
        };
    }
}
