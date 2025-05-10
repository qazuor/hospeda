import type {
    AdminInfoType,
    BaseEntityType,
    ContactInfoType,
    LocationType,
    SocialNetworkType
} from '../common.types';
import type { RoleTypeEnum, StateEnum } from '../enums.types';

/**
 * Public user profile for display purposes (e.g., host page).
 */
export interface UserProfile {
    /**
     * Avatar image URL or media identifier.
     */
    avatar: string;

    /**
     * Short biography or personal introduction.
     */
    bio?: string;

    /**
     * Optional personal website.
     */
    website?: string;

    /**
     * Occupation or role outside the platform.
     */
    occupation?: string;
}

/**
 * Application preferences for the user account.
 */
export interface UserSettings {
    /**
     * Enables dark mode UI.
     */
    darkMode?: boolean;

    /**
     * Preferred language for the interface (e.g., 'en', 'es').
     */
    language?: string;

    /**
     * Enables/disables all types of app notifications.
     */
    notificationsEnabled: boolean;

    /**
     * Allow system to send emails.
     */
    allowEmails: boolean;

    /**
     * Allow SMS-based notifications.
     */
    allowSms: boolean;

    /**
     * Allow push notifications.
     */
    allowPush: boolean;
}

/**
 * Represents a permission assigned to a user or role.
 */
export interface PermissionType {
    id: string; // UUID
}

/**
 * Represents a role (can be linked to permissions in RBAC).
 */
export interface RoleType {
    id: string; // UUID
}

/**
 * Main user entity used for authentication and access control.
 */
export interface UserType extends BaseEntityType {
    /**
     * Unique username used for login or internal identification.
     */
    userName: string;

    /**
     * Password hash (never store plain passwords).
     */
    passwordHash: string;

    /**
     * Display name shown publicly.
     */
    displayName: string;

    /**
     * User's legal first name.
     */
    firstName: string;

    /**
     * User's legal last name.
     */
    lastName: string;

    /**
     * Date of birth.
     */
    brithDate: Date;

    /**
     * User's location info (city, country, etc.).
     */
    location: LocationType;

    /**
     * Primary contact information.
     */
    contactInfo: ContactInfoType;

    /**
     * User's social network links.
     */
    socialNetworks: SocialNetworkType;

    /**
     * Assigned role within the platform (admin, host, etc.).
     */
    role: RoleTypeEnum;

    /**
     * Account state (active, suspended, etc.).
     */
    state: StateEnum;

    /**
     * Indicates if the email address has been verified.
     */
    emailVerified: boolean;

    /**
     * Indicates if the phone number has been verified.
     */
    phoneVerified: boolean;

    /**
     * Optional extended profile data.
     */
    profile?: UserProfile;

    /**
     * User-specific preferences and settings.
     */
    settings?: UserSettings;

    /**
     * List of saved/favorited accommodations (by ID).
     */
    bookmarks?: string[];

    /**
     * Internal admin metadata.
     */
    adminInfo?: AdminInfoType;
}
