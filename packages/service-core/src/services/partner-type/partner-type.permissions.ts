import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Permission checks for the partner type catalog (`PartnerTypeService`,
 * HOS-2336). Only {@link PermissionEnum} is consulted, never a role. Mirrors
 * `host-trade-category.permissions.ts`.
 *
 * There is no hard-delete permission: the catalog is soft-delete only, and the
 * `partners.type_id` FK is `RESTRICT`, so the service refuses hard deletes
 * through {@link checkCanHardDeletePartnerType}.
 */

/**
 * Asserts that the actor holds one partner type permission.
 *
 * @param actor - The actor performing the action.
 * @param permission - The permission required.
 * @param verb - Human text for the refusal message.
 * @throws {ServiceError} FORBIDDEN when there is no actor or the permission is missing.
 */
function assertPartnerTypePermission(actor: Actor, permission: PermissionEnum, verb: string): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, permission)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `FORBIDDEN: Permission denied to ${verb} partner types`
        );
    }
}

/**
 * Checks the actor may view, list, search or count partner types in the admin
 * panel. Requires `PARTNER_TYPE_VIEW`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanViewPartnerType(actor: Actor): void {
    assertPartnerTypePermission(actor, PermissionEnum.PARTNER_TYPE_VIEW, 'view');
}

/**
 * Checks the actor may create partner types. Requires `PARTNER_TYPE_CREATE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanCreatePartnerType(actor: Actor): void {
    assertPartnerTypePermission(actor, PermissionEnum.PARTNER_TYPE_CREATE, 'create');
}

/**
 * Checks the actor may update (including deactivate) partner types. Requires
 * `PARTNER_TYPE_UPDATE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanUpdatePartnerType(actor: Actor): void {
    assertPartnerTypePermission(actor, PermissionEnum.PARTNER_TYPE_UPDATE, 'update');
}

/**
 * Checks the actor may soft-delete partner types. Requires `PARTNER_TYPE_DELETE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanDeletePartnerType(actor: Actor): void {
    assertPartnerTypePermission(actor, PermissionEnum.PARTNER_TYPE_DELETE, 'delete');
}

/**
 * Checks the actor may restore soft-deleted partner types. Requires
 * `PARTNER_TYPE_RESTORE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanRestorePartnerType(actor: Actor): void {
    assertPartnerTypePermission(actor, PermissionEnum.PARTNER_TYPE_RESTORE, 'restore');
}

/**
 * Refuses hard deletes of partner types for every actor: the catalog is
 * soft-delete only (a hard delete would free the slug reservation and is
 * blocked by the `partners.type_id` FK anyway).
 *
 * @param _actor - The actor performing the action (unused: nobody may).
 * @throws {ServiceError} Always FORBIDDEN.
 */
export function checkCanHardDeletePartnerType(_actor: Actor): void {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'FORBIDDEN: partner types cannot be hard deleted'
    );
}
