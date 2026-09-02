/**
 * commerce.permissions.ts
 *
 * Generic permission checks for all commerce listing entities (SPEC-239 T-030).
 *
 * Design rules:
 *  - ALL checks resolve permissions through {@link hasCommercePermission}, never
 *    `hasPermission` directly. That function is the single place where the
 *    HOS-1077 dual-read lives: a check passes on the vertical's own permission
 *    (`gastronomy.*` / `experience.*`) OR on the legacy `commerce.*` one. Every
 *    gastronomy/experience caller passes its `vertical`; omitting it keeps the
 *    pre-HOS-1077 commerce-only behaviour for the vertical-agnostic callers.
 *  - NEVER check the actor's roles directly (`actor.roles`). Since HOS-296 an
 *    account holds a SET of hats, so "is the actor role X" is not even a
 *    well-formed question here — ask what they are ALLOWED to do.
 *  - For admin-list, both VIEW_ALL (staff, unscoped) and the entity's VIEW_OWN
 *    permission are accepted; the scoping decision is enforced in `_executeAdminSearch`,
 *    not here.
 *
 * These helpers are consumed by `BaseCommerceListingService` via the abstract
 * permission-set mechanism, and directly by stateless services (commerce-lead,
 * provisioning) for admin-only operations.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
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
 * The commerce verticals that carry their own permission family (HOS-1077).
 *
 * Deliberately NOT `ProductDomainEnum`: that enum also names `accommodation`
 * and `partner`, neither of which routes through these commerce helpers, and a
 * value here must have a full seven-permission family behind it.
 */
export type CommerceVertical = 'gastronomy' | 'experience';

/**
 * The seven authorities every commerce vertical needs, named independently of
 * which enum family provides them.
 */
export type CommercePermissionSlot =
    | 'editOwn'
    | 'create'
    | 'viewAll'
    | 'editAll'
    | 'delete'
    | 'moderateReview'
    | 'moderationChange';

/**
 * The legacy `commerce.*` family — one set shared by both verticals, which is
 * exactly the defect HOS-1077 fixes.
 *
 * RETIRING: release 2 (contract) deletes this table together with the seven
 * enum values it names.
 */
const LEGACY_COMMERCE_PERMISSIONS: Readonly<Record<CommercePermissionSlot, PermissionEnum>> = {
    editOwn: PermissionEnum.COMMERCE_EDIT_OWN,
    create: PermissionEnum.COMMERCE_CREATE,
    viewAll: PermissionEnum.COMMERCE_VIEW_ALL,
    editAll: PermissionEnum.COMMERCE_EDIT_ALL,
    delete: PermissionEnum.COMMERCE_DELETE,
    moderateReview: PermissionEnum.COMMERCE_MODERATE_REVIEW,
    moderationChange: PermissionEnum.COMMERCE_MODERATION_CHANGE
};

/**
 * The per-vertical families that replace {@link LEGACY_COMMERCE_PERMISSIONS}.
 *
 * This table is the whole point of HOS-1077: `gastronomy.editAll` and
 * `experience.editAll` are different permissions, so a restaurant moderator can
 * finally be granted one without the other.
 */
const VERTICAL_PERMISSIONS: Readonly<
    Record<CommerceVertical, Readonly<Record<CommercePermissionSlot, PermissionEnum>>>
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
 * The per-vertical twin of {@link RoleEnum.COMMERCE_OWNER}, which is granted
 * alongside these until release 2 retires it.
 */
export const VERTICAL_OWNER_ROLES: Readonly<Record<CommerceVertical, RoleEnum>> = {
    gastronomy: RoleEnum.GASTRONOMY_OWNER,
    experience: RoleEnum.EXPERIENCE_OWNER
};

/**
 * Resolves the concrete `PermissionEnum` a vertical uses for one slot.
 *
 * Exported so route files can name the same value the service will check,
 * instead of re-deriving the mapping at each call site.
 *
 * @param vertical - The commerce vertical.
 * @param slot - Which of the seven authorities is wanted.
 * @returns The vertical's own permission for that slot.
 */
