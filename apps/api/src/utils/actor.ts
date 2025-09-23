import { PermissionEnum, RoleEnum } from '@repo/schemas';
/**
 * Actor utilities for API layer
 * Provides helpers to create and manage actors for service calls
 */
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { apiLogger } from './logger';

/**
 * Creates a GUEST actor for public API endpoints
 * GUEST users have minimal permissions for public data access
 *
 * @returns {Actor} A guest actor with basic public access permissions
 */
export const createGuestActor = (): Actor => ({
    id: '00000000-0000-4000-8000-000000000000', // Valid UUID v4 for guest actor
    role: RoleEnum.GUEST,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC]
});

/**
 * Check if an actor is a guest user
 * @param actor - The actor to check
 * @returns {boolean} True if the actor is a guest user
 */
export const isGuestActor = (actor: Actor): boolean => {
    return actor.id === '00000000-0000-4000-8000-000000000000' || actor.role === RoleEnum.GUEST;
};

/**
 * Get actor from Hono context
 * This helper ensures we always have an actor available
 *
 * @param c - Hono context
 * @returns {Actor} The actor from context or guest actor as fallback
 */
export const getActorFromContext = (c: Context): Actor => {
    const actor = c.get('actor');
    if (!actor) {
        apiLogger.warn('No actor found in context, using guest actor as fallback');
        return createGuestActor();
    }

    // Ensure permissions array is always defined
    if (!actor.permissions || !Array.isArray(actor.permissions)) {
        apiLogger.warn(
            `Actor has invalid permissions, initializing as empty array (actorId: ${actor.id})`
        );
        actor.permissions = [];
    }

    return actor;
};
