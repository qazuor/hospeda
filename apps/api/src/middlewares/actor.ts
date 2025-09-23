/**
 * Universal Actor Middleware
 * Automatically creates and injects actor into context for all routes
 * Handles both authenticated users and guest users
 * Uses high-performance user cache to minimize database queries
 */
import { getAuth } from '@hono/clerk-auth';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { createGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';
import { userCache } from '../utils/user-cache';

/**
 * Universal actor middleware that runs on all routes
 * Automatically detects authentication and creates appropriate actor
 *
 * @returns {MiddlewareHandler} Middleware that injects actor into context
 */
export const actorMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        const auth = getAuth(c);
        let actor: Actor;

        // Handle case where Clerk returns undefined after sign-out
        if (auth?.userId) {
            // User is authenticated - get user from cache (or database if cache miss)
            try {
                const dbUser = await userCache.getUser(auth.userId);

                if (dbUser) {
                    // Ensure SUPER_ADMIN has all permissions
                    let permissions = dbUser.permissions || [];
                    if (dbUser.role === RoleEnum.SUPER_ADMIN) {
                        permissions = Object.values(PermissionEnum);
                    }

                    actor = {
                        id: dbUser.id,
                        role: dbUser.role,
                        permissions
                    };
                } else {
                    // Fallback to GUEST if user not found
                    apiLogger.warn(`User ${auth.userId} not found in database, using guest actor`);
                    actor = createGuestActor();
                }
            } catch (error) {
                apiLogger.error(
                    'Error getting user actor:',
                    error instanceof Error ? error.message : String(error)
                );
                actor = createGuestActor();
            }
        } else {
            // User is not authenticated - use GUEST actor
            actor = createGuestActor();
        }

        // Inject actor into context
        c.set('actor', actor);

        await next();
    };
};
