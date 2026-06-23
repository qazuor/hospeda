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
import type { EffectPreview, PromoEffect } from '@repo/schemas';
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
 *
 * @deprecated Use `PromoEffect` from `@repo/schemas` for new code.
 * Kept for backward compatibility with legacy callers.
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Promo code creation input (SPEC-262 T-005 updated).
 *
 * Accepts the new typed `effect` discriminated union (SPEC-262) as the
 * primary mechanism. The legacy `discountType` / `discountValue` flat fields
 * are RETAINED for backward compatibility with startup/seed paths (e.g.
 * `ensureDefaultPromoCodes`). When `effect` is supplied it takes precedence
 * and the service persists the typed effect columns. When only
 * `discountType` / `discountValue` are supplied (legacy path), the service
 * maps them to a `discount` effect with `durationCycles = 1`.
 *
 * New callers (admin routes, T-008) MUST supply `effect`. Existing seed-only
 * callers that still pass `discountType` / `discountValue` continue to work
 * without changes.
 */
export interface CreatePromoCodeInput {
    /** The promo code string (will be uppercased) */
    code: string;

    /**
     * Typed promo effect (SPEC-262).
     *
     * When provided, takes precedence over `discountType` / `discountValue`.
     * Persisted to `effect_kind`, `value_kind`, `duration_cycles`, `extra_days`
     * via raw SQL after the INSERT (these columns are extras-carril additions
     * not in the QZPay Drizzle schema).
     */
    effect?: PromoEffect;

    /**
     * Legacy discount type field.
     * @deprecated Prefer `effect` for new code. Required when `effect` is absent.
     */
    discountType?: DiscountType;
    /**
     * Legacy discount value field.
     * @deprecated Prefer `effect` for new code. Required when `effect` is absent.
     */
    discountValue?: number;

    /** Optional description */
    description?: string;
    /** Expiration date (optional) */
    expiryDate?: Date;
    /** Maximum number of uses (optional, unlimited if not set) */
    maxUses?: number;
    /** Maximum number of uses per individual user (maps to max_uses_per_user) */
    maxUsesPerUser?: number;
    /** Date before which the code is not yet valid (maps to starts_at) */
    validFrom?: Date;
    /** Plan restrictions (array of plan IDs, optional) */
    planRestrictions?: string[];
    /** Only for first-time purchases (default: false) */
    firstPurchaseOnly?: boolean;
    /** Whether the code can be combined with other codes (maps to combinable) */
    isStackable?: boolean;
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
 *
 * SPEC-262 T-012: adds `effectPreview` so the validate endpoint can expose
 * the typed effect for the web checkout UI (preview before paying).
 * `discountAmount` is preserved unchanged for back-compat.
 */
export interface PromoCodeValidationResult {
    /** Whether the code is valid */
    valid: boolean;
    /** Error code if invalid */
    errorCode?: string;
    /** Error message if invalid */
    errorMessage?: string;
    /** Discount amount preview (in cents). Back-compat — existing callers rely on this. */
    discountAmount?: number;
    /**
     * Typed effect preview (SPEC-262 T-012).
     * Present only when `valid` is true. Allows the checkout UI to render
     * "50% off for 3 months", "Free forever", "Trial +N days" before payment.
     */
    effectPreview?: EffectPreview;
}

/**
 * Promo code entity (matches expected QZPay structure).
 *
 * ADDITIVE: the `effect` field is new (SPEC-262) and optional so that
 * existing callers that only read `type` / `value` continue to work
 * without changes (AC-4.3 backward-compat contract).
 */
export interface PromoCode {
    id: string;
    code: string;
    /**
     * Legacy type field — kept for backward compat (AC-4.3).
     * For existing `percentage`/`fixed` codes this matches the DB `type` column.
     * For new SPEC-262 codes `mapDbToPromoCode` maps `effect_kind` to this field.
     */
    type: 'percentage' | 'fixed' | 'discount' | 'trial_extension' | 'comp';
    /** Discount value in centavos (or percentage integer). 0 for non-discount kinds. */
    value: number;
    active: boolean;
    expiresAt?: string;
    /** ISO date before which the code is not yet valid (from starts_at) */
    validFrom?: string;
    maxUses?: number;
    /** Max redemptions per individual user (from max_uses_per_user) */
    maxUsesPerUser?: number;
    timesRedeemed: number;
    metadata?: Record<string, unknown>;
    /** Plan IDs this code is restricted to (from DB column, not metadata) */
    validPlans?: string[];
    /** Whether this code is only for new customers (from DB column, not metadata) */
    newCustomersOnly?: boolean;
    /** Whether the code can be combined with other codes (from combinable) */
    isStackable?: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    /**
     * Full typed effect — NEW field (SPEC-262, optional for backward compat).
     *
     * Present on codes created or migrated after SPEC-262. Absent on legacy
     * codes fetched before the backfill migration runs. Clients that only need
     * the one-shot discount amount can rely solely on `type` + `value`.
     */
    effect?: PromoEffect;
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
     * Branches by effect kind (SPEC-262 T-005):
     * - `discount` → computes finalAmount/discountAmount (AC-4.1 backward compat)
     * - `trial_extension` → returns extraDays from persisted DB effect (AC-3.2)
     * - `comp` → stamps subscription status='comp', returns 0 charge (AC-2.1)
     *
     * @param code - Promo code string
     * @param customerId - Billing customer ID
     * @param amount - Optional original amount in cents
     * @param options - Optional settings
     * @param options.livemode - Whether in live mode (default: false)
     * @param options.subscriptionId - Optional subscription ID for effect state tracking
     * @param options.subscriptionStatus - Optional current subscription status for state
     *   machine validation (AC-3.4). Pass the current subscription's status when applying
     *   to an existing subscription to enforce compatibility rules.
     * @param ctx - Optional query context carrying a transaction client
     * @returns Typed apply result or error
     */
    async apply(
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
