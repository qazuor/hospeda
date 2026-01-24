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
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { createGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';
import { userCache } from '../utils/user-cache';

/**
 * Schema for validating mock actor permissions
 * @internal TEST-ONLY
 */
const MockPermissionsSchema = z.array(z.nativeEnum(PermissionEnum));

/**
 * Check if mock actor headers are allowed
 * @internal TEST-ONLY - Never enable in production!
 *
 * Mock actor headers are ONLY accepted when:
 * - NODE_ENV === 'test'
 * - ALLOW_MOCK_ACTOR === 'true' (explicit opt-in)
 *
 * Headers:
 * - x-mock-actor-id: UUID of the mock actor
 * - x-mock-actor-role: Role enum value
 * - x-mock-actor-permissions: JSON array of permissions
 */
const isMockActorAllowed = (): boolean => {
    return process.env.NODE_ENV === 'test' && process.env.ALLOW_MOCK_ACTOR === 'true';
};

/**
 * Universal actor middleware that runs on all routes
 * Automatically detects authentication and creates appropriate actor
 *
 * @returns {MiddlewareHandler} Middleware that injects actor into context
 */
export const actorMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        /**
         * @internal TEST-ONLY: Mock actor headers for E2E tests
         * These headers are ONLY processed when:
         * - NODE_ENV === 'test'
         * - ALLOW_MOCK_ACTOR === 'true'
         *
         * @warning NEVER enable ALLOW_MOCK_ACTOR in production or staging!
         */
        if (isMockActorAllowed()) {
            const mockActorId = c.req.header('x-mock-actor-id');
            const mockActorRole = c.req.header('x-mock-actor-role');
            const mockActorPermissions = c.req.header('x-mock-actor-permissions');

            if (mockActorId && mockActorRole && mockActorPermissions) {
                // Validate mock actor role
                const roleValidation = z.nativeEnum(RoleEnum).safeParse(mockActorRole);
                if (!roleValidation.success) {
                    throw new HTTPException(400, {
                        message: `Invalid mock actor role: ${mockActorRole}. Must be one of: ${Object.values(RoleEnum).join(', ')}`
                    });
                }

                // Parse and validate permissions with proper error handling
                let parsedPermissions: PermissionEnum[];
                try {
                    const rawPermissions = JSON.parse(mockActorPermissions);
                    const permissionsValidation = MockPermissionsSchema.safeParse(rawPermissions);

                    if (!permissionsValidation.success) {
                        throw new HTTPException(400, {
                            message: `Invalid mock actor permissions format: ${permissionsValidation.error.message}`
                        });
                    }

                    parsedPermissions = permissionsValidation.data;
                } catch (error) {
                    if (error instanceof HTTPException) {
                        throw error;
                    }
                    // JSON parse error
                    throw new HTTPException(400, {
                        message: `Invalid mock actor permissions JSON: ${error instanceof Error ? error.message : 'Parse error'}`
                    });
                }

                const actor: Actor = {
                    id: mockActorId,
                    role: roleValidation.data,
                    permissions: parsedPermissions
                };

                apiLogger.debug(
                    `Using mock actor for testing: actorId=${mockActorId}, role=${roleValidation.data}, permissionsCount=${parsedPermissions.length}`
                );

                c.set('actor', actor);
                await next();
                return;
            }
        }

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
