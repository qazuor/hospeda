import type { AccommodationCreateInput } from '@repo/schemas';
import { type AccommodationType, PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { checkGenericPermission, hasPermission } from '../../utils';

/**
 * Checks if a given actor is the owner of a resource.
 * This is a generic helper that compares the actor's ID with the resource's `ownerId`.
 * @param actor The actor performing the action.
 * @param entity The resource to check, which must have an `ownerId` property.
 * @returns `true` if the actor is the owner, `false` otherwise.
 */
const isOwner = (actor: Actor, entity: { ownerId?: string | null }) => {
    return entity.ownerId === actor.id;
};

/**
 * Checks if an actor has permission to create an accommodation.
 * Requires the `ACCOMMODATION_CREATE` permission.
 * Ownership checks (`ownerId` matching `actor.id`) are assumed to be handled separately.
 * @param actor The actor performing the action.
 * @param _data The data for the accommodation to be created (unused in this check).
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: AccommodationCreateInput): void {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to create accommodation'
        );
    }
}

/**
 * Checks if an actor has permission to update an accommodation.
 * Requires `ACCOMMODATION_UPDATE_ANY` or `ACCOMMODATION_UPDATE_OWN`.
 * If `_OWN` is used, it verifies that the actor is the owner of the accommodation.
 * @param actor The actor performing the action.
 * @param entity The accommodation entity to be updated.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, entity: AccommodationType): void {
    checkGenericPermission(
        actor,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        isOwner(actor, entity),
        'Permission denied to update accommodation'
    );
}

/**
 * Checks if an actor has permission to soft-delete an accommodation.
 * Requires `ACCOMMODATION_DELETE_ANY` or `ACCOMMODATION_DELETE_OWN`.
 * If `_OWN` is used, it verifies that the actor is the owner of the accommodation.
 * @param actor The actor performing the action.
 * @param entity The accommodation entity to be soft-deleted.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, entity: AccommodationType): void {
    checkGenericPermission(
        actor,
        PermissionEnum.ACCOMMODATION_DELETE_ANY,
        PermissionEnum.ACCOMMODATION_DELETE_OWN,
        isOwner(actor, entity),
        'Permission denied to delete accommodation'
    );
}

/**
 * Checks if an actor has permission to permanently delete an accommodation.
 * This is a sensitive operation and requires the `ACCOMMODATION_HARD_DELETE` permission.
 * There is no `_OWN` equivalent for hard-deletes.
 * @param actor The actor performing the action.
 * @param _entity The accommodation entity to be deleted (unused, for signature consistency).
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: AccommodationType): void {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied to permanently delete accommodation'
        );
    }
}

/**
 * Checks if an actor has permission to restore a soft-deleted accommodation.
 * Requires `ACCOMMODATION_RESTORE_ANY` or `ACCOMMODATION_RESTORE_OWN`.
 * If `_OWN` is used, it verifies that the actor is the owner of the accommodation.
 * @param actor The actor performing the action.
 * @param entity The accommodation entity to be restored.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, entity: AccommodationType): void {
    checkGenericPermission(
        actor,
        PermissionEnum.ACCOMMODATION_RESTORE_ANY,
        PermissionEnum.ACCOMMODATION_RESTORE_OWN,
        isOwner(actor, entity),
        'Permission denied to restore accommodation'
    );
}

/**
 * Checks if an actor has permission to view an accommodation.
 * Public accommodations are always viewable. Private ones require specific permissions.
 * The owner of an accommodation can always view it, regardless of other permissions.
 * @param actor The actor performing the action.
 * @param entity The accommodation entity to be viewed.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, entity: AccommodationType): void {
    if (
        entity.visibility === 'PUBLIC' ||
        (entity.visibility === 'PRIVATE' &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_PRIVATE)) ||
        hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL) ||
        isOwner(actor, entity)
    ) {
        return;
    }

    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to view accommodation');
}

/**
 * Checks if an actor has permission to list accommodations.
 * Currently, any actor can attempt to list accommodations, and the results
 * will be filtered by other mechanisms (e.g., visibility, ownership).
 * This function can be extended to enforce a global listing permission if needed.
 * @param _actor The actor performing the action (currently unused).
 */
export function checkCanList(_actor: Actor): void {
    // For now, we allow anyone to attempt to list. The service will filter results.
    // If a global block is needed, it would be implemented here.
    return;
}
