import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { FeatureService } from '@repo/db';
import { FeatureSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the features router
const featuresRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    state: z.string().optional(),
    isBuiltin: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all features
featuresRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI', query }, 'Listing features');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            state: query.state,
            isBuiltin:
                query.isBuiltin === 'true' ? true : query.isBuiltin === 'false' ? false : undefined,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const featureService = new FeatureService();

        // Fetch features
        const features = await featureService.list(filter, user);

        // Get total count for pagination
        const total =
            features.length > query.limit
                ? features.length
                : Math.max(query.page * query.limit, features.length);

        return paginatedResponse(c, features, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error listing features');
        return errorResponse(c, {
            message: 'Error listing features',
            status: 500
        });
    }
});

// Get feature by ID
featuresRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI', id }, 'Fetching feature by ID');

        const featureService = new FeatureService();
        const feature = await featureService.getById(id, user);

        if (!feature) {
            return notFoundResponse(c, 'Feature not found');
        }

        return successResponse(c, feature);
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error fetching feature');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Feature not found');
        }

        return errorResponse(c, {
            message: 'Error fetching feature',
            status: 500
        });
    }
});

// Create a new feature
featuresRoutes.post('/', zValidator('json', FeatureSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI' }, 'Creating new feature');

        const featureService = new FeatureService();
        const newFeature = await featureService.create(data, user);

        return successResponse(c, newFeature, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error creating feature');
        return errorResponse(c, {
            message: 'Error creating feature',
            status: 500
        });
    }
});

// Update a feature
featuresRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', FeatureSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'FeaturesAPI', id }, 'Updating feature');

            const featureService = new FeatureService();
            const updatedFeature = await featureService.update(id, data, user);

            return successResponse(c, updatedFeature);
        } catch (error) {
            apiLogger.error(error as Error, 'FeaturesAPI - Error updating feature');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Feature not found');
            }

            return errorResponse(c, {
                message: 'Error updating feature',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a feature
featuresRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI', id }, 'Soft-deleting feature');

        const featureService = new FeatureService();
        await featureService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error deleting feature');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Feature not found');
        }

        return errorResponse(c, {
            message: 'Error deleting feature',
            status: 500
        });
    }
});

// Restore a soft-deleted feature
featuresRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI', id }, 'Restoring feature');

        const featureService = new FeatureService();
        await featureService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error restoring feature');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Feature not found');
        }

        return errorResponse(c, {
            message: 'Error restoring feature',
            status: 500
        });
    }
});

// Get built-in features
featuresRoutes.get('/builtin', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'FeaturesAPI' }, 'Listing built-in features');

        const featureService = new FeatureService();

        // Pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            state: query.state,
            includeDeleted: query.includeDeleted === 'true'
        };

        const features = await featureService.getBuiltIn(user, filter);

        // Get total count for pagination
        const total =
            features.length > query.limit
                ? features.length
                : Math.max(query.page * query.limit, features.length);

        return paginatedResponse(c, features, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'FeaturesAPI - Error listing built-in features');
        return errorResponse(c, {
            message: 'Error listing built-in features',
            status: 500
        });
    }
});

export { featuresRoutes };
