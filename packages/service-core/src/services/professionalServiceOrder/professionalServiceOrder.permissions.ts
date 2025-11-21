import type { Actor } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types/index.js';

/**
 * Professional Service Order Permissions
 *
 * Permission check functions for professional service order operations.
 * IMPORTANT: Uses ONLY granular permissions (PermissionEnum), NEVER role checks.
 *
 * Following the CORRECT pattern from CLAUDE.md:
 * ✅ CORRECT: Check ONLY actor.permissions.includes(PermissionEnum.X)
 * ❌ WRONG: Check actor.role !== RoleEnum.X
 * ❌ WRONG: Use role as bypass (actor.role === ADMIN || permissions.includes(X))
 */

/**
 * Check if actor can create professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for creating a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to create professional service orders'
        );
    }
}

/**
 * Check if actor can update professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for updating a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanUpdate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to update professional service orders'
        );
    }
}

/**
 * Check if actor can patch (partial update) professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for patching a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanPatch(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to patch professional service orders'
        );
    }
}

/**
 * Check if actor can delete (soft delete) professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for deleting a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanDelete(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to delete professional service orders'
        );
    }
}

/**
 * Check if actor can soft delete professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for soft deleting a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanSoftDelete(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to soft delete professional service orders'
        );
    }
}

/**
 * Check if actor can hard delete (permanently delete) professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for hard deleting a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanHardDelete(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to permanently delete professional service orders'
        );
    }
}

/**
 * Check if actor can restore soft-deleted professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for restoring a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanRestore(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to restore professional service orders'
        );
    }
}

/**
 * Check if actor can view professional service orders
 *
 * @param actor - The actor performing the action
 * @param _data - The data for viewing a service order (not used in permission check)
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanView(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to view professional service orders'
        );
    }
}

/**
 * Check if actor can list professional service orders
 *
 * @param actor - The actor performing the action
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to list professional service orders'
        );
    }
}

/**
 * Check if actor can search professional service orders
 *
 * @param actor - The actor performing the action
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to search professional service orders'
        );
    }
}

/**
 * Check if actor can count professional service orders
 *
 * @param actor - The actor performing the action
 * @throws ServiceError with FORBIDDEN code if actor lacks permission
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SERVICE_ORDER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to count professional service orders'
        );
    }
}
