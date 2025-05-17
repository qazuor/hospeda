import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { RoleService, UserService } from '@repo/db';
import { logger } from '@repo/logger';
import { UserCreateSchema, UserUpdateSchema } from '@repo/schemas';
import { EntityTypeEnum } from '@repo/types';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the users router
const usersRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    roleId: z.string().uuid().optional(),
    state: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all users
usersRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        logger.info('Listing users', 'UsersAPI', { query });

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            roleId: query.roleId,
            state: query.state,
            orderBy: query.orderBy,
            order: query.order,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const userService = new UserService();

        // Fetch users
        const users = await userService.list(filter, user);

        // Get total count for pagination
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
        logger.error('Error listing users', 'UsersAPI', error);
        return errorResponse(c, {
            message: 'Error listing users',
            status: 500
        });
    }
});

// Get user by ID
usersRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const currentUser = c.get('user');

        logger.info('Fetching user by ID', 'UsersAPI', { id });

        const userService = new UserService();
        const user = await userService.getById(id, currentUser);

        if (!user) {
            return notFoundResponse(c, 'User not found');
        }

        return successResponse(c, user);
    } catch (error) {
        logger.error('Error fetching user', 'UsersAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'User not found');
        }

        return errorResponse(c, {
            message: 'Error fetching user',
            status: 500
        });
    }
});

// Create a new user
usersRoutes.post('/', zValidator('json', UserCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const currentUser = c.get('user');

        logger.info('Creating new user', 'UsersAPI');

        const userService = new UserService();
        const newUser = await userService.create(data, currentUser);

        return successResponse(c, newUser, 201);
    } catch (error) {
        logger.error('Error creating user', 'UsersAPI', error);
        return errorResponse(c, {
            message: 'Error creating user',
            status: 500
        });
    }
});

// Update a user
usersRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', UserUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const currentUser = c.get('user');

            logger.info('Updating user', 'UsersAPI', { id });

            const userService = new UserService();
            const updatedUser = await userService.update(id, data, currentUser);

            return successResponse(c, updatedUser);
        } catch (error) {
            logger.error('Error updating user', 'UsersAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'User not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this user',
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error updating user',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) a user
usersRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const currentUser = c.get('user');

        logger.info('Soft-deleting user', 'UsersAPI', { id });

        const userService = new UserService();
        await userService.delete(id, currentUser);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        logger.error('Error deleting user', 'UsersAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'User not found');
        }

        return errorResponse(c, {
            message: 'Error deleting user',
            status: 500
        });
    }
});

// Restore a soft-deleted user
usersRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const currentUser = c.get('user');

        logger.info('Restoring user', 'UsersAPI', { id });

        const userService = new UserService();
        await userService.restore(id, currentUser);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        logger.error('Error restoring user', 'UsersAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'User not found');
        }

        return errorResponse(c, {
            message: 'Error restoring user',
            status: 500
        });
    }
});

// Change user's role
usersRoutes.post(
    '/:id/role',
    zValidator('param', idParam),
    zValidator(
        'json',
        z.object({
            roleId: z.string().uuid()
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const { roleId } = c.req.valid('json');
            const currentUser = c.get('user');

            logger.info('Changing user role', 'UsersAPI', { userId: id, roleId });

            // Verify role exists
            const roleService = new RoleService();
            await roleService.getById(roleId, currentUser);

            const userService = new UserService();
            const updatedUser = await userService.changeRole(id, roleId, currentUser);

            return successResponse(c, updatedUser);
        } catch (error) {
            logger.error('Error changing user role', 'UsersAPI', error);

            if (
                (error as Error).message.includes('user not found') ||
                (error as Error).message.includes('User not found')
            ) {
                return notFoundResponse(c, 'User not found');
            }
            if (
                (error as Error).message.includes('role not found') ||
                (error as Error).message.includes('Role not found')
            ) {
                return notFoundResponse(c, 'Role not found');
            }

            return errorResponse(c, {
                message: 'Error changing user role',
                status: 500
            });
        }
    }
);

// Reset user password
usersRoutes.post('/:id/reset-password', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const currentUser = c.get('user');

        logger.info('Resetting user password', 'UsersAPI', { userId: id });

        const userService = new UserService();
        await userService.resetPassword(id, currentUser);

        return successResponse(c, {
            id,
            message: 'Password reset successfully. A temporary password has been generated.'
        });
    } catch (error) {
        logger.error('Error resetting user password', 'UsersAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'User not found');
        }

        return errorResponse(c, {
            message: 'Error resetting user password',
            status: 500
        });
    }
});

// List user's bookmarks
usersRoutes.get(
    '/:id/bookmarks',
    zValidator('param', idParam),
    zValidator(
        'query',
        z.object({
            page: z.coerce.number().positive().default(1),
            limit: z.coerce.number().positive().max(100).default(20),
            entityType: z.string().optional()
        })
    ),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const currentUser = c.get('user');

            logger.info('Listing user bookmarks', 'UsersAPI', { userId: id, query });

            const userService = new UserService();

            // Convert entityType string to EntityTypeEnum if present
            let entityTypeEnum: EntityTypeEnum | undefined = undefined;
            if (query.entityType) {
                // Import EntityTypeEnum from the correct location if not already imported
                // import { EntityTypeEnum } from '@repo/db'; // Uncomment if needed
                if (Object.values(EntityTypeEnum).includes(query.entityType as EntityTypeEnum)) {
                    entityTypeEnum = query.entityType as EntityTypeEnum;
                } else {
                    return errorResponse(c, {
                        message: 'Invalid entityType value',
                        status: 400
                    });
                }
            }

            // Construct filter
            const filter = {
                entityType: entityTypeEnum,
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const bookmarks = await userService.listBookmarks(id, currentUser, filter);

            // Get total count for pagination
            const total =
                bookmarks.length > query.limit
                    ? bookmarks.length
                    : Math.max(query.page * query.limit, bookmarks.length);

            return paginatedResponse(c, bookmarks, {
                page: query.page,
                limit: query.limit,
                total: total
            });
        } catch (error) {
            logger.error('Error listing user bookmarks', 'UsersAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'User not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: "You do not have permission to view this user's bookmarks",
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error listing user bookmarks',
                status: 500
            });
        }
    }
);

export { usersRoutes };
