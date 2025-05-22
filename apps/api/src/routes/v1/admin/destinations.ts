import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { DestinationService } from '@repo/db';
import { DestinationCreateSchema, DestinationUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the destinations router
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
    visibility: z.string().optional(),
    state: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all destinations
destinationsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI', query }, 'Listing destinations');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            visibility: query.visibility,
            state: query.state,
            orderBy: query.orderBy,
            order: query.order,
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const destinationService = new DestinationService();

        // Fetch destinations
        const destinations = await destinationService.list(filter, user);

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
        apiLogger.error(error as Error, 'DestinationsAPI - Error listing destinations');
        return errorResponse(c, {
            message: 'Error listing destinations',
            status: 500
        });
    }
});

// Get destination by ID
destinationsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI', id }, 'Fetching destination by ID');

        const destinationService = new DestinationService();
        const destination = await destinationService.getById(id, user);

        if (!destination) {
            return notFoundResponse(c, 'Destination not found');
        }

        return successResponse(c, destination);
    } catch (error) {
        apiLogger.error(error as Error, 'DestinationsAPI - Error fetching destination');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Destination not found');
        }

        return errorResponse(c, {
            message: 'Error fetching destination',
            status: 500
        });
    }
});

// Create a new destination
destinationsRoutes.post('/', zValidator('json', DestinationCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI' }, 'Creating new destination');

        const destinationService = new DestinationService();
        const newDestination = await destinationService.create(data, user);

        return successResponse(c, newDestination, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'DestinationsAPI - Error creating destination');
        return errorResponse(c, {
            message: 'Error creating destination',
            status: 500
        });
    }
});

// Update a destination
destinationsRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', DestinationUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'DestinationsAPI', id }, 'Updating destination');

            const destinationService = new DestinationService();
            const updatedDestination = await destinationService.update(id, data, user);

            return successResponse(c, updatedDestination);
        } catch (error) {
            apiLogger.error(error as Error, 'DestinationsAPI - Error updating destination');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Destination not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this destination',
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error updating destination',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a destination
destinationsRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI', id }, 'Soft-deleting destination');

        const destinationService = new DestinationService();
        await destinationService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'DestinationsAPI - Error deleting destination');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Destination not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this destination',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error deleting destination',
            status: 500
        });
    }
});

// Restore a soft-deleted destination
destinationsRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI', id }, 'Restoring destination');

        const destinationService = new DestinationService();
        await destinationService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'DestinationsAPI - Error restoring destination');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Destination not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to restore this destination',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error restoring destination',
            status: 500
        });
    }
});

// Get destination statistics
destinationsRoutes.get('/:id/stats', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'DestinationsAPI', id }, 'Fetching destination stats');

        const destinationService = new DestinationService();
        const stats = await destinationService.getStats(id, user);

        return successResponse(c, stats);
    } catch (error) {
        apiLogger.error(error as Error, 'DestinationsAPI - Error fetching destination stats');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Destination not found');
        }

        return errorResponse(c, {
            message: 'Error fetching destination statistics',
            status: 500
        });
    }
});

// Update visibility of a destination
destinationsRoutes.patch(
    '/:id/visibility',
    zValidator('param', idParam),
    zValidator(
        'json',
        z.object({
            visibility: z.enum(['PUBLIC', 'DRAFT', 'PRIVATE'])
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const { visibility } = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info(
                { location: 'DestinationsAPI', id, visibility },
                'Updating destination visibility'
            );

            const destinationService = new DestinationService();
            const updatedDestination = await destinationService.updateVisibility(
                id,
                visibility,
                user
            );

            return successResponse(c, updatedDestination);
        } catch (error) {
            apiLogger.error(
                error as Error,
                'DestinationsAPI - Error updating destination visibility'
            );

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Destination not found');
            }

            return errorResponse(c, {
                message: 'Error updating destination visibility',
                status: 500
            });
        }
    }
);

export { destinationsRoutes };
