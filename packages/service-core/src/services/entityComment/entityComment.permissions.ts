import { EntityTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Permission helpers for the comment system (SPEC-165).
 *
 * Comments are polymorphic but restricted to POST and EVENT at the service layer
 * (RD-3). Every permission is resolved from the comment's `entityType` to the
 * matching POST_/EVENT_ permission. There is NO `_WRITE` variant: the existing
 * `_CREATE` permission is the write gate (RD-9).
 */

/** The only entity types comments may target (RD-3). */
export const ALLOWED_COMMENT_ENTITY_TYPES = [EntityTypeEnum.POST, EntityTypeEnum.EVENT] as const;

export type CommentEntityType = (typeof ALLOWED_COMMENT_ENTITY_TYPES)[number];

/**
 * Asserts the entity type is one comments support (POST | EVENT). Returns the
 * narrowed type. Throws `VALIDATION_ERROR` for any other value (AC-3).
 *
 * @throws {ServiceError} VALIDATION_ERROR if the entity type is not POST or EVENT.
 */
export function assertCommentEntityType(entityType: string): CommentEntityType {
    if (entityType === EntityTypeEnum.POST || entityType === EntityTypeEnum.EVENT) {
        return entityType;
    }
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        `Comments are only supported on posts and events, not "${entityType}".`
    );
}

const CREATE_PERMISSION: Record<CommentEntityType, PermissionEnum> = {
    [EntityTypeEnum.POST]: PermissionEnum.POST_COMMENT_CREATE,
    [EntityTypeEnum.EVENT]: PermissionEnum.EVENT_COMMENT_CREATE
};

const VIEW_PERMISSION: Record<CommentEntityType, PermissionEnum> = {
    [EntityTypeEnum.POST]: PermissionEnum.POST_COMMENT_VIEW,
    [EntityTypeEnum.EVENT]: PermissionEnum.EVENT_COMMENT_VIEW
};

const MODERATE_PERMISSION: Record<CommentEntityType, PermissionEnum> = {
    [EntityTypeEnum.POST]: PermissionEnum.POST_COMMENT_MODERATE,
    [EntityTypeEnum.EVENT]: PermissionEnum.EVENT_COMMENT_MODERATE
};

function assertActor(actor: Actor): void {
    if (!actor || !actor.id) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied: no actor.');
    }
}

/**
 * Create gate: the actor must hold the `_CREATE` permission for the comment's
 * entity type. The entity type is validated first (AC-3).
 *
 * @throws {ServiceError} VALIDATION_ERROR for an unsupported entity type,
 *   FORBIDDEN if the actor lacks the create permission.
 */
export function checkCanCreateComment(actor: Actor, entityType: string): void {
    const resolved = assertCommentEntityType(entityType);
    assertActor(actor);
    if (!actor.permissions.includes(CREATE_PERMISSION[resolved])) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create a comment.'
        );
    }
}

/**
 * View gate (admin-level read of a specific comment): the actor must hold the
 * `_VIEW` permission matching the comment's entity type.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the view permission.
 */
export function checkCanViewComment(actor: Actor, entityType: string): void {
    const resolved = assertCommentEntityType(entityType);
    assertActor(actor);
    if (!actor.permissions.includes(VIEW_PERMISSION[resolved])) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view this comment.'
        );
    }
}

/**
 * Moderate gate (approve/reject/soft-delete/hard-delete/restore any comment):
 * the actor must hold the `_MODERATE` permission matching the entity type.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks the moderate permission.
 */
export function checkCanModerateComment(actor: Actor, entityType: string): void {
    const resolved = assertCommentEntityType(entityType);
    assertActor(actor);
    if (!actor.permissions.includes(MODERATE_PERMISSION[resolved])) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to moderate this comment.'
        );
    }
}

/**
 * List/count gate: the actor must hold at least one comment `_VIEW` permission
 * (POST or EVENT), since the list spans both entity types.
 *
 * @throws {ServiceError} FORBIDDEN if the actor holds neither view permission.
 */
export function checkCanListComments(actor: Actor): void {
    assertActor(actor);
    const hasAnyView =
        actor.permissions.includes(PermissionEnum.POST_COMMENT_VIEW) ||
        actor.permissions.includes(PermissionEnum.EVENT_COMMENT_VIEW);
    if (!hasAnyView) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list comments.'
        );
    }
}

/**
 * Recent-feed gate: the actor must hold BOTH comment `_VIEW` permissions
 * (POST and EVENT). The recent feed merges both entity types into a single flat
 * list with no per-row filtering, so partial visibility is not offered — full
 * cross-entity read access is required (SPEC-165 AC-18). The admin route also
 * enforces this via `requiredPermissions`; this check is defense in depth.
 *
 * @throws {ServiceError} FORBIDDEN if the actor lacks either view permission.
 */
export function checkCanListRecentComments(actor: Actor): void {
    assertActor(actor);
    const hasBothViews =
        actor.permissions.includes(PermissionEnum.POST_COMMENT_VIEW) &&
        actor.permissions.includes(PermissionEnum.EVENT_COMMENT_VIEW);
    if (!hasBothViews) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list recent comments.'
        );
    }
}
