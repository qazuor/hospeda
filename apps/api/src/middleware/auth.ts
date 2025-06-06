import { BuiltinRoleTypeEnum, StateEnum, type UserType } from '@repo/types';
import type { Context, Next } from 'hono';

// This is a placeholder for actual JWT verification and user data retrieval
// In a real implementation, this would verify a JWT token and fetch user data
export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    // Just a placeholder user for now
    const mockUser: UserType = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        roleId: BuiltinRoleTypeEnum.ADMIN,
        permissions: [],
        userName: '',
        passwordHash: '',
        state: StateEnum.ACTIVE,
        name: '',
        displayName: '',
        createdAt: new Date(),
        createdById: '',
        updatedAt: new Date(),
        updatedById: ''
    };

    // Placeholder for validating Bearer token
    if (authHeader?.startsWith('Bearer ')) {
        // In a real impl, verify the JWT token and fetch user data
        // const token = authHeader.substring(7);
        // const verified = await verifyToken(token);

        // Attach the user to the context
        c.set('user', mockUser);
        apiLogger.debug({ location: 'Auth', userId: mockUser.id }, 'User authenticated');
    } else {
        apiLogger.debug({ location: 'Auth' }, 'No auth token provided');
    }

    // Always proceed to next middleware
    await next();
}

// Middleware that requires authentication
export async function requireAuth(c: Context, next: Next) {
    const user = c.get('user');

    if (!user) {
        apiLogger.warn({ location: 'Auth' }, 'Authentication required');
        return c.json(
            {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            },
            401
        );
    }

    await next();
}

// Middleware that requires admin role
export async function requireAdmin(c: Context, next: Next) {
    const user = c.get('user');

    if (!user) {
        apiLogger.warn({ location: 'Auth' }, 'Authentication required for admin access');
        return c.json(
            {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            },
            401
        );
    }

    if (user.roleId !== BuiltinRoleTypeEnum.ADMIN) {
        apiLogger.warn(
            { location: 'Auth', userId: user.id, roleId: user.roleId },
            'Admin access denied'
        );
        return c.json(
            {
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Admin access required'
                }
            },
            403
        );
    }

    await next();
}

import { apiLogger } from '@/utils/logger';
// Helper middleware to check specific permissions
import type { PermissionType } from '@repo/types';
export function requirePermission(permission: PermissionType) {
    return async (c: Context, next: Next) => {
        const user = c.get('user');

        if (!user) {
            apiLogger.warn({ location: 'Auth' }, 'Authentication required for permission check');
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                },
                401
            );
        }

        // Admin role has all permissions
        if (user.roleId === BuiltinRoleTypeEnum.ADMIN) {
            await next();
            return;
        }

        // Check if the user has the required permission
        if (!(user.permissions ?? []).includes(permission)) {
            apiLogger.warn(
                {
                    location: 'Auth',
                    userId: user.id,
                    permission,
                    userPermissions: user.permissions
                },
                'Permission denied'
            );
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You do not have permission to access this resource'
                    }
                },
                403
            );
        }

        await next();
    };
}
