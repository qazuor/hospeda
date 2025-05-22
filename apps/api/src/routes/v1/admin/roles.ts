import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { PermissionService, RoleService } from '@repo/db';
import { RoleCreateSchema, RoleUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the roles router
const rolesRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    isBuiltIn: z.enum(['true', 'false']).optional(),
    isDeprecated: z.enum(['true', 'false']).optional(),
    isDefault: z.enum(['true', 'false']).optional(),
    state: z.string().optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all roles
rolesRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        apiLogger.info({ location: 'RolesAPI', query }, 'Listing roles');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            isBuiltIn:
                query.isBuiltIn === 'true' ? true : query.isBuiltIn === 'false' ? false : undefined,
            isDeprecated:
                query.isDeprecated === 'true'
                    ? true
                    : query.isDeprecated === 'false'
                      ? false
                      : undefined,
            isDefault:
                query.isDefault === 'true' ? true : query.isDefault === 'false' ? false : undefined,
            state: query.state,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const roleService = new RoleService();

        // Fetch roles
        const roles = await roleService.list(filter, user);

        // Get total count for pagination
        const total =
            roles.length > query.limit
                ? roles.length
                : Math.max(query.page * query.limit, roles.length);

        return paginatedResponse(c, roles, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'RolesAPI - Error listing roles');
        return errorResponse(c, {
            message: 'Error listing roles',
            status: 500
        });
    }
});

// Get role by ID
rolesRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'RolesAPI', id }, 'Fetching role by ID');

        const roleService = new RoleService();
        const role = await roleService.getById(id, user);

        if (!role) {
            return notFoundResponse(c, 'Role not found');
        }

        return successResponse(c, role);
    } catch (error) {
        apiLogger.error(error as Error, 'RolesAPI - Error fetching role');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Role not found');
        }

        return errorResponse(c, {
            message: 'Error fetching role',
            status: 500
        });
    }
});

// Create a new role
rolesRoutes.post('/', zValidator('json', RoleCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        apiLogger.info({ location: 'RolesAPI' }, 'Creating new role');

        const roleService = new RoleService();
        const newRole = await roleService.create(data, user);

        return successResponse(c, newRole, 201);
    } catch (error) {
        apiLogger.error(error as Error, 'RolesAPI - Error creating role');
        return errorResponse(c, {
            message: 'Error creating role',
            status: 500
        });
    }
});

// Update a role
rolesRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', RoleUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info({ location: 'RolesAPI', id }, 'Updating role');

            const roleService = new RoleService();
            const updatedRole = await roleService.update(id, data, user);

            return successResponse(c, updatedRole);
        } catch (error) {
            apiLogger.error(error as Error, 'RolesAPI - Error updating role');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Role not found');
            }

            return errorResponse(c, {
                message: 'Error updating role',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a role
rolesRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'RolesAPI', id }, 'Soft-deleting role');

        const roleService = new RoleService();
        await roleService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        apiLogger.error(error as Error, 'RolesAPI - Error deleting role');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Role not found');
        }
        if ((error as Error).message.includes('built-in')) {
            return errorResponse(c, {
                message: 'Cannot delete built-in roles',
                status: 400
            });
        }

        return errorResponse(c, {
            message: 'Error deleting role',
            status: 500
        });
    }
});

// Restore a soft-deleted role
rolesRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        apiLogger.info({ location: 'RolesAPI', id }, 'Restoring role');

        const roleService = new RoleService();
        await roleService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        apiLogger.error(error as Error, 'RolesAPI - Error restoring role');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Role not found');
        }

        return errorResponse(c, {
            message: 'Error restoring role',
            status: 500
        });
    }
});

// Get users with a specific role
rolesRoutes.get(
    '/:id/users',
    zValidator('param', idParam),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            apiLogger.info({ location: 'RolesAPI', roleId: id, query }, 'Listing users with role');

            const roleService = new RoleService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const users = await roleService.listUsers(id, user, filter);

            // Get total count
            const total =
                users.length > query.limit
                    ? users.length
                    : Math.max(query.page * query.limit, users.length);

            return paginatedResponse(c, users, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            apiLogger.error(error as Error, 'RolesAPI - Error listing users with role');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Role not found');
            }

            return errorResponse(c, {
                message: 'Error listing users with role',
                status: 500
            });
        }
    }
);

// List permissions for a role
rolesRoutes.get(
    '/:id/permissions',
    zValidator('param', idParam),
    zValidator(
        'query',
        z.object({
            page: z.coerce.number().positive().default(1),
            limit: z.coerce.number().positive().max(100).default(50)
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            apiLogger.info({ location: 'RolesAPI', roleId: id }, 'Listing permissions for role');

            const roleService = new RoleService();

            // Pagination params
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const permissions = await roleService.listPermissions(id, user, filter);

            return successResponse(c, permissions);
        } catch (error) {
            apiLogger.error(error as Error, 'RolesAPI - Error listing permissions for role');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Role not found');
            }

            return errorResponse(c, {
                message: 'Error listing permissions for role',
                status: 500
            });
        }
    }
);

// Add a permission to a role
rolesRoutes.post(
    '/:id/permissions',
    zValidator('param', idParam),
    zValidator(
        'json',
        z.object({
            permissionId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const { permissionId } = c.req.valid('json');
            const user = c.get('user');

            apiLogger.info(
                { location: 'RolesAPI', roleId: id, permissionId },
                'Adding permission to role'
            );

            // Verify permission exists
            const permissionService = new PermissionService();
            await permissionService.getById(permissionId, user);

            // Add permission to role
            const roleService = new RoleService();
            const relation = await roleService.assignPermission(id, permissionId, user);

            return successResponse(c, relation, 201);
        } catch (error) {
            apiLogger.error(error as Error, 'RolesAPI - Error adding permission to role');

            if (
                (error as Error).message.includes('role not found') ||
                (error as Error).message.includes('Role not found')
            ) {
                return notFoundResponse(c, 'Role not found');
            }
            if (
                (error as Error).message.includes('permission not found') ||
                (error as Error).message.includes('Permission not found')
            ) {
                return notFoundResponse(c, 'Permission not found');
            }

            return errorResponse(c, {
                message: 'Error adding permission to role',
                status: 500
            });
        }
    }
);

// Remove a permission from a role
rolesRoutes.delete(
    '/:id/permissions/:permissionId',
    zValidator(
        'param',
        z.object({
            id: z.string().uuid(),
            permissionId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { id, permissionId } = c.req.valid('param');
            const user = c.get('user');

            apiLogger.info(
                { location: 'RolesAPI', roleId: id, permissionId },
                'Removing permission from role'
            );

            const roleService = new RoleService();
            await roleService.removePermission(id, permissionId, user);

            return successResponse(c, {
                roleId: id,
                permissionId,
                removed: true
            });
        } catch (error) {
            apiLogger.error(error as Error, 'RolesAPI - Error removing permission from role');

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, (error as Error).message);
            }

            return errorResponse(c, {
                message: 'Error removing permission from role',
                status: 500
            });
        }
    }
);

export { rolesRoutes };
