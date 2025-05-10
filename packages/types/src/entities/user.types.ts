import type {
    BaseEntityType,
    ContactInfoType,
    FullLocationType,
    SocialNetworkType
} from '../common.types';
import type { StateEnum } from '../enums.types';
import type { AccommodationType } from './accommodation.types';

/**
 * Public user profile for display purposes (e.g., host page).
 */
export interface UserBookmarkType {
    userId: string;
    user?: UserType;
    accommodationId: string;
    accommodation?: AccommodationType;
    name?: string;
    description?: string;
}

/**
 * Public user profile for display purposes (e.g., host page).
 */
export interface UserProfile {
    avatar: string;
    bio?: string;
    website?: string;
    occupation?: string;
}

/**
 * Notifications preferences for the user account.
 */
export interface UserNotificationsType {
    enabled: boolean;
    allowEmails: boolean;
    allowSms: boolean;
    allowPush: boolean;
}

/**
 * Application preferences for the user account.
 */
export interface UserSettingsType {
    darkMode?: boolean;
    language?: string;
    notifications: UserNotificationsType;
}

/**
 * Represents a permission assigned to a user or role.
 */
export interface PermissionType extends BaseEntityType {
    description: string;
    isBuiltIn: boolean;
    isDeprecated: boolean;
}

/**
 * Represents a role (can be linked to permissions in RBAC).
 */
export interface RoleType extends BaseEntityType {
    description: string;
    isBuiltIn: boolean;
    isDeprecated: boolean;
    isDefault: boolean;
    permissions: PermissionType[];
}

/**
 * Main user entity used for authentication and access control.
 */
export interface UserType extends BaseEntityType {
    userName: string;
    passwordHash: string;
    displayName: string;
    firstName: string;
    lastName: string;
    brithDate: Date;
    location: FullLocationType;
    contactInfo: ContactInfoType;
    socialNetworks: SocialNetworkType;
    role: RoleType;
    permissions: PermissionType[];
    state: StateEnum;
    emailVerified: boolean;
    phoneVerified: boolean;
    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}
