import type { EntitlementKey, LimitKey, PlanDefinition } from '@repo/billing';

/**
 * Extended plan with database-specific fields
 */
export interface PlanWithMetadata extends PlanDefinition {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Plan filters for UI
 */
export interface PlanFilters {
    category?: 'owner' | 'complex' | 'tourist' | 'all';
    isActive?: boolean;
    page?: number;
    limit?: number;
}

/**
 * Create plan payload
 */
export interface CreatePlanPayload {
    slug: string;
    name: string;
    description: string;
    category: 'owner' | 'complex' | 'tourist';
    monthlyPriceArs: number;
    annualPriceArs: number | null;
    monthlyPriceUsdRef: number;
    hasTrial: boolean;
    trialDays: number;
    isDefault: boolean;
    sortOrder: number;
    entitlements: EntitlementKey[];
    limits: Array<{ key: LimitKey; value: number }>;
    isActive: boolean;
}

/**
 * Update plan payload
 */
export interface UpdatePlanPayload extends Partial<CreatePlanPayload> {
    id: string;
}

export type { PlanDefinition, EntitlementKey, LimitKey };
