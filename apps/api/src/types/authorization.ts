/**
 * Authorization types for route-level access control
 * Defines the three-tier authorization system: public, protected, admin
 */

import type { PermissionEnum } from '@repo/schemas';

/**
 * Authorization levels for API routes
 * - public: No authentication required (guests allowed)
 * - protected: Authentication required (no guests)
 * - admin: Admin-level permissions required
 */
export type AuthorizationLevel = 'public' | 'protected' | 'admin';

/**
 * Configuration for route authorization
 */
export interface AuthorizationConfig {
    /** The required authorization level for the route */
    level: AuthorizationLevel;
    /** Additional specific permissions required (for admin level or specific checks) */
    requiredPermissions?: PermissionEnum[];
    /** Custom error message for unauthorized access */
    unauthorizedMessage?: string;
    /** Custom error message for forbidden access */
    forbiddenMessage?: string;
}

/**
 * Entity types that support ownership verification
 */
export type OwnableEntityType =
    | 'accommodation'
    | 'destination'
    | 'event'
    | 'post'
    | 'attraction'
    | 'eventLocation'
    | 'eventOrganizer'
    | 'user';

/**
 * Fields that can represent ownership of an entity
 */
export type OwnershipField = 'ownerId' | 'createdById' | 'userId';

/**
 * Configuration for ownership verification middleware
 */
export interface OwnershipConfig {
    /** The type of entity being accessed */
    entityType: OwnableEntityType;
    /** Fields to check for ownership (checked in order, first match wins) */
    ownershipFields: OwnershipField[];
    /** The parameter name containing the entity ID (defaults to 'id') */
    paramIdField?: string;
    /** Permission that allows bypassing ownership check (e.g., UPDATE_ANY) */
    bypassPermission?: PermissionEnum;
    /** Whether to allow access if entity is not found (defaults to false) */
    allowNotFound?: boolean;
}

/**
 * Context extensions set by authorization middleware
 */
export interface AuthorizationContext {
    /** The resolved entity (if ownership middleware ran) */
    entity?: Record<string, unknown>;
    /** Whether the current actor is the owner of the entity */
    isOwner?: boolean;
    /** The authorization level of the current route */
    authorizationLevel?: AuthorizationLevel;
}

/**
 * Default authorization configurations for common use cases
 */
export const DEFAULT_AUTH_CONFIGS = {
    /** Public route - no authentication */
    public: {
        level: 'public' as AuthorizationLevel
    },
    /** Protected route - authentication required */
    protected: {
        level: 'protected' as AuthorizationLevel,
        unauthorizedMessage: 'Authentication required'
    },
    /** Admin route - admin permissions required */
    admin: {
        level: 'admin' as AuthorizationLevel,
        forbiddenMessage: 'Admin access required'
    }
} as const;

/**
 * Default ownership configurations for common entities
 */
export const DEFAULT_OWNERSHIP_CONFIGS: Record<OwnableEntityType, Partial<OwnershipConfig>> = {
    accommodation: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        paramIdField: 'id'
    },
    destination: {
        entityType: 'destination',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    event: {
        entityType: 'event',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    post: {
        entityType: 'post',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    attraction: {
        entityType: 'attraction',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    eventLocation: {
        entityType: 'eventLocation',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    eventOrganizer: {
        entityType: 'eventOrganizer',
        ownershipFields: ['createdById'],
        paramIdField: 'id'
    },
    user: {
        entityType: 'user',
        ownershipFields: ['userId'],
        paramIdField: 'id'
    }
} as const;
