/**
 * venue.permissions.ts
 *
 * Thin venue permission helpers (SPEC-239 T-038 / SPEC-253 T-005).
 *
 * All real logic lives in the generic `listing.permissions.ts` helpers that
 * resolve the venue permission family. This file re-exports or delegates to
 * those helpers with venue context, keeping the venue service layer
 * consistent with accommodation's pattern while avoiding permission-logic
 * duplication.
 *
 * Design decisions:
 * - NEVER check the actor's roles directly (`actor.roles`).  Only `PermissionEnum`
 *   values.  Since HOS-296 an account holds a SET of hats, so "is the actor
 *   role X" is not even a well-formed question here.
 * - These helpers are called by VenueService permission hooks only.
 * - Owner-scoped update gate uses `VENUE_EDIT_OWN` (single permission,
 *   SPEC-253 D2=b).
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { isAction15AuthorizedFor } from '../../utils/administrative-authorization';
import type { VenueOrExperience } from '../listing/listing.permissions';
import {
    checkCanAdminListListings,
    checkCanCreateListing,
    checkCanDeleteListing,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanEditOwnOrAll,
    checkCanModerateReview,
    checkCanViewAll,
    hasListingPermission
} from '../listing/listing.permissions';

/**
 * The vertical every check in this file resolves against (HOS-1077).
 *
 * Passing it is what makes `venue.*` permissions pass here while the
 * other vertical's do not.
 */
const VERTICAL: VenueOrExperience = 'venue';

// Re-export generic helpers under venue-scoped names so callers inside
// the venue directory can import from one place.

/**
 * Checks if the actor may create a new venue listing.
 * Delegates to {@link checkCanCreateListing} — an authenticated account and
 * nothing more (HOS-687 / HOS-589 §6.1).
 *
 * @param actor - The actor performing the action.
 * @param data - Create payload (unused; accepted for signature parity).
 * @throws {ServiceError} UNAUTHORIZED when the actor is anonymous / a guest.
 */
export function checkVenueCanCreate(actor: Actor, data: unknown): void {
    checkCanCreateListing(actor, data);
}

/**
 * Checks if the actor may perform a full (admin) update on any venue listing.
 * Delegates to {@link checkCanEditAll} (`VENUE_EDIT_ALL`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity being updated.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_EDIT_ALL`.
 */
