import { mockPaginatedResponse } from '../mocks/handlers';

/**
 * Minimal valid accommodation fixture for testing.
 * Fields derived from AccommodationSchema in @repo/schemas.
 */
export const mockAccommodation = {
    id: 'acc-test-001',
    slug: 'hotel-rio-test',
    name: 'Hotel Rio Test',
    summary: 'A comfortable hotel near the river for testing purposes',
    description:
        'A comfortable and modern hotel located near the river. Perfect for families and couples looking for a relaxing stay in Concepcion del Uruguay.',
    isFeatured: false,
    type: 'HOTEL',
    destinationId: 'dest-test-001',
    ownerId: 'user-test-001',

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

    // Optional fields set to null/undefined for minimal fixture
    adminInfo: null,
    seo: null,
    contactInfo: null,
    location: null,
    media: null,
    reviewsCount: 0,
    averageRating: 0,
    tags: [],
    iaData: [],
    faqs: [],
    price: undefined,
    rating: undefined,
    extraInfo: undefined
} as const;

/** List of 3 accommodations for table/list tests */
export const mockAccommodationList = [
    mockAccommodation,
    {
        ...mockAccommodation,
        id: 'acc-test-002',
        name: 'Hostel del Centro',
        slug: 'hostel-del-centro',
        type: 'HOSTEL' as const,
        summary: 'A budget-friendly hostel in the city center',
        description:
            'A budget-friendly hostel located in the heart of the city. Ideal for backpackers and solo travelers looking for affordable accommodation.'
    },
    {
        ...mockAccommodation,
        id: 'acc-test-003',
        name: 'Cabanas del Bosque',
        slug: 'cabanas-del-bosque',
        type: 'CABIN' as const,
        isFeatured: true,
        summary: 'Cozy cabins surrounded by native forest',
        description:
            'Beautiful wooden cabins surrounded by native forest. Each cabin features a private deck with views of the trees and a wood-burning stove.'
    }
];

/** Paginated response wrapper for list endpoint tests */
export const mockAccommodationPage = mockPaginatedResponse(mockAccommodationList);
