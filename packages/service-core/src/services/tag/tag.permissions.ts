/**
 * @fileoverview Permission helpers for the user-tag subsystem (SPEC-086).
 *
 * All permission checks dispatch on tag.type (INTERNAL / SYSTEM / USER) per D-017.
 * Ownership checks for USER tags compare actor.id against tag.ownerId.
 *
 * Rules from D-017:
 * - TAG_USER_UPDATE_ANY is intentionally absent (D-012).
 * - TAG_SYSTEM_ASSIGN is not a separate permission — TAG_ASSIGN_ADD covers it (D-017).
 *
 * Pattern: every exported function EITHER returns void (allowed) OR throws ServiceError (denied).
 */
import type { Tag } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode, TagTypeEnum } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

// ---------------------------------------------------------------------------
// Tag creation — dispatches by type
// ---------------------------------------------------------------------------

/**
 * Checks if the actor can create a tag of the given type.
 *
 * - INTERNAL → TAG_INTERNAL_CREATE
 * - SYSTEM   → TAG_SYSTEM_CREATE
 * - USER     → TAG_USER_CREATE
 *
 * @param actor - The actor performing the action.
 * @param type - TagTypeEnum value from the create input.
 * @throws {ServiceError} FORBIDDEN if actor lacks the required permission.
 */
export const assertCanCreateTag = (actor: Actor, type: TagTypeEnum): void => {
    const permMap: Record<TagTypeEnum, PermissionEnum> = {
        [TagTypeEnum.INTERNAL]: PermissionEnum.TAG_INTERNAL_CREATE,
        [TagTypeEnum.SYSTEM]: PermissionEnum.TAG_SYSTEM_CREATE,
        [TagTypeEnum.USER]: PermissionEnum.TAG_USER_CREATE
    };
    const required = permMap[type];
    if (!hasPermission(actor, required)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `Permission denied: ${required} required to create ${type} tag`
        );
    }
};

// ---------------------------------------------------------------------------
// Tag update — dispatches by type, USER checks ownership
// ---------------------------------------------------------------------------

/**
 * Checks if the actor can update the given tag.
 *
 * - INTERNAL → TAG_INTERNAL_UPDATE
 * - SYSTEM   → TAG_SYSTEM_UPDATE
 * - USER     → TAG_USER_UPDATE_OWN (only for tag owner; TAG_USER_UPDATE_ANY does not exist per D-012)
 *
 * @param actor - The actor performing the action.
 * @param tag - The existing tag entity.
 * @throws {ServiceError} FORBIDDEN if actor lacks permission or does not own a USER tag.
 */
export const assertCanUpdateTag = (actor: Actor, tag: Tag): void => {
    switch (tag.type) {
        case TagTypeEnum.INTERNAL:
            if (!hasPermission(actor, PermissionEnum.TAG_INTERNAL_UPDATE)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_INTERNAL_UPDATE required to update INTERNAL tag'
                );
            }
            break;
        case TagTypeEnum.SYSTEM:
            if (!hasPermission(actor, PermissionEnum.TAG_SYSTEM_UPDATE)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_SYSTEM_UPDATE required to update SYSTEM tag'
                );
            }
            break;
        case TagTypeEnum.USER:
            if (
                tag.ownerId !== actor.id ||
                !hasPermission(actor, PermissionEnum.TAG_USER_UPDATE_OWN)
            ) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_USER_UPDATE_OWN required and actor must be the tag owner'
                );
            }
            break;
        default: {
            // Exhaustive check guard
            const _exhaustive: never = tag.type;
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, `Unknown tag type: ${_exhaustive}`);
        }
    }
};

// ---------------------------------------------------------------------------
// Tag delete — dispatches by type, USER checks ownership and super-admin path
// ---------------------------------------------------------------------------

/**
 * Checks if the actor can delete the given tag.
 *
 * - INTERNAL → TAG_INTERNAL_DELETE
 * - SYSTEM   → TAG_SYSTEM_DELETE
 * - USER (own) → TAG_USER_DELETE_OWN + actor must be owner
 * - USER (any) → TAG_USER_DELETE_ANY (super-admin moderation path)
 *
 * @param actor - The actor performing the action.
 * @param tag - The existing tag entity.
 * @throws {ServiceError} FORBIDDEN if actor cannot delete the tag.
 */
