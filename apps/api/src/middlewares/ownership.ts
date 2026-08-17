/**
 * Ownership Middleware
 * Verifies entity ownership for protected routes
 * Allows owners to access their own entities, admins can bypass with _ANY permissions
 */

import type { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodTypeAny } from 'zod';
import type { OwnableEntityType, OwnershipConfig, OwnershipField } from '../types/authorization';
import { getActorFromContext } from '../utils/actor';
import { apiLogger } from '../utils/logger';

/**
 * Type definition for entity with ownership fields
 */
type OwnableEntity = {
    id: string;
    ownerId?: string | null;
    createdById?: string | null;
    userId?: string | null;
    /** Editorial content (posts, events) is owned by its author, not its creator. */
    authorId?: string | null;
    [key: string]: unknown;
};

/**
 * Entity fetcher function type
 * Services must implement this interface to work with ownership middleware
 */
export type EntityFetcher = (
    actor: Actor,
    entityId: string
) => Promise<{
    data?: OwnableEntity | null;
    error?: { message: string };
}>;

/**
 * Registry of entity fetchers
 * Services register their getById functions here
 */
const entityFetchers: Map<OwnableEntityType, EntityFetcher> = new Map();

/**
 * Register an entity fetcher for ownership verification
 * Call this during app initialization for each entity type
 *
 * @example
 * registerEntityFetcher('accommodation', async (actor, id) => {
 *   return accommodationService.getById(actor, id);
 * });
 */
export const registerEntityFetcher = (
    entityType: OwnableEntityType,
    fetcher: EntityFetcher
): void => {
    entityFetchers.set(entityType, fetcher);
    apiLogger.debug(`Registered entity fetcher for: ${entityType}`);
};

/**
 * Clear all registered entity fetchers (useful for testing)
 */
export const clearEntityFetchers = (): void => {
    entityFetchers.clear();
};

/**
 * List the entity types that currently have a fetcher registered.
 *
 * Exposed so the coverage guard can assert against the real registry rather
 * than parsing the registration source, which would pass on a call that never
 * executes.
 */
export const getRegisteredEntityTypes = (): OwnableEntityType[] => {
    return [...entityFetchers.keys()];
};

/**
 * Shape a path parameter must satisfy when the route declares none.
 *
 * Every `OwnableEntityType` in this repo is keyed by a UUID, so this is the
 * fail-closed default rather than a guess. Written as a literal pattern instead
 * of `z.string().uuid()` so the guarantee does not move when the Zod version
 * does.
 */
const UUID_PATTERN =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Returns true when the raw path parameter satisfies the declared shape.
 *
 * Runs BEFORE the entity fetcher. A parameter that fails here never reaches the
 * database: rejecting it is cheaper than asking Postgres, and asking Postgres
 * is what turned a malformed id into a 500 plus a multi-kilobyte `select` in
 * the production log (H-68).
 */
const isWellFormedEntityId = (entityId: string, idSchema: ZodTypeAny | undefined): boolean => {
    if (idSchema) {
        return idSchema.safeParse(entityId).success;
    }
    return UUID_PATTERN.test(entityId);
};

/**
 * Check if an actor is the owner of an entity
 * Checks multiple ownership fields in order of priority
 */
const checkOwnership = (
    actor: Actor,
    entity: OwnableEntity,
    ownershipFields: OwnershipField[]
): boolean => {
    for (const field of ownershipFields) {
        const ownerValue = entity[field];
        if (ownerValue && ownerValue === actor.id) {
            return true;
        }
    }
    return false;
};

/**
 * Check if actor has a permission that allows bypassing ownership check
 */
const hasPermission = (actor: Actor, permission: PermissionEnum | undefined): boolean => {
    if (!permission) {
        return false;
    }
    if (!actor.permissions || !Array.isArray(actor.permissions)) {
        return false;
    }
    return actor.permissions.includes(permission);
};

/**
 * Creates an ownership verification middleware
 *
 * This middleware:
 * 1. Extracts entityId from route parameters
 * 2. Fetches the entity using the registered fetcher
 * 3. Verifies the actor is the owner OR has bypass permission
 * 4. Sets `entity` and `isOwner` in the context for downstream handlers
 *
 * @param config - Ownership configuration
 * @returns Middleware handler that enforces ownership rules
 *
 * @example
 * // Basic ownership check
 * app.put('/accommodations/:id',
 *   ownershipMiddleware({
 *     entityType: 'accommodation',
 *     ownershipFields: ['ownerId', 'createdById']
 *   }),
 *   updateHandler
 * );
 *
 * @example
 * // With bypass permission for admins
 * app.delete('/accommodations/:id',
 *   ownershipMiddleware({
 *     entityType: 'accommodation',
 *     ownershipFields: ['ownerId', 'createdById'],
 *     bypassPermission: PermissionEnum.ACCOMMODATION_DELETE_ANY
 *   }),
 *   deleteHandler
 * );
 */
