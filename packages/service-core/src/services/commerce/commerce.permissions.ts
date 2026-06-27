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
 * Accepts either `COMMERCE_EDIT_ALL` (staff) or `COMMERCE_EDIT_OWN` (owner),
 * provided the actor is the listing's owner. The `ownSectionPermission` parameter
 * is kept for call-site compatibility but is ignored — all owner sections now
 * collapse to the single `COMMERCE_EDIT_OWN` permission (SPEC-253 D2=b).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must have `ownerId`).
 * @param _ownSectionPermission - Ignored (kept for call-site compatibility, SPEC-253).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    _ownSectionPermission?: PermissionEnum
): void {
    if (
        hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL) ||
        (hasPermission(actor, PermissionEnum.COMMERCE_EDIT_OWN) && isOwner(actor, entity))
    ) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to edit own commerce listing'
    );
}

/**
 * Verifies the actor may update a commerce listing through the base update pipeline
 * (`_canUpdate`). Accepts staff (`COMMERCE_EDIT_ALL`) OR the listing's owner holding
 * `COMMERCE_EDIT_OWN` (SPEC-253 D2=b: replaces the former 10 per-section perms).
 *
 * This is the owner-aware analogue of {@link checkCanEditAll}, mirroring how
 * `AccommodationService` accepts `UPDATE_ANY` OR (`UPDATE_OWN` + owner). Owner edits
 * additionally flow through `updateOwn`, which validates the payload to operational
 * fields only — so a passing owner can still only persist operational changes,
 * never identity/lifecycle/visibility fields.
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwnOrAll(actor: Actor, entity: { ownerId?: string | null }): void {
    if (hasPermission(actor, PermissionEnum.COMMERCE_EDIT_ALL)) {
        return;
    }
    if (isOwner(actor, entity) && hasPermission(actor, PermissionEnum.COMMERCE_EDIT_OWN)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to update commerce listing'
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