export const assertCanDeleteTag = (actor: Actor, tag: Tag): void => {
    switch (tag.type) {
        case TagTypeEnum.INTERNAL:
            if (!hasPermission(actor, PermissionEnum.TAG_INTERNAL_DELETE)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_INTERNAL_DELETE required to delete INTERNAL tag'
                );
            }
            break;
        case TagTypeEnum.SYSTEM:
            if (!hasPermission(actor, PermissionEnum.TAG_SYSTEM_DELETE)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_SYSTEM_DELETE required to delete SYSTEM tag'
                );
            }
            break;
        case TagTypeEnum.USER: {
            const isOwner = tag.ownerId === actor.id;
            const canDeleteOwn =
                isOwner && hasPermission(actor, PermissionEnum.TAG_USER_DELETE_OWN);
            const canDeleteAny = hasPermission(actor, PermissionEnum.TAG_USER_DELETE_ANY);
            if (!canDeleteOwn && !canDeleteAny) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_USER_DELETE_OWN (own) or TAG_USER_DELETE_ANY (super-admin) required'
                );
            }
            break;
        }
        default: {
            const _exhaustive: never = tag.type;
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, `Unknown tag type: ${_exhaustive}`);
        }
    }
};

// ---------------------------------------------------------------------------
// Tag view — picker visibility per D-006
// ---------------------------------------------------------------------------

/**
 * Checks if the actor can view a specific tag (picker visibility per D-006).
 *
 * - INTERNAL → TAG_INTERNAL_VIEW
 * - SYSTEM   → any authenticated user (no special permission required)
 * - USER     → TAG_USER_VIEW_OWN + actor must be owner,
 *              OR TAG_VIEW_ALL_USER_TAGS (super-admin moderation)
 *
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 * @throws {ServiceError} FORBIDDEN if tag is not visible to actor.
 */
export const assertCanViewTag = (actor: Actor, tag: Tag): void => {
    if (!actor.id) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: authenticated actor required to view tags'
        );
    }
    switch (tag.type) {
        case TagTypeEnum.INTERNAL:
            if (!hasPermission(actor, PermissionEnum.TAG_INTERNAL_VIEW)) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_INTERNAL_VIEW required to view INTERNAL tag'
                );
            }
            break;
        case TagTypeEnum.SYSTEM:
            // SYSTEM tags are visible to any authenticated actor — no special permission needed
            break;
        case TagTypeEnum.USER: {
            const isOwner = tag.ownerId === actor.id;
            const canViewOwn = isOwner && hasPermission(actor, PermissionEnum.TAG_USER_VIEW_OWN);
            const canViewAll = hasPermission(actor, PermissionEnum.TAG_VIEW_ALL_USER_TAGS);
            if (!canViewOwn && !canViewAll) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: TAG_USER_VIEW_OWN (own) or TAG_VIEW_ALL_USER_TAGS (super-admin) required'
                );
            }
            break;
        }
        default: {
            const _exhaustive: never = tag.type;
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, `Unknown tag type: ${_exhaustive}`);
        }
    }
};

// ---------------------------------------------------------------------------
// Cross-cutting view helpers
// ---------------------------------------------------------------------------

/**
 * Checks if the actor can view all tag assignments across users (super-admin attribution).
 * Requires TAG_VIEW_ALL_ASSIGNMENTS.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if actor lacks TAG_VIEW_ALL_ASSIGNMENTS.
 */
export const assertCanViewAllAssignments = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: TAG_VIEW_ALL_ASSIGNMENTS required'
        );
    }
};

/**
 * Checks if the actor can view all USER tags across users (super-admin moderation).
 * Requires TAG_VIEW_ALL_USER_TAGS.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if actor lacks TAG_VIEW_ALL_USER_TAGS.
 */
export const assertCanViewAllUserTags = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_VIEW_ALL_USER_TAGS)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: TAG_VIEW_ALL_USER_TAGS required'
        );
    }
};

// ---------------------------------------------------------------------------
// Legacy compatibility shims (used by BaseCrudRelatedService hooks)
// These delegate to the new typed helpers with a sensible fallback type.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use assertCanCreateTag(actor, type) instead.
 * Legacy shim for BaseCrudService._canCreate hook.
 */
