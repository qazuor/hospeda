/**
 * Accommodation Public API Routes
 * Handles unauthenticated endpoints for accommodations using shared packages
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { CommonResponses } from '../../schemas/common-responses';
import { responses } from '../../utils/response-helpers';
import { AccommodationSchemas } from '../../validation/accommodation-schemas';

const app = new OpenAPIHono();

// Response schemas
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

const AccommodationDetailSchema = z.object({
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
});

// List accommodations route
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
        400: CommonResponses.ValidationError
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
    let accommodations = [
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
        },
        {
            id: '3',
            name: 'City Apartment',
            description: 'Modern apartment in downtown area',
            location: 'New York, USA',
            price: 120,
            rating: 4.2,
            amenities: ['WiFi', 'Kitchen', 'Gym', 'Parking']
        }
    ];

    // Apply filters based on validated query
    if (validatedQuery.type) {
        accommodations = accommodations.filter((acc) =>
            acc.name.toLowerCase().includes(validatedQuery.type?.toLowerCase() ?? '')
        );
    }

    if (validatedQuery.minPrice) {
        accommodations = accommodations.filter(
            (acc) => acc.price >= (validatedQuery.minPrice ?? 0)
        );
    }

    if (validatedQuery.maxPrice) {
        accommodations = accommodations.filter(
            (acc) => acc.price <= (validatedQuery.maxPrice ?? Number.MAX_VALUE)
        );
    }

    // Apply pagination
    const total = accommodations.length;
    const totalPages = Math.ceil(total / validatedQuery.limit);
    const startIndex = validatedQuery.offset;
    const paginatedAccommodations = accommodations.slice(
        startIndex,
        startIndex + validatedQuery.limit
    );

    const responseData = {
        accommodations: paginatedAccommodations,
        pagination: {
            page: Math.floor(validatedQuery.offset / validatedQuery.limit) + 1,
            limit: validatedQuery.limit,
            total,
            totalPages
        }
    };

    return responses.success(c, responseData);
});

// Get accommodation details route
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
                    schema: AccommodationDetailSchema
                }
            }
        },
        400: CommonResponses.ValidationError,
        404: CommonResponses.NotFound
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
        return responses.notFound(c, 'Accommodation not found');
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

    return responses.success(c, mockAccommodation);
});

export { app as accommodationRoutes };
