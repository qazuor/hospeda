/**
 * Billing Add-on Fixtures
 *
 * Mock data for billing add-on entities used in admin integration tests.
 * Shapes derived from:
 * - AddonDefinition in packages/billing/src/types/addon.types.ts
 * - PurchasedAddon in apps/admin/src/features/billing-addons/types.ts
 */
import { mockPaginatedResponse, mockSuccessResponse } from '../mocks/handlers';

/** Single valid add-on definition */
export const mockBillingAddon = {
    id: 'addon-uuid-001',
    slug: 'extra-photos',
    name: 'Extra Photos Pack',
    description: 'Add 10 more photos per accommodation',
    billingType: 'one_time',
    priceArs: 200000,
    annualPriceArs: null,
    durationDays: 365,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 10,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 1,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z'
} as const;

/** List of 3 add-on definitions */
export const mockBillingAddonList = [
    mockBillingAddon,
    {
        ...mockBillingAddon,
        id: 'addon-uuid-002',
        slug: 'featured-boost',
        name: 'Featured Boost',
        description: 'Boost your listing to featured for 30 days',
        billingType: 'one_time',
        priceArs: 350000,
        durationDays: 30,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: 'featured_listing',
        sortOrder: 2
    },
    {
        ...mockBillingAddon,
        id: 'addon-uuid-003',
        slug: 'extra-properties',
        name: 'Extra Properties',
        description: 'Add 3 more property slots',
        billingType: 'recurring',
        priceArs: 500000,
        annualPriceArs: 5000000,
        durationDays: null,
        affectsLimitKey: 'max_accommodations',
        limitIncrease: 3,
        grantsEntitlement: null,
        targetCategories: ['complex'],
        sortOrder: 3
    }
] as const;

/** Non-paginated response (addons endpoint returns array directly) */
export const mockBillingAddonListResponse = mockSuccessResponse([...mockBillingAddonList]);

/** Single valid purchased add-on (CustomerAddon) */
export const mockPurchasedAddon = {
    id: 'purchase-uuid-001',
    customerId: 'customer-uuid-001',
    customerEmail: 'owner@example.com',
    customerName: 'Juan Perez',
    addonSlug: 'extra-photos',
    addonName: 'Extra Photos Pack',
    status: 'active',
    purchasedAt: '2024-03-01T10:00:00.000Z',
    expiresAt: '2025-03-01T10:00:00.000Z',
    paymentId: 'mp-payment-001',
    priceArs: 200000
} as const;

/** List of 3 purchased add-ons */
export const mockPurchasedAddonList = [
    mockPurchasedAddon,
    {
        ...mockPurchasedAddon,
        id: 'purchase-uuid-002',
        customerId: 'customer-uuid-002',
        customerEmail: 'maria@example.com',
        customerName: 'Maria Garcia',
        addonSlug: 'featured-boost',
        addonName: 'Featured Boost',
        status: 'expired',
        purchasedAt: '2024-01-15T08:00:00.000Z',
        expiresAt: '2024-02-14T08:00:00.000Z',
        paymentId: 'mp-payment-002',
        priceArs: 350000
    },
    {
        ...mockPurchasedAddon,
        id: 'purchase-uuid-003',
        customerEmail: 'carlos@example.com',
        customerName: 'Carlos Lopez',
        addonSlug: 'extra-properties',
        addonName: 'Extra Properties',
        status: 'canceled',
        purchasedAt: '2024-02-20T14:00:00.000Z',
        expiresAt: null,
        paymentId: 'mp-payment-003',
        priceArs: 500000
    }
] as const;

/** Paginated response for purchased add-ons */
export const mockPurchasedAddonPage = mockPaginatedResponse([...mockPurchasedAddonList]);
