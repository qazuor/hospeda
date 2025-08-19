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
import type { AuthProviderEnum } from '../../enums/auth-provider.enum.js';
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
    slug: string;
    /** Primary authentication provider that owns the session for this user */
    authProvider?: AuthProviderEnum;
    /** Provider-scoped user id used to map IdP user to DB user (e.g., Clerk user id) */
    authProviderUserId?: string;

    displayName?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: Date;

    contactInfo?: ContactInfoType;
    location?: FullLocationType;
    socialNetworks?: SocialNetworkType;

    role: RoleEnum;
    permissions: PermissionEnum[];

    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}

/**
 * Represents an external OAuth2 identity linked to the user (e.g., Google, GitHub).
 * Captures the normalized provider/user mapping and selected profile fields.
 */
export interface UserAuthIdentityType {
    id: string;
    userId: UserId;
    provider: string;
    providerUserId: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    raw?: unknown;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    createdById?: UserId;
    updatedById?: UserId;
    deletedAt?: Date;
    deletedById?: UserId;
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
 *   slug: 'john-doe',
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
    'id' | 'firstName' | 'lastName' | 'profile' | 'socialNetworks'
>;

/**
 * UserWithRelationsType extends UserType with all possible related entities.
 * - permissions: Direct permissions assigned to the user (by enum)
 * - role: The user's role (enum)
 * - bookmarks: Array of related UserBookmarkType (if loaded)
 */
export type UserWithRelationsType = UserType & {
    permissions: PermissionEnum[];
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
 * // publicUser.role === 'public' as RoleEnum
 */
export interface PublicUserType {
    id: UserId;
    role: RoleEnum;
}

/**
 * Factory function to create a PublicUserType instance.
 *
 * @returns {PublicUserType} The public user object.
 * @example
 * const publicUser = createPublicUser();
 * // publicUser.id === 'public' as UserId
 * // publicUser.role === 'public' as RoleEnum
 */
export const createPublicUser = (): PublicUserType & { permissions: PermissionEnum[] } => ({
    id: '00000000-0000-4000-y000-000000000000' as UserId,
    role: RoleEnum.GUEST,
    permissions: []
});
