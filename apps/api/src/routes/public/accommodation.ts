/**
 * Accommodation Public API Routes
 * Handles unauthenticated endpoints for accommodations using optimized shared packages
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AccommodationRatingSchema } from '@repo/schemas';
import { AccommodationTypeEnum } from '@repo/types';
import {
    CommonResponses,
    createPaginatedSchema,
    createSuccessSchema
} from '../../schemas/common-responses';
import { responses } from '../../utils/response-helpers';
import { AccommodationSchemas } from '../../validation/accommodation-schemas';

const app = new OpenAPIHono();

/**
 * Public API accommodation schema - optimized using concepts from centralized schema
 * But adapted for public API with simpler typing to avoid branded types complexity
 */
const PublicAccommodationItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.nativeEnum(AccommodationTypeEnum),
    location: z
        .object({
            city: z.string(),
            country: z.string(),
            state: z.string()
        })
        .optional(),
    price: z
        .object({
            price: z.number(),
            currency: z.string()
        })
        .optional(),
    rating: AccommodationRatingSchema.optional(),
    isFeatured: z.boolean(),
    averageRating: z.number(),
    reviewsCount: z.number(),
    // API-specific computed fields
    distance: z.number().optional(),
    amenities: z.array(z.string()).optional()
});

// List response schema using optimized structure
const AccommodationListResponseSchema = createPaginatedSchema(PublicAccommodationItemSchema);

/**
 * Detail response schema - extends the list schema with additional safe fields
 * Uses simplified schemas to avoid complex type constraints from centralized packages
 */
const AccommodationDetailSchema = PublicAccommodationItemSchema.extend({
    description: z.string(),
    contactInfo: z
        .object({
            email: z.string().email().optional(),
            phone: z.string().optional(),
            website: z.string().url().optional()
        })
        .optional(),
    extraInfo: z
        .object({
            capacity: z.number().optional(),
            bedrooms: z.number().optional(),
            bathrooms: z.number().optional(),
            minNights: z.number().optional()
        })
        .optional(),
    media: z
        .object({
            featuredImage: z
                .object({
                    url: z.string().url(),
                    caption: z.string().optional()
                })
                .optional(),
            gallery: z
                .array(
                    z.object({
                        url: z.string().url(),
                        caption: z.string().optional()
                    })
                )
                .optional()
        })
        .optional(),
    // Simplified rooms for mock data
    rooms: z
        .array(
            z.object({
                type: z.string(),
                price: z.number(),
                available: z.boolean()
            })
        )
        .optional()
});

const AccommodationDetailResponseSchema = createSuccessSchema(AccommodationDetailSchema);

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
                    schema: AccommodationListResponseSchema
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

    // Mock response with optimized structure matching centralized schema
    let accommodations = [
        {
            id: '1',
            name: 'Hotel Paradise',
            summary: 'A beautiful beachfront hotel with stunning ocean views',
            type: AccommodationTypeEnum.HOTEL,
            location: {
                city: 'Cancún',
                country: 'Mexico',
                state: 'Quintana Roo'
            },
            price: {
                price: 150,
                currency: 'USD'
            },
            rating: {
                cleanliness: 4.5,
                hospitality: 4.7,
                services: 4.3,
                accuracy: 4.6,
                communication: 4.8,
                location: 4.9
            },
            isFeatured: true,
            reviewsCount: 127,
            averageRating: 4.6,
            amenities: ['WiFi', 'Pool', 'Beach Access', 'Restaurant']
        },
        {
            id: '2',
            name: 'Mountain Lodge',
            summary: 'Cozy cabin in the mountains with hiking trails',
            type: AccommodationTypeEnum.CABIN,
            location: {
                city: 'Aspen',
                country: 'USA',
                state: 'Colorado'
            },
            price: {
                price: 200,
                currency: 'USD'
            },
            rating: {
                cleanliness: 4.8,
                hospitality: 4.9,
                services: 4.7,
                accuracy: 4.8,
                communication: 4.9,
                location: 4.6
            },
            isFeatured: false,
            reviewsCount: 89,
            averageRating: 4.8,
            amenities: ['WiFi', 'Fireplace', 'Hiking', 'Spa']
        },
        {
            id: '3',
            name: 'City Apartment',
            summary: 'Modern apartment in downtown area',
            type: AccommodationTypeEnum.APARTMENT,
            location: {
                city: 'New York',
                country: 'USA',
                state: 'NY'
            },
            price: {
                price: 120,
                currency: 'USD'
            },
            rating: {
                cleanliness: 4.2,
                hospitality: 4.1,
                services: 4.0,
                accuracy: 4.3,
                communication: 4.2,
                location: 4.8
            },
            isFeatured: false,
            reviewsCount: 45,
            averageRating: 4.3,
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
            (acc) => acc.price.price >= (validatedQuery.minPrice ?? 0)
        );
    }

    if (validatedQuery.maxPrice) {
        accommodations = accommodations.filter(
            (acc) => acc.price.price <= (validatedQuery.maxPrice ?? Number.MAX_VALUE)
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
        items: paginatedAccommodations,
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
                    schema: AccommodationDetailResponseSchema
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

    // TODO: Implement actual service call
    // const accommodation = await accommodationService.getById(PUBLIC_USER_ACTOR, validatedParams.id, {
    //   language: validatedQuery.lang || 'en'
    // });

    // Mock response with optimized structure
    // Mock response with optimized structure matching centralized schema
    const mockAccommodation = {
        id: validatedParams.id || validatedParams.slug || '1', // Ensure we always have an ID
        name: 'Hotel Paradise',
        summary: 'A beautiful beachfront hotel with stunning ocean views',
        description:
            'Experience luxury and comfort at Hotel Paradise, where pristine beaches meet world-class hospitality. Our beachfront location offers breathtaking ocean views from every room.',
        type: AccommodationTypeEnum.HOTEL,
        location: {
            city: 'Cancún',
            country: 'Mexico',
            state: 'Quintana Roo'
        },
        price: {
            price: 150,
            currency: 'USD'
        },
        rating: {
            cleanliness: 4.5,
            hospitality: 4.7,
            services: 4.3,
            accuracy: 4.6,
            communication: 4.8,
            location: 4.9
        },
        isFeatured: true,
        reviewsCount: 127,
        averageRating: 4.6,
        amenities: ['WiFi', 'Pool', 'Beach Access', 'Restaurant', 'Spa'],
        media: {
            featuredImage: {
                url: 'https://example.com/image1.jpg',
                caption: 'Ocean view'
            },
            gallery: [
                { url: 'https://example.com/image2.jpg', caption: 'Pool area' },
                { url: 'https://example.com/image3.jpg', caption: 'Beach access' }
            ]
        },
        contactInfo: {
            email: 'info@hotelparadise.com',
            phone: '+52-998-123-4567',
            website: 'https://hotelparadise.com'
        },
        extraInfo: {
            capacity: 6,
            bedrooms: 3,
            bathrooms: 2,
            minNights: 2
        },
        rooms: [
            { type: 'Standard', price: 150, available: true },
            { type: 'Deluxe', price: 200, available: false }
        ]
    };

    return responses.success(c, mockAccommodation);
});

export { app as accommodationRoutes };
