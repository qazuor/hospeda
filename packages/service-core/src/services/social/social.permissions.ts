import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Asserts that the actor holds SOCIAL_HASHTAG_VIEW permission.
 * Used for read/list/search/count operations on the hashtag catalog.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanViewHashtag = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_HASHTAG_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_HASHTAG_VIEW required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_HASHTAG_MANAGE permission.
 * Used for create/update/delete operations on the hashtag catalog.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageHashtag = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_HASHTAG_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_HASHTAG_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_HASHTAG_SET_MANAGE permission.
 * Gates all CRUD operations on hashtag sets (no separate view perm exists).
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageHashtagSet = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_HASHTAG_SET_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_FOOTER_MANAGE permission.
 * Gates all CRUD operations on post footers.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManagePostFooter = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_FOOTER_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_FOOTER_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_CAMPAIGN_MANAGE permission.
 * Gates all CRUD operations on social campaigns.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageCampaign = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_CAMPAIGN_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_CAMPAIGN_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_BATCH_MANAGE permission.
 * Gates all CRUD operations on social content batches.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageContentBatch = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_BATCH_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_BATCH_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_AUDIENCE_MANAGE permission.
 * Gates all CRUD operations on audience descriptors.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageAudience = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_AUDIENCE_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_AUDIENCE_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_PLATFORM_FORMAT_VIEW permission.
 * Used for read/list/search/count operations on platform formats.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanViewPlatformFormat = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_PLATFORM_FORMAT_VIEW required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_PLATFORM_MANAGE permission.
 * Used for update operations on platform formats.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManagePlatform = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_PLATFORM_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_PLATFORM_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_SETTINGS_MANAGE permission.
 * Gates all operations on social settings (read + write).
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanManageSettings = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_SETTINGS_MANAGE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_SETTINGS_MANAGE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_POST_APPROVE permission.
 * Gates approve, reject, and requestChanges operations on social posts.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanApprovePost = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_POST_APPROVE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_POST_APPROVE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_POST_SCHEDULE permission.
 * Gates schedule and markReady operations on social posts.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanSchedulePost = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_POST_SCHEDULE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_POST_SCHEDULE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_POST_PAUSE permission.
 * Gates pause and unpause operations on social posts.
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanPausePost = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_POST_PAUSE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_POST_PAUSE required'
        );
    }
};

/**
 * Asserts that the actor holds SOCIAL_POST_ARCHIVE permission.
 * Gates archive operations on social posts (soft-delete + status=ARCHIVED).
 *
 * @param actor - The acting user.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the permission.
 */
export const checkCanArchivePost = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.SOCIAL_POST_ARCHIVE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: SOCIAL_POST_ARCHIVE required'
        );
    }
};
