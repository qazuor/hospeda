/**
 * Promo Code Service
 *
 * Service for managing promo codes with database integration.
 * Provides:
 * - CRUD operations for promo codes (via Drizzle ORM)
 * - Validation (expiry, max uses, plan restrictions, first-purchase condition, min amount)
 * - Application of promo codes to checkout sessions
 * - Atomic usage count increment
 * - Fallback to DEFAULT_PROMO_CODES for backward compatibility
 *
 * @module services/promo-code
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { DEFAULT_PROMO_CODES } from '@repo/billing';
import {
    type QZPayBillingPromoCode,
    and,
    billingPromoCodeUsage,
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
import { getQZPayBilling } from '../middlewares/billing';
import { apiLogger } from '../utils/logger';

/**
 * Discount type for promo codes
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Promo code creation input
 */
export interface CreatePromoCodeInput {
    /** The promo code string (will be uppercased) */
    code: string;
    /** Discount type (percentage or fixed amount) */
    discountType: DiscountType;
    /** Discount value (percentage 0-100 or fixed amount in cents) */
    discountValue: number;
    /** Optional description */
    description?: string;
    /** Expiration date (optional) */
    expiryDate?: Date;
    /** Maximum number of uses (optional, unlimited if not set) */
    maxUses?: number;
    /** Plan restrictions (array of plan IDs, optional) */
    planRestrictions?: string[];
    /** Only for first-time purchases (default: false) */
    firstPurchaseOnly?: boolean;
    /** Minimum amount required to use code (in cents, optional) */
    minAmount?: number;
    /** Whether the code is active (default: true) */
    isActive?: boolean;
}

/**
 * Promo code update input
 */
export interface UpdatePromoCodeInput {
    /** Optional description */
    description?: string;
    /** Expiration date */
    expiryDate?: Date;
    /** Maximum number of uses */
    maxUses?: number;
    /** Whether the code is active */
    isActive?: boolean;
}

/**
 * Promo code filters for listing
 */
export interface ListPromoCodesFilters {
    /** Filter by active status */
    active?: boolean;
    /** Filter by expired status */
    expired?: boolean;
    /** Search by code */
    codeSearch?: string;
    /** Pagination page */
    page?: number;
    /** Pagination page size */
    pageSize?: number;
}

/**
 * Validation context for promo codes
 */
export interface PromoCodeValidationContext {
    /** Target plan ID */
    planId?: string;
    /** User ID to check first-purchase status */
    userId: string;
    /** Amount to validate against minimum */
    amount?: number;
}

/**
 * Validation result
 */
export interface PromoCodeValidationResult {
    /** Whether the code is valid */
    valid: boolean;
    /** Error code if invalid */
    errorCode?: string;
    /** Error message if invalid */
    errorMessage?: string;
    /** Discount amount preview (in cents) */
    discountAmount?: number;
}

/**
 * Promo code entity (matches expected QZPay structure)
 */
export interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    active: boolean;
    expiresAt?: string;
    maxUses?: number;
    timesRedeemed: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

/**
 * Promo Code Service
 *
 * Manages promo codes with database integration via Drizzle ORM.
 * Provides CRUD operations and validation logic.
 */
export class PromoCodeService {
    private billing: QZPayBilling | null;

    constructor() {
        this.billing = getQZPayBilling();
    }

    /**
     * Ensure billing is configured
     *
     * @throws Error if billing is not configured
     */
    private ensureBilling(): QZPayBilling {
        if (!this.billing) {
            throw new Error('Billing service not configured');
        }
        return this.billing;
    }

