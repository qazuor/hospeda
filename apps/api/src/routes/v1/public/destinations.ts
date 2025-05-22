import { publicUser } from '@/types';
import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { DestinationService } from '@repo/db';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the destinations public router
const destinationsRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional()
});

// List public destinations
destinationsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Listing public destinations');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            orderBy: query.orderBy,
            order: query.order,
            visibility: 'PUBLIC', // Only public destinations
            state: 'ACTIVE', // Only active destinations
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            includeDeleted: false
        };

        // Create the service
        const destinationService = new DestinationService();

        // Fetch destinations
        const destinations = await destinationService.list(filter, publicUser);

        // Get total count for pagination
        const total =
            destinations.length > query.limit
                ? destinations.length
                : Math.max(query.page * query.limit, destinations.length);

        return paginatedResponse(c, destinations, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error listing public destinations');
        return errorResponse(c, {
            message: 'Error listing destinations',
            status: 500
        });
    }
});

// Get a public destination by ID
destinationsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');

        apiLogger.info({ location: 'PublicAPI', id }, 'Fetching public destination by ID');

        const destinationService = new DestinationService();
        const destination = await destinationService.getById(id, publicUser);

        if (!destination || destination.visibility !== 'PUBLIC' || destination.state !== 'ACTIVE') {
            return notFoundResponse(c, 'Destination not found');
        }

        return successResponse(c, destination);
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching public destination');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Destination not found');
        }

        return errorResponse(c, {
            message: 'Error fetching destination',
            status: 500
        });
    }
});

// Get featured destinations
destinationsRoutes.get('/featured', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Fetching featured destinations');

        // Create the service
        const destinationService = new DestinationService();

        // Fetch featured destinations
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            visibility: 'PUBLIC',
            state: 'ACTIVE',
            isFeatured: true,
            includeDeleted: false
        };

        const destinations = await destinationService.list(filter, publicUser);

        // Get total count for pagination
        const total =
            destinations.length > query.limit
                ? destinations.length
                : Math.max(query.page * query.limit, destinations.length);

        return paginatedResponse(c, destinations, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching featured destinations');
        return errorResponse(c, {
            message: 'Error fetching featured destinations',
            status: 500
        });
    }
});

// Get top destinations
destinationsRoutes.get(
    '/top',
    zValidator(
        'query',
        z.object({
            limit: z.coerce.number().positive().max(20).default(5)
        })
    ),
    async (c) => {
        try {
            const { limit } = c.req.valid('query');

            apiLogger.info({ location: 'PublicAPI', limit }, 'Fetching top destinations');

            const destinationService = new DestinationService();
            const topDestinations = await destinationService.listTop(limit, publicUser);

            return successResponse(c, topDestinations);
        } catch (error) {
            apiLogger.error(error as Error, 'PublicAPI - Error fetching top destinations');
            return errorResponse(c, {
                message: 'Error fetching top destinations',
                status: 500
            });
        }
    }
);

// Find destinations nearby
destinationsRoutes.get(
    '/nearby',
    zValidator(
        'query',
        z.object({
            lat: z.coerce.number().min(-90).max(90),
            lng: z.coerce.number().min(-180).max(180),
            radius: z.coerce.number().positive().max(200).default(50),
            limit: z.coerce.number().positive().max(50).default(10)
        })
    ),
    async (c) => {
        try {
            const { lat, lng, radius, limit } = c.req.valid('query');

            apiLogger.info(
                { location: 'PublicAPI', lat, lng, radius },
                'Finding nearby destinations'
            );

            const destinationService = new DestinationService();
            const nearbyDestinations = await destinationService.findNearby(
                lat,
                lng,
                radius,
                publicUser,
                { limit }
            );

            return successResponse(c, nearbyDestinations);
        } catch (error) {
            apiLogger.error(error as Error, 'PublicAPI - Error finding nearby destinations');
            return errorResponse(c, {
                message: 'Error finding nearby destinations',
                status: 500
            });
        }
    }
);

export { destinationsRoutes };
