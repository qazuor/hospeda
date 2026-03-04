/**
 * Promo Code Service
 *
 * Facade that delegates to specialized modules:
 * - `promo-code.crud`       – CRUD database operations
 * - `promo-code.redemption` – Atomic redemption and usage tracking
 * - `promo-code.validation` – Business-rule validation
 *
 * All types used by the modules are re-exported from here so that
 * consumers can import everything from a single entry point.
 *
 * @module services/promo-code
 */

import {
    createPromoCode,
    deletePromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    listPromoCodes,
    updatePromoCode
} from './promo-code.crud';
import {
    applyPromoCode,
    incrementPromoCodeUsage,
    recordPromoCodeUsage,
    tryRedeemAtomically
} from './promo-code.redemption';
import type { RecordUsageInput } from './promo-code.redemption';
import { validatePromoCode } from './promo-code.validation';

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
     * @returns Created promo code or error
     */
    async create(input: CreatePromoCodeInput) {
        return createPromoCode(input);
    }

    /**
     * Get promo code by its code string.
     *
     * @param code - Promo code string (case-insensitive)
     * @returns Promo code or NOT_FOUND error
     */
    async getByCode(code: string) {
        return getPromoCodeByCode(code);
    }

    /**
     * Get promo code by database ID.
     *
     * @param id - Promo code UUID
     * @returns Promo code or NOT_FOUND error
     */
    async getById(id: string) {
        return getPromoCodeById(id);
    }

    /**
     * Update mutable fields of a promo code.
     *
     * @param id - Promo code UUID
     * @param input - Fields to update
     * @returns Updated promo code or error
     */
    async update(id: string, input: UpdatePromoCodeInput) {
        return updatePromoCode(id, input);
    }

    /**
     * Soft-delete a promo code (sets active = false).
     *
     * @param id - Promo code UUID
     * @returns Success or NOT_FOUND error
     */
    async delete(id: string) {
        return deletePromoCode(id);
    }

    /**
     * List promo codes with optional filters and pagination.
     *
     * @param filters - Filter and pagination options
     * @returns Paginated list of promo codes
     */
    async list(filters: ListPromoCodesFilters = {}) {
        return listPromoCodes(filters);
    }

    /**
     * Validate a promo code for a specific checkout context.
     *
     * @param code - Promo code string
     * @param context - Validation context (planId, userId, amount)
     * @returns Validation result with optional discount preview
     */
    async validate(
        code: string,
        context: PromoCodeValidationContext
    ): Promise<PromoCodeValidationResult> {
        return validatePromoCode(code, context);
    }

    /**
     * Apply a promo code for a billing customer.
     *
     * Validates, atomically redeems, and records usage.
     *
     * @param code - Promo code string
     * @param customerId - Billing customer ID
     * @param amount - Optional original amount in cents
     * @returns Discount calculation result or error
     */
    async apply(code: string, customerId: string, amount?: number) {
        return applyPromoCode(code, customerId, amount);
    }

    /**
     * Increment usage count atomically.
     *
     * @param id - Promo code UUID
     * @returns Success or error
     */
    async incrementUsage(id: string) {
        return incrementPromoCodeUsage(id);
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
     * @returns Created usage record or error
     */
    async recordUsage(data: RecordUsageInput) {
        return recordPromoCodeUsage(data);
    }
}
