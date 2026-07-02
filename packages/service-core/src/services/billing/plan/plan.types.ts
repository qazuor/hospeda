/**
 * Plan Service Types
 *
 * Internal types used by the plan CRUD and service modules.
 * Public-facing types are derived from `@repo/schemas`.
 *
 * @module services/billing/plan/plan.types
 */

import { MODEL_C_FIELD_SPLIT, type ModelCField } from '@repo/billing';
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
 * Maps each `UpdatePlanInput` key to its corresponding {@link ModelCField}
 * classification key (HOS-39 T-027).
 *
 * `UpdatePlanInput`'s field names and `MODEL_C_FIELD_SPLIT`'s classification
 * keys are two independently maintained lists — the exact drift that caused
 * the HOS-39 live bug (T-024..T-026). This mapping is the single place that
 * ties them together so {@link findCapabilityFieldViolation} can guard every
 * field, present or future, without duplicating field names.
 *
 * `monthlyPriceUsdRef` is intentionally absent — it has no `MODEL_C_FIELD_SPLIT`
 * entry (a pre-existing gap, out of scope for this fix); unmapped fields are
 * not guarded.
 */
export const UPDATE_PLAN_INPUT_MODEL_C_KEYS: Partial<Record<keyof UpdatePlanInput, ModelCField>> = {
    name: 'displayName',
    description: 'description',
    monthlyPriceArs: 'monthlyPriceArs',
    annualPriceArs: 'annualPriceArs',
    hasTrial: 'metadata.hasTrial',
    trialDays: 'metadata.trialDays',
    sortOrder: 'metadata.sortOrder',
    entitlements: 'entitlements',
    limits: 'limitsValues',
    isActive: 'active'
};

/**
 * Guards `PlanService.update()` against writing a capability-layer field
 * (HOS-39 T-027). Capability fields are config-driven (`MODEL_C_FIELD_SPLIT`);
 * the seed sync overwrites them on every deploy, so allowing an update here
 * would silently repeat the HOS-39 live bug for any future field.
 *
 * Iterates the RUNTIME keys of `input` (not just the TS-typed ones) so it
 * also catches a caller bypassing `UpdatePlanInput` via an unsafe cast.
 *
 * @param input - The raw update input (may contain untyped keys)
 * @returns The first capability-classified field name found, or `null` if none
 */
export function findCapabilityFieldViolation(input: object): string | null {
    for (const key of Object.keys(input)) {
        const modelCKey = UPDATE_PLAN_INPUT_MODEL_C_KEYS[key as keyof UpdatePlanInput];
        if (modelCKey && MODEL_C_FIELD_SPLIT[modelCKey] === 'capability') {
            return key;
        }
    }
    return null;
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
