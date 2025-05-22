import { publicUser } from '@/types';
import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { AccommodationService } from '@repo/db';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the accommodations public router
const accommodationsRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    type: z.string().optional(),
    destinationId: z.string().uuid().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional()
});

// List public accommodations
accommodationsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Listing public accommodations');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            type: query.type,
            destinationId: query.destinationId,
            orderBy: query.orderBy,
            order: query.order,
            state: 'ACTIVE', // Only active accommodations
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            includeDeleted: false
        };

        // Create the service
        const accommodationService = new AccommodationService();

        // Fetch accommodations
        const accommodations = await accommodationService.list(filter, publicUser);

        // Get total count for pagination
        const total =
            accommodations.length > query.limit
                ? accommodations.length
                : Math.max(query.page * query.limit, accommodations.length);

        return paginatedResponse(c, accommodations, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error listing public accommodations');
        return errorResponse(c, {
            message: 'Error listing accommodations',
            status: 500
        });
    }
});

// Get a public accommodation by ID
accommodationsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');

        apiLogger.info({ location: 'PublicAPI', id }, 'Fetching public accommodation by ID');

        const accommodationService = new AccommodationService();
        const accommodation = await accommodationService.getById(id, publicUser);

        if (!accommodation || accommodation.state !== 'ACTIVE') {
            return notFoundResponse(c, 'Accommodation not found');
        }

        return successResponse(c, accommodation);
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching public accommodation');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Accommodation not found');
        }

        return errorResponse(c, {
            message: 'Error fetching accommodation',
            status: 500
        });
    }
});

// Get featured accommodations
accommodationsRoutes.get('/featured', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Fetching featured accommodations');

        // Create the service
        const accommodationService = new AccommodationService();

        // Fetch featured accommodations
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            state: 'ACTIVE',
            isFeatured: true,
            includeDeleted: false
        };

        const accommodations = await accommodationService.list(filter, publicUser);

        // Get total count for pagination
        const total =
            accommodations.length > query.limit
                ? accommodations.length
                : Math.max(query.page * query.limit, accommodations.length);

        return paginatedResponse(c, accommodations, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching featured accommodations');
        return errorResponse(c, {
            message: 'Error fetching featured accommodations',
            status: 500
        });
    }
});

// Search accommodations
accommodationsRoutes.get('/search', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Searching public accommodations');

        if (!query.query) {
            return errorResponse(c, {
                message: 'Search query is required',
                status: 400
            });
        }

        // Create the service
        const accommodationService = new AccommodationService();

        // Fetch search results
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit
        };

        const accommodations = await accommodationService.searchFullText(
            query.query,
            publicUser,
            filter
        );

        // Get total count for pagination
        const total =
            accommodations.length > query.limit
                ? accommodations.length
                : Math.max(query.page * query.limit, accommodations.length);

        return paginatedResponse(c, accommodations, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error searching accommodations');
        return errorResponse(c, {
            message: 'Error searching accommodations',
            status: 500
        });
    }
});

// Get accommodations by destination
accommodationsRoutes.get(
    '/destination/:id',
    zValidator('param', idParam),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');

            apiLogger.info(
                { location: 'PublicAPI', destinationId: id, query },
                'Listing public accommodations by destination'
            );

            const accommodationService = new AccommodationService();

            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit,
                state: 'ACTIVE'
            };

            const accommodations = await accommodationService.listByDestination(
                id,
                publicUser,
                filter
            );

            // Filter out non-active accommodations
            const activeAccommodations = accommodations.filter((acc) => acc.state === 'ACTIVE');

            const total =
                activeAccommodations.length > query.limit
                    ? activeAccommodations.length
                    : Math.max(query.page * query.limit, activeAccommodations.length);

            return paginatedResponse(c, activeAccommodations, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            apiLogger.error(
                error as Error,
                'PublicAPI - Error listing public accommodations by destination'
            );
            return errorResponse(c, {
                message: 'Error listing accommodations by destination',
                status: 500
            });
        }
    }
);

export { accommodationsRoutes };
