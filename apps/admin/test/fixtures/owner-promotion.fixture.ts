/**
 * Owner Promotion Fixtures
 *
 * Mock data for owner promotion entities used in admin integration tests.
 * Shapes derived from OwnerPromotion in apps/admin/src/features/owner-promotions/types.ts
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/** Single valid owner promotion */
export const mockOwnerPromotion = {
    id: 'opromo-uuid-001',
    slug: 'summer-discount',
    ownerId: 'user-uuid-001',
    accommodationId: 'acc-uuid-001',
    title: 'Summer Discount',
    description: '20% off during summer season',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minNights: 3,
    validFrom: '2024-12-01T00:00:00.000Z',
    validUntil: '2025-03-31T23:59:59.000Z',
    maxRedemptions: 50,
    currentRedemptions: 8,
    isActive: true,
    createdAt: '2024-11-15T00:00:00.000Z',
    updatedAt: '2024-11-15T00:00:00.000Z'
} as const;

/** List of 3 owner promotions */
export const mockOwnerPromotionList = [
    mockOwnerPromotion,
    {
        ...mockOwnerPromotion,
        id: 'opromo-uuid-002',
        slug: 'long-stay-deal',
        ownerId: 'user-uuid-002',
        accommodationId: 'acc-uuid-002',
        title: 'Long Stay Deal',
        description: 'ARS 5,000 off for stays of 7+ nights',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500000,
        minNights: 7,
        validFrom: '2024-01-01T00:00:00.000Z',
        validUntil: '2024-12-31T23:59:59.000Z',
        maxRedemptions: null,
        currentRedemptions: 23,
        isActive: true
    },
    {
        ...mockOwnerPromotion,
        id: 'opromo-uuid-003',
        slug: 'free-night-promo',
        accommodationId: 'acc-uuid-003',
        title: 'Free Night Promo',
        description: 'Get a free night when you book 4+',
        discountType: 'FREE_NIGHT',
        discountValue: 1,
        minNights: 4,
        validFrom: '2024-06-01T00:00:00.000Z',
        validUntil: '2024-08-31T23:59:59.000Z',
        maxRedemptions: 20,
        currentRedemptions: 20,
        isActive: false
    }
] as const;

/** Paginated response for owner promotions */
export const mockOwnerPromotionPage = mockPaginatedResponse([...mockOwnerPromotionList]);
