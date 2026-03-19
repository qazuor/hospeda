import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid event fixture for testing.
 * Fields derived from EventSchema in @repo/schemas.
 */
export const mockEvent = {
    id: 'event-test-001',
    slug: 'fiesta-de-la-playa-2026',
    name: 'Fiesta de la Playa 2026',
    summary: 'Annual beach festival with live music and food',
    description:
        'The annual beach festival returns with live music performances, regional food vendors, artisan crafts market, and activities for all ages along the river coast.',
    category: 'FESTIVAL',
    isFeatured: false,

    // Event dates
    date: {
        startDate: '2026-02-15',
        endDate: '2026-02-17'
    },

    // Author
    authorId: 'user-test-001',

    // Location references
    locationId: 'loc-test-001',
    organizerId: 'org-test-001',

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
    contactInfo: null,
    media: null,
    pricing: undefined,
    tags: []
} as const;

/** List of 3 events for table/list tests */
export const mockEventList = [
    mockEvent,
    {
        ...mockEvent,
        id: 'event-test-002',
        name: 'Noche de Tango',
        slug: 'noche-de-tango',
        category: 'MUSIC' as const,
        summary: 'Live tango performance at the cultural center',
        description:
            'An evening of live tango music and dance at the municipal cultural center. Featuring renowned local artists and open milonga for attendees.',
        date: {
            startDate: '2026-03-20',
            endDate: '2026-03-20'
        }
    },
    {
        ...mockEvent,
        id: 'event-test-003',
        name: 'Feria de Artesanos',
        slug: 'feria-de-artesanos',
        category: 'CULTURE' as const,
        isFeatured: true,
        summary: 'Regional artisan market with handmade crafts',
        description:
            'Monthly artisan market featuring handmade crafts, regional products, and traditional food from local producers across the Litoral region.',
        date: {
            startDate: '2026-04-05',
            endDate: '2026-04-06'
        }
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockEventPage = mockPaginatedResponse(mockEventList);
