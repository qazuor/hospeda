/**
 * Promo Code Service
 *
 * Facade that delegates to specialized modules:
 * - `promo-code.crud`       - CRUD database operations
 * - `promo-code.redemption` - Atomic redemption and usage tracking
 * - `promo-code.validation` - Business-rule validation
 *
 * All types used by the modules are re-exported from here so that
 * consumers can import everything from a single entry point.
 *
 * @module services/billing/promo-code
 */

import type { QueryContext } from '@repo/db';
import {
    createPromoCode,
    deletePromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    listPromoCodes,
    updatePromoCode
} from './promo-code.crud.js';
import {
    applyPromoCode,
    incrementPromoCodeUsage,
    recordPromoCodeUsage,
    redeemAndRecordUsage,
    tryRedeemAtomically
} from './promo-code.redemption.js';
import type { RecordUsageInput, RedeemAndRecordInput } from './promo-code.redemption.js';
import { validatePromoCode } from './promo-code.validation.js';

// ---------------------------------------------------------------------------
// Types (re-exported so consumers and sub-modules can import from here)
// ---------------------------------------------------------------------------

/**
 * Discount type for promo codes.
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Promo code creation input.
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
 * Promo code update input.
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
 * Promo code filters for listing.
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
 * Validation context for promo codes.
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
 * Validation result.
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
 * Promo code entity (matches expected QZPay structure).
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
    /** Plan IDs this code is restricted to (from DB column, not metadata) */
    validPlans?: string[];
    /** Whether this code is only for new customers (from DB column, not metadata) */
    newCustomersOnly?: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Facade class
// ---------------------------------------------------------------------------

/**
 * Promo Code Service
 *
 * Thin facade over the promo-code sub-modules. Preserves the original class
 * interface so all existing callers continue to work without changes.
 */
export class PromoCodeService {
    /**
     * Create a new promo code.
     *
     * @param input - Promo code creation data
     * @param options - Optional settings
     * @param options.livemode - Whether to create in live mode (default: false)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Created promo code or error
     */
    async create(
        input: CreatePromoCodeInput,
        options: { readonly livemode?: boolean } = {},
        ctx?: QueryContext
    ) {
        return createPromoCode(input, options, ctx);
    }

    /**
     * Get promo code by its code string.
     *
     * @param code - Promo code string (case-insensitive)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Promo code or NOT_FOUND error
     */
    async getByCode(code: string, ctx?: QueryContext) {
        return getPromoCodeByCode(code, ctx);
    }

    /**
     * Get promo code by database ID.
     *
     * @param id - Promo code UUID
     * @param ctx - Optional query context carrying a transaction client
     * @returns Promo code or NOT_FOUND error
     */
    async getById(id: string, ctx?: QueryContext) {
        return getPromoCodeById(id, ctx);
    }

    /**
     * Update mutable fields of a promo code.
     *
     * @param id - Promo code UUID
     * @param input - Fields to update (optionally includes actorId for audit log)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Updated promo code or error
     */
    async update(
        id: string,
        input: UpdatePromoCodeInput & { readonly actorId?: string },
        ctx?: QueryContext
    ) {
        return updatePromoCode(id, input, ctx);
    }

    /**
     * Soft-delete a promo code (sets active = false).
     *
     * @param id - Promo code UUID
     * @param ctx - Optional query context carrying a transaction client
     * @param actorId - Optional actor performing the deletion (for audit log)
     * @returns Success or NOT_FOUND error
     */
    async delete(id: string, ctx?: QueryContext, actorId?: string) {
        return deletePromoCode(id, ctx, actorId);
    }

    /**
     * List promo codes with optional filters and pagination.
     *
     * @param filters - Filter and pagination options
     * @param ctx - Optional query context carrying a transaction client
     * @returns Paginated list of promo codes
     */
    async list(filters: ListPromoCodesFilters = {}, ctx?: QueryContext) {
        return listPromoCodes(filters, ctx);
    }

    /**
     * Validate a promo code for a specific checkout context.
     *
     * @param code - Promo code string
     * @param context - Validation context (planId, userId, amount)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Validation result with optional discount preview
     */
    async validate(
        code: string,
        context: PromoCodeValidationContext,
        ctx?: QueryContext
    ): Promise<PromoCodeValidationResult> {
        return validatePromoCode(code, context, ctx);
    }

    /**
     * Apply a promo code for a billing customer.
     *
     * Validates, atomically redeems, and records usage.
     *
     * @param code - Promo code string
     * @param customerId - Billing customer ID
     * @param amount - Optional original amount in cents
     * @param options - Optional settings
     * @param options.livemode - Whether in live mode (default: false)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Discount calculation result or error
     */
    async apply(
        code: string,
        customerId: string,
        amount?: number,
        options: { readonly livemode?: boolean } = {},
        ctx?: QueryContext
    ) {
        return applyPromoCode(code, customerId, amount, options, ctx);
    }

    /**
     * Increment usage count atomically.
     *
     * @param id - Promo code UUID
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error
     */
    async incrementUsage(id: string, ctx?: QueryContext) {
        return incrementPromoCodeUsage(id, ctx);
    }

    /**
     * Atomically try to redeem a promo code with row locking.
     *
     * @param promoCodeId - Promo code UUID to redeem
     * @returns Updated promo code row or error
     */
    async tryRedeemAtomically(promoCodeId: string) {
        return tryRedeemAtomically(promoCodeId);
    }

    /**
     * Record a promo code usage event in the audit table.
     *
     * @param data - Usage record data
     * @param ctx - Optional query context carrying a transaction client
     * @returns Created usage record or error
     */
    async recordUsage(data: RecordUsageInput, ctx?: QueryContext) {
        return recordPromoCodeUsage(data, ctx);
    }

    /**
     * Atomically increment usage count and record the usage event in a single
     * database transaction.
     *
     * This is the safe replacement for calling `incrementUsage` and `recordUsage`
     * separately. Uses `SELECT FOR UPDATE` to prevent concurrent over-redemption
     * and validates `maxUses` and `maxPerCustomer` limits inside the lock.
     *
     * @param input - Redeem-and-record parameters
     * @returns Updated promo code and created usage record, or error
     */
    async redeemAndRecord(input: RedeemAndRecordInput) {
        return redeemAndRecordUsage(input);
    }
}
