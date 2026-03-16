import type { AddonDefinition } from '@repo/billing';

/**
 * Extended addon with database-specific fields
 */
export interface AddonWithMetadata extends AddonDefinition {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Addon filters for UI
 */
export interface AddonFilters {
    billingType?: 'one_time' | 'recurring' | 'all';
    isActive?: boolean;
    page?: number;
    limit?: number;
}

/**
 * Create addon payload
 */
export interface CreateAddonPayload {
    slug: string;
    name: string;
    description: string;
    billingType: 'one_time' | 'recurring';
    priceArs: number;
    durationDays: number | null;
    affectsLimitKey: string | null;
    limitIncrease: number | null;
    grantsEntitlement: string | null;
    targetCategories: ('owner' | 'complex')[];
    isActive: boolean;
    sortOrder: number;
}

/**
 * Update addon payload
 */
export interface UpdateAddonPayload extends Partial<CreateAddonPayload> {
    id: string;
}

export type { AddonDefinition };

/**
 * Purchased Add-on (CustomerAddon) types
 */

export interface PurchasedAddon {
    id: string;
    customerId: string;
    customerEmail: string;
    customerName: string | null;
    addonSlug: string;
    addonName: string;
    status: 'active' | 'expired' | 'canceled';
    purchasedAt: string;
    expiresAt: string | null;
    paymentId: string | null;
    priceArs: number;
}

export interface PurchasedAddonFilters {
    status?: 'all' | 'active' | 'expired' | 'canceled';
    addonSlug?: string;
    customerEmail?: string;
    page?: number;
    limit?: number;
}

export interface PurchasedAddonsResponse {
    items: PurchasedAddon[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
