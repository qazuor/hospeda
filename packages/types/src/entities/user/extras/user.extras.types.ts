import type { PermissionType } from '@repo/types/entities/user/permission.types.js';
import type { RoleType } from '@repo/types/entities/user/role.types.js';
import type { UserBookmarkType } from '@repo/types/entities/user/user.bookmark.types.js';
import type { UserType } from '@repo/types/entities/user/user.types.js';

export type UserProfileSummary = Pick<
    UserType,
    'id' | 'userName' | 'firstName' | 'lastName' | 'profile' | 'socialNetworks'
>;

export type UserWithAccess = UserType & {
    permissions?: PermissionType[];
    role?: RoleType;
    bookmarks?: UserBookmarkType[];
};
