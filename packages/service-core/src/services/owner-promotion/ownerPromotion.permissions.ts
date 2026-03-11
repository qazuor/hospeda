import type { OwnerPromotion, OwnerPromotionCreateInput } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { checkGenericPermission, hasPermission } from '../../utils';

/**
 * Checks if a given actor is the owner of an OwnerPromotion resource.
 * @param actor - The actor performing the action.
 * @param entity - The entity to check ownership on (requires `ownerId` property).
 * @returns `true` if the actor is the owner, `false` otherwise.
 */
const isOwner = (actor: Actor, entity: { ownerId?: string | null }): boolean => {
    return entity.ownerId === actor.id;
};

/**
 * Checks if an actor has permission to create an owner promotion.
 * Requires the `OWNER_PROMOTION_CREATE` permission.
 *
 * @param actor - The actor performing the action.
 * @param _data - The creation input data (unused in this check).
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanCreate(actor: Actor, _data: OwnerPromotionCreateInput): void {
    if (!hasPermission(actor, PermissionEnum.OWNER_PROMOTION_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create owner promotion'
        );
    }
}

/**
 * Checks if an actor has permission to update an owner promotion.
 * Requires `OWNER_PROMOTION_UPDATE_ANY` or `OWNER_PROMOTION_UPDATE_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity to be updated.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanUpdate(actor: Actor, entity: OwnerPromotion): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_UPDATE_ANY,
        PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to update owner promotion'
    );
}

/**
 * Checks if an actor has permission to soft-delete an owner promotion.
 * Requires `OWNER_PROMOTION_SOFT_DELETE_ANY` or `OWNER_PROMOTION_SOFT_DELETE_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity to be soft-deleted.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanSoftDelete(actor: Actor, entity: OwnerPromotion): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_ANY,
        PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to delete owner promotion'
    );
}

/**
 * Checks if an actor has permission to permanently delete an owner promotion.
 * Requires `OWNER_PROMOTION_HARD_DELETE_ANY` or `OWNER_PROMOTION_HARD_DELETE_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity to be permanently deleted.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanHardDelete(actor: Actor, entity: OwnerPromotion): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_HARD_DELETE_ANY,
        PermissionEnum.OWNER_PROMOTION_HARD_DELETE_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to permanently delete owner promotion'
    );
}

/**
 * Checks if an actor has permission to restore a soft-deleted owner promotion.
 * Requires `OWNER_PROMOTION_RESTORE_ANY` or `OWNER_PROMOTION_RESTORE_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity to be restored.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanRestore(actor: Actor, entity: OwnerPromotion): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_RESTORE_ANY,
        PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to restore owner promotion'
    );
}

/**
 * Checks if an actor has permission to view an owner promotion.
 * Requires `OWNER_PROMOTION_VIEW_ANY` or `OWNER_PROMOTION_VIEW_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity to be viewed.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanView(actor: Actor, entity: OwnerPromotion): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_VIEW_ANY,
        PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to view owner promotion'
    );
}

/**
 * Checks if an actor has permission to list owner promotions.
 * Requires either `OWNER_PROMOTION_VIEW_ANY` or `OWNER_PROMOTION_VIEW_OWN`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanList(actor: Actor): void {
    if (
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_ANY) &&
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_OWN)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list owner promotions'
        );
    }
}

/**
 * Checks if an actor has permission to search owner promotions.
 * Requires either `OWNER_PROMOTION_VIEW_ANY` or `OWNER_PROMOTION_VIEW_OWN`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanSearch(actor: Actor): void {
    if (
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_ANY) &&
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_OWN)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search owner promotions'
        );
    }
}

/**
 * Checks if an actor has permission to count owner promotions.
 * Requires either `OWNER_PROMOTION_VIEW_ANY` or `OWNER_PROMOTION_VIEW_OWN`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanCount(actor: Actor): void {
    if (
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_ANY) &&
        !hasPermission(actor, PermissionEnum.OWNER_PROMOTION_VIEW_OWN)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count owner promotions'
        );
    }
}

/**
 * Checks if an actor has permission to update the visibility of an owner promotion.
 * Requires `OWNER_PROMOTION_UPDATE_VISIBILITY_ANY` or `OWNER_PROMOTION_UPDATE_VISIBILITY_OWN`.
 * If `_OWN` is used, verifies the actor is the owner of the promotion.
 *
 * @param actor - The actor performing the action.
 * @param entity - The owner promotion entity whose visibility is to be updated.
 * @param _newVisibility - The new visibility value (unused in this check).
 * @throws {ServiceError} With `FORBIDDEN` code if permission is denied.
 */
export function checkCanUpdateVisibility(
    actor: Actor,
    entity: OwnerPromotion,
    _newVisibility: unknown
): void {
    checkGenericPermission(
        actor,
        PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_ANY,
        PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN,
        isOwner(actor, entity),
        'Permission denied: Insufficient permissions to update owner promotion visibility'
    );
}
