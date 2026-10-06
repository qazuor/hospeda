/**
 * experience.permissions.ts
 *
 * Thin experience permission helpers (SPEC-240 T-015 / SPEC-253 T-007).
 *
 * All real logic lives in the generic `commerce.permissions.ts` helpers that
 * resolve the experience permission family. This file re-exports or delegates to
 * those helpers with experience context, keeping the experience service layer
 * consistent with gastronomy's pattern while avoiding permission-logic
 * duplication.
 *
 * Design decisions:
 * - NEVER check the actor's roles directly (`actor.roles`).  Only `PermissionEnum`
 *   values.  Since HOS-296 an account holds a SET of hats, so "is the actor
 *   role X" is not even a well-formed question here.
 * - Experience uses its own EXPERIENCE_* permission family.
 * - These helpers are called by ExperienceService permission hooks only.
 * - Owner-scoped update gate uses `EXPERIENCE_EDIT_OWN` (single permission,
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
 * Passing it is what makes `experience.*` permissions pass here while the
 * other vertical's do not.
 */
const VERTICAL: CommerceVertical = 'experience';

// Re-export generic helpers under experience-scoped names so callers inside
// the experience directory can import from one place.

/**
 * Checks if the actor may create a new experience listing.
 * Delegates to {@link checkCanCreateCommerce} — an authenticated account and
 * nothing more (HOS-687 / HOS-589 §6.1).
 *
 * @param actor - The actor performing the action.
 * @param data - Create payload (unused; accepted for signature parity).
 * @throws {ServiceError} UNAUTHORIZED when the actor is anonymous / a guest.
 */
export function checkExperienceCanCreate(actor: Actor, data: unknown): void {
    checkCanCreateCommerce(actor, data);
}

/**
 * Checks if the actor may perform a full (admin) update on any experience listing.
 * Delegates to {@link checkCanEditAll} (`EXPERIENCE_EDIT_ALL`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity being updated.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_EDIT_ALL`.
 */
export function checkExperienceCanEditAll(actor: Actor, entity: unknown): void {
    checkCanEditAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may update an experience listing through the base update
 * pipeline (the service `_canUpdate` gate).
 *
 * Delegates to {@link checkCanEditOwnOrAll}: accepts staff (`EXPERIENCE_EDIT_ALL`)
 * OR the listing owner holding at least one operational `editOwn` permission.
 * Owner edits still flow through `updateOwn`, which enforces per-section gating
 * and an operational-only payload.
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkExperienceCanEditOwnOrAll(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwnOrAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may perform an owner-scoped update on their own experience
 * listing.
 *
 * Delegates to {@link checkCanEditOwn} which accepts either `EXPERIENCE_EDIT_ALL`
 * (staff bypass) or `EXPERIENCE_EDIT_OWN` when the actor is the listing owner
 * (SPEC-253 D2=b: section param is accepted for call-site compatibility but ignored).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkExperienceCanEditOwn(actor: Actor, entity: { ownerId?: string | null }): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may soft-delete an experience listing.
 * Delegates to {@link checkCanDeleteCommerce} (`EXPERIENCE_DELETE`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_DELETE`.
 */
export function checkExperienceCanDelete(actor: Actor, entity: unknown): void {
    checkCanDeleteCommerce(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may view all experience listings (including private/draft).
 * Delegates to {@link checkCanViewAll} (`EXPERIENCE_VIEW_ALL`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_VIEW_ALL`.
 */
export function checkExperienceCanViewAll(actor: Actor): void {
    checkCanViewAll(actor, VERTICAL);
}

/**
 * Checks if the actor may use the admin-list path for experience listings.
 *
 * Requires `experience.viewAll`.
 *
 * Delegates to {@link checkCanAdminListCommerce}.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks that permission.
 */
export function checkExperienceCanAdminList(actor: Actor): void {
    checkCanAdminListCommerce(actor, VERTICAL);
}

/**
 * Checks if the actor may moderate an experience review.
 * Delegates to {@link checkCanModerateReview} (`EXPERIENCE_MODERATE_REVIEW`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_MODERATE_REVIEW`.
 */
export function checkExperienceCanModerateReview(actor: Actor): void {
    checkCanModerateReview(actor, VERTICAL);
}

/**
 * Checks if the actor may create or edit FAQs on an experience listing they own.
 *
 * Accepts either `EXPERIENCE_EDIT_ALL` (staff) or `EXPERIENCE_EDIT_OWN` when the
 * actor is the listing owner (SPEC-253 D2=b: replaces COMMERCE_FAQS_EDIT_OWN).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity whose FAQs are being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkExperienceCanEditFaqs(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may add/remove/reorder/feature photos on an experience
 * listing's gallery (HOS-372).
 *
 * Accepts either `EXPERIENCE_EDIT_ALL` (staff) or `EXPERIENCE_EDIT_OWN` when the
 * actor is the listing owner — identical gate to
 * {@link checkExperienceCanEditFaqs}, kept as a separate named wrapper for
 * call-site clarity (media vs FAQ operations).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity whose media is being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkExperienceCanEditMedia(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may view experience listings (public read).
 *
 * For public/protected read paths, any actor is allowed to attempt to list;
 * the service layer enforces lifecycle+visibility filters on results.
 * This is intentionally permissive — mirrors gastronomy's pattern.
 *
 * @param _actor - The actor performing the action (currently unused).
 */
export function checkExperienceCanView(_actor: Actor): void {
    // Public listings are viewable by all. The service enforces lifecycle/visibility.
    return;
}

/**
 * Checks if the actor may perform a hard-delete on an experience listing.
 * Requires `EXPERIENCE_DELETE` (no separate hard-delete permission exists yet;
 * follows the same pattern as commerce delete gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being hard-deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_DELETE`.
 */
export function checkExperienceCanHardDelete(actor: Actor, _entity: unknown): void {
    if (!hasCommercePermission(actor, 'delete', VERTICAL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete experience listing'
        );
    }
}

/**
 * Checks if the actor may restore a soft-deleted experience listing.
 * Requires `EXPERIENCE_EDIT_ALL` (mirrors commerce restore gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being restored (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `EXPERIENCE_EDIT_ALL`.
 */
export function checkExperienceCanRestore(actor: Actor, _entity: unknown): void {
    checkCanEditAll(actor, _entity, VERTICAL);
}
