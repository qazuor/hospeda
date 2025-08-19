import { RRolePermissionModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Type-safe role permission assignments
 * Each role is mapped to an array of permissions it should have
 */
const ROLE_PERMISSIONS: Record<RoleEnum, PermissionEnum[]> = {
    [RoleEnum.SUPER_ADMIN]: [
        // ACCOMMODATION: All permissions
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        PermissionEnum.ACCOMMODATION_DELETE_OWN,
        PermissionEnum.ACCOMMODATION_DELETE_ANY,
        PermissionEnum.ACCOMMODATION_RESTORE_OWN,
        PermissionEnum.ACCOMMODATION_RESTORE_ANY,
        PermissionEnum.ACCOMMODATION_HARD_DELETE,
        PermissionEnum.ACCOMMODATION_SOFT_DELETE_VIEW,
        PermissionEnum.ACCOMMODATION_PUBLISH,
        PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
        PermissionEnum.ACCOMMODATION_VIEW_ALL,
        PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
        PermissionEnum.ACCOMMODATION_VIEW_DRAFT,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.ACCOMMODATION_IA_CONTENT_APPROVE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,
        // Catalog management (amenities/features)
        PermissionEnum.AMENITY_CREATE,
        PermissionEnum.AMENITY_UPDATE,
        PermissionEnum.AMENITY_DELETE,
        PermissionEnum.FEATURE_CREATE,
        PermissionEnum.FEATURE_UPDATE,
        PermissionEnum.FEATURE_DELETE,

        // DESTINATION: All permissions
        PermissionEnum.DESTINATION_CREATE,
        PermissionEnum.DESTINATION_UPDATE,
        PermissionEnum.DESTINATION_DELETE,
        PermissionEnum.DESTINATION_RESTORE,
        PermissionEnum.DESTINATION_HARD_DELETE,
        PermissionEnum.DESTINATION_SOFT_DELETE_VIEW,
        PermissionEnum.DESTINATION_FEATURED_TOGGLE,
        PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
        PermissionEnum.DESTINATION_REVIEW_MODERATE,
        PermissionEnum.DESTINATION_TAGS_MANAGE,
        PermissionEnum.DESTINATION_GALLERY_MANAGE,
        PermissionEnum.DESTINATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.DESTINATION_IA_CONTENT_APPROVE,
        PermissionEnum.DESTINATION_SLUG_MANAGE,
        PermissionEnum.DESTINATION_VIEW_PRIVATE,
        PermissionEnum.DESTINATION_VIEW_DRAFT,
        PermissionEnum.DESTINATION_VIEW_ALL,
        PermissionEnum.DESTINATION_ATTRACTION_MANAGE,

        // EVENT: All permissions
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_DELETE,
        PermissionEnum.EVENT_RESTORE,
        PermissionEnum.EVENT_HARD_DELETE,
        PermissionEnum.EVENT_SOFT_DELETE_VIEW,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_LOCATION_MANAGE,

        // POST: All permissions
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_DELETE,
        PermissionEnum.POST_RESTORE,
        PermissionEnum.POST_HARD_DELETE,
        PermissionEnum.POST_SOFT_DELETE_VIEW,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,

        // USER: All permissions
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_IMPERSONATE,
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_UPDATE_ROLES,
        PermissionEnum.USER_DELETE,
        PermissionEnum.USER_BOOKMARK_MANAGE,
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_BLOCK,
        PermissionEnum.USER_RESTORE,
        PermissionEnum.USER_HARD_DELETE,
        PermissionEnum.USER_SOFT_DELETE_VIEW,
        PermissionEnum.USER_ACTIVITY_LOG_VIEW,
        PermissionEnum.USER_PASSWORD_RESET,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.FAVORITE_ENTITY,
        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // SYSTEM: All permissions
        PermissionEnum.AUDIT_LOG_VIEW,
        PermissionEnum.SYSTEM_MAINTENANCE_MODE,
        PermissionEnum.TRANSLATIONS_MANAGE,
        PermissionEnum.MULTILANGUAGE_CONTENT_EDIT,
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.DASHBOARD_FULL_VIEW,
        PermissionEnum.SETTINGS_MANAGE,
        PermissionEnum.STATS_VIEW,
        PermissionEnum.NOTIFICATION_SEND,
        PermissionEnum.NOTIFICATION_CONFIGURE,
        PermissionEnum.SEO_MANAGE,

        // ACCESS: All permissions
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_PERMISSIONS_MANAGE,

        // LOGGING & ERROR TRACKING: All permissions
        PermissionEnum.LOGS_VIEW_ALL,
        PermissionEnum.ERRORS_VIEW,
        PermissionEnum.ANALYTICS_VIEW,

        // DEBUG & DEPLOY: All permissions
        PermissionEnum.DEBUG_TOOLS_ACCESS,
        PermissionEnum.ENTITIES_BULK_IMPORT,
        PermissionEnum.ENTITIES_BULK_EXPORT,

        // UI / CUSTOMIZATION: All permissions
        PermissionEnum.THEME_EDIT,
        PermissionEnum.HOMEPAGE_LAYOUT_CONFIGURE,

        // TAG: All permissions
        PermissionEnum.TAG_CREATE,
        PermissionEnum.TAG_UPDATE,
        PermissionEnum.TAG_DELETE,

        // POST Sponsorship management
        PermissionEnum.POST_SPONSORSHIP_MANAGE
    ],

    [RoleEnum.ADMIN]: [
        // ACCOMMODATION: Most permissions (no hard delete)
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        PermissionEnum.ACCOMMODATION_DELETE_ANY,
        PermissionEnum.ACCOMMODATION_RESTORE_ANY,
        PermissionEnum.ACCOMMODATION_SOFT_DELETE_VIEW,
        PermissionEnum.ACCOMMODATION_PUBLISH,
        PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
        PermissionEnum.ACCOMMODATION_VIEW_ALL,
        PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
        PermissionEnum.ACCOMMODATION_VIEW_DRAFT,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.ACCOMMODATION_IA_CONTENT_APPROVE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,
        // Catalog management (amenities/features)
        PermissionEnum.AMENITY_CREATE,
        PermissionEnum.AMENITY_UPDATE,
        PermissionEnum.AMENITY_DELETE,
        PermissionEnum.FEATURE_CREATE,
        PermissionEnum.FEATURE_UPDATE,
        PermissionEnum.FEATURE_DELETE,

        // DESTINATION: Most permissions (no hard delete)
        PermissionEnum.DESTINATION_CREATE,
        PermissionEnum.DESTINATION_UPDATE,
        PermissionEnum.DESTINATION_DELETE,
        PermissionEnum.DESTINATION_RESTORE,
        PermissionEnum.DESTINATION_SOFT_DELETE_VIEW,
        PermissionEnum.DESTINATION_FEATURED_TOGGLE,
        PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
        PermissionEnum.DESTINATION_REVIEW_MODERATE,
        PermissionEnum.DESTINATION_TAGS_MANAGE,
        PermissionEnum.DESTINATION_GALLERY_MANAGE,
        PermissionEnum.DESTINATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.DESTINATION_IA_CONTENT_APPROVE,
        PermissionEnum.DESTINATION_SLUG_MANAGE,
        PermissionEnum.DESTINATION_VIEW_PRIVATE,
        PermissionEnum.DESTINATION_VIEW_DRAFT,
        PermissionEnum.DESTINATION_VIEW_ALL,
        PermissionEnum.DESTINATION_ATTRACTION_MANAGE,

        // EVENT: Most permissions (no hard delete)
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_DELETE,
        PermissionEnum.EVENT_RESTORE,
        PermissionEnum.EVENT_SOFT_DELETE_VIEW,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_LOCATION_MANAGE,

        // POST: Most permissions (no hard delete)
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_DELETE,
        PermissionEnum.POST_RESTORE,
        PermissionEnum.POST_SOFT_DELETE_VIEW,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,
        PermissionEnum.POST_VIEW_ALL,

        // USER: Most permissions (no impersonate, no hard delete)
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_UPDATE_ROLES,
        PermissionEnum.USER_DELETE,
        PermissionEnum.USER_BOOKMARK_MANAGE,
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_BLOCK,
        PermissionEnum.USER_RESTORE,
        PermissionEnum.USER_SOFT_DELETE_VIEW,
        PermissionEnum.USER_ACTIVITY_LOG_VIEW,
        PermissionEnum.USER_PASSWORD_RESET,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.FAVORITE_ENTITY,
        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // SYSTEM: Most permissions (no maintenance mode)
        PermissionEnum.AUDIT_LOG_VIEW,
        PermissionEnum.TRANSLATIONS_MANAGE,
        PermissionEnum.MULTILANGUAGE_CONTENT_EDIT,
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.DASHBOARD_FULL_VIEW,
        PermissionEnum.SETTINGS_MANAGE,
        PermissionEnum.STATS_VIEW,
        PermissionEnum.NOTIFICATION_SEND,
        PermissionEnum.NOTIFICATION_CONFIGURE,
        PermissionEnum.SEO_MANAGE,

        // ACCESS: All permissions
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,

        // LOGGING & ERROR TRACKING: All permissions
        PermissionEnum.LOGS_VIEW_ALL,
        PermissionEnum.ERRORS_VIEW,
        PermissionEnum.ANALYTICS_VIEW,

        // DEBUG & DEPLOY: Bulk operations only
        PermissionEnum.ENTITIES_BULK_IMPORT,
        PermissionEnum.ENTITIES_BULK_EXPORT,

        // UI / CUSTOMIZATION: All permissions
        PermissionEnum.THEME_EDIT,
        PermissionEnum.HOMEPAGE_LAYOUT_CONFIGURE,

        // TAG: All permissions
        PermissionEnum.TAG_CREATE,
        PermissionEnum.TAG_UPDATE,
        PermissionEnum.TAG_DELETE,

        // POST Sponsorship management
        PermissionEnum.POST_SPONSORSHIP_MANAGE
    ],

    [RoleEnum.EDITOR]: [
        // EVENT: Create, update, publish, manage
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,

        // POST: Create, update, publish, manage
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,

        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.FAVORITE_ENTITY,
        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // ACCESS: Admin panel and APIs
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,

        // TAG: All permissions
        PermissionEnum.TAG_CREATE,
        PermissionEnum.TAG_UPDATE,
        PermissionEnum.TAG_DELETE
    ],

    [RoleEnum.HOST]: [
        // ACCOMMODATION: Own accommodations only
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_DELETE_OWN,
        PermissionEnum.ACCOMMODATION_RESTORE_OWN,
        PermissionEnum.ACCOMMODATION_PUBLISH,
        PermissionEnum.ACCOMMODATION_VIEW_ALL,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,

        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.FAVORITE_ENTITY,
        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // ACCESS: Basic access
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC
    ],

    [RoleEnum.USER]: [
        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,
        PermissionEnum.FAVORITE_ENTITY,
        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // ACCESS: Public API only
        PermissionEnum.ACCESS_API_PUBLIC
    ],

    [RoleEnum.GUEST]: [
        // ACCESS: Public API only
        PermissionEnum.ACCESS_API_PUBLIC
    ]
} as const;

/**
 * Seeds role permissions by assigning permissions to roles.
 *
 * This function creates the role-permission relationships that define
 * what actions each role can perform in the system. It uses TypeScript
 * declarations for type safety and validation.
 *
 * The function:
 * - Processes all roles defined in ROLE_PERMISSIONS
 * - Checks for existing relationships to avoid duplicates
 * - Creates new role-permission assignments
 * - Provides progress tracking and detailed logging
 * - Handles errors gracefully
 *
 * @returns Promise that resolves when all role permissions are assigned
 *
 * @example
 * ```typescript
 * await seedRolePermissions();
 * // Creates relationships like:
 * // SUPER_ADMIN → ACCOMMODATION_CREATE
 * // ADMIN → USER_READ_ALL
 * // USER → USER_UPDATE_PROFILE
 * ```
 */
export async function seedRolePermissions(): Promise<void> {
    const separator = '#'.repeat(90);
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  INITIALIZING ROLE PERMISSION ASSIGNMENT`);

    try {
        // Create the role permission model
        const rolePermissionModel = new RRolePermissionModel();

        let created = 0;
        let skipped = 0;

        // Calculate total number of role permissions to process
        const totalRolePermissions = Object.values(ROLE_PERMISSIONS).reduce(
            (total, permissions) => total + permissions.length,
            0
        );

        logger.info(`${STATUS_ICONS.Seed}  Total permissions to assign: ${totalRolePermissions}`);

        // Iterate through all roles and their assigned permissions
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            for (const permission of permissions) {
                try {
                    // Check if the role permission already exists
                    const exists = await rolePermissionModel.findOne({
                        role: role as RoleEnum,
                        permission
                    });

                    if (exists) {
                        logger.info(
                            `[${created + skipped + 1} of ${totalRolePermissions}] - Role permission ${role} → ${permission} already exists, skipping`
                        );
                        skipped++;
                        continue;
                    }

                    // Create the role permission
                    await rolePermissionModel.create({
                        role: role as RoleEnum,
                        permission
                    });

                    const roleIcon =
                        role === RoleEnum.SUPER_ADMIN
                            ? ` ${STATUS_ICONS.UserSuperAdmin}`
                            : role === RoleEnum.ADMIN
                              ? ` ${STATUS_ICONS.UserAdmin}`
                              : role === RoleEnum.USER
                                ? ` ${STATUS_ICONS.User}`
                                : ` ${STATUS_ICONS.User}`;

                    created++;
                    logger.success(
                        `[${created + skipped} of ${totalRolePermissions}] - Created role permission: ${role} → ${permission}${roleIcon}`
                    );

                    // Track in summary
                    summaryTracker.trackSuccess('Role Permissions');
                } catch (error) {
                    logger.error(
                        `Failed to create role permission ${role} → ${permission}: ${
                            (error as Error).message
                        }`
                    );
                    summaryTracker.trackError(
                        'Role Permissions',
                        `${role}-${permission}`,
                        (error as Error).message
                    );
                }
            }
        }

        logger.info(`${separator}`);
        logger.success(
            `${STATUS_ICONS.Success}  ROLE PERMISSION ASSIGNMENT COMPLETED: ${created} created, ${skipped} skipped`
        );
    } catch (error) {
        logger.error(
            `${STATUS_ICONS.Error}  ERROR IN ROLE PERMISSION ASSIGNMENT: ${(error as Error).message}`
        );
        throw error;
    }
}
