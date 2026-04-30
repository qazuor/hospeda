/**
 * MSW Request Handlers for Admin App Tests
 *
 * These handlers mock the API responses for testing purposes.
 * Add handlers for each API endpoint that your tests need.
 */

import { http, HttpResponse } from 'msw';

// Base API URL
const API_BASE = '/api/v1';

/**
 * Mock data factories
 */
const mockPaginatedResponse = <T>(items: T[], page = 1, pageSize = 20) => ({
    success: true,
    data: {
        items,
        pagination: {
            page,
            pageSize,
            total: items.length,
            totalPages: Math.ceil(items.length / pageSize),
            hasNextPage: page * pageSize < items.length,
            hasPreviousPage: page > 1
        }
    },
    metadata: {
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
    }
});

const mockSuccessResponse = <T>(data: T) => ({
    success: true,
    data,
    metadata: {
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
    }
});

const mockErrorResponse = (code: string, message: string) => ({
    success: false,
    error: {
        code,
        message,
        details: null
    },
    metadata: {
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id'
    }
});

/**
 * Sample mock data
 */
const mockAccommodation = {
    id: 'acc-1',
    name: 'Test Hotel',
    slug: 'test-hotel',
    type: 'hotel',
    description: 'A test hotel for testing',
    isFeatured: false,
    destinationId: 'dest-1',
    ownerId: 'user-1',
    lifecycleState: 'active',
    moderationState: 'approved',
    visibility: 'public',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockDestination = {
    id: 'dest-1',
    name: 'Test City',
    slug: 'test-city',
    description: 'A test destination',
    isFeatured: true,
    lifecycleState: 'active',
    moderationState: 'approved',
    visibility: 'public',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockEvent = {
    id: 'event-1',
    name: 'Test Event',
    slug: 'test-event',
    summary: 'A test event',
    category: 'festival',
    date: {
        startDate: '2024-06-01',
        endDate: '2024-06-02'
    },
    organizerId: 'org-1',
    organizerName: 'Test Organizer',
    locationId: 'loc-1',
    locationName: 'Test Venue',
    isFeatured: false,
    lifecycleState: 'active',
    moderationState: 'approved',
    visibility: 'public',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    slug: 'test-post',
    excerpt: 'A test post excerpt',
    authorId: 'user-1',
    authorName: 'Test Author',
    publishStatus: 'published',
    isFeatured: false,
    lifecycleState: 'active',
    moderationState: 'approved',
    visibility: 'public',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockUser = {
    id: 'user-1',
    authProviderId: 'auth_user_1',
    displayName: 'Test User',
    primaryEmail: 'test@example.com',
    role: 'user',
    isActive: true,
    accommodationsCount: 2,
    eventsCount: 0,
    postsCount: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

/**
 * API Handlers
 */
export const handlers = [
    // Accommodations
    http.get(`${API_BASE}/public/accommodations`, () => {
        return HttpResponse.json(mockPaginatedResponse([mockAccommodation]));
    }),

    http.get(`${API_BASE}/public/accommodations/:id`, ({ params }) => {
        if (params.id === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Accommodation not found'), {
                status: 404
            });
        }
        return HttpResponse.json(mockSuccessResponse(mockAccommodation));
    }),

    // Destinations
    http.get(`${API_BASE}/public/destinations`, () => {
        return HttpResponse.json(mockPaginatedResponse([mockDestination]));
    }),

    http.get(`${API_BASE}/public/destinations/:idOrSlug`, ({ params }) => {
        if (params.idOrSlug === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Destination not found'), {
                status: 404
            });
        }
        return HttpResponse.json(mockSuccessResponse(mockDestination));
    }),

    // Events
    http.get(`${API_BASE}/public/events`, () => {
        return HttpResponse.json(mockPaginatedResponse([mockEvent]));
    }),

    http.get(`${API_BASE}/public/events/:idOrSlug`, ({ params }) => {
        if (params.idOrSlug === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Event not found'), {
                status: 404
            });
        }
        return HttpResponse.json(mockSuccessResponse(mockEvent));
    }),

    // Posts
    http.get(`${API_BASE}/public/posts`, () => {
        return HttpResponse.json(mockPaginatedResponse([mockPost]));
    }),

    http.get(`${API_BASE}/public/posts/:idOrSlug`, ({ params }) => {
        if (params.idOrSlug === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Post not found'), {
                status: 404
            });
        }
        return HttpResponse.json(mockSuccessResponse(mockPost));
    }),

    // Users
    http.get(`${API_BASE}/public/users`, () => {
        return HttpResponse.json(mockPaginatedResponse([mockUser]));
    }),

    http.get(`${API_BASE}/public/users/:id`, ({ params }) => {
        if (params.id === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'User not found'), {
                status: 404
            });
        }
        return HttpResponse.json(mockSuccessResponse(mockUser));
    }),

    // Amenities
    http.get(`${API_BASE}/public/amenities`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'amenity-1',
                    name: 'WiFi',
                    slug: 'wifi',
                    description: 'High-speed internet',
                    icon: 'wifi',
                    isBuiltin: true,
                    isFeatured: true,
                    lifecycleState: 'active',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    }),

    // Features
    http.get(`${API_BASE}/public/features`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'feature-1',
                    name: 'Pool',
                    slug: 'pool',
                    description: 'Swimming pool',
                    icon: 'pool',
                    isBuiltin: true,
                    isFeatured: true,
                    lifecycleState: 'active',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    }),

    // Attractions
    http.get(`${API_BASE}/public/attractions`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'attr-1',
                    name: 'Beach',
                    slug: 'beach',
                    description: 'Beautiful beach',
                    icon: 'beach',
                    isBuiltin: true,
                    isFeatured: true,
                    destinationId: 'dest-1',
                    lifecycleState: 'active',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    }),

    // Event Locations
    http.get(`${API_BASE}/public/event-locations`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'loc-1',
                    placeName: 'Test Venue',
                    street: '123 Test St',
                    city: 'Test City',
                    state: 'Test State',
                    country: 'Argentina',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    }),

    // Event Organizers
    http.get(`${API_BASE}/public/event-organizers`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'org-1',
                    name: 'Test Organizer',
                    description: 'Event organizer for testing',
                    lifecycleState: 'active',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    }),

    // PostTags (admin)
    http.get(`${API_BASE}/admin/posts/tags`, () => {
        return HttpResponse.json(mockPaginatedResponse([]));
    }),

    http.get(`${API_BASE}/admin/posts/tags/:id`, ({ params }) => {
        if (params.id === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'PostTag not found'), {
                status: 404
            });
        }
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Test PostTag',
                slug: 'test-post-tag',
                color: 'BLUE',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.get(`${API_BASE}/admin/posts/tags/:id/impact`, () => {
        return HttpResponse.json(mockSuccessResponse({ count: 0 }));
    }),

    http.post(`${API_BASE}/admin/posts/tags`, () => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: 'new-post-tag-id',
                name: 'New PostTag',
                slug: 'new-post-tag',
                color: 'GREEN',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            }),
            { status: 201 }
        );
    }),

    http.patch(`${API_BASE}/admin/posts/tags/:id`, ({ params }) => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Updated PostTag',
                slug: 'updated-post-tag',
                color: 'ORANGE',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.delete(`${API_BASE}/admin/posts/tags/:id`, () => {
        return HttpResponse.json({ success: true });
    }),

    // System tags (admin)
    http.get(`${API_BASE}/admin/tags/system`, () => {
        return HttpResponse.json(mockPaginatedResponse([]));
    }),

    http.get(`${API_BASE}/admin/tags/system/:id`, ({ params }) => {
        if (params.id === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Tag not found'), {
                status: 404
            });
        }
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Test System Tag',
                type: 'SYSTEM',
                color: 'BLUE',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.get(`${API_BASE}/admin/tags/system/:id/impact`, () => {
        return HttpResponse.json(mockSuccessResponse({ count: 0 }));
    }),

    http.post(`${API_BASE}/admin/tags/system`, () => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: 'new-system-tag-id',
                name: 'New System Tag',
                type: 'SYSTEM',
                color: 'GREEN',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            }),
            { status: 201 }
        );
    }),

    http.patch(`${API_BASE}/admin/tags/system/:id`, ({ params }) => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Updated System Tag',
                type: 'SYSTEM',
                color: 'ORANGE',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.delete(`${API_BASE}/admin/tags/system/:id`, () => {
        return HttpResponse.json({ success: true });
    }),

    // Internal tags (admin)
    http.get(`${API_BASE}/admin/tags/internal`, () => {
        return HttpResponse.json(mockPaginatedResponse([]));
    }),

    http.get(`${API_BASE}/admin/tags/internal/:id`, ({ params }) => {
        if (params.id === 'not-found') {
            return HttpResponse.json(mockErrorResponse('NOT_FOUND', 'Tag not found'), {
                status: 404
            });
        }
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Test Internal Tag',
                type: 'INTERNAL',
                color: 'PURPLE',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.get(`${API_BASE}/admin/tags/internal/:id/impact`, () => {
        return HttpResponse.json(mockSuccessResponse({ count: 0 }));
    }),

    http.post(`${API_BASE}/admin/tags/internal`, () => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: 'new-internal-tag-id',
                name: 'New Internal Tag',
                type: 'INTERNAL',
                color: 'GREY',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            }),
            { status: 201 }
        );
    }),

    http.patch(`${API_BASE}/admin/tags/internal/:id`, ({ params }) => {
        return HttpResponse.json(
            mockSuccessResponse({
                id: params.id,
                name: 'Updated Internal Tag',
                type: 'INTERNAL',
                color: 'CYAN',
                icon: null,
                description: null,
                lifecycleState: 'ACTIVE',
                ownerId: null,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
                createdById: null,
                updatedById: null
            })
        );
    }),

    http.delete(`${API_BASE}/admin/tags/internal/:id`, () => {
        return HttpResponse.json({ success: true });
    }),

    // User tags moderation (admin)
    http.get(`${API_BASE}/admin/tags/user`, () => {
        return HttpResponse.json(mockPaginatedResponse([]));
    }),

    http.delete(`${API_BASE}/admin/tags/user/:id`, () => {
        return HttpResponse.json({ success: true });
    }),

    // Entity attribution (admin)
    http.get(`${API_BASE}/admin/entities/:type/:id/tags`, () => {
        return HttpResponse.json(mockSuccessResponse({ assignments: [] }));
    }),

    // Sponsors
    http.get(`${API_BASE}/public/sponsors`, () => {
        return HttpResponse.json(
            mockPaginatedResponse([
                {
                    id: 'sponsor-1',
                    name: 'Test Sponsor',
                    description: 'A test sponsor',
                    type: 'business',
                    lifecycleState: 'active',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z'
                }
            ])
        );
    })
];

/**
 * Export mock data for use in tests
 */
export const mockData = {
    accommodation: mockAccommodation,
    destination: mockDestination,
    event: mockEvent,
    post: mockPost,
    user: mockUser
};

/**
 * Export response factories for custom test scenarios
 */
export { API_BASE, mockPaginatedResponse, mockSuccessResponse, mockErrorResponse };