export const checkCanCreateTag = (actor: Actor): void => {
    // Without type context, we require the least-privileged create permission as a gate.
    // Routes must call assertCanCreateTag with the actual type before service creation.
    if (
        !hasPermission(actor, PermissionEnum.TAG_USER_CREATE) &&
        !hasPermission(actor, PermissionEnum.TAG_SYSTEM_CREATE) &&
        !hasPermission(actor, PermissionEnum.TAG_INTERNAL_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: TAG_USER_CREATE, TAG_SYSTEM_CREATE, or TAG_INTERNAL_CREATE required'
        );
    }
};

/**
 * @deprecated Use assertCanUpdateTag(actor, tag) instead.
 * Legacy shim for BaseCrudService._canUpdate hook.
 */
export const checkCanUpdateTag = (actor: Actor, tag: Tag): void => {
    assertCanUpdateTag(actor, tag);
};

/**
 * @deprecated Use assertCanDeleteTag(actor, tag) instead.
 * Legacy shim for BaseCrudService._canDelete hook.
 */
export const checkCanDeleteTag = (actor: Actor, tag: Tag): void => {
    assertCanDeleteTag(actor, tag);
};

/**
 * Tags no longer support soft-delete per D-011 (hard delete only).
 * This shim prevents BaseCrudService._canSoftDelete from silently passing.
 *
 * @throws {ServiceError} Always throws FORBIDDEN — soft-delete is not allowed.
 */
export const checkCanSoftDeleteTag = (_actor: Actor, _tag: Tag): void => {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Tags use hard delete only (D-011). Soft delete is not supported.'
    );
};

/**
 * @deprecated Use assertCanDeleteTag(actor, tag) instead.
 * Legacy shim for BaseCrudService._canHardDelete hook.
 */
export const checkCanHardDeleteTag = (actor: Actor, tag: Tag): void => {
    assertCanDeleteTag(actor, tag);
};

/**
 * Tags no longer support restore per D-011 (hard delete only).
 * This shim prevents BaseCrudService._canRestore from silently passing.
 *
 * @throws {ServiceError} Always throws FORBIDDEN — restore is not supported.
 */
export const checkCanRestoreTag = (_actor: Actor, _tag: Tag): void => {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Tags use hard delete only (D-011). Restore is not supported.'
    );
};

/**
 * @deprecated Use assertCanViewTag(actor, tag) instead.
 * Legacy shim for BaseCrudService._canView hook.
 */
export const checkCanViewTag = (actor: Actor, tag: Tag): void => {
    assertCanViewTag(actor, tag);
};

/**
 * Checks if the actor can list tags.
 * Any authenticated user can list visible tags.
 * Filtering by visibility is done at service layer.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if actor is not authenticated.
 */
export const checkCanListTags = (actor: Actor): void => {
    if (!actor.id) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: authenticated actor required to list tags'
        );
    }
};

/**
 * Checks if the actor can search tags.
 * Any authenticated user can search visible tags.
 *
 * @param actor - The actor performing the action.
 */
export const checkCanSearchTags = (actor: Actor): void => {
    checkCanListTags(actor);
};

/**
 * Checks if the actor can count tags.
 * Any authenticated user can count visible tags.
 *
 * @param actor - The actor performing the action.
 */
export const checkCanCountTags = (actor: Actor): void => {
    checkCanListTags(actor);
};

/**
 * Checks if the actor can update visibility of a tag.
 * Delegates to assertCanUpdateTag.
 *
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 */
export const checkCanUpdateVisibilityTag = (actor: Actor, tag: Tag): void => {
    assertCanUpdateTag(actor, tag);
};

/**
 * Checks if an actor has permission to admin-list tags.
 * Requires at least one of the type-specific view permissions.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} FORBIDDEN if actor lacks any tag view permission.
 */
export function checkCanAdminList(actor: Actor): void {
    const hasAnyView =
        hasPermission(actor, PermissionEnum.TAG_INTERNAL_VIEW) ||
        hasPermission(actor, PermissionEnum.TAG_SYSTEM_VIEW) ||
        hasPermission(actor, PermissionEnum.TAG_USER_VIEW_OWN) ||
        hasPermission(actor, PermissionEnum.TAG_VIEW_ALL_USER_TAGS);

    if (!actor.id || !hasAnyView) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: TAG_INTERNAL_VIEW, TAG_SYSTEM_VIEW, TAG_USER_VIEW_OWN, or TAG_VIEW_ALL_USER_TAGS required for admin list'
        );
    }
}
