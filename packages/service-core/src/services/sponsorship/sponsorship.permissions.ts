import type { Sponsorship, SponsorshipCreateInput } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { checkGenericPermission, hasPermission } from '../../utils';

/**
 * Checks if a given actor is the sponsor (owner) of a sponsorship.
 * Compares the actor's ID with the sponsorship's `sponsorUserId` field.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity, which must have a `sponsorUserId` property.
 * @returns `true` if the actor is the sponsor, `false` otherwise.
 */
const isSponsor = (actor: Actor, entity: { sponsorUserId?: string | null }): boolean => {
    return entity.sponsorUserId === actor.id;
};

/**
 * Checks if an actor has permission to create a sponsorship.
 * Requires the `SPONSORSHIP_CREATE` permission.
 *
 * @param actor - The actor performing the action.
 * @param _data - The data for the sponsorship to be created (unused in this check).
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: SponsorshipCreateInput): void {
    if (!hasPermission(actor, PermissionEnum.SPONSORSHIP_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create sponsorship'
        );
    }
}

/**
 * Checks if an actor has permission to update a sponsorship.
 * Requires `SPONSORSHIP_UPDATE_ANY` for admin-level access, or
 * `SPONSORSHIP_UPDATE_OWN` when the actor is the sponsorship's sponsor.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity to be updated.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_UPDATE_ANY,
        PermissionEnum.SPONSORSHIP_UPDATE_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to update sponsorship'
    );
}

/**
 * Checks if an actor has permission to soft-delete a sponsorship.
 * Requires `SPONSORSHIP_SOFT_DELETE_ANY` for admin-level access, or
 * `SPONSORSHIP_SOFT_DELETE_OWN` when the actor is the sponsorship's sponsor.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity to be soft-deleted.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_ANY,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to delete sponsorship'
    );
}

/**
 * Checks if an actor has permission to permanently delete a sponsorship.
 * Requires `SPONSORSHIP_HARD_DELETE_ANY` for admin-level access, or
 * `SPONSORSHIP_HARD_DELETE_OWN` when the actor is the sponsorship's sponsor.
 * This is a sensitive operation; ownership-scoped hard delete is supported
 * but should be restricted in practice via role configuration.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity to be permanently deleted.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_HARD_DELETE_ANY,
        PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to permanently delete sponsorship'
    );
}

/**
 * Checks if an actor has permission to restore a soft-deleted sponsorship.
 * Requires `SPONSORSHIP_RESTORE_ANY` for admin-level access, or
 * `SPONSORSHIP_RESTORE_OWN` when the actor is the sponsorship's sponsor.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity to be restored.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_RESTORE_ANY,
        PermissionEnum.SPONSORSHIP_RESTORE_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to restore sponsorship'
    );
}

/**
 * Checks if an actor has permission to view a sponsorship.
 * Requires `SPONSORSHIP_VIEW_ANY` for admin-level access, or
 * `SPONSORSHIP_VIEW_OWN` when the actor is the sponsorship's sponsor.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity to be viewed.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_VIEW_ANY,
        PermissionEnum.SPONSORSHIP_VIEW_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to view sponsorship'
    );
}

/**
 * Checks if an actor has permission to list sponsorships.
 * Requires either `SPONSORSHIP_VIEW_ANY` (for viewing any sponsorship) or
 * `SPONSORSHIP_VIEW_OWN` (for viewing own sponsorships in a list context).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    const canList =
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_ANY) ||
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_OWN);
    if (!canList) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to search sponsorships.
 * Requires either `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    const canSearch =
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_ANY) ||
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_OWN);
    if (!canSearch) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to count sponsorships.
 * Requires either `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    const canCount =
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_ANY) ||
        hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_OWN);
    if (!canCount) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count sponsorships'
        );
    }
}

/**
 * Checks if an actor has permission to update the visibility of a sponsorship.
 * Requires `SPONSORSHIP_UPDATE_VISIBILITY_ANY` for admin-level access, or
 * `SPONSORSHIP_UPDATE_VISIBILITY_OWN` when the actor is the sponsorship's sponsor.
 *
 * @param actor - The actor performing the action.
 * @param entity - The sponsorship entity whose visibility is being updated.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, entity: Sponsorship): void {
    checkGenericPermission(
        actor,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_ANY,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN,
        isSponsor(actor, entity),
        'Permission denied: Insufficient permissions to update sponsorship visibility'
    );
}

/**
 * Checks if the actor has permission to use admin list for sponsorships.
 * Requires SPONSORSHIP_VIEW_ANY permission in addition to admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks SPONSORSHIP_VIEW_ANY permission.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!hasPermission(actor, PermissionEnum.SPONSORSHIP_VIEW_ANY)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SPONSORSHIP_VIEW_ANY required for admin list'
        );
    }
}
