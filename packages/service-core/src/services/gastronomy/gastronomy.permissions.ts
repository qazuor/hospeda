/**
 * gastronomy.permissions.ts
 *
 * Thin gastronomy permission helpers (SPEC-239 T-038).
 *
 * All real logic lives in the generic `commerce.permissions.ts` helpers that
 * consume `PermissionEnum.COMMERCE_*`.  This file re-exports or delegates to
 * those helpers with gastronomy context, keeping the gastronomy service layer
 * consistent with accommodation's pattern while avoiding permission-logic
 * duplication.
 *
 * Design decisions:
 * - NEVER check `actor.role` directly.  Only `PermissionEnum` values.
 * - These helpers are called by GastronomyService permission hooks only.
 * - Owner-scoped update section gates use `checkCanEditOwn` with the relevant
 *   `COMMERCE_*_EDIT_OWN` constant for the section being mutated.
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import {
    checkCanAdminListCommerce,
    checkCanCreateCommerce,
    checkCanDeleteCommerce,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanEditOwnOrAll,
    checkCanModerateReview,
    checkCanViewAll
} from '../commerce/commerce.permissions';

// Re-export generic helpers under gastronomy-scoped names so callers inside
// the gastronomy directory can import from one place.

/**
 * Checks if the actor may create a new gastronomy listing.
 * Delegates to {@link checkCanCreateCommerce} (`COMMERCE_CREATE`).
 *
 * @param actor - The actor performing the action.
 * @param data - Create payload (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_CREATE`.
 */
export function checkGastronomyCanCreate(actor: Actor, data: unknown): void {
    checkCanCreateCommerce(actor, data);
}

/**
 * Checks if the actor may perform a full (admin) update on any gastronomy listing.
 * Delegates to {@link checkCanEditAll} (`COMMERCE_EDIT_ALL`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity being updated.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_EDIT_ALL`.
 */
export function checkGastronomyCanEditAll(actor: Actor, entity: unknown): void {
    checkCanEditAll(actor, entity);
}

/**
 * Checks if the actor may update a gastronomy listing through the base update
 * pipeline (the service `_canUpdate` gate).
 *
 * Delegates to {@link checkCanEditOwnOrAll}: accepts staff (`COMMERCE_EDIT_ALL`)
 * OR the listing owner holding at least one operational `editOwn` permission.
 * Owner edits still flow through `updateOwn`, which enforces per-section gating
 * and an operational-only payload.
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditOwnOrAll(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwnOrAll(actor, entity);
}

/**
 * Checks if the actor may perform an operational (owner-scoped) update on their
 * own gastronomy listing for a given section.
 *
 * Delegates to {@link checkCanEditOwn} which accepts either `COMMERCE_EDIT_ALL`
 * (staff bypass) or the specific `ownSectionPermission` when the actor is the
 * listing owner.
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity being updated (must carry `ownerId`).
 * @param ownSectionPermission - The granular `editOwn` permission for this section.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    ownSectionPermission: PermissionEnum
): void {
    checkCanEditOwn(actor, entity, ownSectionPermission);
}

/**
 * Checks if the actor may soft-delete a gastronomy listing.
 * Delegates to {@link checkCanDeleteCommerce} (`COMMERCE_DELETE`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_DELETE`.
 */
export function checkGastronomyCanDelete(actor: Actor, entity: unknown): void {
    checkCanDeleteCommerce(actor, entity);
}

/**
 * Checks if the actor may view all gastronomy listings (including private/draft).
 * Delegates to {@link checkCanViewAll} (`COMMERCE_VIEW_ALL`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_VIEW_ALL`.
 */
export function checkGastronomyCanViewAll(actor: Actor): void {
    checkCanViewAll(actor);
}

/**
 * Checks if the actor may use the admin-list path for gastronomy listings.
 *
 * Accepts either `COMMERCE_VIEW_ALL` (staff, unscoped) or
 * `COMMERCE_VIEW_ALL` as view-own fallback (forward-compatible; a dedicated
 * `COMMERCE_GASTRONOMY_VIEW_OWN` can be plugged in when added to the enum).
 *
 * Delegates to {@link checkCanAdminListCommerce}.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor holds neither permission.
 */
export function checkGastronomyCanAdminList(actor: Actor): void {
    // Forward-compatible: pass COMMERCE_VIEW_ALL as viewOwnPermission until
    // a per-type COMMERCE_GASTRONOMY_VIEW_OWN enum value is added.
    checkCanAdminListCommerce(actor, PermissionEnum.COMMERCE_VIEW_ALL);
}

/**
 * Checks if the actor may moderate a gastronomy review.
 * Delegates to {@link checkCanModerateReview} (`COMMERCE_MODERATE_REVIEW`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_MODERATE_REVIEW`.
 */
export function checkGastronomyCanModerateReview(actor: Actor): void {
    checkCanModerateReview(actor);
}

/**
 * Checks if the actor may create or edit FAQs on a gastronomy listing they own.
 *
 * Accepts either `COMMERCE_EDIT_ALL` (staff) or `COMMERCE_FAQS_EDIT_OWN`
 * when the actor is the listing owner.
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity whose FAQs are being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditFaqs(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwn(actor, entity, PermissionEnum.COMMERCE_FAQS_EDIT_OWN);
}

/**
 * Checks if the actor may view gastronomy listings (public read).
 *
 * For public/protected read paths, any actor is allowed to attempt to list;
 * the service layer enforces lifecycle+visibility filters on results.
 * This is intentionally permissive — mirror accommodation's `checkCanList` pattern.
 *
 * @param _actor - The actor performing the action (currently unused).
 */
export function checkGastronomyCanView(_actor: Actor): void {
    // Public listings are viewable by all. The service enforces lifecycle/visibility.
    return;
}

/**
 * Checks if the actor may perform a hard-delete on a gastronomy listing.
 * Requires `COMMERCE_DELETE` (no separate hard-delete permission exists yet;
 * follows the same pattern as commerce delete gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being hard-deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_DELETE`.
 */
export function checkGastronomyCanHardDelete(actor: Actor, _entity: unknown): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete gastronomy listing'
        );
    }
}

/**
 * Checks if the actor may restore a soft-deleted gastronomy listing.
 * Requires `COMMERCE_EDIT_ALL` (mirrors commerce restore gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being restored (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_EDIT_ALL`.
 */
export function checkGastronomyCanRestore(actor: Actor, _entity: unknown): void {
    checkCanEditAll(actor, _entity);
}
