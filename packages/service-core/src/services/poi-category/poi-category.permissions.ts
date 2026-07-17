import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Permission checks for the POI category catalog + POI assignment
 * (HOS-139 spec §7.3).
 *
 * Mirrors `point-of-interest.permissions.ts`'s consistent-permission-enum
 * shape: every hook checks `PermissionEnum.POI_CATEGORY_*`, including
 * `checkCanAdminList` — unlike `points_of_interest` (a seed-only, no-permission
 * public catalog in Phase 1), `poi_categories` is an admin-editable catalog
 * from day one (spec §6.1), so read access is permission-gated like the
 * standard 12-method shape documented in `packages/service-core/CLAUDE.md`.
 *
 * The relation-management methods (`assignCategoryToPointOfInterest`,
 * `unassignCategoryFromPointOfInterest`, `setPrimaryCategory`) reuse these
 * same permissions rather than minting a dedicated "manage assignment"
 * permission — create≈assign, delete≈unassign, update≈set-primary (spec
 * §7.3), consistent with how `PointOfInterestService` reuses
 * `checkCanCreatePointOfInterest` for `_canAddPointOfInterestToDestination`.
 */

/**
 * Checks if an actor has permission to view a POI category.
 * Requires `POI_CATEGORY_VIEW`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanViewPoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to view POI category'
        );
    }
}

/**
 * Checks if an actor has permission to list/search/count POI categories.
 * Requires `POI_CATEGORY_VIEW`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanListPoiCategories(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to list POI categories'
        );
    }
}

/**
 * Checks if an actor can list the PUBLIC POI category catalog (HOS-147).
 *
 * Public read: ANY actor (guest included) may list the catalog, mirroring the
 * amenity/feature public-catalog convention (`checkCanListAmenities` — "results
 * are filtered elsewhere"). The service filters to ACTIVE, non-deleted rows.
 * This deliberately does NOT require `POI_CATEGORY_VIEW`: that gate still guards
 * the ADMIN catalog (`checkCanAdminList`/`checkCanListPoiCategories`), which is
 * unchanged. Opening this narrow public read is what backs the thematic
 * filter-chip UI (`GET /api/v1/public/poi-categories`).
 * @param actor The actor performing the action.
 * @throws {ServiceError} If no actor is present.
 */
export function checkCanListPublicPoiCategories(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
}

/**
 * Checks if an actor has permission to create a POI category (or assign an
 * existing category to a point of interest — spec §7.3).
 * Requires `POI_CATEGORY_CREATE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreatePoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to create POI category'
        );
    }
}

/**
 * Checks if an actor has permission to update a POI category (or set a
 * point of interest's primary category — spec §7.3).
 * Requires `POI_CATEGORY_UPDATE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdatePoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to update POI category'
        );
    }
}

/**
 * Checks if an actor has permission to delete a POI category (or unassign a
 * category from a point of interest — spec §7.3).
 * Requires `POI_CATEGORY_DELETE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDeletePoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to delete POI category'
        );
    }
}

/**
 * Checks if an actor has permission to restore a soft-deleted POI category.
 * Requires `POI_CATEGORY_RESTORE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestorePoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to restore POI category'
        );
    }
}

/**
 * Checks if an actor has permission to permanently delete a POI category.
 * Requires `POI_CATEGORY_HARD_DELETE`.
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDeletePoiCategory(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, PermissionEnum.POI_CATEGORY_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'FORBIDDEN: Permission denied to permanently delete POI category'
        );
    }
}

/**
 * Checks if an actor has permission to admin-list this entity type.
 * Requires `POI_CATEGORY_VIEW` (consistent with the rest of this file).
 * @param actor The actor performing the action.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor?.id || !hasPermission(actor, PermissionEnum.POI_CATEGORY_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: POI_CATEGORY_VIEW required for admin list'
        );
    }
}
