import type {
    BaseEntityType,
    ContactInfoType,
    FullLocationType,
    SocialNetworkType
} from '../common.types.js';
import type { EntityTypeEnum, StateEnum } from '../enums.types.js';
import type { AccommodationType } from './accommodation.types.js';
import type { DestinationType } from './destination.types.js';
import type { EventType } from './event.types.js';
import type { PostType } from './post.types.js';

/**
 * Accommodation bookmarked by a user for quick access.
 */
export interface UserBookmarkType {
    ownerId: string;
    owner?: UserType;
    entityId: string;
    entity?: AccommodationType | DestinationType | UserType | PostType | EventType;
    entityType: EntityTypeEnum; // e.g., 'accommodation', 'destination', 'user', 'post', 'event'
    name?: string;
    description?: string;
}

/**
 * Public user profile for display purposes (e.g., host page).
 */
export interface UserProfile {
    avatar?: string;
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
    userIds?: string[];
    users?: UserType[];
    roleIds?: string[];
    roles?: RoleType[];
}

/**
 * Represents a role (can be linked to permissions in RBAC).
 */
export interface RoleType extends BaseEntityType {
    description: string;
    isBuiltIn: boolean;
    isDeprecated?: boolean;
    isDefault?: boolean;
    permissionIds?: string[];
    permissions?: PermissionType[];
    users?: UserType[];
}

/**
 * Represents the many-to-many relationship between roles and permissions.
 */
export interface RolePermissionType {
    roleId: string;
    role?: RoleType;
    permissionId: string;
    permission?: PermissionType;
}

/**
 * Explicit permission assigned to a specific user.
 */
export interface UserPermissionType {
    userId: string;
    user?: UserType;
    permissionId: string;
    permission?: PermissionType;
}

/**
 * Main user entity used for authentication and access control.
 */
export interface UserType extends BaseEntityType {
    userName: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    brithDate?: Date;
    location?: FullLocationType;
    contactInfo?: ContactInfoType;
    socialNetworks?: SocialNetworkType;
    roleId: string;
    role?: RoleType;
    permissionsIds?: string[];
    permissions?: PermissionType[];
    state: StateEnum;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    profile?: UserProfile;
    settings?: UserSettingsType;
    bookmarks?: UserBookmarkType[];
}
