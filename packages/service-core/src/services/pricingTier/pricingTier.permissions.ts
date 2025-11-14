import type { PricingTier } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.PRICING_TIER_CREATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or users with PRICING_TIER_CREATE can create pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to update.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: PricingTier): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.PRICING_TIER_UPDATE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can update pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to softdelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: PricingTier): void {
    const isAdmin = actor.role === RoleEnum.ADMIN;
    const hasPermission = actor.permissions.includes(PermissionEnum.PRICING_TIER_DELETE);

    if (!isAdmin && !hasPermission) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins or authorized users can soft delete pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to harddelete.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: PricingTier): void {
    if (actor.role !== RoleEnum.SUPER_ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only super admins can permanently delete pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to restore.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: PricingTier): void {
    if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Only admins can restore pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to view.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: PricingTier): void {
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Authentication required to view pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to list.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Authentication required to list pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to search.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Authentication required to search pricing tiers'
        );
    }
}

/**
 * Checks if an actor has permission to count.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Authentication required to count pricing tiers'
        );
    }
}
