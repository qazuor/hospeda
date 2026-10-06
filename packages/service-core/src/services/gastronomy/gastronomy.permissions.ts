/**
 * gastronomy.permissions.ts
 *
 * Thin gastronomy permission helpers (SPEC-239 T-038 / SPEC-253 T-005).
 *
 * All real logic lives in the generic `commerce.permissions.ts` helpers that
 * resolve the gastronomy permission family. This file re-exports or delegates to
 * those helpers with gastronomy context, keeping the gastronomy service layer
 * consistent with accommodation's pattern while avoiding permission-logic
 * duplication.
 *
 * Design decisions:
 * - NEVER check the actor's roles directly (`actor.roles`).  Only `PermissionEnum`
 *   values.  Since HOS-296 an account holds a SET of hats, so "is the actor
 *   role X" is not even a well-formed question here.
 * - These helpers are called by GastronomyService permission hooks only.
 * - Owner-scoped update gate uses `GASTRONOMY_EDIT_OWN` (single permission,
 *   SPEC-253 D2=b).
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import type { CommerceVertical } from '../commerce/commerce.permissions';
import {
    checkCanAdminListCommerce,
    checkCanCreateCommerce,
    checkCanDeleteCommerce,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanEditOwnOrAll,
    checkCanModerateReview,
    checkCanViewAll,
    hasCommercePermission
} from '../commerce/commerce.permissions';

/**
 * The vertical every check in this file resolves against (HOS-1077).
 *
 * Passing it is what makes `gastronomy.*` permissions pass here while the
 * other vertical's do not.
 */
const VERTICAL: CommerceVertical = 'gastronomy';

// Re-export generic helpers under gastronomy-scoped names so callers inside
// the gastronomy directory can import from one place.

/**
 * Checks if the actor may create a new gastronomy listing.
 * Delegates to {@link checkCanCreateCommerce} — an authenticated account and
 * nothing more (HOS-687 / HOS-589 §6.1).
 *
 * @param actor - The actor performing the action.
 * @param data - Create payload (unused; accepted for signature parity).
 * @throws {ServiceError} UNAUTHORIZED when the actor is anonymous / a guest.
 */
export function checkGastronomyCanCreate(actor: Actor, data: unknown): void {
    checkCanCreateCommerce(actor, data);
}

/**
 * Checks if the actor may perform a full (admin) update on any gastronomy listing.
 * Delegates to {@link checkCanEditAll} (`GASTRONOMY_EDIT_ALL`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity being updated.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_EDIT_ALL`.
 */
export function checkGastronomyCanEditAll(actor: Actor, entity: unknown): void {
    checkCanEditAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may update a gastronomy listing through the base update
 * pipeline (the service `_canUpdate` gate).
 *
 * Delegates to {@link checkCanEditOwnOrAll}: accepts staff (`GASTRONOMY_EDIT_ALL`)
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
    checkCanEditOwnOrAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may perform an owner-scoped update on their own gastronomy
 * listing.
 *
 * Delegates to {@link checkCanEditOwn} which accepts either `GASTRONOMY_EDIT_ALL`
 * (staff bypass) or `GASTRONOMY_EDIT_OWN` when the actor is the listing owner
 * (SPEC-253 D2=b: section param is accepted for call-site compatibility but ignored).
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditOwn(actor: Actor, entity: { ownerId?: string | null }): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may soft-delete a gastronomy listing.
 * Delegates to {@link checkCanDeleteCommerce} (`GASTRONOMY_DELETE`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_DELETE`.
 */
export function checkGastronomyCanDelete(actor: Actor, entity: unknown): void {
    checkCanDeleteCommerce(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may view all gastronomy listings (including private/draft).
 * Delegates to {@link checkCanViewAll} (`GASTRONOMY_VIEW_ALL`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_VIEW_ALL`.
 */
export function checkGastronomyCanViewAll(actor: Actor): void {
    checkCanViewAll(actor, VERTICAL);
}

/**
 * Checks if the actor may use the admin-list path for gastronomy listings.
 *
 * Requires `gastronomy.viewAll`.
 *
 * Delegates to {@link checkCanAdminListCommerce}.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks that permission.
 */
export function checkGastronomyCanAdminList(actor: Actor): void {
    checkCanAdminListCommerce(actor, VERTICAL);
}

/**
 * Checks if the actor may moderate a gastronomy review.
 * Delegates to {@link checkCanModerateReview} (`GASTRONOMY_MODERATE_REVIEW`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_MODERATE_REVIEW`.
 */
export function checkGastronomyCanModerateReview(actor: Actor): void {
    checkCanModerateReview(actor, VERTICAL);
}

/**
 * Checks if the actor may create or edit FAQs on a gastronomy listing they own.
 *
 * Accepts either `GASTRONOMY_EDIT_ALL` (staff) or `GASTRONOMY_EDIT_OWN` when the
 * actor is the listing owner (SPEC-253 D2=b: replaces COMMERCE_FAQS_EDIT_OWN).
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity whose FAQs are being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditFaqs(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may add/remove/reorder/feature photos on a gastronomy
 * listing's gallery (HOS-372).
 *
 * Accepts either `GASTRONOMY_EDIT_ALL` (staff) or `GASTRONOMY_EDIT_OWN` when the
 * actor is the listing owner — identical gate to
 * {@link checkGastronomyCanEditFaqs}, kept as a separate named wrapper for
 * call-site clarity (media vs FAQ operations).
 *
 * @param actor - The actor performing the action.
 * @param entity - The gastronomy entity whose media is being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkGastronomyCanEditMedia(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwn(actor, entity, VERTICAL);
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
 * Requires `GASTRONOMY_DELETE` (no separate hard-delete permission exists yet;
 * follows the same pattern as commerce delete gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being hard-deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_DELETE`.
 */
export function checkGastronomyCanHardDelete(actor: Actor, _entity: unknown): void {
    if (!hasCommercePermission(actor, 'delete', VERTICAL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete gastronomy listing'
        );
    }
}

/**
 * Checks if the actor may restore a soft-deleted gastronomy listing.
 * Requires `GASTRONOMY_EDIT_ALL` (mirrors commerce restore gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being restored (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `GASTRONOMY_EDIT_ALL`.
 */
export function checkGastronomyCanRestore(actor: Actor, _entity: unknown): void {
    checkCanEditAll(actor, _entity, VERTICAL);
}
