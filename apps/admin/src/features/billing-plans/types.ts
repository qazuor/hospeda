import type { EntitlementKey, LimitKey, PlanDefinition } from '@repo/billing';

/**
 * Parsed plan record shape used by DataTable cells and column definitions.
 *
 * Produced by `transformPlanRecord` in hooks.ts. Maps from the DB
 * BillingPlanResponse shape:
 * - `limits` is converted from `Record<string, number>` → `{ key, value }[]`
 * - All metadata fields are promoted to top level (no nested `metadata` object)
 * - Includes `id` (UUID) and ISO timestamps for audit/display
 *
 * This is the canonical row type for the plans DataTable.
 */
export interface ParsedPlanRecord {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly slug: string;
    readonly category: 'owner' | 'complex' | 'tourist';
    readonly isActive: boolean;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly monthlyPriceUsdRef: number;
    readonly entitlements: readonly string[];
    readonly limits: readonly { readonly key: string; readonly value: number }[];
    readonly createdAt: string;
    readonly updatedAt: string;
}

/**
 * Extended plan with database-specific fields.
 *
 * Used when the UI needs both the plan definition and the DB identity fields
 * (id, timestamps) together.
 */
export interface PlanWithMetadata extends PlanDefinition {
    readonly id: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/**
 * Plan filters for UI list/search
 */
export interface PlanFilters {
    readonly category?: 'owner' | 'complex' | 'tourist' | 'all';
    readonly isActive?: boolean;
    readonly page?: number;
    readonly limit?: number;
}

/**
 * Create plan payload — maps to CreateBillingPlanSchema.
 *
 * `slug` is WRITE-ONCE: present on create, absent on update (D1 / SPEC-168).
 * `limits` is sent as an array of { key, value } pairs from the dialog and
 * converted to a Record<string, number> before hitting the API (see hooks.ts).
 */
export interface CreatePlanPayload {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly category: 'owner' | 'complex' | 'tourist';
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly monthlyPriceUsdRef: number;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly entitlements: string[];
    readonly limits: ReadonlyArray<{ readonly key: string; readonly value: number }>;
    readonly isActive: boolean;
}

/**
 * Update plan payload — `slug` is intentionally excluded (D1: slug is immutable).
 *
 * All fields from CreatePlanPayload except `slug` are optional; `id` is the UUID
 * mutation identifier. Matches UpdateBillingPlanSchema contract.
 */
export interface UpdatePlanPayload extends Partial<Omit<CreatePlanPayload, 'slug'>> {
    readonly id: string;
}

export type { PlanDefinition, EntitlementKey, LimitKey };
