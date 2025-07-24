/**
 * Public user utility for unauthenticated requests
 * Creates a standardized public user actor for service calls
 */
import type { Actor } from '@repo/service-core';
import { RoleEnum } from '@repo/types';

/**
 * Public user actor for unauthenticated API calls
 * Used when accessing public endpoints to maintain service layer consistency
 */
export const PUBLIC_USER_ACTOR: Actor = {
    id: 'public',
    role: RoleEnum.GUEST,
    permissions: [] // Empty permissions for public access
};

/**
 * Create a public user context for service calls
 * @returns {Actor} Public user actor with basic read permissions
 */
export const createPublicUserActor = (): Actor => {
    return {
        ...PUBLIC_USER_ACTOR
    };
};

/**
 * Check if an actor is a public user
 * @param actor - The actor to check
 * @returns {boolean} True if the actor is a public user
 */
export const isPublicUser = (actor: Actor): boolean => {
    return actor.id === 'public' || actor.role === 'GUEST';
};