export const ownershipMiddleware = (config: OwnershipConfig): MiddlewareHandler => {
    const {
        entityType,
        ownershipFields,
        paramIdField = 'id',
        bypassPermission,
        allowNotFound = false,
        idSchema
    } = config;

    return async (c, next) => {
        const actor = getActorFromContext(c);
        const entityId = c.req.param(paramIdField);

        apiLogger.debug(
            `Ownership check: entityType=${entityType}, entityId=${entityId}, actorId=${actor.id}`
        );

        // Validate entityId is provided
        if (!entityId) {
            apiLogger.warn(`Missing entity ID parameter: ${paramIdField}`);
            throw new HTTPException(400, {
                message: `Missing required parameter: ${paramIdField}`
            });
        }

        // Validate the parameter's SHAPE before anything touches the database.
        // The contract orders the checks auth → permission → shape → existence,
        // and this is the shape step: the route's own `requestParams` validation
        // cannot serve here because the factory runs ownership ahead of it.
        // The message names the parameter, never its value — echoing the input
        // back is how the original 500 leaked the offending id into logs.
        if (!isWellFormedEntityId(entityId, idSchema)) {
            apiLogger.warn(`Malformed entity ID parameter: ${paramIdField} (${entityType})`);
            throw new HTTPException(400, {
                message: `Invalid ${paramIdField} parameter`
            });
        }

        // Get the entity fetcher for this entity type
        const fetcher = entityFetchers.get(entityType);

        if (!fetcher) {
            apiLogger.error(`No entity fetcher registered for: ${entityType}`);
            throw new HTTPException(500, {
                message: 'Internal server error: Entity type not configured'
            });
        }

        // Fetch the entity
        let entity: OwnableEntity | null | undefined;
        try {
            const result = await fetcher(actor, entityId);

            if (result.error) {
                apiLogger.warn(`Error fetching entity: ${result.error.message}`);
                throw new HTTPException(404, {
                    message: `${entityType} not found`
                });
            }

            entity = result.data;
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }
            apiLogger.error(
                `Error fetching entity: ${error instanceof Error ? error.message : String(error)}`
            );
            throw new HTTPException(500, {
                message: 'Internal server error while fetching entity'
            });
        }

        // Handle entity not found
        if (!entity) {
            if (allowNotFound) {
                // Allow the request to continue without entity
                c.set('entity', null);
                c.set('isOwner', false);
                await next();
                return;
            }

            apiLogger.warn(`Entity not found: ${entityType}/${entityId}`);
            throw new HTTPException(404, {
                message: `${entityType} not found`
            });
        }

        // Check if actor has bypass permission
        if (bypassPermission && hasPermission(actor, bypassPermission)) {
            apiLogger.debug(`Actor ${actor.id} has bypass permission: ${bypassPermission}`);
            c.set('entity', entity);
            c.set('isOwner', checkOwnership(actor, entity, ownershipFields));
            await next();
            return;
        }

        // Check ownership
        const isOwner = checkOwnership(actor, entity, ownershipFields);

        if (!isOwner) {
            // The log keeps the distinction; the client does not.
            apiLogger.warn(
                `Ownership denied: Actor ${actor.id} is not owner of ${entityType}/${entityId}`
            );
            // 404, byte-identical to the not-found branch above — NOT 403.
            //
            // A 403 here answered "this id exists and is not yours", which is
            // the difference that told any caller which ids are real (H-72).
            // The repo already settled this in writing for benefit usages
            // (HOS-376: "todo camino ajeno responde 404, nunca 403 — un 403
            // confirmaría que el id existe"), and
            // `accommodation/protected/getById.ts` already complies by doing the
            // owner check in its handler. Posts and events dissented only
            // because they delegate here. Any divergence in status OR message
            // reopens the leak, so this must mirror the 404 above exactly.
            throw new HTTPException(404, {
                message: `${entityType} not found`
            });
        }

        // Store entity and ownership status in context
        c.set('entity', entity);
        c.set('isOwner', isOwner);

        apiLogger.debug(
            `Ownership verified: Actor ${actor.id} is owner of ${entityType}/${entityId}`
        );

        await next();
    };
};

/**
 * Get entity from context (set by ownershipMiddleware)
 */
export const getEntityFromContext = <T extends OwnableEntity>(c: {
    get: (key: string) => unknown;
}): T | null => {
    return c.get('entity') as T | null;
};

/**
 * Check if current actor is owner of the entity in context
 */
export const isOwnerFromContext = (c: { get: (key: string) => unknown }): boolean => {
    return c.get('isOwner') === true;
};

/**
 * Creates an ownership middleware that allows access without requiring ownership
 * Useful for routes that need to load the entity but don't require ownership
 * (e.g., public read routes that want the entity loaded)
 */
export const optionalOwnershipMiddleware = (
    config: Omit<OwnershipConfig, 'bypassPermission'>
): MiddlewareHandler => {
    return async (c, next) => {
        const { entityType, ownershipFields, paramIdField = 'id', allowNotFound = true } = config;

        const actor = getActorFromContext(c);
        const entityId = c.req.param(paramIdField);

        if (!entityId) {
            c.set('entity', null);
            c.set('isOwner', false);
            await next();
            return;
        }

        const fetcher = entityFetchers.get(entityType);

        if (!fetcher) {
            c.set('entity', null);
            c.set('isOwner', false);
            await next();
            return;
        }

        try {
            const result = await fetcher(actor, entityId);

            if (result.error || !result.data) {
                c.set('entity', null);
                c.set('isOwner', false);

                if (!allowNotFound) {
                    throw new HTTPException(404, {
                        message: `${entityType} not found`
                    });
                }

                await next();
                return;
            }

            const entity = result.data;
            const isOwner = checkOwnership(actor, entity, ownershipFields);

            c.set('entity', entity);
            c.set('isOwner', isOwner);
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }
            c.set('entity', null);
            c.set('isOwner', false);
        }

        await next();
    };
};
