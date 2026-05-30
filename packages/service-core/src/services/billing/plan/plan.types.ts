/**
 * Plan Service Types
 *
 * Internal types used by the plan CRUD and service modules.
 * Public-facing types are derived from `@repo/schemas`.
 *
 * @module services/billing/plan/plan.types
 */

import type { BillingPlanCategory, BillingPlanResponse } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new billing plan.
 * Aligned with `CreateBillingPlan` from `@repo/schemas`.
 */
export interface CreatePlanInput {
    /** Unique plan slug — stored as `billing_plans.name`. Immutable after creation. */
    readonly slug: string;
    /** Human-readable display name (stored in metadata.displayName) */
    readonly name: string;
    /** Plan description */
    readonly description: string;
    /** Target user category */
    readonly category: BillingPlanCategory;
    /** Monthly price in ARS cents (0 for free plans) */
    readonly monthlyPriceArs: number;
    /** Annual price in ARS cents (null when there is no annual option) */
    readonly annualPriceArs: number | null;
    /** USD reference price for display purposes */
    readonly monthlyPriceUsdRef: number;
    /** Whether the plan has a trial period */
    readonly hasTrial: boolean;
    /** Trial duration in days (0 when no trial) */
    readonly trialDays: number;
    /** Whether this is the default plan for its category */
    readonly isDefault: boolean;
    /** Display sort order */
    readonly sortOrder: number;
    /** Entitlement keys granted by the plan */
    readonly entitlements: readonly string[];
    /** Limit map (key → value, -1 = unlimited) */
    readonly limits: Record<string, number>;
    /** Whether the plan is available for purchase */
    readonly isActive: boolean;
}

/**
 * Input for updating an existing billing plan.
 * `slug` is intentionally absent — it is immutable after creation.
 * All fields are optional (partial update).
 */
export interface UpdatePlanInput {
    /** Human-readable display name */
    readonly name?: string;
    /** Plan description */
    readonly description?: string;
    /** Target user category */
    readonly category?: BillingPlanCategory;
    /** Monthly price in ARS cents */
    readonly monthlyPriceArs?: number;
    /** Annual price in ARS cents (null to remove annual option) */
    readonly annualPriceArs?: number | null;
    /** USD reference price */
    readonly monthlyPriceUsdRef?: number;
    /** Whether the plan has a trial */
    readonly hasTrial?: boolean;
    /** Trial duration in days */
    readonly trialDays?: number;
    /** Whether this is the default plan for its category */
    readonly isDefault?: boolean;
    /** Display sort order */
    readonly sortOrder?: number;
    /** Entitlement keys */
    readonly entitlements?: readonly string[];
    /** Limit map */
    readonly limits?: Record<string, number>;
    /** Whether the plan is active */
    readonly isActive?: boolean;
}

/**
 * Filters for listing billing plans.
 */
export interface ListPlansFilters {
    /** Filter by category */
    readonly category?: BillingPlanCategory;
    /** Filter by active status */
    readonly active?: boolean;
    /** Free-text search over slug/display name */
    readonly search?: string;
    /**
     * When true, soft-deleted plans (`deletedAt IS NOT NULL`) are included.
     * Defaults to excluding them. Admin-only.
     */
    readonly includeDeleted?: boolean;
    /** Pagination page (1-based, default: 1) */
    readonly page?: number;
    /** Page size (default: 20) */
    readonly pageSize?: number;
}

// ---------------------------------------------------------------------------
// Re-export response type for convenience
// ---------------------------------------------------------------------------

export type { BillingPlanResponse };
