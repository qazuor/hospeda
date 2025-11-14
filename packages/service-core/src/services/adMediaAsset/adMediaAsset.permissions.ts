import type { AdMediaAsset } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to update ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to patch ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: AdMediaAsset, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update ad media asset visibility'
        );
    }
}

/**
 * Checks if an actor has permission to delete ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: AdMediaAsset): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to restore ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to view ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to list ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: AdMediaAsset): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to search ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search ad media assets'
        );
    }
}

/**
 * Checks if an actor has permission to count ad media assets.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count ad media assets'
        );
    }
}
