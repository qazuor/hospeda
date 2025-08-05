/**
 * Universal Actor Middleware
 * Automatically creates and injects actor into context for all routes
 * Handles both authenticated users and guest users
 */
import { getAuth } from '@hono/clerk-auth';
import type { Actor } from '@repo/service-core';
import { UserService } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { createGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';

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

        if (auth?.userId) {
            // User is authenticated - get user from database
            try {
                const userService = new UserService({ logger: apiLogger });
                const guestActor = createGuestActor(); // Temporary actor for database query

                const userResult = await userService.getById(guestActor, auth.userId);

                if (userResult.data) {
                    actor = {
                        id: userResult.data.id,
                        role: userResult.data.role,
                        permissions: userResult.data.permissions
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
