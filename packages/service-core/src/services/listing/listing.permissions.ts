/**
 * listing.permissions.ts
 *
 * Generic permission checks for all listing entities (SPEC-239 T-030).
 *
 * Design rules:
 *  - ALL checks resolve permissions through {@link hasListingPermission}, never
 *    `hasPermission` directly. That function is the single place where the
 *    vertical permission is resolved. `vertical` is REQUIRED: a check that
 *    does not know its vertical fails to compile instead of falling open
 *    across verticals (HOS-1417, the HOS-1077 contract step).
 *  - NEVER check the actor's roles directly (`actor.roles`). Since HOS-296 an
 *    account holds a SET of hats, so "is the actor role X" is not even a
 *    well-formed question here — ask what they are ALLOWED to do.
 *  - For admin-list, both VIEW_ALL (staff, unscoped) and the entity's VIEW_OWN
 *    permission are accepted; the scoping decision is enforced in `_executeAdminSearch`,
 *    not here.
 *
 * These helpers are consumed by `BaseListingService` via the abstract
 * permission-set mechanism, and directly by stateless services (lead,
 * provisioning) for admin-only operations.
 */

import {
    type GastronomyOrExperience,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the actor owns the listing entity.
 *
 * @param actor - The actor performing the action.
 * @param entity - Any entity record that carries an `ownerId` field.
 */
const isOwner = (actor: Actor, entity: { ownerId?: string | null }): boolean =>
    entity.ownerId === actor.id;

/**
 * Returns `true` when the actor is anonymous — no roles at all, or only the
 * `GUEST` sentinel.
 *
 * An anonymous actor carries a real UUID (the guest sentinel id), so
 * `!actor.id` is NOT a usable authentication test here — the same trap the
 * API error contract documents. Mirrors `resolveOwnerUserId` in
 * `host-trade.service.ts`.
 *
 * @param actor - The actor performing the action.
 */
const isAnonymousActor = (actor: Actor): boolean =>
    actor.roles.length === 0 || actor.roles.every((role) => role === RoleEnum.GUEST);

// ---------------------------------------------------------------------------
// Per-vertical permission resolution (HOS-1077)
// ---------------------------------------------------------------------------

/**
 * The listing verticals that carry their own permission family (HOS-1077).
 *
 * Re-exported from `@repo/schemas` (the single source of truth). Deliberately
 * NOT the whole `ProductDomainEnum`: that enum also names `accommodation` and
 * `partner`, neither of which routes through these listing helpers, and a
 * value here must have a full seven-permission family behind it.
 */
export type { GastronomyOrExperience };

/**
 * The seven authorities every listing vertical needs, named independently of
 * which enum family provides them.
 */
export type ListingPermissionSlot =
    | 'editOwn'
    | 'create'
    | 'viewAll'
    | 'editAll'
    | 'delete'
    | 'moderateReview'
    | 'moderationChange';

/**
 * The per-vertical permission families.
 *
 * This table is the whole point of HOS-1077: `gastronomy.editAll` and
 * `experience.editAll` are different permissions, so a restaurant moderator can
 * finally be granted one without the other.
 */
const VERTICAL_PERMISSIONS: Readonly<
    Record<GastronomyOrExperience, Readonly<Record<ListingPermissionSlot, PermissionEnum>>>
> = {
    gastronomy: {
        editOwn: PermissionEnum.GASTRONOMY_EDIT_OWN,
        create: PermissionEnum.GASTRONOMY_CREATE,
        viewAll: PermissionEnum.GASTRONOMY_VIEW_ALL,
        editAll: PermissionEnum.GASTRONOMY_EDIT_ALL,
        delete: PermissionEnum.GASTRONOMY_DELETE,
        moderateReview: PermissionEnum.GASTRONOMY_MODERATE_REVIEW,
        moderationChange: PermissionEnum.GASTRONOMY_MODERATION_CHANGE
    },
    experience: {
        editOwn: PermissionEnum.EXPERIENCE_EDIT_OWN,
        create: PermissionEnum.EXPERIENCE_CREATE,
        viewAll: PermissionEnum.EXPERIENCE_VIEW_ALL,
        editAll: PermissionEnum.EXPERIENCE_EDIT_ALL,
        delete: PermissionEnum.EXPERIENCE_DELETE,
        moderateReview: PermissionEnum.EXPERIENCE_MODERATE_REVIEW,
        moderationChange: PermissionEnum.EXPERIENCE_MODERATION_CHANGE
    }
};

/**
 * The owner role each vertical grants when someone creates their first listing
 * (HOS-1077).
 *
 * Each listing grants only its vertical's owner role.
 */
export const VERTICAL_OWNER_ROLES: Readonly<Record<GastronomyOrExperience, RoleEnum>> = {
    gastronomy: RoleEnum.GASTRONOMY_OWNER,
    experience: RoleEnum.EXPERIENCE_OWNER
};

/**
 * Resolves the concrete `PermissionEnum` a vertical uses for one slot.
 *
 * Exported so route files can name the same value the service will check,
 * instead of re-deriving the mapping at each call site.
 *
 * @param vertical - The listing vertical.
 * @param slot - Which of the seven authorities is wanted.
 * @returns The vertical's own permission for that slot.
 */
export function verticalPermission(
    vertical: GastronomyOrExperience,
    slot: ListingPermissionSlot
): PermissionEnum {
    return VERTICAL_PERMISSIONS[vertical][slot];
}

/**
 * Checks the vertical's own permission, and only that one: a gastronomy
 * permission never authorizes an experience listing, nor the other way round.
 *
 * @param actor - The actor performing the action.
 * @param slot - Which of the seven authorities is being demanded.
 * @param vertical - The vertical whose family is accepted.
 * @returns `true` when the actor holds an applicable vertical permission.
 */
export function hasListingPermission(
    actor: Actor,
    slot: ListingPermissionSlot,
    vertical: GastronomyOrExperience
): boolean {
    return hasPermission(actor, VERTICAL_PERMISSIONS[vertical][slot]);
}

// ---------------------------------------------------------------------------
// Listing permission checks
// ---------------------------------------------------------------------------

/**
 * Verifies the actor may create a new listing.
 *
 * Requires an authenticated account and NOTHING else (HOS-687 / HOS-589 §6.1).
 *
 * This deliberately no longer demands a pre-existing CREATE permission. Creating the listing
 * is the act that MAKES someone a listing owner — demanding the owner's own
 * permission to perform it made the role unreachable for every account that
 * did not already have it, which is everyone. It is the exact mirror of host
 * onboarding, where creating the first accommodation draft requires no
 * `ACCOMMODATION_*` permission and grants `HOST` on the way through.
 *
 * The admin create path is unaffected: `apps/api/src/routes/gastronomy/admin/create.ts`
 * and its experience twin carry their own `anyOfPermissions` gate with the
 * corresponding vertical's CREATE permission, so this service predicate does
 * not widen the admin door.
 *
 * @param actor - The actor performing the action.
 * @param _data - The creation payload (unused here; accepted for signature consistency).
 * @throws {ServiceError} UNAUTHORIZED when the actor is anonymous / a guest.
 */
export function checkCanCreateListing(actor: Actor, _data: unknown): void {
    if (isAnonymousActor(actor)) {
        throw new ServiceError(
            ServiceErrorCode.UNAUTHORIZED,
            'Authentication required to create a listing'
        );
    }
}

/**
 * Verifies the actor may update any listing (admin path).
 * Requires the applicable vertical EDIT_ALL permission.
 *
 * For owner-scoped updates, use {@link checkCanEditOwn} with the appropriate
 * section permission instead.
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being updated (unused; for signature consistency).
 * @param vertical - The vertical whose `editAll` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanEditAll(
    actor: Actor,
    _entity: unknown,
    vertical: GastronomyOrExperience
): void {
    if (!hasListingPermission(actor, 'editAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to edit any listing'
        );
    }
}

/**
 * Verifies the actor may perform an operational edit on their own listing.
 *
 * Accepts either `editAll` (staff) or `editOwn` (owner), provided the actor is
 * the listing's owner. All owner sections collapse to the single `editOwn`
 * permission (SPEC-253 D2=b), so there is no per-section parameter — the dead
 * `ownSectionPermission` argument no call site ever passed was dropped in
 * HOS-1077 to make room for `vertical` without a four-argument signature.
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must have `ownerId`).
 * @param vertical - The vertical whose permissions are required.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    vertical: GastronomyOrExperience
): void {
    if (
        hasListingPermission(actor, 'editAll', vertical) ||
        (hasListingPermission(actor, 'editOwn', vertical) && isOwner(actor, entity))
    ) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to edit own listing'
    );
}

/**
 * Verifies the actor may update a listing through the base update pipeline
 * (`_canUpdate`). Accepts staff (the applicable vertical EDIT_ALL permission) OR the listing's owner holding
 * the applicable vertical EDIT_OWN permission (SPEC-253 D2=b: replaces the former 10 per-section perms).
 *
 * This is the owner-aware analogue of {@link checkCanEditAll}, mirroring how
 * `AccommodationService` accepts `UPDATE_ANY` OR (`UPDATE_OWN` + owner). Owner edits
 * additionally flow through `updateOwn`, which validates the payload to operational
 * fields only — so a passing owner can still only persist operational changes,
 * never identity/lifecycle/visibility fields.
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must carry `ownerId`).
 * @param vertical - The vertical whose permissions are required.
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwnOrAll(
    actor: Actor,
    entity: { ownerId?: string | null },
    vertical: GastronomyOrExperience
): void {
    if (hasListingPermission(actor, 'editAll', vertical)) {
        return;
    }
    if (isOwner(actor, entity) && hasListingPermission(actor, 'editOwn', vertical)) {
        return;
    }
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: Insufficient permissions to update listing'
    );
}

/**
 * Verifies the actor may soft-delete a listing.
 * Requires the applicable vertical DELETE permission.
 *
 * @param actor - The actor performing the action.
 * @param _entity - The entity being deleted (unused; for signature consistency).
 * @param vertical - The vertical whose `delete` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanDeleteListing(
    actor: Actor,
    _entity: unknown,
    vertical: GastronomyOrExperience
): void {
    if (!hasListingPermission(actor, 'delete', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete listing'
        );
    }
}

/**
 * Verifies the actor may view all listings (including draft/private).
 * Requires the applicable vertical VIEW_ALL permission.
 *
 * @param actor - The actor performing the action.
 * @param vertical - The vertical whose `viewAll` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanViewAll(actor: Actor, vertical: GastronomyOrExperience): void {
    if (!hasListingPermission(actor, 'viewAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view all listings'
        );
    }
}

/**
 * Verifies the actor may use the admin-list path for a listing entity type.
 *
 * Requires the vertical's `viewAll`.
 * Scoping of the results themselves is enforced in `_executeAdminSearch`,
 * not here.
 *
 * HOS-1077 dropped the `viewOwnPermission` parameter: it was a forward-compat
 * stub that every caller satisfied by passing the applicable vertical VIEW_ALL permission, i.e. the
 * same permission the first branch already checked, so the OR could never
 * admit anyone the first branch did not. The vertical split is what that stub
 * was waiting for, and it arrives as `vertical` instead.
 *
 * @param actor - The actor performing the action.
 * @param vertical - The vertical whose `viewAll` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the applicable permission.
 */
export function checkCanAdminListListings(actor: Actor, vertical: GastronomyOrExperience): void {
    if (!hasListingPermission(actor, 'viewAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: viewAll required for listing admin list'
        );
    }
}

/**
 * Verifies the actor may moderate a review on a listing.
 * Requires the applicable vertical MODERATE_REVIEW permission.
 *
 * @param actor - The actor performing the action.
 * @param vertical - The vertical whose `moderateReview` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanModerateReview(actor: Actor, vertical: GastronomyOrExperience): void {
    if (!hasListingPermission(actor, 'moderateReview', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate listing reviews'
        );
    }
}

/**
 * Verifies the actor may change the moderation state of a gastronomy or experience LISTING.
 * Requires the applicable vertical MODERATION_CHANGE permission (HOS-686).
 *
 * ## Why this is not {@link checkCanModerateReview}
 *
 * the applicable vertical MODERATE_REVIEW permission moderates reviews written *about* a listing. This
 * one moderates the listing itself — the takedown verdict public reads honour
 * (`moderationState === REJECTED` keeps the listing out of public results). Anyone grepping "moderate" under the listing layer finds
 * the review check first and can reasonably conclude the listing case is
 * already covered. It is not: they are two distinct authorities.
 *
 * ## Why accommodation's `checkCanModerate` could not be reused
 *
 * `accommodation.permissions.ts:313` hardcodes
 * `ACCOMMODATION_MODERATION_CHANGE` and accepts no permission parameter, so it
 * is not generic over domains.
 *
 * @param actor - The actor performing the action.
 * @param vertical - The vertical whose `moderationChange` permission is required.
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanModerateListing(actor: Actor, vertical: GastronomyOrExperience): void {
    if (!hasListingPermission(actor, 'moderationChange', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate listing'
        );
    }
}