export function verticalPermission(
    vertical: CommerceVertical,
    slot: CommercePermissionSlot
): PermissionEnum {
    return VERTICAL_PERMISSIONS[vertical][slot];
}

/**
 * The ONE dual-read in the service layer (HOS-1077 release 1 = expand).
 *
 * An actor passes when they hold EITHER the vertical's own permission OR the
 * legacy `commerce.*` one. Both directions matter during the migration window:
 *
 * - Legacy accepted → nobody with only `commerce.*` rows loses access before
 *   the data-migration reaches their environment.
 * - Vertical accepted → the split is usable the moment this ships, which is the
 *   product change the issue asks for.
 *
 * `vertical` is optional because two callers are genuinely vertical-agnostic
 * (`BaseCommerceListingService` fallbacks and the stateless provisioning
 * helpers); passing nothing preserves today's commerce-only behaviour exactly.
 *
 * Release 2 (contract) deletes the legacy branch, at which point a caller that
 * omits `vertical` fails closed — which is why every gastronomy/experience call
 * site passes one now.
 *
 * @param actor - The actor performing the action.
 * @param slot - Which of the seven authorities is being demanded.
 * @param vertical - The vertical whose family should be accepted, if known.
 * @returns `true` when the actor holds the vertical's permission or the legacy one.
 */
export function hasCommercePermission(
    actor: Actor,
    slot: CommercePermissionSlot,
    vertical?: CommerceVertical
): boolean {
    if (vertical !== undefined && hasPermission(actor, VERTICAL_PERMISSIONS[vertical][slot])) {
        return true;
    }
    // DUAL-READ (HOS-1077 expand). Release 2 removes this line.
    return hasPermission(actor, LEGACY_COMMERCE_PERMISSIONS[slot]);
}

// ---------------------------------------------------------------------------
// Commerce listing permission checks
// ---------------------------------------------------------------------------

/**
 * Verifies the actor may create a new commerce listing.
 *
 * Requires an authenticated account and NOTHING else (HOS-687 / HOS-589 §6.1).
 *
 * This deliberately no longer demands `COMMERCE_CREATE`. Creating the listing
 * is the act that MAKES someone a commerce owner — demanding the owner's own
 * permission to perform it made the role unreachable for every account that
 * did not already have it, which is everyone. It is the exact mirror of host
 * onboarding, where creating the first accommodation draft requires no
 * `ACCOMMODATION_*` permission and grants `HOST` on the way through.
 *
 * The admin create path is unaffected: `apps/api/src/routes/gastronomy/admin/create.ts`
 * and its experience twin carry their own `requiredPermissions:
 * [COMMERCE_CREATE]` at the route, so relaxing this shared service predicate
 * does not widen the admin door.
 *
 * @param actor - The actor performing the action.
 * @param _data - The creation payload (unused here; accepted for signature consistency).
 * @throws {ServiceError} UNAUTHORIZED when the actor is anonymous / a guest.
 */
