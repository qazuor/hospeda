/**
 * Promo Code CRUD Module
 *
 * Handles database CRUD operations for promo codes:
 * - Create, read, update, soft-delete, and list promo codes
 * - Maps database records to the PromoCode response format
 *
 * @module services/promo-code.crud
 */

import {
    type QZPayBillingPromoCode,
    and,
    billingPromoCodes,
    count,
    desc,
    eq,
    getDb,
    ilike,
    isNull,
    lte,
    or,
    sql
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { apiLogger } from '../utils/logger';
import type {
    CreatePromoCodeInput,
    ListPromoCodesFilters,
    PromoCode,
    UpdatePromoCodeInput
} from './promo-code.service';

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
export async function createPromoCode(input: CreatePromoCodeInput) {
    try {
        const db = getDb();
        const code = input.code.toUpperCase();

        apiLogger.info({ code }, 'Creating promo code in database');

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
                livemode: process.env.NODE_ENV === 'production'
            })
            .returning();

        const promoCode = result[0];

        if (!promoCode) {
            throw new Error('Failed to create promo code');
        }

        apiLogger.info({ id: promoCode.id }, 'Promo code created successfully');

        return { success: true, data: mapDbToPromoCode(promoCode) };
    } catch (error) {
        apiLogger.error(
            'Failed to create promo code',
            error instanceof Error ? error.message : String(error)
        );

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

        apiLogger.debug({ code: normalizedCode }, 'Looking up promo code in database');

        const [dbPromoCode] = await db
            .select()
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.code, normalizedCode))
            .limit(1);

        if (dbPromoCode) {
            apiLogger.info({ code: normalizedCode }, 'Promo code found in database');
            return { success: true, data: mapDbToPromoCode(dbPromoCode) };
        }

        apiLogger.info({ code: normalizedCode }, 'Promo code not found');
        return {
            success: false,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
        };
    } catch (error) {
        apiLogger.error(
            'Failed to get promo code by code',
            error instanceof Error ? error.message : String(error)
        );

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

        apiLogger.debug({ id }, 'Looking up promo code by ID');

        const [promoCode] = await db
            .select()
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, id))
            .limit(1);

        if (!promoCode) {
            apiLogger.info({ id }, 'Promo code not found');
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        apiLogger.info({ id }, 'Promo code found');
        return { success: true, data: mapDbToPromoCode(promoCode) };
    } catch (error) {
        apiLogger.error(
            'Failed to get promo code by ID',
            error instanceof Error ? error.message : String(error)
        );

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

        apiLogger.info({ id }, 'Updating promo code');

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

        apiLogger.info({ id }, 'Promo code updated successfully');

        return { success: true, data: mapDbToPromoCode(updatedPromoCode) };
    } catch (error) {
        apiLogger.error(
            'Failed to update promo code',
            error instanceof Error ? error.message : String(error)
        );

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

        apiLogger.info({ id }, 'Deleting promo code (soft delete)');

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

        apiLogger.info({ id }, 'Promo code deleted successfully');

        return { success: true, data: undefined };
    } catch (error) {
        apiLogger.error(
            'Failed to delete promo code',
            error instanceof Error ? error.message : String(error)
        );

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

        apiLogger.debug({ filters }, 'Listing promo codes');

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
            conditions.push(ilike(billingPromoCodes.code, `%${codeSearch}%`));
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

        apiLogger.info({ total, page, pageSize }, 'Promo codes listed successfully');

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
    } catch (error) {
        apiLogger.error(
            'Failed to list promo codes',
            error instanceof Error ? error.message : String(error)
        );

        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to list promo codes'
            }
        };
    }
}
