import type { Partner } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create partners.
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
 * Checks if an actor has permission to view partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: Partner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view partners'
        );
    }
}

/**
 * Checks if an actor has permission to list partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list partners'
        );
    }
}

/**
 * Checks if an actor has permission to search partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search partners'
        );
    }
}

/**
 * Checks if an actor has permission to count partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count partners'
        );
    }
}

/**
 * Checks if an actor has permission to admin list partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.PARTNER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions for partner admin list'
        );
    }
}
