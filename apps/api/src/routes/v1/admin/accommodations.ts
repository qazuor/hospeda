import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import type { InsertAccommodation } from '@repo/db';
import { AccommodationService } from '@repo/db';
import { AccommodationCreateSchema, AccommodationUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the accommodations router
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
    ownerId: z.string().uuid().optional(),
    state: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all accommodations
accommodationsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'AccommodationsAPI', query }, 'Listing accommodations');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            type: query.type,
            destinationId: query.destinationId,
            ownerId: query.ownerId,
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
        const accommodationService = new AccommodationService();

        // Fetch accommodations
        const accommodations = await accommodationService.list(filter, user);

        // Get total count for pagination - in a real implementation this would use a count query
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
        apiLogger.error(error as Error, 'AccommodationsAPI - Error listing accommodations');
        return errorResponse(c, {
            message: 'Error listing accommodations',
            status: 500
        });
    }
});

// Get accommodation by ID
accommodationsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AccommodationsAPI', id }, 'Fetching accommodation by ID');

        const accommodationService = new AccommodationService();
        const accommodation = await accommodationService.getById(id, user);

        if (!accommodation) {
            return notFoundResponse(c, 'Accommodation not found');
        }

        return successResponse(c, accommodation);
    } catch (error) {
        apiLogger.error(error as Error, 'AccommodationsAPI - Error fetching accommodation');

        // Handle specific error types
        if ((error as Error).message === 'Accommodation not found') {
            return notFoundResponse(c, 'Accommodation not found');
        }

        return errorResponse(c, {
            message: 'Error fetching accommodation',
            status: 500
        });
    }
});

// Create a new accommodation
accommodationsRoutes.post('/', zValidator('json', AccommodationCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json') as InsertAccommodation;
        const user = c.get('user');

        apiLogger.info({ location: 'AccommodationsAPI' }, 'Creating new accommodation');

        const accommodationService = new AccommodationService();
        const newAccommodation = await accommodationService.create(data, user);

        return successResponse(c, newAccommodation, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'AccommodationsAPI - Error creating accommodation');
        return errorResponse(c, {
            message: 'Error creating accommodation',
            status: 500
        });
    }
});

// Update an accommodation
accommodationsRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', AccommodationUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'AccommodationsAPI', id }, 'Updating accommodation');

            const accommodationService = new AccommodationService();
            const updatedAccommodation = await accommodationService.update(id, data, user);

            return successResponse(c, updatedAccommodation);
        } catch (error) {
            apiLogger.error(error as Error, 'AccommodationsAPI - Error updating accommodation');

            if ((error as Error).message === 'Accommodation not found') {
                return notFoundResponse(c, 'Accommodation not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this accommodation',
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error updating accommodation',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) an accommodation
accommodationsRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AccommodationsAPI', id }, 'Soft-deleting accommodation');

        const accommodationService = new AccommodationService();
        await accommodationService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'AccommodationsAPI - Error deleting accommodation');

        if ((error as Error).message === 'Accommodation not found') {
            return notFoundResponse(c, 'Accommodation not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this accommodation',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error deleting accommodation',
            status: 500
        });
    }
});

// Restore a soft-deleted accommodation
accommodationsRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AccommodationsAPI', id }, 'Restoring accommodation');

        const accommodationService = new AccommodationService();
        await accommodationService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'AccommodationsAPI - Error restoring accommodation');

        if ((error as Error).message === 'Accommodation not found') {
            return notFoundResponse(c, 'Accommodation not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to restore this accommodation',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error restoring accommodation',
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
            const user = c.get('user');

            apiLogger.info(
                { location: 'AccommodationsAPI', destinationId: id, query },
                'Listing accommodations by destination'
            );

            const accommodationService = new AccommodationService();

            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const accommodations = await accommodationService.listByDestination(id, user, filter);

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
            apiLogger.error(
                error as Error,
                'AccommodationsAPI - Error listing accommodations by destination'
            );
            return errorResponse(c, {
                message: 'Error listing accommodations by destination',
                status: 500
            });
        }
    }
);

export { accommodationsRoutes };
