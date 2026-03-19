import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid sponsor (PostSponsor) fixture for testing.
 * Fields derived from PostSponsorSchema in @repo/schemas.
 */
export const mockSponsor = {
    id: 'sponsor-test-001',
    name: 'Termas de Colon',
    type: 'POST_SPONSOR',
    description: 'Leading thermal resort and spa in the city of Colon',

    // Lifecycle
    lifecycleState: 'ACTIVE',

    // Audit fields
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: null,
    deletedById: null,

    // Optional / nullable fields
    adminInfo: null,
    logo: null,
    contactInfo: null,
    socialNetworks: null
} as const;

/** List of 3 sponsors for table/list tests */
export const mockSponsorList = [
    mockSponsor,
    {
        ...mockSponsor,
        id: 'sponsor-test-002',
        name: 'Bodega del Litoral',
        description: 'Premium winery offering tours and tastings in the region',
        type: 'ADVERTISER' as const
    },
    {
        ...mockSponsor,
        id: 'sponsor-test-003',
        name: 'Hotel Plaza Victoria',
        description: 'Traditional hotel in the heart of Concepcion del Uruguay',
        type: 'HOST' as const
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockSponsorPage = mockPaginatedResponse(mockSponsorList);
