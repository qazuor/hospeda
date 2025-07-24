/**
 * Public API routes
 * Handles unauthenticated endpoints for accommodations, destinations, events, etc.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

// Common schemas
const PaginationSchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc').optional()
});

const AccommodationListSchema = z.object({
    accommodations: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            location: z.string(),
            price: z.number(),
            rating: z.number(),
            amenities: z.array(z.string())
        })
    ),
    pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number()
    })
});

// Accommodations list route
const accommodationsListRoute = createRoute({
    method: 'get',
    path: '/accommodations',
    summary: 'List accommodations',
    description: 'Get a paginated list of accommodations',
    tags: ['Accommodations'],
    request: {
        query: PaginationSchema.extend({
            location: z.string().optional(),
            minPrice: z.coerce.number().optional(),
            maxPrice: z.coerce.number().optional(),
            amenities: z.string().optional() // comma-separated values
        })
    },
    responses: {
        200: {
            description: 'Accommodations retrieved successfully',
            content: {
                'application/json': {
                    schema: AccommodationListSchema
                }
            }
        }
    }
});

app.openapi(accommodationsListRoute, async (c) => {
    const { page = 1, limit = 20 } = c.req.valid('query');

    // TODO: Implement actual service call when service-core is ready
    // const result = await accommodationService.list(PUBLIC_USER_ACTOR, {
    //   page,
    //   limit,
    //   filters: { location, minPrice, maxPrice, amenities: amenities?.split(',') },
    //   sort: sort ? { [sort]: order } : undefined
    // });

    // Mock response for now
    const mockData = {
        accommodations: [
            {
                id: '1',
                name: 'Hotel Paradise',
                description: 'A beautiful beachfront hotel',
                location: 'Cancún, Mexico',
                price: 150,
                rating: 4.5,
                amenities: ['WiFi', 'Pool', 'Beach Access']
            }
        ],
        pagination: {
            page,
            limit,
            total: 1,
            totalPages: 1
        }
    };

    return c.json(mockData);
});

// Accommodation details route
const accommodationDetailsRoute = createRoute({
    method: 'get',
    path: '/accommodations/{id}',
    summary: 'Get accommodation details',
    description: 'Get detailed information about a specific accommodation',
    tags: ['Accommodations'],
    request: {
        params: z.object({
            id: z.string()
        })
    },
    responses: {
        200: {
            description: 'Accommodation details retrieved successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        id: z.string(),
                        name: z.string(),
                        description: z.string(),
                        location: z.string(),
                        price: z.number(),
                        rating: z.number(),
                        amenities: z.array(z.string()),
                        images: z.array(z.string()),
                        rooms: z.array(
                            z.object({
                                type: z.string(),
                                price: z.number(),
                                available: z.boolean()
                            })
                        )
                    })
                }
            }
        },
        404: {
            description: 'Accommodation not found',
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                        message: z.string()
                    })
                }
            }
        }
    }
});

app.openapi(accommodationDetailsRoute, async (c) => {
    const { id } = c.req.valid('param');

    // TODO: Implement actual service call
    // const accommodation = await accommodationService.getById(PUBLIC_USER_ACTOR, id);

    // Mock response - for demonstration only
    if (id === 'not-found') {
        return c.json(
            {
                error: 'NOT_FOUND',
                message: 'Accommodation not found'
            },
            404
        );
    }

    const mockAccommodation = {
        id,
        name: 'Hotel Paradise',
        description: 'A beautiful beachfront hotel with stunning ocean views',
        location: 'Cancún, Mexico',
        price: 150,
        rating: 4.5,
        amenities: ['WiFi', 'Pool', 'Beach Access', 'Restaurant', 'Spa'],
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        rooms: [
            { type: 'Standard', price: 150, available: true },
            { type: 'Deluxe', price: 200, available: false }
        ]
    };

    return c.json(mockAccommodation, 200);
});

// Destinations list route
const destinationsListRoute = createRoute({
    method: 'get',
    path: '/destinations',
    summary: 'List destinations',
    description: 'Get a list of available destinations',
    tags: ['Destinations'],
    request: {
        query: PaginationSchema.extend({
            country: z.string().optional(),
            featured: z.coerce.boolean().optional()
        })
    },
    responses: {
        200: {
            description: 'Destinations retrieved successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        destinations: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                country: z.string(),
                                description: z.string(),
                                image: z.string(),
                                featured: z.boolean()
                            })
                        ),
                        pagination: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            totalPages: z.number()
                        })
                    })
                }
            }
        }
    }
});

app.openapi(destinationsListRoute, async (c) => {
    const { page = 1, limit = 20 } = c.req.valid('query');

    // Mock response
    const mockData = {
        destinations: [
            {
                id: '1',
                name: 'Cancún',
                country: 'Mexico',
                description: 'Beautiful beaches and ancient Mayan ruins',
                image: 'https://example.com/cancun.jpg',
                featured: true
            }
        ],
        pagination: {
            page,
            limit,
            total: 1,
            totalPages: 1
        }
    };

    return c.json(mockData);
});

// Search route
const searchRoute = createRoute({
    method: 'get',
    path: '/search',
    summary: 'Search content',
    description: 'Search across accommodations, destinations, and events',
    tags: ['Search'],
    request: {
        query: z.object({
            query: z.string().min(1),
            type: z
                .enum(['all', 'accommodations', 'destinations', 'events'])
                .default('all')
                .optional(),
            page: z.coerce.number().min(1).default(1).optional(),
            limit: z.coerce.number().min(1).max(50).default(10).optional()
        })
    },
    responses: {
        200: {
            description: 'Search results',
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(
                            z.object({
                                id: z.string(),
                                type: z.enum(['accommodation', 'destination', 'event']),
                                title: z.string(),
                                description: z.string(),
                                image: z.string().optional(),
                                score: z.number()
                            })
                        ),
                        pagination: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            totalPages: z.number()
                        })
                    })
                }
            }
        },
        400: {
            description: 'Invalid search parameters',
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                        message: z.string()
                    })
                }
            }
        }
    }
});

app.openapi(searchRoute, async (c) => {
    const { query, type = 'all', page = 1, limit = 10 } = c.req.valid('query');

    // Mock search results
    const allResults = [
        {
            id: '1',
            type: 'accommodation' as const,
            title: 'Hotel Paradise',
            description: 'A beautiful beachfront hotel',
            image: 'https://example.com/hotel.jpg',
            score: 0.95
        },
        {
            id: '2',
            type: 'destination' as const,
            title: 'Cancún',
            description: 'Beautiful beaches and ancient Mayan ruins',
            image: 'https://example.com/cancun.jpg',
            score: 0.87
        },
        {
            id: '3',
            type: 'event' as const,
            title: 'Beach Festival',
            description: 'Annual music festival on the beach',
            image: 'https://example.com/festival.jpg',
            score: 0.75
        }
    ];

    // Filter by type if specified
    let results =
        type === 'all' ? allResults : allResults.filter((r) => r.type === type.replace(/s$/, ''));

    // Filter by search query (simple contains check)
    if (query) {
        results = results.filter(
            (r) =>
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                r.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Apply pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    return c.json(
        {
            results: paginatedResults,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        },
        200
    );
});

export { app as publicRoutes };
