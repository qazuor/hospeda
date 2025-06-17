import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    WithOptional,
    WithVisibility,
    Writable
} from '../../common/helpers.types.js';
import type { UserId } from '../../common/id.types.js';
import type { FullLocationType } from '../../common/location.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { PermissionEnum } from '../../enums/permission.enum.js';
import { RoleEnum } from '../../enums/role.enum.js';
import type { UserBookmarkType } from './user.bookmark.types.js';
import type { UserProfile } from './user.profile.types.js';
import type { UserSettingsType } from './user.settings.types.js';

/**
 * Represents a user in the system.
 * - `role` is a fixed enum.
 * - `permissions` are direct permissions assigned to the user (by enum).
 */
export interface UserType extends WithAudit, WithLifecycleState, WithVisibility, WithAdminInfo {
    id: UserId;
    userName: string;
    password: string;

    firstName?: string;
    lastName?: string;
    birthDate?: Date;

    email?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;

    contactInfo?: ContactInfoType;
    location?: FullLocationType;
    socialNetworks?: SocialNetworkType;

    role: RoleEnum;
    permissions?: PermissionEnum[];

    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}

/**
 * Partial editable structure of a UserType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialUserType = Partial<Writable<UserType>>;

/**
 * Input structure used to create a new user.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 *
 * @example
 * // Creating a new user (id and audit fields are optional)
 * const input: NewUserInputType = {
 *   userName: 'john_doe',
 *   password: 'securePassword',
 *   role: 'role',
 * };
 */
export type NewUserInputType = WithOptional<
    UserType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing user.
 * All fields are optional for partial patching.
 *
 * @example
 * // Updating a user (only the fields to update are provided)
 * const input: UpdateUserInputType = {
 *   firstName: 'John',
 * };
 */
export type UpdateUserInputType = Partial<Writable<UserType>>;

export type UserProfileSummaryType = Pick<
    UserType,
    'id' | 'userName' | 'firstName' | 'lastName' | 'profile' | 'socialNetworks'
>;

/**
 * UserWithRelationsType extends UserType with all possible related entities.
 * - permissions: Direct permissions assigned to the user (by enum)
 * - role: The user's role (enum)
 * - bookmarks: Array of related UserBookmarkType (if loaded)
 */
export type UserWithRelationsType = UserType & {
    permissions?: PermissionEnum[];
    role: RoleEnum;
    bookmarks?: UserBookmarkType[];
};

/**
 * Represents a public (anonymous) user with minimal information.
 * Used when there is no authenticated user in the session.
 *
 * @example
 * const publicUser = createPublicUser();
 * // publicUser.id === 'public' as UserId
 * // publicUser.userName === 'public'
 * // publicUser.role === 'public' as RoleEnum
 */
export interface PublicUserType {
    id: UserId;
    userName: string;
    role: RoleEnum;
}

/**
 * Factory function to create a PublicUserType instance.
 *
 * @returns {PublicUserType} The public user object.
 * @example
 * const publicUser = createPublicUser();
 * // publicUser.id === 'public' as UserId
 * // publicUser.userName === 'public'
 * // publicUser.role === 'public' as RoleEnum
 */
export const createPublicUser = (): PublicUserType => ({
    id: '00000000-0000-4000-y000-000000000000' as UserId,
    userName: 'public',
    role: RoleEnum.GUEST
});
