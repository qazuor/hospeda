import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Permission checks shared by the provider-trade catalog services
 * (`HostTradeCategoryGroupService` and `HostTradeCategoryService`, HOS-919).
 *
 * Both entities use the same `HOST_TRADE_CATEGORY_*` family: the group is only
 * a heading for the categories, so minting a second family would add roles to
 * maintain with no real distinction. Mirrors `poi-category.permissions.ts`.
 * Only {@link PermissionEnum} is consulted, never a role.
 *
 * There is no hard-delete permission: the catalog is soft-delete only, and the
 * `r_host_trade_category` FK is `RESTRICT`, so the services refuse hard deletes
 * through {@link checkCanHardDeleteHostTradeCatalog}.
 */

/**
 * Asserts that the actor holds one catalog permission.
 *
 * @param actor - The actor performing the action.
 * @param permission - The permission required.
 * @param verb - Human text for the refusal message.
 * @throws {ServiceError} FORBIDDEN when there is no actor or the permission is missing.
 */
function assertCatalogPermission(actor: Actor, permission: PermissionEnum, verb: string): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    if (!hasPermission(actor, permission)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `FORBIDDEN: Permission denied to ${verb} provider trade catalog`
        );
    }
}

/**
 * Checks the actor may view, list, search or count catalog rows in the admin
 * panel. Requires `HOST_TRADE_CATEGORY_VIEW`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanViewHostTradeCatalog(actor: Actor): void {
    assertCatalogPermission(actor, PermissionEnum.HOST_TRADE_CATEGORY_VIEW, 'view');
}

/**
 * Checks the actor may create catalog rows. Requires `HOST_TRADE_CATEGORY_CREATE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanCreateHostTradeCatalog(actor: Actor): void {
    assertCatalogPermission(actor, PermissionEnum.HOST_TRADE_CATEGORY_CREATE, 'create');
}

/**
 * Checks the actor may update (including deactivate) catalog rows. Requires
 * `HOST_TRADE_CATEGORY_UPDATE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanUpdateHostTradeCatalog(actor: Actor): void {
    assertCatalogPermission(actor, PermissionEnum.HOST_TRADE_CATEGORY_UPDATE, 'update');
}

/**
 * Checks the actor may soft-delete catalog rows. Requires
 * `HOST_TRADE_CATEGORY_DELETE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanDeleteHostTradeCatalog(actor: Actor): void {
    assertCatalogPermission(actor, PermissionEnum.HOST_TRADE_CATEGORY_DELETE, 'delete');
}

/**
 * Checks the actor may restore soft-deleted catalog rows. Requires
 * `HOST_TRADE_CATEGORY_RESTORE`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if the check fails.
 */
export function checkCanRestoreHostTradeCatalog(actor: Actor): void {
    assertCatalogPermission(actor, PermissionEnum.HOST_TRADE_CATEGORY_RESTORE, 'restore');
}

/**
 * Refuses hard deletes of catalog rows for every actor: the catalog is
 * soft-delete only (a hard delete would free the slug reservation and is
 * blocked by the join FK anyway).
 *
 * @param _actor - The actor performing the action (unused: nobody may).
 * @throws {ServiceError} Always FORBIDDEN.
 */
export function checkCanHardDeleteHostTradeCatalog(_actor: Actor): void {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'FORBIDDEN: provider trade catalog rows cannot be hard deleted'
    );
}
