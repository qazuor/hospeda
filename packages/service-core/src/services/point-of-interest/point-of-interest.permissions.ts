import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Permission checks for the Point Of Interest entity (HOS-113 T-014/T-018).
 *
 * DEVIATION FROM ATTRACTION (deliberate, per T-014's note): attraction's
 * permission layer is split-brain — the route layer checks `ATTRACTION_*`
 * while the service layer mostly checks `DESTINATION_*`. POI uses
 * `PermissionEnum.POINT_OF_INTEREST_*` CONSISTENTLY at every hook, including
 * `checkCanAdminList`. Do not reintroduce attraction's inconsistency here.
 */

/**
 * Checks if an actor has permission to view a point of interest.
 * POIs are a public catalog (HOS-113 §6.5 — seed-only, no admin CRUD in
 * Phase 1): viewing never requires a permission, mirroring
 * `checkCanViewAmenity`.
 * @param actor The actor performing the action.
 */
export function checkCanViewPointOfInterest(_actor: Actor): void {
    // Public catalog: no permission required to view.
    return;
}

/**
 * Checks if an actor has permission to list/search/count points of interest.
 * Public catalog — any actor (including anonymous/no-permission actors) can
 * list; results are filtered elsewhere.
 * @param actor The actor performing the action.
 */
export function checkCanListPointsOfInterest(_actor: Actor): void {
    // Public catalog: no permission required to list/search/count.
    return;
}

/**
 * Checks if an actor has permission to create a point of interest.
 * Requires `POINT_OF_INTEREST_CREATE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreatePointOfInterest(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POINT_OF_INTEREST_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to create point of interest'
        );
    }
}

/**
 * Checks if an actor has permission to update a point of interest.
 * Requires `POINT_OF_INTEREST_UPDATE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdatePointOfInterest(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POINT_OF_INTEREST_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to update point of interest'
        );
    }
}

/**
 * Checks if an actor has permission to delete a point of interest.
 * Requires `POINT_OF_INTEREST_DELETE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDeletePointOfInterest(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POINT_OF_INTEREST_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to delete point of interest'
        );
    }
}

/**
 * Checks if an actor has permission to restore a soft-deleted point of interest.
 * Requires `POINT_OF_INTEREST_RESTORE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestorePointOfInterest(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POINT_OF_INTEREST_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to restore point of interest'
        );
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * Requires `POINT_OF_INTEREST_VIEW` (consistent with the rest of this file —
 * NOT `DESTINATION_*`, unlike attraction's `checkCanAdminList`).
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor?.id || !hasPermission(actor, PermissionEnum.POINT_OF_INTEREST_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: POINT_OF_INTEREST_VIEW required for admin list'
        );
    }
}
