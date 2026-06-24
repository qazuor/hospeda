/**
 * experience.permissions.ts
 *
 * Thin experience permission helpers (SPEC-240 T-015 / SPEC-253 T-007).
 *
 * All real logic lives in the generic `commerce.permissions.ts` helpers that
 * consume `PermissionEnum.COMMERCE_*`.  This file re-exports or delegates to
 * those helpers with experience context, keeping the experience service layer
 * consistent with gastronomy's pattern while avoiding permission-logic
 * duplication.
 *
 * Design decisions:
 * - NEVER check `actor.role` directly.  Only `PermissionEnum` values.
 * - Experience reuses COMMERCE_* permissions exactly as gastronomy does (SPEC-240 T-015).
 *   No EXPERIENCE_* enum values are introduced — the shared COMMERCE_* scheme
 *   is sufficient and avoids fragmentation.
 * - These helpers are called by ExperienceService permission hooks only.
 * - Owner-scoped update gate uses `COMMERCE_EDIT_OWN` (single permission,
 *   SPEC-253 D2=b). The per-section `COMMERCE_*_EDIT_OWN` perms are removed.
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

// Re-export generic helpers under experience-scoped names so callers inside
// the experience directory can import from one place.

/**
 * Checks if the actor may create a new experience listing.
 * Delegates to {@link checkCanCreateCommerce} (`COMMERCE_CREATE`).
 *
 * @param actor - The actor performing the action.
 * @param data - Create payload (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_CREATE`.
 */
export function checkExperienceCanCreate(actor: Actor, data: unknown): void {
    checkCanCreateCommerce(actor, data);
}

/**
 * Checks if the actor may perform a full (admin) update on any experience listing.
 * Delegates to {@link checkCanEditAll} (`COMMERCE_EDIT_ALL`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity being updated.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_EDIT_ALL`.
 */
export function checkExperienceCanEditAll(actor: Actor, entity: unknown): void {
    checkCanEditAll(actor, entity);
}

/**
 * Checks if the actor may update an experience listing through the base update
 * pipeline (the service `_canUpdate` gate).
 *
 * Delegates to {@link checkCanEditOwnOrAll}: accepts staff (`COMMERCE_EDIT_ALL`)
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
    checkCanEditOwnOrAll(actor, entity);
}

/**
 * Checks if the actor may perform an owner-scoped update on their own experience
 * listing.
 *
 * Delegates to {@link checkCanEditOwn} which accepts either `COMMERCE_EDIT_ALL`
 * (staff bypass) or `COMMERCE_EDIT_OWN` when the actor is the listing owner
 * (SPEC-253 D2=b: section param is accepted for call-site compatibility but ignored).
 *
 * @param actor - The actor performing the action.
 * @param entity - The experience entity being updated (must carry `ownerId`).
 * @param _ownSectionPermission - Ignored since SPEC-253 D2=b (kept for compatibility).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkExperienceCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    _ownSectionPermission?: PermissionEnum
): void {
    checkCanEditOwn(actor, entity);
}

/**
 * Checks if the actor may soft-delete an experience listing.
 * Delegates to {@link checkCanDeleteCommerce} (`COMMERCE_DELETE`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_DELETE`.
 */
export function checkExperienceCanDelete(actor: Actor, entity: unknown): void {
    checkCanDeleteCommerce(actor, entity);
}

/**
 * Checks if the actor may view all experience listings (including private/draft).
 * Delegates to {@link checkCanViewAll} (`COMMERCE_VIEW_ALL`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_VIEW_ALL`.
 */
export function checkExperienceCanViewAll(actor: Actor): void {
    checkCanViewAll(actor);
}

/**
 * Checks if the actor may use the admin-list path for experience listings.
 *
 * Accepts either `COMMERCE_VIEW_ALL` (staff, unscoped) or
 * `COMMERCE_VIEW_ALL` as view-own fallback (forward-compatible; a dedicated
 * `COMMERCE_EXPERIENCE_VIEW_OWN` can be plugged in when added to the enum).
 *
 * Delegates to {@link checkCanAdminListCommerce}.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor holds neither permission.
 */
export function checkExperienceCanAdminList(actor: Actor): void {
    // Forward-compatible: pass COMMERCE_VIEW_ALL as viewOwnPermission until
    // a per-type COMMERCE_EXPERIENCE_VIEW_OWN enum value is added.
    checkCanAdminListCommerce(actor, PermissionEnum.COMMERCE_VIEW_ALL);
}

/**
 * Checks if the actor may moderate an experience review.
 * Delegates to {@link checkCanModerateReview} (`COMMERCE_MODERATE_REVIEW`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_MODERATE_REVIEW`.
 */
export function checkExperienceCanModerateReview(actor: Actor): void {
    checkCanModerateReview(actor);
}

/**
 * Checks if the actor may create or edit FAQs on an experience listing they own.
 *
 * Accepts either `COMMERCE_EDIT_ALL` (staff) or `COMMERCE_EDIT_OWN` when the
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
    checkCanEditOwn(actor, entity);
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
 * Requires `COMMERCE_DELETE` (no separate hard-delete permission exists yet;
 * follows the same pattern as commerce delete gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being hard-deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_DELETE`.
 */
export function checkExperienceCanHardDelete(actor: Actor, _entity: unknown): void {
    if (!hasPermission(actor, PermissionEnum.COMMERCE_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete experience listing'
        );
    }
}

/**
 * Checks if the actor may restore a soft-deleted experience listing.
 * Requires `COMMERCE_EDIT_ALL` (mirrors commerce restore gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being restored (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `COMMERCE_EDIT_ALL`.
 */
export function checkExperienceCanRestore(actor: Actor, _entity: unknown): void {
    checkCanEditAll(actor, _entity);
}
