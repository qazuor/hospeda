/**
 * Public API routes
 * Handles unauthenticated endpoints for accommodations, destinations, events, etc.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AccommodationSchemas } from '../../validation/accommodation-schemas';

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
    description: 'Get a paginated list of accommodations with filtering options',
    tags: ['Accommodations'],
    request: {
        query: AccommodationSchemas.list
    },
    responses: {
        200: {
            description: 'Accommodations retrieved successfully',
            content: {
                'application/json': {
                    schema: AccommodationListSchema
                }
            }
        },
        400: {
            description: 'Invalid query parameters',
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                        message: z.string(),
                        details: z.array(
                            z.object({
                                field: z.string(),
                                message: z.string(),
                                code: z.string()
                            })
                        )
                    })
                }
            }
        }
    }
});

app.openapi(accommodationsListRoute, async (c) => {
    const validatedQuery = c.req.valid('query');

    // TODO: Implement actual service call when service-core is ready
    // const result = await accommodationService.list(PUBLIC_USER_ACTOR, {
    //   limit: validatedQuery.limit,
    //   offset: validatedQuery.offset,
    //   filters: {
    //     type: validatedQuery.type,
    //     destination: validatedQuery.destination,
    //     priceRange: validatedQuery.minPrice && validatedQuery.maxPrice ?
    //       { min: validatedQuery.minPrice, max: validatedQuery.maxPrice } : undefined,
    //     minRating: validatedQuery.minRating,
    //     amenities: validatedQuery.amenities,
    //     guests: validatedQuery.guests,
    //     rooms: validatedQuery.rooms,
    //     location: validatedQuery.lat && validatedQuery.lng ?
    //       { lat: validatedQuery.lat, lng: validatedQuery.lng, radius: validatedQuery.radius } : undefined,
    //     dateRange: validatedQuery.checkIn && validatedQuery.checkOut ?
    //       { checkIn: validatedQuery.checkIn, checkOut: validatedQuery.checkOut } : undefined,
    //     searchQuery: validatedQuery.q
    //   },
    //   sort: { field: validatedQuery.sort, order: validatedQuery.order },
    //   language: validatedQuery.lang
    // });

    // Mock response for now with more realistic data based on validated query
    const mockData = {
        accommodations: [
            {
                id: '1',
                name: 'Hotel Paradise',
                description: 'A beautiful beachfront hotel with stunning ocean views',
                location: 'Cancún, Mexico',
                price: 150,
                rating: 4.5,
                amenities: ['WiFi', 'Pool', 'Beach Access', 'Restaurant']
            },
            {
                id: '2',
                name: 'Mountain Lodge',
                description: 'Cozy cabin in the mountains with hiking trails',
                location: 'Aspen, Colorado',
                price: 200,
                rating: 4.8,
                amenities: ['WiFi', 'Fireplace', 'Hiking', 'Spa']
            }
        ],
        pagination: {
            page: Math.floor(validatedQuery.offset / validatedQuery.limit) + 1,
            limit: validatedQuery.limit,
            total: 2,
            totalPages: 1
        }
    };

    return c.json(mockData, 200);
});

// Accommodation details route
const accommodationDetailsRoute = createRoute({
    method: 'get',
    path: '/accommodations/{id}',
    summary: 'Get accommodation details',
    description: 'Get detailed information about a specific accommodation',
    tags: ['Accommodations'],
    request: {
        params: AccommodationSchemas.getById,
        query: z.object({
            lang: z
                .string()
                .regex(/^[a-z]{2}$/)
                .default('en')
                .optional()
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
        400: {
            description: 'Invalid accommodation ID',
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                        message: z.string(),
                        details: z.array(
                            z.object({
                                field: z.string(),
                                message: z.string(),
                                code: z.string()
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
    const validatedParams = c.req.valid('param');
    const _validatedQuery = c.req.valid('query');

    // TODO: Implement actual service call
    // const accommodation = await accommodationService.getById(PUBLIC_USER_ACTOR, validatedParams.id, {
    //   language: validatedQuery.lang || 'en'
    // });

    // Mock response - for demonstration only
    if (validatedParams.id === '00000000-0000-0000-0000-000000000000') {
        return c.json(
            {
                error: 'NOT_FOUND',
                message: 'Accommodation not found'
            },
            404
        );
    }

    const mockAccommodation = {
        id: validatedParams.id,
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
}); // Destinations list route
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
        query: AccommodationSchemas.search
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
                                type: z.enum(['accommodation', 'destination']),
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
                        message: z.string(),
                        details: z.array(
                            z.object({
                                field: z.string(),
                                message: z.string(),
                                code: z.string()
                            })
                        )
                    })
                }
            }
        }
    }
});

app.openapi(searchRoute, async (c) => {
    const validatedQuery = c.req.valid('query');

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
        }
    ];

    // Filter by type if specified
    let results =
        validatedQuery.type === 'all'
            ? allResults
            : allResults.filter((r) => r.type === validatedQuery.type);

    // Filter by search query (simple contains check)
    if (validatedQuery.q) {
        results = results.filter(
            (r) =>
                r.title.toLowerCase().includes(validatedQuery.q.toLowerCase()) ||
                r.description.toLowerCase().includes(validatedQuery.q.toLowerCase())
        );
    }

    // Apply pagination
    const total = results.length;
    const totalPages = Math.ceil(total / validatedQuery.limit);
    const startIndex = validatedQuery.offset;
    const paginatedResults = results.slice(startIndex, startIndex + validatedQuery.limit);

    return c.json(
        {
            results: paginatedResults,
            pagination: {
                page: Math.floor(validatedQuery.offset / validatedQuery.limit) + 1,
                limit: validatedQuery.limit,
                total,
                totalPages
            }
        },
        200
    );
});

export { app as publicRoutes };
