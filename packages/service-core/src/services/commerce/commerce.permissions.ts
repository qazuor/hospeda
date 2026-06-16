/**
 * commerce.permissions.ts
 *
 * Generic permission checks for all commerce listing entities (SPEC-239 T-030).
 *
 * Design rules:
 *  - ALL checks use `hasPermission(actor, PermissionEnum.COMMERCE_*)` exclusively.
 *  - NEVER check `actor.role` directly.
 *  - For admin-list, both VIEW_ALL (staff, unscoped) and the entity's VIEW_OWN
 *    permission are accepted; the scoping decision is enforced in `_executeAdminSearch`,
 *    not here.
 *
 * These helpers are consumed by `BaseCommerceListingService` via the abstract
 * permission-set mechanism, and directly by stateless services (commerce-lead,
 * provisioning) for admin-only operations.
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the actor owns the commerce entity.
 *
 * @param actor - The actor performing the action.
 * @param entity - Any entity record that carries an `ownerId` field.
 */
const isOwner = (actor: Actor, entity: { ownerId?: string | null }): boolean =>
    entity.ownerId === actor.id;

// ---------------------------------------------------------------------------
// Commerce listing permission checks
// ---------------------------------------------------------------------------

/**
 * Verifies the actor may create a new commerce listing.
 * Requires `COMMERCE_CREATE`.
 *
 * @param actor - The actor performing the action.
 * @param _data - The creation payload (unused here; accepted for signature consistency).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanCreateCommerce(actor: Actor, _data: unknown): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create commerce listing'
        );
    }
}

/**
 * Verifies the actor may update any commerce listing (admin path).
 * Requires `COMMERCE_EDIT_ALL`.
 *
 * For owner-scoped updates, use {@link checkCanEditOwn} with the appropriate
 * section permission instead.
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being updated (unused; for signature consistency).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanEditAll(actor: Actor, _entity: unknown): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to edit any commerce listing'
        );
    }
}

/**
 * Verifies the actor may perform an operational edit on their own commerce listing.
 *
 * Accepts either `COMMERCE_EDIT_ALL` (staff) or the supplied `ownSectionPermission`
 * (the section-specific `editOwn` permission, e.g. `COMMERCE_SCHEDULE_EDIT_OWN`),
 * provided the actor is the listing's owner.
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must have `ownerId`).
 * @param ownSectionPermission - The granular `editOwn` permission for this section.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    ownSectionPermission: PermissionEnum
): void {
    if (
        hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL) ||
        (hasPermission(actor, ownSectionPermission) && isOwner(actor, entity))
    ) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to edit own commerce listing'
    );
}

/**
 * Verifies the actor may soft-delete a commerce listing.
 * Requires `COMMERCE_DELETE`.
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being deleted (unused; for signature consistency).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanDeleteCommerce(actor: Actor, _entity: unknown): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete commerce listing'
        );
    }
}

/**
 * Verifies the actor may view all commerce listings (including draft/private).
 * Requires `COMMERCE_VIEW_ALL`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanViewAll(actor: Actor): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view all commerce listings'
        );
    }
}

/**
 * Verifies the actor may use the admin-list path for a commerce entity type.
 *
 * Accepts EITHER:
 * - `COMMERCE_VIEW_ALL` — staff: unscoped listing.
 * - A supplied `viewOwnPermission` — owner-scoped listing (the scoping is
 *   enforced in `_executeAdminSearch`, not here).
 *
 * @param actor - The actor performing the action.
 * @param viewOwnPermission - The entity-specific "view own" permission (currently
 *   unused in the schema — stubbed as `COMMERCE_VIEW_ALL` since there is no
 *   per-type COMMERCE_GASTRONOMY_VIEW_OWN yet; kept as a parameter to stay
 *   forward-compatible when sub-type permissions are added).
 * @throws {ServiceError} FORBIDDEN when the actor holds neither permission.
 */
export function checkCanAdminListCommerce(
    actor: Actor,
    viewOwnPermission: PermissionEnum = PermissionEnum.COMMERCE_VIEW_ALL
): void {
    if (
        !hasPermission(actor, PermissionEnum.COMMERCE_VIEW_ALL) &&
        !hasPermission(actor, viewOwnPermission)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: COMMERCE_VIEW_ALL required for commerce admin list'
        );
    }
}

/**
 * Verifies the actor may moderate a review on a commerce listing.
 * Requires `COMMERCE_MODERATE_REVIEW`.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanModerateReview(actor: Actor): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_MODERATE_REVIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate commerce reviews'
        );
    }
}