export function checkCanCreateCommerce(actor: Actor, _data: unknown): void {
    if (isAnonymousActor(actor)) {
        throw new ServiceError(
            ServiceErrorCode.UNAUTHORIZED,
            'Authentication required to create a commerce listing'
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
 * @param vertical - Commerce vertical whose own `editAll` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanEditAll(actor: Actor, _entity: unknown, vertical?: CommerceVertical): void {
    if (!hasCommercePermission(actor, 'editAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to edit any commerce listing'
        );
    }
}

/**
 * Verifies the actor may perform an operational edit on their own commerce listing.
 *
 * Accepts either `editAll` (staff) or `editOwn` (owner), provided the actor is
 * the listing's owner. All owner sections collapse to the single `editOwn`
 * permission (SPEC-253 D2=b), so there is no per-section parameter — the dead
 * `ownSectionPermission` argument no call site ever passed was dropped in
 * HOS-1077 to make room for `vertical` without a four-argument signature.
 *
 * @param actor - The actor performing the action.
 * @param entity - The entity being updated (must have `ownerId`).
 * @param vertical - Commerce vertical whose own permissions also pass (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwn(
    actor: Actor,
    entity: { ownerId?: string | null },
    vertical?: CommerceVertical
): void {
    if (
        hasCommercePermission(actor, 'editAll', vertical) ||
        (hasCommercePermission(actor, 'editOwn', vertical) && isOwner(actor, entity))
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
 * @param vertical - Commerce vertical whose own permissions also pass (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when neither condition is met.
 */
export function checkCanEditOwnOrAll(
    actor: Actor,
    entity: { ownerId?: string | null },
    vertical?: CommerceVertical
): void {
    if (hasCommercePermission(actor, 'editAll', vertical)) {
        return;
    }
    if (isOwner(actor, entity) && hasCommercePermission(actor, 'editOwn', vertical)) {
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
 * @param vertical - Commerce vertical whose own `delete` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanDeleteCommerce(
    actor: Actor,
    _entity: unknown,
    vertical?: CommerceVertical
): void {
    if (!hasCommercePermission(actor, 'delete', vertical)) {
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
 * @param vertical - Commerce vertical whose own `viewAll` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanViewAll(actor: Actor, vertical?: CommerceVertical): void {
    if (!hasCommercePermission(actor, 'viewAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view all commerce listings'
        );
    }
}

/**
 * Verifies the actor may use the admin-list path for a commerce entity type.
 *
 * Requires `viewAll` — the vertical's own permission, or the legacy commerce
 * one. Scoping of the results themselves is enforced in `_executeAdminSearch`,
 * not here.
 *
 * HOS-1077 dropped the `viewOwnPermission` parameter: it was a forward-compat
 * stub that every caller satisfied by passing `COMMERCE_VIEW_ALL`, i.e. the
 * same permission the first branch already checked, so the OR could never
 * admit anyone the first branch did not. The vertical split is what that stub
 * was waiting for, and it arrives as `vertical` instead.
 *
 * @param actor - The actor performing the action.
 * @param vertical - Commerce vertical whose own `viewAll` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor holds neither permission.
 */
export function checkCanAdminListCommerce(actor: Actor, vertical?: CommerceVertical): void {
    if (!hasCommercePermission(actor, 'viewAll', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: viewAll required for commerce admin list'
        );
    }
}

/**
 * Verifies the actor may moderate a review on a commerce listing.
 * Requires `COMMERCE_MODERATE_REVIEW`.
 *
 * @param actor - The actor performing the action.
 * @param vertical - Commerce vertical whose own `moderateReview` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanModerateReview(actor: Actor, vertical?: CommerceVertical): void {
    if (!hasCommercePermission(actor, 'moderateReview', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate commerce reviews'
        );
    }
}

/**
 * Verifies the actor may change the moderation state of a commerce LISTING.
 * Requires `COMMERCE_MODERATION_CHANGE` (HOS-686).
 *
 * ## Why this is not {@link checkCanModerateReview}
 *
 * `COMMERCE_MODERATE_REVIEW` moderates reviews written *about* a listing. This
 * one moderates the listing itself — the takedown verdict the commerce
 * visibility reconciler reads (`moderationState === REJECTED` flips the listing
 * to `PRIVATE` / `INACTIVE`). Anyone grepping "moderate" under commerce finds
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
 * @param vertical - Commerce vertical whose own `moderationChange` permission also passes (HOS-1077).
 * @throws {ServiceError} FORBIDDEN when the actor lacks the required permission.
 */
export function checkCanModerateCommerceListing(actor: Actor, vertical?: CommerceVertical): void {
    if (!hasCommercePermission(actor, 'moderationChange', vertical)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate commerce listing'
        );
    }
}
