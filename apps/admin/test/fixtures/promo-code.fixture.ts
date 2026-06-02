/**
 * Promo Code Fixtures
 *
 * Mock data for promo code entities used in admin integration tests.
 * Shapes derived from PromoCode in apps/admin/src/features/promo-codes/types.ts
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Single valid promo code.
 *
 * Field names match the `PromoCode` interface introduced in commit 3af9c5601
 * ("fix(billing): consolidate promo-code contract and support full rich model").
 * Old names (discountValue, usedCount, validUntil, applicablePlans, isActive,
 * requiresFirstPurchase, minimumAmount) were replaced with the canonical
 * API-response shape.
 */
export const mockPromoCode = {
    id: 'promo-uuid-001',
    code: 'WELCOME20',
    description: 'Welcome discount for new users',
    type: 'percentage',
    value: 20,
    maxUses: 100,
    maxUsesPerUser: 1,
    timesRedeemed: 12,
    validFrom: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-12-31T23:59:59.000Z',
    validPlans: ['owner-plan-uuid', 'complex-plan-uuid'],
    isStackable: false,
    active: true,
    newCustomersOnly: true,
    minAmount: null,
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
} as const;

/** List of 3 promo codes */
export const mockPromoCodeList = [
    mockPromoCode,
    {
        ...mockPromoCode,
        id: 'promo-uuid-002',
        code: 'FLAT5000',
        description: 'Fixed discount on any plan',
        type: 'fixed',
        value: 500000,
        maxUses: 50,
        maxUsesPerUser: 1,
        timesRedeemed: 50,
        validFrom: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-06-30T23:59:59.000Z',
        validPlans: ['owner-plan-uuid', 'complex-plan-uuid', 'tourist-plan-uuid'],
        isStackable: false,
        active: false,
        newCustomersOnly: false,
        minAmount: 1000000,
        status: 'expired'
    },
    {
        ...mockPromoCode,
        id: 'promo-uuid-003',
        code: 'SUMMER15',
        description: 'Summer season discount',
        type: 'percentage',
        value: 15,
        maxUses: null,
        maxUsesPerUser: 2,
        timesRedeemed: 35,
        validFrom: '2024-12-01T00:00:00.000Z',
        expiresAt: null,
        validPlans: ['owner-plan-uuid'],
        isStackable: true,
        active: true,
        newCustomersOnly: false,
        minAmount: null,
        status: 'active'
    }
] as const;

/** Paginated response for promo codes */
export const mockPromoCodePage = mockPaginatedResponse([...mockPromoCodeList]);
