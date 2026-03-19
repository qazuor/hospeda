import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid post fixture for testing.
 * Fields derived from PostSchema in @repo/schemas.
 */
export const mockPost = {
    id: 'post-test-001',
    slug: 'mejores-playas-litoral',
    title: 'Las Mejores Playas del Litoral',
    summary: 'A guide to the best river beaches in the Litoral region',
    content:
        'Discover the most beautiful river beaches in the Litoral region of Argentina. From the sandy shores of Colon to the rocky beaches of Concordia, this guide covers everything you need to know for a perfect summer day by the river.',
    category: 'TOURISM',
    isFeatured: false,
    isFeaturedInWebsite: false,
    isNews: false,

    // Author
    authorId: 'user-test-001',

    // Social engagement
    likes: 42,
    comments: 5,
    shares: 8,

    // Display fields
    publishedAt: '2026-01-15T10:00:00.000Z',
    readingTimeMinutes: 7,
    expiresAt: undefined,

    // Lifecycle, moderation, visibility
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',

    // Audit fields
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    createdById: 'user-test-001',
    updatedById: 'user-test-001',
    deletedAt: null,
    deletedById: null,

    // Optional / nullable fields
    adminInfo: null,
    seo: null,
    media: null,
    tags: [],

    // Related entities
    relatedDestinationId: undefined,
    relatedAccommodationId: undefined,
    relatedEventId: undefined,
    sponsorshipId: undefined
} as const;

/** List of 3 posts for table/list tests */
export const mockPostList = [
    mockPost,
    {
        ...mockPost,
        id: 'post-test-002',
        title: 'Carnaval de Gualeguaychu 2026',
        slug: 'carnaval-gualeguaychu-2026',
        category: 'EVENTS' as const,
        summary: 'Everything about the biggest carnival in Argentina',
        content:
            'The Carnival of Gualeguaychu is the largest open-air carnival in Argentina. This comprehensive guide covers schedules, ticket prices, where to stay, and tips for making the most of your visit to this spectacular event.',
        isNews: true,
        likes: 128,
        comments: 23,
        shares: 45,
        readingTimeMinutes: 10
    },
    {
        ...mockPost,
        id: 'post-test-003',
        title: 'Guia de Termas en Entre Rios',
        slug: 'guia-termas-entre-rios',
        category: 'NATURE' as const,
        isFeatured: true,
        summary: 'Complete guide to hot springs in Entre Rios province',
        content:
            'Entre Rios province is famous for its thermal hot springs. From the mineral-rich waters of Federacion to the modern spa complexes of Villa Elisa, this guide explores the best thermal destinations in the province.',
        likes: 87,
        comments: 12,
        shares: 31,
        readingTimeMinutes: 12
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockPostPage = mockPaginatedResponse(mockPostList);
