import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if an actor has permission to view host-trade entries (host-facing read).
 * Requires HOST_TRADE_VIEW — granted to authenticated host-role users.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanViewHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view host trades'
        );
    }
}

/**
 * Checks if an actor has permission to create a host-trade entry.
 * Requires HOST_TRADE_CREATE (admin-only operation).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanCreateHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create host trade'
        );
    }
}

/**
 * Checks if an actor has permission to update a host-trade entry.
 * Requires HOST_TRADE_UPDATE (admin-only operation).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanUpdateHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update host trade'
        );
    }
}

/**
 * Checks if an actor has permission to soft-delete a host-trade entry.
 * Requires HOST_TRADE_DELETE (admin-only operation).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanDeleteHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete host trade'
        );
    }
}

/**
 * Checks if an actor has permission to permanently delete a host-trade entry.
 * Requires HOST_TRADE_HARD_DELETE (admin-only operation).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanHardDeleteHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_HARD_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete host trade'
        );
    }
}

/**
 * Checks if an actor has permission to restore a soft-deleted host-trade entry.
 * Requires HOST_TRADE_RESTORE (admin-only operation).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanRestoreHostTrade(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.HOST_TRADE_RESTORE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore host trade'
        );
    }
}

/**
 * Checks if an actor has permission to view all host-trade entries (admin read).
 * Requires HOST_TRADE_VIEW_ALL — the entity-specific check used in _canAdminList.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export function checkCanAdminListHostTrades(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.HOST_TRADE_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: HOST_TRADE_VIEW_ALL required for admin list'
        );
    }
}

/**
 * Checks if an actor has either HOST_TRADE_VIEW (host-facing) or
 * HOST_TRADE_VIEW_ALL (admin) permission.
 *
 * Used for list / search / count / view base hooks so that both hosts and
 * admins can pass through the base `_canAdminList` → `_canList` chain without
 * requiring them to hold both permissions simultaneously.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the actor has neither permission.
 */
export function checkCanViewOrViewAll(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    }
    if (
        !hasPermission(actor, PermissionEnum.HOST_TRADE_VIEW) &&
        !hasPermission(actor, PermissionEnum.HOST_TRADE_VIEW_ALL)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view host trades'
        );
    }
}
