import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { PermissionService } from '@repo/db';
import { PermissionCreateSchema, PermissionUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the permissions router
const permissionsRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    isDeprecated: z.enum(['true', 'false']).optional(),
    state: z.string().optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all permissions
permissionsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI', query }, 'Listing permissions');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            isDeprecated:
                query.isDeprecated === 'true'
                    ? true
                    : query.isDeprecated === 'false'
                      ? false
                      : undefined,
            state: query.state,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const permissionService = new PermissionService();

        // Fetch permissions
        const permissions = await permissionService.list(filter, user);

        // Get total count for pagination
        const total =
            permissions.length > query.limit
                ? permissions.length
                : Math.max(query.page * query.limit, permissions.length);

        return paginatedResponse(c, permissions, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error listing permissions');
        return errorResponse(c, {
            message: 'Error listing permissions',
            status: 500
        });
    }
});

// Get permission by ID
permissionsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI', id }, 'Fetching permission by ID');

        const permissionService = new PermissionService();
        const permission = await permissionService.getById(id, user);

        if (!permission) {
            return notFoundResponse(c, 'Permission not found');
        }

        return successResponse(c, permission);
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error fetching permission');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Permission not found');
        }

        return errorResponse(c, {
            message: 'Error fetching permission',
            status: 500
        });
    }
});

// Create a new permission
permissionsRoutes.post('/', zValidator('json', PermissionCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI' }, 'Creating new permission');

        const permissionService = new PermissionService();
        const newPermission = await permissionService.create(data, user);

        return successResponse(c, newPermission, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error creating permission');
        return errorResponse(c, {
            message: 'Error creating permission',
            status: 500
        });
    }
});

// Update a permission
permissionsRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', PermissionUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'PermissionsAPI', id }, 'Updating permission');

            const permissionService = new PermissionService();
            const updatedPermission = await permissionService.update(id, data, user);

            return successResponse(c, updatedPermission);
        } catch (error) {
            apiLogger.error(error as Error, 'PermissionsAPI - Error updating permission');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Permission not found');
            }

            return errorResponse(c, {
                message: 'Error updating permission',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a permission
permissionsRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI', id }, 'Soft-deleting permission');

        const permissionService = new PermissionService();
        await permissionService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error deleting permission');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Permission not found');
        }

        return errorResponse(c, {
            message: 'Error deleting permission',
            status: 500
        });
    }
});

// Restore a soft-deleted permission
permissionsRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI', id }, 'Restoring permission');

        const permissionService = new PermissionService();
        await permissionService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error restoring permission');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Permission not found');
        }

        return errorResponse(c, {
            message: 'Error restoring permission',
            status: 500
        });
    }
});

// Get roles that have a specific permission
permissionsRoutes.get(
    '/:id/roles',
    zValidator('param', idParam),
    zValidator(
        'query',
        z.object({
            page: z.coerce.number().positive().default(1),
            limit: z.coerce.number().positive().max(100).default(20)
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            apiLogger.info(
                { location: 'PermissionsAPI', permissionId: id },
                'Listing roles with permission'
            );

            const permissionService = new PermissionService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const roles = await permissionService.getRoles(id, user, filter);

            return successResponse(c, roles);
        } catch (error) {
            apiLogger.error(error as Error, 'PermissionsAPI - Error listing roles with permission');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Permission not found');
            }

            return errorResponse(c, {
                message: 'Error listing roles with permission',
                status: 500
            });
        }
    }
);

// Add a permission to a user
permissionsRoutes.post(
    '/assign/user',
    zValidator(
        'json',
        z.object({
            userId: z.string().uuid(),
            permissionId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { userId, permissionId } = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info(
                { location: 'PermissionsAPI', userId, permissionId },
                'Adding permission to user'
            );

            const permissionService = new PermissionService();
            const relation = await permissionService.addToUser(userId, permissionId, user);

            return successResponse(c, relation, 201);
        } catch (error) {
            apiLogger.error(error as Error, 'PermissionsAPI - Error adding permission to user');

            if (
                (error as Error).message.includes('user not found') ||
                (error as Error).message.includes('User not found')
            ) {
                return notFoundResponse(c, 'User not found');
            }
            if (
                (error as Error).message.includes('permission not found') ||
                (error as Error).message.includes('Permission not found')
            ) {
                return notFoundResponse(c, 'Permission not found');
            }

            return errorResponse(c, {
                message: 'Error adding permission to user',
                status: 500
            });
        }
    }
);

// Remove a permission from a user
permissionsRoutes.delete(
    '/assign/user',
    zValidator(
        'json',
        z.object({
            userId: z.string().uuid(),
            permissionId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { userId, permissionId } = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info(
                { location: 'PermissionsAPI', userId, permissionId },
                'Removing permission from user'
            );

            const permissionService = new PermissionService();
            await permissionService.removeFromUser(userId, permissionId, user);

            return successResponse(c, {
                userId,
                permissionId,
                removed: true
            });
        } catch (error) {
            apiLogger.error(error as Error, 'PermissionsAPI - Error removing permission from user');

            if (
                (error as Error).message.includes('user not found') ||
                (error as Error).message.includes('User not found')
            ) {
                return notFoundResponse(c, 'User not found');
            }
            if (
                (error as Error).message.includes('permission not found') ||
                (error as Error).message.includes('Permission not found')
            ) {
                return notFoundResponse(c, 'Permission not found');
            }

            return errorResponse(c, {
                message: 'Error removing permission from user',
                status: 500
            });
        }
    }
);

// Get deprecated permissions
permissionsRoutes.get('/deprecated', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'PermissionsAPI' }, 'Listing deprecated permissions');

        const permissionService = new PermissionService();

        // Pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit
        };

        const permissions = await permissionService.getDeprecated(user, filter);

        // Get total count for pagination
        const total =
            permissions.length > query.limit
                ? permissions.length
                : Math.max(query.page * query.limit, permissions.length);

        return paginatedResponse(c, permissions, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PermissionsAPI - Error listing deprecated permissions');
        return errorResponse(c, {
            message: 'Error listing deprecated permissions',
            status: 500
        });
    }
});

export { permissionsRoutes };
