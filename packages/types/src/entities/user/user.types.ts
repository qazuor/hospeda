import type { PermissionType } from '@repo/types/entities/user/user.permission.types.js';
import type { RoleType } from '@repo/types/entities/user/user.role.types.js';
import type { ContactInfoType } from '../../common/contact.types.js';
import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { PermissionId, RoleId, UserId } from '../../common/id.types.js';
import type { FullLocationType } from '../../common/location.types.js';
import type { SocialNetworkType } from '../../common/social.types.js';
import type { UserBookmarkType } from './user.bookmark.types.js';
import type { UserProfile } from './user.profile.types.js';
import type { UserSettingsType } from './user.settings.types.js';

export interface UserType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: UserId;
    userName: string;
    password: string;

    firstName?: string;
    lastName?: string;
    birthDate?: Date;

    emailVerified?: boolean;
    phoneVerified?: boolean;

    contactInfo?: ContactInfoType;
    location?: FullLocationType;
    socialNetworks?: SocialNetworkType;

    roleId: RoleId;
    permissionIds?: PermissionId[];

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
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewUserInputType = NewEntityInput<UserType>;

/**
 * Input structure used to update an existing user.
 * All fields are optional for partial patching.
 */
export type UpdateUserInputType = PartialUserType;

export type UserProfileSummaryType = Pick<
    UserType,
    'id' | 'userName' | 'firstName' | 'lastName' | 'profile' | 'socialNetworks'
>;

export type UserWithRelationsType = UserType & {
    permissions?: PermissionType[];
    role?: RoleType;
    bookmarks?: UserBookmarkType[];
};
