// packages/types/src/entities/user/user.input.types.ts

import type { PermissionType } from '@repo/types/entities/user/permission.types.js';
import type { RoleType } from '@repo/types/entities/user/role.types.js';
import type { UserBookmarkType } from '@repo/types/entities/user/user.bookmark.types.js';
import type { NewEntityInput, Writable } from '../../../common/helpers.types.js';
import type { UserType } from '../user.types.js';

/**
 * Partial editable structure of a UserType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialUser = Partial<Writable<UserType>>;

/**
 * Input structure used to create a new user.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewUserInput = NewEntityInput<UserType>;

/**
 * Input structure used to update an existing user.
 * All fields are optional for partial patching.
 */
export type UpdateUserInput = PartialUser;

/**
 * Partial editable structure of a RoleType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialRole = Partial<Writable<RoleType>>;

/**
 * Input structure used to create a new role.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewRoleInput = NewEntityInput<RoleType>;

/**
 * Input structure used to update an existing role.
 * All fields are optional for partial patching.
 */
export type UpdateRoleInput = PartialRole;

/**
 * Partial editable structure of a PermissionType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialPermission = Partial<Writable<PermissionType>>;

/**
 * Input structure used to create a new permission.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewPermissionInput = NewEntityInput<PermissionType>;

/**
 * Input structure used to update an existing permission.
 * All fields are optional for partial patching.
 */
export type UpdatePermissionInput = PartialPermission;

/**
 * Partial editable structure of a UserBookmarkType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialUserBookmark = Partial<Writable<UserBookmarkType>>;

/**
 * Input structure used to create a new user bookmark.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewUserBookmarkInput = NewEntityInput<UserBookmarkType>;

/**
 * Input structure used to update an existing user bookmark.
 * All fields are optional for partial patching.
 */
export type UpdateUserBookmarkInput = PartialUserBookmark;
