/**
 * Sponsorship Fixtures
 *
 * Mock data for sponsorship entities used in admin integration tests.
 * Shapes derived from:
 * - Sponsorship in packages/schemas/src/entities/sponsorship/sponsorship.schema.ts
 * - SponsorshipsTab column definitions in apps/admin/src/routes/_authed/billing/components/SponsorshipsTab.tsx
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/** Single valid sponsorship */
export const mockSponsorship = {
    id: 'spons-uuid-001',
    slug: 'event-gold-sponsor',
    sponsorUserId: 'user-uuid-010',
    targetType: 'EVENT',
    targetId: 'event-uuid-001',
    levelId: 'level-uuid-001',
    packageId: null,
    status: 'active',
    startsAt: '2024-03-01T00:00:00.000Z',
    endsAt: '2024-06-01T00:00:00.000Z',
    paymentId: 'mp-payment-010',
    logoUrl: 'https://example.com/logos/sponsor1.png',
    linkUrl: 'https://sponsor1.example.com',
    couponCode: 'SPONSOR10',
    couponDiscountPercent: 10,
    analytics: {
        impressions: 1500,
        clicks: 120,
        couponsUsed: 8
    },
    createdAt: '2024-02-15T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z',
    deletedAt: null,
    createdById: 'user-uuid-admin',
    updatedById: 'user-uuid-admin',
    deletedById: null
} as const;

/** List of 3 sponsorships */
export const mockSponsorshipList = [
    mockSponsorship,
    {
        ...mockSponsorship,
        id: 'spons-uuid-002',
        slug: 'post-silver-sponsor',
        sponsorUserId: 'user-uuid-011',
        targetType: 'POST',
        targetId: 'post-uuid-001',
        levelId: 'level-uuid-002',
        status: 'pending',
        startsAt: '2024-04-01T00:00:00.000Z',
        endsAt: '2024-07-01T00:00:00.000Z',
        paymentId: null,
        logoUrl: null,
        linkUrl: 'https://sponsor2.example.com',
        couponCode: null,
        couponDiscountPercent: null,
        analytics: {
            impressions: 0,
            clicks: 0,
            couponsUsed: 0
        }
    },
    {
        ...mockSponsorship,
        id: 'spons-uuid-003',
        slug: 'event-expired-sponsor',
        sponsorUserId: 'user-uuid-012',
        targetType: 'EVENT',
        targetId: 'event-uuid-002',
        levelId: 'level-uuid-001',
        status: 'expired',
        startsAt: '2023-06-01T00:00:00.000Z',
        endsAt: '2023-12-01T00:00:00.000Z',
        paymentId: 'mp-payment-012',
        couponCode: 'OLDPROMO',
        couponDiscountPercent: 5,
        analytics: {
            impressions: 8500,
            clicks: 620,
            couponsUsed: 45
        }
    }
] as const;

/** Paginated response for sponsorships */
export const mockSponsorshipPage = mockPaginatedResponse([...mockSponsorshipList]);
