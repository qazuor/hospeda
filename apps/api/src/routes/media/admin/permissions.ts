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

export type MediaEntityType =
    | 'accommodation'
    | 'destination'
    | 'event'
    | 'post'
    | 'gastronomy'
    | 'experience'
    | 'postSponsor'
    | 'eventOrganizer';

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
    post: [PermissionEnum.POST_UPDATE],
    gastronomy: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL],
    experience: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL],
    postSponsor: [PermissionEnum.POST_SPONSOR_UPDATE],
    eventOrganizer: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
};

/**
 * Entity types whose update permission splits into OWN / ANY variants.
 * For these, when the actor only has the OWN variant, ownership must be verified.
 */
const OWN_ANY_ENTITIES: ReadonlySet<MediaEntityType> = new Set([
    'accommodation',
    'gastronomy',
    'experience'
]);

/**
 * Entity types that express belonging through `authorId` rather than `ownerId`.
 *
 * These have a single flat UPDATE permission, so staff pass on the permission
 * check alone (unchanged behavior). The author fallback below is what lets a
 * non-staff author manage media on their own content from the protected route,
 * where no `ownerId` exists to compare against.
 */
const AUTHOR_OWNED_ENTITIES: ReadonlySet<MediaEntityType> = new Set(['post', 'event']);

type EntityWithOwner = { ownerId?: string | null; authorId?: string | null };

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
        // An author managing media on their own post/event is allowed without
        // holding the flat editorial UPDATE permission. Staff never reach this
        // branch — they satisfy `hasAny` above — so admin behavior is unchanged.
        if (
            AUTHOR_OWNED_ENTITIES.has(entityType) &&
            entity?.authorId &&
            entity.authorId === actor.id
        ) {
            return { allowed: true };
        }
        return { allowed: false, reason: 'MISSING_ENTITY_PERMISSION' };
    }

    if (!OWN_ANY_ENTITIES.has(entityType)) {
        return { allowed: true };
    }

    // For OWN/ANY entities: if actor has ANY variant, skip ownership check.
    const anyPermission =
        entityType === 'accommodation'
            ? PermissionEnum.ACCOMMODATION_UPDATE_ANY
            : entityType === 'gastronomy' || entityType === 'experience'
              ? PermissionEnum.COMMERCE_EDIT_ALL
              : null;

    if (anyPermission && actor.permissions.includes(anyPermission)) {
        return { allowed: true };
    }

    // Actor only has OWN variant: verify ownership.
    if (!entity || entity.ownerId !== actor.id) {
        return { allowed: false, reason: 'NOT_ENTITY_OWNER' };
    }

    return { allowed: true };
};
