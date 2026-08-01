import type { Attraction } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Whether the actor holds one of the privileged attraction-viewing permissions.
 * Attractions reuse the destination permission set — they have no dedicated one.
 */
function canViewNonPublicAttractions(actor: Actor): boolean {
    return (
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_PRIVATE) ||
        hasPermission(actor, PermissionEnum.DESTINATION_VIEW_DRAFT)
    );
}

/**
 * Checks if an actor has permission to view an attraction.
 *
 * ACTIVE attractions are public content: anyone may view them, signed in or not.
 * Any other lifecycle state (DRAFT, INACTIVE, ARCHIVED) is not published yet or
 * no longer published, so it requires a privileged viewer.
 *
 * Attractions have no `visibility` column — `lifecycleState` is the only
 * publication signal, so it stands in for the PUBLIC/PRIVATE split that
 * {@link checkCanViewPost} and {@link checkCanViewEvent} gate on.
 *
 * Soft-deleted attractions existed but are permanently gone: the base model's
 * read path does not filter `deleted_at IS NULL`, so it is enforced here to stop
 * ghost rows leaking a 200. One that was ACTIVE (and therefore indexable)
 * surfaces as GONE so crawlers deindex the URL fast; one that was never public
 * returns NOT_FOUND to preserve the anti-enumeration contract (SPEC-092 T-087),
 * matching the post and event precedent (HOS-117 T-022).
 *
 * @param actor The actor performing the action.
 * @param attraction The attraction being viewed.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanViewAttraction(actor: Actor, attraction: Attraction): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');

    const isPublished = attraction.lifecycleState === LifecycleStatusEnum.ACTIVE;
    const isPrivileged = canViewNonPublicAttractions(actor);

    if (attraction.deletedAt !== null && attraction.deletedAt !== undefined && !isPrivileged) {
        throw isPublished
            ? new ServiceError(ServiceErrorCode.GONE, 'Attraction is gone')
            : new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
    }

    if (isPublished || isPrivileged) return;

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'FORBIDDEN: Permission denied to view attraction'
    );
}

/**
 * Checks if an actor has permission to list/search/count attractions.
 * Currently, any actor can attempt to list attractions; results are filtered elsewhere.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanListAttractions(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Listing is allowed for any actor; results are filtered elsewhere.
    return;
}

/**
 * Checks if an actor has permission to create an attraction.
 * Requires the DESTINATION_CREATE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreateAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to create attraction'
        );
    }
}

/**
 * Checks if an actor has permission to update an attraction.
 * Requires DESTINATION_UPDATE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to update attraction'
        );
    }
}

/**
 * Checks if an actor has permission to delete an attraction.
 * Requires DESTINATION_DELETE permission.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDeleteAttraction(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.DESTINATION_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to delete attraction'
        );
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.ATTRACTION_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ATTRACTION_VIEW required for admin list'
        );
    }
}
