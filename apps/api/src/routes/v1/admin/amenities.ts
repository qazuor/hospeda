import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { AmenityService } from '@repo/db';
import { AmenitySchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the amenities router
const amenitiesRoutes = new Hono();

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
    state: z.string().optional(),
    isBuiltin: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all amenities
amenitiesRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI', query }, 'Listing amenities');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            type: query.type,
            state: query.state,
            isBuiltin:
                query.isBuiltin === 'true' ? true : query.isBuiltin === 'false' ? false : undefined,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const amenityService = new AmenityService();

        // Fetch amenities
        const amenities = await amenityService.list(filter, user);

        // Get total count for pagination
        const total =
            amenities.length > query.limit
                ? amenities.length
                : Math.max(query.page * query.limit, amenities.length);

        return paginatedResponse(c, amenities, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error listing amenities');
        return errorResponse(c, {
            message: 'Error listing amenities',
            status: 500
        });
    }
});

// Get amenity by ID
amenitiesRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI', id }, 'Fetching amenity by ID');

        const amenityService = new AmenityService();
        const amenity = await amenityService.getById(id, user);

        if (!amenity) {
            return notFoundResponse(c, 'Amenity not found');
        }

        return successResponse(c, amenity);
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error fetching amenity');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Amenity not found');
        }

        return errorResponse(c, {
            message: 'Error fetching amenity',
            status: 500
        });
    }
});

// Create a new amenity
amenitiesRoutes.post('/', zValidator('json', AmenitySchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI' }, 'Creating new amenity');

        const amenityService = new AmenityService();
        const newAmenity = await amenityService.create(data, user);

        return successResponse(c, newAmenity, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error creating amenity');
        return errorResponse(c, {
            message: 'Error creating amenity',
            status: 500
        });
    }
});

// Update an amenity
amenitiesRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', AmenitySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'AmenitiesAPI', id }, 'Updating amenity');

            const amenityService = new AmenityService();
            const updatedAmenity = await amenityService.update(id, data, user);

            return successResponse(c, updatedAmenity);
        } catch (error) {
            apiLogger.error(error as Error, 'AmenitiesAPI - Error updating amenity');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Amenity not found');
            }

            return errorResponse(c, {
                message: 'Error updating amenity',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) an amenity
amenitiesRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI', id }, 'Soft-deleting amenity');

        const amenityService = new AmenityService();
        await amenityService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error deleting amenity');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Amenity not found');
        }

        return errorResponse(c, {
            message: 'Error deleting amenity',
            status: 500
        });
    }
});

// Restore a soft-deleted amenity
amenitiesRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI', id }, 'Restoring amenity');

        const amenityService = new AmenityService();
        await amenityService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error restoring amenity');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Amenity not found');
        }

        return errorResponse(c, {
            message: 'Error restoring amenity',
            status: 500
        });
    }
});

// List amenities by type
amenitiesRoutes.get(
    '/type/:type',
    zValidator(
        'param',
        z.object({
            type: z.string()
        })
    ),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { type } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            apiLogger.info({ location: 'AmenitiesAPI', type }, 'Listing amenities by type');

            const amenityService = new AmenityService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit,
                includeDeleted: query.includeDeleted === 'true'
            };

            const amenities = await amenityService.getByType(type, user, filter);

            // Get total count for pagination
            const total =
                amenities.length > query.limit
                    ? amenities.length
                    : Math.max(query.page * query.limit, amenities.length);

            return paginatedResponse(c, amenities, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            apiLogger.error(error as Error, 'AmenitiesAPI - Error listing amenities by type');
            return errorResponse(c, {
                message: 'Error listing amenities by type',
                status: 500
            });
        }
    }
);

// Get built-in amenities
amenitiesRoutes.get('/builtin', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'AmenitiesAPI' }, 'Listing built-in amenities');

        const amenityService = new AmenityService();

        // Pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            type: query.type,
            includeDeleted: query.includeDeleted === 'true'
        };

        const amenities = await amenityService.getBuiltIn(user, filter);

        // Get total count for pagination
        const total =
            amenities.length > query.limit
                ? amenities.length
                : Math.max(query.page * query.limit, amenities.length);

        return paginatedResponse(c, amenities, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'AmenitiesAPI - Error listing built-in amenities');
        return errorResponse(c, {
            message: 'Error listing built-in amenities',
            status: 500
        });
    }
});

export { amenitiesRoutes };
