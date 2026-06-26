import type { Partner } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create partners.
 * Requires `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create partners'
        );
    }
}

/**
 * Checks if an actor has permission to update partners.
 * Requires `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: Partner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update partners'
        );
    }
}

/**
 * Checks if an actor has permission to soft-delete partners.
 * Requires `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: Partner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete partners'
        );
    }
}

/**
 * Checks if an actor has permission to hard-delete partners.
 * Requires `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: Partner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete partners'
        );
    }
}

/**
 * Checks if an actor has permission to restore partners.
 * Requires `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: Partner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore partners'
        );
    }
}

/**
 * Checks if an actor has permission to view a partner.
 * Requires `PARTNER_VIEW_ALL` or `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Partner): void {
    const hasPermission =
        actor?.id &&
        (actor.permissions.includes(PermissionEnum.PARTNER_VIEW_ALL) ||
            actor.permissions.includes(PermissionEnum.PARTNER_MANAGE));
    if (!hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view partners'
        );
    }
}

/**
 * Checks if an actor has permission to list partners.
 * Requires `PARTNER_VIEW_ALL` or `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    const hasPermission =
        actor?.id &&
        (actor.permissions.includes(PermissionEnum.PARTNER_VIEW_ALL) ||
            actor.permissions.includes(PermissionEnum.PARTNER_MANAGE));
    if (!hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list partners'
        );
    }
}

/**
 * Checks if an actor has permission to search partners.
 * Allows `ACCESS_API_PUBLIC` (unauthenticated), `PARTNER_VIEW_ALL`, or `PARTNER_MANAGE`.
 * Public search endpoint must work without authentication.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    const hasPermission =
        actor?.permissions.includes(PermissionEnum.ACCESS_API_PUBLIC) ||
        (actor?.id &&
            (actor.permissions.includes(PermissionEnum.PARTNER_VIEW_ALL) ||
                actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)));
    if (!hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search partners'
        );
    }
}

/**
 * Checks if an actor has permission to count partners.
 * Requires `PARTNER_VIEW_ALL` or `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    const hasPermission =
        actor?.id &&
        (actor.permissions.includes(PermissionEnum.PARTNER_VIEW_ALL) ||
            actor.permissions.includes(PermissionEnum.PARTNER_MANAGE));
    if (!hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count partners'
        );
    }
}

/**
 * Checks if an actor has permission to use the admin list for partners.
 * Requires `PARTNER_VIEW_ALL` or `PARTNER_MANAGE`.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    const hasPermission =
        actor?.id &&
        (actor.permissions.includes(PermissionEnum.PARTNER_VIEW_ALL) ||
            actor.permissions.includes(PermissionEnum.PARTNER_MANAGE));
    if (!hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions for partner admin list'
        );
    }
}
