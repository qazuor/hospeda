/**
 * Promo Code Fixtures
 *
 * Mock data for promo code entities used in admin integration tests.
 * Shapes derived from PromoCode in apps/admin/src/features/promo-codes/types.ts
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/** Single valid promo code */
export const mockPromoCode = {
    id: 'promo-uuid-001',
    code: 'WELCOME20',
    description: 'Welcome discount for new users',
    type: 'percentage',
    discountValue: 20,
    maxUses: 100,
    maxUsesPerUser: 1,
    usedCount: 12,
    validFrom: '2024-01-01T00:00:00.000Z',
    validUntil: '2024-12-31T23:59:59.000Z',
    applicablePlans: ['owner', 'complex'],
    isStackable: false,
    isActive: true,
    requiresFirstPurchase: true,
    minimumAmount: null,
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
        discountValue: 500000,
        maxUses: 50,
        maxUsesPerUser: 1,
        usedCount: 50,
        validFrom: '2024-01-01T00:00:00.000Z',
        validUntil: '2024-06-30T23:59:59.000Z',
        applicablePlans: ['owner', 'complex', 'tourist'],
        isStackable: false,
        isActive: false,
        requiresFirstPurchase: false,
        minimumAmount: 1000000,
        status: 'expired'
    },
    {
        ...mockPromoCode,
        id: 'promo-uuid-003',
        code: 'SUMMER15',
        description: 'Summer season discount',
        type: 'percentage',
        discountValue: 15,
        maxUses: null,
        maxUsesPerUser: 2,
        usedCount: 35,
        validFrom: '2024-12-01T00:00:00.000Z',
        validUntil: null,
        applicablePlans: ['owner'],
        isStackable: true,
        isActive: true,
        requiresFirstPurchase: false,
        minimumAmount: null,
        status: 'active'
    }
] as const;

/** Paginated response for promo codes */
export const mockPromoCodePage = mockPaginatedResponse([...mockPromoCodeList]);
