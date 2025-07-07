import type { TagType } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can create a tag.
 * Requires TAG_CREATE permission.
 * @param actor - The actor performing the action.
 * @throws ServiceError if not permitted.
 */
export const checkCanCreateTag = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_CREATE permission'
        );
    }
};

/**
 * Checks if the actor can update a tag.
 * Requires TAG_UPDATE permission.
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 * @throws ServiceError if not permitted.
 */
export const checkCanUpdateTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_UPDATE permission'
        );
    }
};

/**
 * Checks if the actor can delete a tag.
 * Requires TAG_DELETE permission.
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 * @throws ServiceError if not permitted.
 */
export const checkCanDeleteTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_DELETE permission'
        );
    }
};

/**
 * Checks if the actor can restore a tag.
 * Uses TAG_UPDATE permission (no dedicated restore permission).
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 * @throws ServiceError if not permitted.
 */
export const checkCanRestoreTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_UPDATE permission'
        );
    }
};

/**
 * Checks if the actor can view a tag.
 * All users can view tags (public), but you could restrict to a permission if needed.
 * @param actor - The actor performing the action.
 * @param tag - The tag entity.
 * @throws ServiceError if not permitted.
 */
export const checkCanViewTag = (_actor: Actor, _tag: TagType): void => {
    // Tags are public; no restriction by default.
    return;
};

/**
 * Checks if the actor can list tags.
 * All users can list tags (public), but you could restrict to a permission if needed.
 * @param actor - The actor performing the action.
 * @throws ServiceError if not permitted.
 */
export const checkCanListTags = (_actor: Actor): void => {
    // Tags are public; no restriction by default.
    return;
};

/**
 * Checks if the actor can search tags.
 * All users can search tags (public), but you could restrict to a permission if needed.
 * @param actor - The actor performing the action.
 * @throws ServiceError if not permitted.
 */
export const checkCanSearchTags = (_actor: Actor): void => {
    // Tags are public; no restriction by default.
    return;
};

/**
 * Checks if the actor can count tags.
 * All users can count tags (public), but you could restrict to a permission if needed.
 * @param actor - The actor performing the action.
 * @throws ServiceError if not permitted.
 */
export const checkCanCountTags = (_actor: Actor): void => {
    // Tags are public; no restriction by default.
    return;
};

/**
 * Checks if the actor can soft-delete a tag.
 * Uses TAG_DELETE permission.
 */
export const checkCanSoftDeleteTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_DELETE permission'
        );
    }
};

/**
 * Checks if the actor can hard-delete a tag.
 * Uses TAG_DELETE permission (no dedicated hard delete permission).
 */
export const checkCanHardDeleteTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_DELETE permission'
        );
    }
};

/**
 * Checks if the actor can update the visibility of a tag.
 * Uses TAG_UPDATE permission.
 */
export const checkCanUpdateVisibilityTag = (actor: Actor, _tag: TagType): void => {
    if (!hasPermission(actor, PermissionEnum.TAG_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing TAG_UPDATE permission'
        );
    }
};
