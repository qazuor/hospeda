/**
 * Entity-specific permission validation for admin media routes.
 *
 * Defense in depth: on top of the route-level `MEDIA_UPLOAD` / `MEDIA_DELETE`
 * gate, we require the actor to ALSO have the update permission of the target
 * entity. Modifying media of an entity is a form of updating it, so the
 * relevant permission is `*_UPDATE*`, not `*_DELETE*`.
 *
 * Accommodation permissions split into OWN / ANY variants. For OWN, ownership
 * is verified against the entity's `ownerId`. Other entities have a single
 * flat UPDATE permission and no ownership check.
 */
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

export type MediaEntityType = 'accommodation' | 'destination' | 'event' | 'post';

/**
 * Maps each entity type to the set of permissions that allow modifying its media.
 * An actor is permitted if they hold ANY of the listed permissions.
 */
const ENTITY_UPDATE_PERMISSIONS: Record<MediaEntityType, readonly PermissionEnum[]> = {
    accommodation: [
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY
    ],
    destination: [PermissionEnum.DESTINATION_UPDATE],
    event: [PermissionEnum.EVENT_UPDATE],
    post: [PermissionEnum.POST_UPDATE]
};

/**
 * Entity types whose update permission splits into OWN / ANY variants.
 * For these, when the actor only has the OWN variant, ownership must be verified.
 */
const OWN_ANY_ENTITIES: ReadonlySet<MediaEntityType> = new Set(['accommodation']);

type EntityWithOwner = { ownerId?: string | null };

type PermissionCheckResult =
    | { allowed: true }
    | { allowed: false; reason: 'MISSING_ENTITY_PERMISSION' | 'NOT_ENTITY_OWNER' };

/**
 * Validates that the actor is allowed to modify media of the given entity.
 *
 * @param actor    The authenticated actor making the request.
 * @param entityType The target entity type (accommodation, destination, event, post).
 * @param entity   The fetched entity, used for ownership checks on OWN-variant permissions.
 *                 Pass `null` when ownership check is not applicable (entity does not split OWN/ANY).
 * @returns `{ allowed: true }` on success, `{ allowed: false, reason }` on failure.
 */
export const validateEntityMediaPermission = ({
    actor,
    entityType,
    entity
}: {
    actor: Actor;
    entityType: MediaEntityType;
    entity: EntityWithOwner | null;
}): PermissionCheckResult => {
    const allowedPermissions = ENTITY_UPDATE_PERMISSIONS[entityType];
    const hasAny = allowedPermissions.some((perm) => actor.permissions.includes(perm));

    if (!hasAny) {
        return { allowed: false, reason: 'MISSING_ENTITY_PERMISSION' };
    }

    if (!OWN_ANY_ENTITIES.has(entityType)) {
        return { allowed: true };
    }

    // For OWN/ANY entities: if actor has ANY variant, skip ownership check.
    const anyPermission =
        entityType === 'accommodation' ? PermissionEnum.ACCOMMODATION_UPDATE_ANY : null;

    if (anyPermission && actor.permissions.includes(anyPermission)) {
        return { allowed: true };
    }

    // Actor only has OWN variant: verify ownership.
    if (!entity || entity.ownerId !== actor.id) {
        return { allowed: false, reason: 'NOT_ENTITY_OWNER' };
    }

    return { allowed: true };
};
