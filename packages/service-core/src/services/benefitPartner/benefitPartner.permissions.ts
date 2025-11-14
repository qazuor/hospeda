import type { BenefitPartner } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to update benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: BenefitPartner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to patch benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: BenefitPartner, _data: unknown): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to delete benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: BenefitPartner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: BenefitPartner): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to restore benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: BenefitPartner): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to view benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: BenefitPartner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to list benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: BenefitPartner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to search benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to count benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count benefit partners'
        );
    }
}

/**
 * Checks if an actor has permission to update visibility of benefit partners.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdateVisibility(actor: Actor, _entity: BenefitPartner): void {
    if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.BENEFIT_PARTNER_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update benefit partner visibility'
        );
    }
}
