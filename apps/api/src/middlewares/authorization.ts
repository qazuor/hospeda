/**
 * Authorization Middleware
 * Provides three-tier authorization for API routes:
 * - public: No authentication required (guests allowed)
 * - protected: Authentication required (no guests)
 * - admin: Admin-level permissions required
 */

import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AuthorizationConfig } from '../types/authorization';
import { getActorFromContext, isGuestActor } from '../utils/actor';
import { AuditEventType, auditLog } from '../utils/audit-logger';
import { apiLogger } from '../utils/logger';

/**
 * Permissions that grant admin-level access
 * Having any of these permissions allows access to admin routes
 */
const ADMIN_ACCESS_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
];

/**
 * Check if actor has any of the specified permissions
 */
const hasAnyPermission = (actor: Actor, permissions: PermissionEnum[]): boolean => {
    if (!actor.permissions || !Array.isArray(actor.permissions)) {
        return false;
    }
    return permissions.some((permission) => actor.permissions.includes(permission));
};

/**
 * Check if actor has all of the specified permissions
 */
const hasAllPermissions = (actor: Actor, permissions: PermissionEnum[]): boolean => {
    if (!actor.permissions || !Array.isArray(actor.permissions)) {
        return false;
    }
    return permissions.every((permission) => actor.permissions.includes(permission));
};

/**
 * Check if actor has admin-level access.
 * Access is granted solely based on permissions, never by role bypass.
 */
const hasAdminAccess = (actor: Actor): boolean => {
    return hasAnyPermission(actor, ADMIN_ACCESS_PERMISSIONS);
};

/**
 * Creates an authorization middleware based on the specified configuration
 *
 * @param config - Authorization configuration
 * @returns Middleware handler that enforces authorization rules
 *
 * @example
 * // Public route - allows anyone
 * app.use('/api/v1/public/*', authorizationMiddleware({ level: 'public' }));
 *
 * @example
 * // Protected route - requires authentication
 * app.use('/api/v1/protected/*', authorizationMiddleware({ level: 'protected' }));
 *
 * @example
 * // Admin route - requires admin permissions
 * app.use('/api/v1/admin/*', authorizationMiddleware({ level: 'admin' }));
 *
 * @example
 * // Admin route with specific permissions
 * app.use('/api/v1/admin/users/*', authorizationMiddleware({
 *   level: 'admin',
 *   requiredPermissions: [PermissionEnum.USER_UPDATE]
 * }));
 */