export function checkVenueCanEditAll(actor: Actor, entity: unknown): void {
    checkCanEditAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may update a venue listing through the base update
 * pipeline (the service `_canUpdate` gate).
 *
 * Delegates to {@link checkCanEditOwnOrAll}: accepts staff (`VENUE_EDIT_ALL`)
 * OR the listing owner holding at least one operational `editOwn` permission.
 * Owner edits still flow through `updateOwn`, which enforces per-section gating
 * and an operational-only payload.
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkVenueCanEditOwnOrAll(actor: Actor, entity: { ownerId?: string | null }): void {
    checkCanEditOwnOrAll(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may perform an owner-scoped update on their own venue
 * listing.
 *
 * Delegates to {@link checkCanEditOwn} which accepts either `VENUE_EDIT_ALL`
 * (staff bypass) or `VENUE_EDIT_OWN` when the actor is the listing owner
 * (SPEC-253 D2=b: section param is accepted for call-site compatibility but ignored).
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity being updated (must carry `ownerId`).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkVenueCanEditOwn(actor: Actor, entity: { ownerId?: string | null }): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may soft-delete a venue listing.
 * Delegates to {@link checkCanDeleteListing} (`VENUE_DELETE`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_DELETE`.
 */
export function checkVenueCanDelete(actor: Actor, entity: unknown): void {
    checkCanDeleteListing(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may view all venue listings (including private/draft).
 * Delegates to {@link checkCanViewAll} (`VENUE_VIEW_ALL`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_VIEW_ALL`.
 */
export function checkVenueCanViewAll(actor: Actor): void {
    checkCanViewAll(actor, VERTICAL);
}

/**
 * Checks if the actor may use the admin-list path for venue listings.
 *
 * Requires `venue.viewAll`.
 *
 * Delegates to {@link checkCanAdminListListings}.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks that permission.
 */
export function checkVenueCanAdminList(actor: Actor): void {
    checkCanAdminListListings(actor, VERTICAL);
}

/**
 * Checks if the actor may moderate a venue review.
 * Delegates to {@link checkCanModerateReview} (`VENUE_MODERATE_REVIEW`).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_MODERATE_REVIEW`.
 */
export function checkVenueCanModerateReview(actor: Actor): void {
    checkCanModerateReview(actor, VERTICAL);
}

/**
 * Checks if the actor may create or edit FAQs on a venue listing they own.
 *
 * Accepts either `VENUE_EDIT_ALL` (staff) or `VENUE_EDIT_OWN` when the
 * actor is the listing owner (SPEC-253 D2=b: replaces the per-section FAQ permission).
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity whose FAQs are being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkVenueCanEditFaqs(actor: Actor, entity: { ownerId?: string | null }): void {
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may add/remove/reorder/feature photos on a venue
 * listing's gallery (HOS-372).
 *
 * Accepts either `VENUE_EDIT_ALL` (staff) or `VENUE_EDIT_OWN` when the
 * actor is the listing owner — identical gate to
 * {@link checkVenueCanEditFaqs}, kept as a separate named wrapper for
 * call-site clarity (media vs FAQ operations). Action 15 (ACC:15, HOS-1493)
 * also passes, only inside its authorized scope bound to the listing's owner.
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity whose media is being edited.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkVenueCanEditMedia(actor: Actor, entity: { ownerId?: string | null }): void {
    // ACC:15 (HOS-1493): only inside a scope where a route's listing-access
    // chain authorized action 15 for this listing's owner — never from the
    // actor's permission alone.
    if (isAction15AuthorizedFor({ actor, ownerId: entity.ownerId })) return;
    checkCanEditOwn(actor, entity, VERTICAL);
}

/**
 * Checks if the actor may add, edit, remove or reorder the FAQ ENTRIES of a
 * venue listing: the owner/staff gate of {@link checkVenueCanEditFaqs} plus
 * action 15 (ACC:15, HOS-1493) inside its authorized scope. FAQ entries are
 * listing content; the sibling sub-entities that share
 * {@link checkVenueCanEditFaqs} (menu, events, certificates, …) are not part of
 * action 15 and keep that gate unchanged.
 *
 * @param actor - The actor performing the action.
 * @param entity - The venue entity whose FAQs are being edited.
 * @throws {ServiceError} FORBIDDEN when no condition is met.
 */
export function checkVenueCanEditFaqEntries(
    actor: Actor,
    entity: { ownerId?: string | null }
): void {
    if (isAction15AuthorizedFor({ actor, ownerId: entity.ownerId })) return;
    checkVenueCanEditFaqs(actor, entity);
}

/**
 * Checks if the actor may view venue listings (public read).
 *
 * For public/protected read paths, any actor is allowed to attempt to list;
 * the service layer enforces the publication-status filter on results.
 * This is intentionally permissive — mirror accommodation's `checkCanList` pattern.
 *
 * @param _actor - The actor performing the action (currently unused).
 */
export function checkVenueCanView(_actor: Actor): void {
    // Public listings are viewable by all. The service enforces publication status.
    return;
}

/**
 * Checks if the actor may perform a hard-delete on a venue listing.
 * Requires `VENUE_DELETE` (no separate hard-delete permission exists yet;
 * follows the same pattern as listing delete gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being hard-deleted (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_DELETE`.
 */
export function checkVenueCanHardDelete(actor: Actor, _entity: unknown): void {
    if (!hasListingPermission(actor, 'delete', VERTICAL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete gastronomy listing'
        );
    }
}

/**
 * Checks if the actor may restore a soft-deleted venue listing.
 * Requires `VENUE_EDIT_ALL` (mirrors listing restore gate).
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being restored (unused; accepted for signature parity).
 * @throws {ServiceError} FORBIDDEN when the actor lacks `VENUE_EDIT_ALL`.
 */
export function checkVenueCanRestore(actor: Actor, _entity: unknown): void {
    checkCanEditAll(actor, _entity, VERTICAL);
}
