import type { Campaign } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to update campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to patch campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: Campaign, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update campaign visibility'
        );
    }
}

/**
 * Checks if an actor has permission to delete campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to restore campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to view campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to list campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: Campaign): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to search campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search campaigns'
        );
    }
}

/**
 * Checks if an actor has permission to count campaigns.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count campaigns'
        );
    }
}