export const authorizationMiddleware = (config: AuthorizationConfig): MiddlewareHandler => {
    return async (c, next) => {
        const actor = getActorFromContext(c);
        const { level, requiredPermissions, unauthorizedMessage, forbiddenMessage } = config;

        // Store authorization level in context for downstream use
        c.set('authorizationLevel', level);

        // Reject system actors early: they must never reach HTTP endpoints
        if (actor._isSystemActor) {
            apiLogger.warn(`System actor rejected from HTTP context: actorId=${actor.id}`);
            auditLog({
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: actor.id,
                actorRole: actor.role,
                resource: c.req.path,
                method: c.req.method,
                statusCode: 403,
                reason: 'system_actor_rejected'
            });
            throw new HTTPException(403, { message: 'System actors cannot access HTTP endpoints' });
        }

        apiLogger.debug(
            `Authorization check: level=${level}, actorId=${actor.id}, role=${actor.role}, isGuest=${isGuestActor(actor)}`
        );

        // PUBLIC level: Allow everyone (guests and authenticated users)
        if (level === 'public') {
            await next();
            return;
        }

        // PROTECTED level: Require authentication (no guests)
        if (level === 'protected') {
            if (isGuestActor(actor)) {
                apiLogger.warn('Unauthorized access attempt to protected route by guest actor');
                auditLog({
                    auditEvent: AuditEventType.ACCESS_DENIED,
                    actorId: 'anonymous',
                    actorRole: 'guest',
                    resource: c.req.path,
                    method: c.req.method,
                    statusCode: 401,
                    reason: 'authentication_required'
                });
                throw new HTTPException(401, {
                    message: unauthorizedMessage || 'Authentication required'
                });
            }

            // If specific permissions are required, check them
            if (requiredPermissions && requiredPermissions.length > 0) {
                if (!hasAllPermissions(actor, requiredPermissions)) {
                    apiLogger.warn(
                        `Forbidden: Actor ${actor.id} lacks required permissions for protected route`
                    );
                    auditLog({
                        auditEvent: AuditEventType.ACCESS_DENIED,
                        actorId: actor.id,
                        actorRole: actor.role,
                        resource: c.req.path,
                        method: c.req.method,
                        statusCode: 403,
                        reason: 'insufficient_permissions',
                        requiredPermissions: requiredPermissions.map(String)
                    });
                    throw new HTTPException(403, {
                        message: forbiddenMessage || 'Insufficient permissions'
                    });
                }
            }

            await next();
            return;
        }

        // ADMIN level: Require authentication AND admin access
        if (level === 'admin') {
            // First check authentication
            if (isGuestActor(actor)) {
                apiLogger.warn('Unauthorized access attempt to admin route by guest actor');
                auditLog({
                    auditEvent: AuditEventType.ACCESS_DENIED,
                    actorId: 'anonymous',
                    actorRole: 'guest',
                    resource: c.req.path,
                    method: c.req.method,
                    statusCode: 401,
                    reason: 'authentication_required'
                });
                throw new HTTPException(401, {
                    message: unauthorizedMessage || 'Authentication required'
                });
            }

            // Then check admin access
            if (!hasAdminAccess(actor)) {
                apiLogger.warn(`Forbidden: Actor ${actor.id} lacks admin access`);
                auditLog({
                    auditEvent: AuditEventType.ACCESS_DENIED,
                    actorId: actor.id,
                    actorRole: actor.role,
                    resource: c.req.path,
                    method: c.req.method,
                    statusCode: 403,
                    reason: 'admin_access_required',
                    requiredPermissions: ADMIN_ACCESS_PERMISSIONS.map(String)
                });
                throw new HTTPException(403, {
                    message: forbiddenMessage || 'Admin access required'
                });
            }

            // If additional specific permissions are required, check them
            if (requiredPermissions && requiredPermissions.length > 0) {
                if (!hasAllPermissions(actor, requiredPermissions)) {
                    apiLogger.warn(`Forbidden: Actor ${actor.id} lacks required admin permissions`);
                    auditLog({
                        auditEvent: AuditEventType.ACCESS_DENIED,
                        actorId: actor.id,
                        actorRole: actor.role,
                        resource: c.req.path,
                        method: c.req.method,
                        statusCode: 403,
                        reason: 'insufficient_permissions',
                        requiredPermissions: requiredPermissions.map(String)
                    });
                    throw new HTTPException(403, {
                        message: forbiddenMessage || 'Insufficient admin permissions'
                    });
                }
            }

            await next();
            return;
        }

        // Unknown authorization level - fail safe
        apiLogger.error(`Unknown authorization level: ${level}`);
        throw new HTTPException(500, {
            message: 'Internal server error: Invalid authorization configuration'
        });
    };
};

/**
 * Pre-configured authorization middleware for public routes
 */
export const publicAuthMiddleware = (): MiddlewareHandler => {
    return authorizationMiddleware({ level: 'public' });
};

/**
 * Pre-configured authorization middleware for protected routes
 */
export const protectedAuthMiddleware = (
    requiredPermissions?: PermissionEnum[]
): MiddlewareHandler => {
    return authorizationMiddleware({
        level: 'protected',
        requiredPermissions
    });
};

/**
 * Pre-configured authorization middleware for admin routes
 */
export const adminAuthMiddleware = (requiredPermissions?: PermissionEnum[]): MiddlewareHandler => {
    return authorizationMiddleware({
        level: 'admin',
        requiredPermissions
    });
};
