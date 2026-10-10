import { PermissionEnum, RoleEnum } from '@repo/schemas';
/**
 * Actor utilities for API layer
 * Provides helpers to create and manage actors for service calls
 */
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { apiLogger } from './logger';

/**
 * Creates a GUEST actor for public API endpoints
 * GUEST users have minimal permissions for public data access
 *
 * @returns {Actor} A guest actor with basic public access permissions
 */
export const createGuestActor = (): Actor => ({
    id: '00000000-0000-4000-8000-000000000000', // Valid UUID v4 for guest actor
    roles: [RoleEnum.GUEST],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC]
});

/**
 * Check if an actor is a guest user
 * @param actor - The actor to check
 * @returns {boolean} True if the actor is a guest user
 */
export const isGuestActor = (actor: Actor): boolean => {
    return (
        actor.id === '00000000-0000-4000-8000-000000000000' || actor.roles.includes(RoleEnum.GUEST)
    );
};

/**
 * Get actor from Hono context.
 * Throws if actor is not available (indicates middleware misconfiguration).
 *
 * @param c - Hono context
 * @returns {Actor} The actor from context
 * @throws {HTTPException} 500 if actor is not in context
 */
export const getActorFromContext = (c: Context): Actor => {
    const actor = c.get('actor');
    if (!actor) {
        apiLogger.error('Actor not found in context - actorMiddleware may not be running');
        throw new HTTPException(500, {
            message: 'Internal server error: Actor not available'
        });
    }

    return actor;
};
