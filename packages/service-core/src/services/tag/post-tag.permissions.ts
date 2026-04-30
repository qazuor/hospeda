/**
 * Permission helpers for the PostTag subsystem (SPEC-086 T-017).
 *
 * PostTags are the public-facing blog categorization taxonomy.
 * All permission checks use only `PermissionEnum` — role checks are forbidden
 * per project convention (see CLAUDE.md "Granular Permission Pattern").
 *
 * Permissions are defined in `PermissionEnum`:
 * - `POST_TAG_CREATE` — create a PostTag
 * - `POST_TAG_UPDATE` — update a PostTag
 * - `POST_TAG_DELETE` — hard-delete a PostTag (impact count flow)
 * - `POST_TAG_VIEW`   — view PostTags in admin context (including INACTIVE/ARCHIVED)
 * - `POST_TAG_ASSIGN` — assign or unassign PostTags on a post
 *
 * @see SPEC-086 D-001, D-013, D-017
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Asserts that the actor has permission to create a PostTag.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With code FORBIDDEN if the actor lacks `POST_TAG_CREATE`.
 *
 * @example
 * ```ts
 * assertCanCreatePostTag(actor); // throws if actor lacks permission
 * ```
 */
export function assertCanCreatePostTag(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_TAG_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create PostTag'
        );
    }
}

/**
 * Asserts that the actor has permission to update a PostTag.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With code FORBIDDEN if the actor lacks `POST_TAG_UPDATE`.
 *
 * @example
 * ```ts
 * assertCanUpdatePostTag(actor); // throws if actor lacks permission
 * ```
 */
export function assertCanUpdatePostTag(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_TAG_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update PostTag'
        );
    }
}

/**
 * Asserts that the actor has permission to hard-delete a PostTag.
 *
 * PostTags use hard delete only (D-011). The caller should obtain the impact count
 * via `getImpactCount` before invoking `delete` so the UI can show a confirmation.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With code FORBIDDEN if the actor lacks `POST_TAG_DELETE`.
 *
 * @example
 * ```ts
 * assertCanDeletePostTag(actor); // throws if actor lacks permission
 * ```
 */
export function assertCanDeletePostTag(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_TAG_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete PostTag'
        );
    }
}

/**
 * Asserts that the actor has permission to view PostTags in admin context.
 *
 * Admin view includes INACTIVE and ARCHIVED PostTags.
 * Anonymous public access does not require this permission (D-013).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With code FORBIDDEN if the actor lacks `POST_TAG_VIEW`.
 *
 * @example
 * ```ts
 * assertCanViewPostTag(actor); // throws if actor lacks permission
 * ```
 */
export function assertCanViewPostTag(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_TAG_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view PostTag'
        );
    }
}

/**
 * Asserts that the actor has permission to assign or unassign PostTags on a post.
 *
 * Required for both `setTagsForPost` (bulk replace) and `removeTagFromPost` (single).
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} With code FORBIDDEN if the actor lacks `POST_TAG_ASSIGN`.
 *
 * @example
 * ```ts
 * assertCanAssignPostTag(actor); // throws if actor lacks permission
 * ```
 */
export function assertCanAssignPostTag(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.POST_TAG_ASSIGN)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to assign PostTag'
        );
    }
}