    /**
     * Map database promo code to PromoCode response format
     *
     * @param dbPromoCode - Database promo code record
     * @returns Mapped PromoCode
     */
    private mapDbToPromoCode(dbPromoCode: QZPayBillingPromoCode): PromoCode {
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
            createdAt: dbPromoCode.createdAt.toISOString(),
            updatedAt: dbPromoCode.createdAt.toISOString() // QZPay schema doesn't have updatedAt
        };
    }

    /**
     * Create a new promo code
     *
     * @param input - Promo code creation data
     * @returns Created promo code
     */
    async create(input: CreatePromoCodeInput) {
        try {
            const db = getDb();
            const code = input.code.toUpperCase();

            apiLogger.info({ code }, 'Creating promo code in database');

            // Build config object
            const config: Record<string, unknown> = {};
            if (input.description) {
                config.description = input.description;
            }
            if (input.minAmount) {
                config.minAmount = input.minAmount;
            }

            // Insert promo code
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

            return {
                success: true,
                data: this.mapDbToPromoCode(promoCode)
            };
        } catch (error) {
            apiLogger.error(
                'Failed to create promo code',
                error instanceof Error ? error.message : String(error)
            );

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to create promo code'
                }
            };
        }
    }

    /**
     * Get promo code by code string
     *
     * @param code - Promo code string
     * @returns Promo code or null
     *
     * @note Checks database first, falls back to DEFAULT_PROMO_CODES for backward compatibility
     */
    async getByCode(code: string) {
        try {
            const db = getDb();
            const normalizedCode = code.toUpperCase();

            apiLogger.debug({ code: normalizedCode }, 'Looking up promo code in database');

            // Try database first
            const [dbPromoCode] = await db
                .select()
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.code, normalizedCode))
                .limit(1);

            if (dbPromoCode) {
                apiLogger.info({ code: normalizedCode }, 'Promo code found in database');
                return {
                    success: true,
                    data: this.mapDbToPromoCode(dbPromoCode)
                };
            }

            // Fallback to DEFAULT_PROMO_CODES for backward compatibility
            apiLogger.debug({ code: normalizedCode }, 'Falling back to local config');

            const promoCodeDef = DEFAULT_PROMO_CODES.find((pc) => pc.code === normalizedCode);

            if (!promoCodeDef) {
                apiLogger.info({ code: normalizedCode }, 'Promo code not found');
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            // Convert PromoCodeDefinition to PromoCode response format
            const promoCode: PromoCode = {
                id: `local_${normalizedCode}`,
                code: promoCodeDef.code,
                type: 'percentage',
                value: promoCodeDef.discountPercent,
                active: promoCodeDef.isActive,
                expiresAt: promoCodeDef.expiresAt
                    ? promoCodeDef.expiresAt.toISOString()
                    : undefined,
                maxUses: promoCodeDef.maxRedemptions ?? undefined,
                timesRedeemed: 0, // Local config doesn't track usage
                metadata: {
                    description: promoCodeDef.description,
                    isPermanent: promoCodeDef.isPermanent,
                    durationCycles: promoCodeDef.durationCycles,
                    restrictedToPlans: promoCodeDef.restrictedToPlans,
                    newUserOnly: promoCodeDef.newUserOnly
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            apiLogger.info({ code: normalizedCode }, 'Promo code found in local config');

            return {
                success: true,
                data: promoCode
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
     * Get promo code by ID
     *
     * @param id - Promo code ID
     * @returns Promo code or null
     */
    async getById(id: string) {
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
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            apiLogger.info({ id }, 'Promo code found');

            return {
                success: true,
                data: this.mapDbToPromoCode(promoCode)
            };
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
     * Update promo code
     *
     * @param id - Promo code ID
     * @param input - Update data
     * @returns Updated promo code
     */
    async update(id: string, input: UpdatePromoCodeInput) {
        try {
            const db = getDb();

            apiLogger.info({ id }, 'Updating promo code');

            // Build update object
            const updateData: Partial<QZPayBillingPromoCode> = {};

            if (input.description !== undefined) {
                // Merge with existing config
                const [existing] = await db
                    .select()
                    .from(billingPromoCodes)
                    .where(eq(billingPromoCodes.id, id))
                    .limit(1);

                if (!existing) {
                    return {
                        success: false,
                        error: {
                            code: ServiceErrorCode.NOT_FOUND,
                            message: 'Promo code not found'
                        }
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
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            apiLogger.info({ id }, 'Promo code updated successfully');

            return {
                success: true,
                data: this.mapDbToPromoCode(updatedPromoCode)
            };
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
     * Soft delete promo code (sets active = false)
     *
     * @param id - Promo code ID
     * @returns Success status
     */
    async delete(id: string) {
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
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            apiLogger.info({ id }, 'Promo code deleted successfully');

            return {
                success: true,
                data: undefined
            };
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
     * List promo codes with filters
     *
     * @param filters - Filter and pagination options
     * @returns Paginated list of promo codes
     */
    async list(filters: ListPromoCodesFilters = {}) {
        try {
            const db = getDb();
            const { page = 1, pageSize = 20, active, expired, codeSearch } = filters;

            apiLogger.debug({ filters }, 'Listing promo codes');

            // Build where conditions
            const conditions = [];

            if (active !== undefined) {
                conditions.push(eq(billingPromoCodes.active, active));
            }

            if (expired !== undefined) {
                if (expired) {
                    // Show only expired codes
                    conditions.push(lte(billingPromoCodes.expiresAt, new Date()));
                } else {
                    // Show only non-expired codes (null or future date)
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

            // Get total count
            const countResult = await db
                .select({ value: count() })
                .from(billingPromoCodes)
                .where(whereClause);

            const total = countResult[0]?.value ?? 0;

            // Get paginated results
            const items = await db
                .select()
                .from(billingPromoCodes)
                .where(whereClause)
                .orderBy(desc(billingPromoCodes.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            const mappedItems = items.map((item) => this.mapDbToPromoCode(item));

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

    /**
     * Validate a promo code for specific context
     *
     * Checks:
     * - Code exists and is not deleted
     * - Not expired
     * - Usage count < max uses
     * - First purchase requirement (if applicable)
     * - Plan restrictions (if applicable)
     * - Minimum amount (if applicable)
     *
     * @param code - Promo code string
     * @param context - Validation context
     * @returns Validation result
     */
    async validate(
        code: string,
        context: PromoCodeValidationContext
    ): Promise<PromoCodeValidationResult> {
        try {
            const normalizedCode = code.toUpperCase();

            apiLogger.debug(
                { code: normalizedCode, planId: context.planId, userId: context.userId },
                'Validating promo code'
            );

            // Try to get from database first
            const dbResult = await this.getByCode(normalizedCode);

            let promoData: PromoCode | null = null;
            let isLocalConfig = false;

            if (dbResult.success && dbResult.data) {
                promoData = dbResult.data;
            } else {
                // Already checked DEFAULT_PROMO_CODES in getByCode
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_NOT_FOUND',
                    errorMessage: 'Promo code not found'
                };
            }

            // Check if from local config (ID starts with 'local_')
            isLocalConfig = promoData.id.startsWith('local_');

            // Check if code is active
            if (!promoData.active) {
                apiLogger.info({ code: normalizedCode }, 'Promo code is inactive');
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_INACTIVE',
                    errorMessage: 'This promo code is no longer active'
                };
            }

            // Check expiry date
            if (promoData.expiresAt && new Date() > new Date(promoData.expiresAt)) {
                apiLogger.info(
                    { code: normalizedCode, expiresAt: promoData.expiresAt },
                    'Promo code expired'
                );
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_EXPIRED',
                    errorMessage: 'This promo code has expired'
                };
            }

            // Check max uses (only for DB codes, not local config)
            if (
                !isLocalConfig &&
                promoData.maxUses &&
                promoData.timesRedeemed >= promoData.maxUses
            ) {
                apiLogger.info(
                    {
                        code: normalizedCode,
                        maxUses: promoData.maxUses,
                        timesRedeemed: promoData.timesRedeemed
                    },
                    'Promo code max uses exceeded'
                );
                return {
                    valid: false,
                    errorCode: 'PROMO_CODE_MAX_USES',
                    errorMessage: 'This promo code has reached its maximum number of uses'
                };
            }

            // Check plan restrictions
            if (promoData.metadata?.restrictedToPlans && context.planId) {
                const restrictedPlans = promoData.metadata.restrictedToPlans as string[];
                if (!restrictedPlans.includes(context.planId)) {
                    apiLogger.info(
                        {
                            code: normalizedCode,
                            planId: context.planId,
                            restrictedPlans
                        },
                        'Promo code not valid for this plan'
                    );
                    return {
                        valid: false,
                        errorCode: 'PROMO_CODE_PLAN_RESTRICTION',
                        errorMessage: 'This promo code is not valid for the selected plan'
                    };
                }
            }

            // Check new user requirement (log warning since we can't verify without customer history)
            if (promoData.metadata?.newUserOnly) {
                apiLogger.warn(
                    { code: normalizedCode, userId: context.userId },
                    'Cannot verify newUserOnly requirement without customer history - accepting code'
                );
            }

            // Check minimum amount
            if (context.amount !== undefined && promoData.metadata?.minAmount) {
                const minAmount = promoData.metadata.minAmount as number;
                if (context.amount < minAmount) {
                    apiLogger.info(
                        { code: normalizedCode, amount: context.amount, minAmount },
                        'Amount below minimum for promo code'
                    );
                    return {
                        valid: false,
                        errorCode: 'PROMO_CODE_MIN_AMOUNT',
                        errorMessage: `Minimum amount of ${minAmount} required to use this promo code`
                    };
                }
            }

            // Calculate discount preview if amount provided
            let discountAmount: number | undefined;
            if (context.amount !== undefined) {
                if (promoData.type === 'percentage') {
                    discountAmount = Math.round((context.amount * promoData.value) / 100);
                } else {
                    // Fixed amount discount
                    discountAmount = Math.min(promoData.value, context.amount);
                }
            }

            apiLogger.info(
                {
                    code: normalizedCode,
                    type: promoData.type,
                    value: promoData.value,
                    discountAmount
                },
                'Promo code is valid'
            );

            return {
                valid: true,
                discountAmount
            };
        } catch (error) {
            apiLogger.error(
                'Failed to validate promo code',
                error instanceof Error ? error.message : String(error)
            );

            return {
                valid: false,
                errorCode: 'PROMO_CODE_VALIDATION_ERROR',
                errorMessage: 'Failed to validate promo code'
            };
        }
    }

    /**
     * Apply promo code to a checkout session
     *
     * @param code - Promo code string
     * @param checkoutId - Checkout session ID
     * @returns Updated checkout session
     *
     * @note Currently validates code and returns acceptance confirmation
     * @note Actual checkout session modification depends on QZPay integration
     * @todo Implement with actual QZPay API: billing.checkout.applyPromoCode()
     */
    async apply(code: string, checkoutId: string) {
        this.ensureBilling();

        const normalizedCode = code.toUpperCase();

        apiLogger.info({ code: normalizedCode, checkoutId }, 'Applying promo code to checkout');

        try {
            // Get promo code (checks DB first, then DEFAULT_PROMO_CODES)
            const result = await this.getByCode(normalizedCode);

            if (!result.success || !result.data) {
                apiLogger.info({ code: normalizedCode }, 'Promo code not found');
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            const promoCode = result.data;

            // Check if active
            if (!promoCode.active) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'This promo code is no longer active'
                    }
                };
            }

            // Check expiry
            if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'This promo code has expired'
                    }
                };
            }

            apiLogger.info(
                {
                    code: normalizedCode,
                    checkoutId,
                    type: promoCode.type,
                    value: promoCode.value,
                    metadata: promoCode.metadata
                },
                'Promo code accepted - QZPay integration pending for checkout session update'
            );

            // Return success with promo code details
            // Actual checkout session update will happen when QZPay integration is complete
            return {
                success: true,
                data: {
                    code: promoCode.code,
                    type: promoCode.type,
                    value: promoCode.value,
                    metadata: promoCode.metadata,
                    message: 'Promo code accepted. Checkout session integration pending QZPay.'
                }
            };
        } catch (error) {
            apiLogger.error(
                'Failed to apply promo code',
                error instanceof Error ? error.message : String(error)
            );

            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: error instanceof Error ? error.message : 'Failed to apply promo code'
                }
            };
        }
    }

    /**
     * Increment usage count atomically
     *
     * @param id - Promo code ID
     * @returns Success status
     */
    async incrementUsage(id: string) {
        try {
            const db = getDb();

            apiLogger.info({ id }, 'Incrementing promo code usage');

            const [updated] = await db
                .update(billingPromoCodes)
                .set({
                    usedCount: sql`${billingPromoCodes.usedCount} + 1`
                })
                .where(eq(billingPromoCodes.id, id))
                .returning();

            if (!updated) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Promo code not found'
                    }
                };
            }

            apiLogger.info(
                { id, newCount: updated.usedCount },
                'Promo code usage incremented successfully'
            );

            return {
                success: true,
                data: undefined
            };
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
     * Record promo code usage
     *
     * @param data - Usage record data
     * @returns Created usage record
     */
    async recordUsage(data: {
        promoCodeId: string;
        customerId: string;
        subscriptionId?: string;
        discountAmount: number;
        currency: string;
    }) {
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

            return {
                success: true,
                data: usage
            };
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
}
