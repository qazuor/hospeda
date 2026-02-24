/**
 * Universal Actor Middleware.
 *
 * Creates and injects an Actor into the Hono context for all routes.
 * Reads the authenticated user from context (set by auth middleware)
 * and resolves permissions from the database. Unauthenticated requests
 * receive a guest actor with minimal public access.
 *
 * @module actor-middleware
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { createGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';
import { getPermissionsForRole } from '../utils/role-permissions-cache';
import { userCache } from '../utils/user-cache';

/**
 * Schema for validating mock actor permissions.
 * @internal TEST-ONLY
 */
const MockPermissionsSchema = z.array(z.nativeEnum(PermissionEnum));

/**
 * Check if mock actor headers are allowed.
 * @internal TEST-ONLY .. Never enable in production or staging!
 *
 * Mock actor headers are ONLY accepted when ALL conditions are met:
 * - NODE_ENV === 'test'
 * - ALLOW_MOCK_ACTOR === 'true' (explicit opt-in)
 * - CI !== 'true' (never in CI pipelines with real tokens)
 *
 * Headers:
 * - x-mock-actor-id: UUID of the mock actor
 * - x-mock-actor-role: Role enum value
 * - x-mock-actor-permissions: JSON array of permissions
 */
const isMockActorAllowed = (): boolean => {
    return (
        process.env.NODE_ENV === 'test' &&
        process.env.ALLOW_MOCK_ACTOR === 'true' &&
        process.env.CI !== 'true'
    );
};

/**
 * Universal actor middleware that runs on all routes.
 * Reads the authenticated user from context (set by auth middleware)
 * and builds the appropriate Actor with permissions.
 *
 * For authenticated users:
 * - SUPER_ADMIN gets all permissions without DB lookup
 * - Other roles get permissions from the database via UserCache
 *
 * For unauthenticated requests:
 * - Creates a guest actor with public access only
 *
 * @returns Middleware that injects actor into context
 */
export const actorMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        /**
         * @internal TEST-ONLY: Mock actor headers for E2E tests.
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

        // Read authenticated user from context (set by auth middleware)
        const user = c.get('user');
        let actor: Actor;

        if (user?.id) {
            try {
                const userRole = (user.role as RoleEnum) || RoleEnum.USER;

                // SUPER_ADMIN gets all permissions without a DB lookup
                if (userRole === RoleEnum.SUPER_ADMIN) {
                    actor = {
                        id: user.id,
                        role: RoleEnum.SUPER_ADMIN,
                        permissions: Object.values(PermissionEnum)
                    };
                } else {
                    // Resolve permissions from role_permission table (cached)
                    const rolePermissions = await getPermissionsForRole(userRole);

                    // Also merge any user-specific permissions from the user record
                    const dbUser = await userCache.getUser(user.id);
                    const userPermissions = dbUser?.permissions || [];

                    // Combine role-based and user-specific permissions (deduplicated)
                    const allPermissions = [
                        ...new Set([...rolePermissions, ...userPermissions])
                    ] as PermissionEnum[];

                    actor = {
                        id: user.id,
                        role: userRole,
                        permissions: allPermissions
                    };
                }

                // Attach billing entitlements if available
                const userEntitlements = c.get('userEntitlements');
                if (userEntitlements) {
                    actor.entitlements = new Set<string>(
                        Array.from(userEntitlements || []).map((e) => String(e))
                    );
                }
            } catch (error) {
                apiLogger.error(
                    'Error building user actor:',
                    error instanceof Error ? error.message : String(error)
                );
                actor = createGuestActor();
            }
        } else {
            // Unauthenticated request .. use GUEST actor
            actor = createGuestActor();
        }

        // Inject actor into context
        c.set('actor', actor);

        await next();
    };
};

/**
 * Get actor from context.
 *
 * Retrieves the actor that was injected by actorMiddleware.
 * Throws if actor is not available (should never happen if middleware is configured).
 *
 * @param c - Hono context
 * @returns Actor object
 * @throws HTTPException if actor is not in context
 */
export const getActorFromContext = (c: Parameters<MiddlewareHandler>[0]): Actor => {
    const actor = c.get('actor');

    if (!actor) {
        apiLogger.error('Actor not found in context - actorMiddleware may not be running');
        throw new HTTPException(500, {
            message: 'Internal server error: Actor not available'
        });
    }

    return actor;
};
