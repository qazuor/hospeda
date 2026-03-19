import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid destination fixture for testing.
 * Fields derived from DestinationSchema in @repo/schemas.
 */
export const mockDestination = {
    id: 'dest-test-001',
    slug: 'concepcion-del-uruguay',
    name: 'Concepcion del Uruguay',
    summary: 'Historic city on the banks of the Uruguay River',
    description:
        'Concepcion del Uruguay is a historic city located on the banks of the Uruguay River in the province of Entre Rios, Argentina.',
    isFeatured: true,

    // Hierarchy fields
    parentDestinationId: 'dest-parent-001',
    destinationType: 'CITY',
    level: 4,
    path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
    pathIds: 'dest-country-001/dest-region-001/dest-province-001/dest-test-001',

    // Lifecycle, moderation, visibility
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',

    // Audit fields
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: null,
    deletedById: null,

    // Optional / nullable fields
    adminInfo: null,
    seo: null,
    location: null,
    media: null,
    reviewsCount: 0,
    averageRating: 0,
    accommodationsCount: 12,
    tags: [],
    attractions: [],
    reviews: [],
    rating: undefined
} as const;

/** List of 3 destinations for table/list tests */
export const mockDestinationList = [
    mockDestination,
    {
        ...mockDestination,
        id: 'dest-test-002',
        name: 'Colon',
        slug: 'colon',
        path: '/argentina/litoral/entre-rios/colon',
        summary: 'Thermal city near the Uruguay River',
        description:
            'Colon is a popular thermal destination in Entre Rios province, known for its hot springs, beaches, and natural parks along the Uruguay River.',
        accommodationsCount: 25
    },
    {
        ...mockDestination,
        id: 'dest-test-003',
        name: 'Gualeguaychu',
        slug: 'gualeguaychu',
        path: '/argentina/litoral/entre-rios/gualeguaychu',
        summary: 'Famous for its carnival celebrations',
        description:
            'Gualeguaychu is widely known for hosting the largest carnival celebration in Argentina. The city also offers beautiful riverside walks and parks.',
        isFeatured: false,
        accommodationsCount: 18
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockDestinationPage = mockPaginatedResponse(mockDestinationList);
