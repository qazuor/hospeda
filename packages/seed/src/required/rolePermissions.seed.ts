import { RRolePermissionModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Type-safe role permission assignments
 * Each role is mapped to an array of permissions it should have
 */
// Exported for the SPEC-169 role-permission audit regression test (AC-6), which asserts no
// non-staff role holds a broad view grant outside the documented allow-list.
export const ROLE_PERMISSIONS: Record<RoleEnum, PermissionEnum[]> = {
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
        PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.ACCOMMODATION_IA_CONTENT_APPROVE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,

        // ACCOMMODATION: Granular section permissions
        PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
        PermissionEnum.ACCOMMODATION_SERVICES_EDIT,
        PermissionEnum.ACCOMMODATION_PRICE_EDIT,
        PermissionEnum.ACCOMMODATION_SCHEDULE_EDIT,
        PermissionEnum.ACCOMMODATION_MEDIA_EDIT,
        PermissionEnum.ACCOMMODATION_FAQS_EDIT,
        PermissionEnum.ACCOMMODATION_STATES_EDIT,
        PermissionEnum.ACCOMMODATION_SEO_EDIT,
        PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT,

        // ACCOMMODATION: Specific field permissions
        PermissionEnum.ACCOMMODATION_OWNER_CHANGE,
        PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE,
        PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE,
        PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE,
        PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
        // Catalog management (amenities/features)
        PermissionEnum.AMENITY_CREATE,
        PermissionEnum.AMENITY_UPDATE,
        PermissionEnum.AMENITY_DELETE,
        PermissionEnum.AMENITY_FEATURED_TOGGLE,
        PermissionEnum.AMENITY_LIFECYCLE_CHANGE,
        PermissionEnum.FEATURE_CREATE,
        PermissionEnum.FEATURE_UPDATE,
        PermissionEnum.FEATURE_DELETE,
        PermissionEnum.FEATURE_FEATURED_TOGGLE,
        PermissionEnum.FEATURE_LIFECYCLE_CHANGE,

        // DESTINATION: All permissions
        PermissionEnum.DESTINATION_CREATE,
        PermissionEnum.DESTINATION_UPDATE,
        PermissionEnum.DESTINATION_DELETE,
        PermissionEnum.DESTINATION_RESTORE,
        PermissionEnum.DESTINATION_HARD_DELETE,
        PermissionEnum.DESTINATION_SOFT_DELETE_VIEW,
        PermissionEnum.DESTINATION_FEATURED_TOGGLE,
        PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
        PermissionEnum.DESTINATION_LIFECYCLE_CHANGE,
        PermissionEnum.DESTINATION_MODERATION_CHANGE,
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
        PermissionEnum.ATTRACTION_LIFECYCLE_CHANGE,

        // EVENT: All permissions
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_DELETE,
        PermissionEnum.EVENT_RESTORE,
        PermissionEnum.EVENT_HARD_DELETE,
        PermissionEnum.EVENT_SOFT_DELETE_VIEW,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_VISIBILITY_CHANGE,
        PermissionEnum.EVENT_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_MODERATION_CHANGE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_LOCATION_MANAGE,
        PermissionEnum.EVENT_LOCATION_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_ORGANIZER_LIFECYCLE_CHANGE,

        // POST: All permissions
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_DELETE,
        PermissionEnum.POST_RESTORE,
        PermissionEnum.POST_HARD_DELETE,
        PermissionEnum.POST_SOFT_DELETE_VIEW,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_SPONSOR_LIFECYCLE_CHANGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_VISIBILITY_CHANGE,
        PermissionEnum.POST_LIFECYCLE_CHANGE,
        PermissionEnum.POST_MODERATION_CHANGE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,
        PermissionEnum.POST_VIEW_ALL,

        // USER: All permissions
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_IMPERSONATE,
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_UPDATE_ROLES,
        PermissionEnum.USER_VISIBILITY_CHANGE,
        PermissionEnum.USER_LIFECYCLE_CHANGE,
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
        PermissionEnum.USER_BOOKMARK_VIEW_ANY,

        // USER_BOOKMARK: Full management including hard delete
        PermissionEnum.USER_BOOKMARK_CREATE,
        PermissionEnum.USER_BOOKMARK_UPDATE,
        PermissionEnum.USER_BOOKMARK_DELETE,
        PermissionEnum.USER_BOOKMARK_VIEW,
        PermissionEnum.USER_BOOKMARK_RESTORE,
        PermissionEnum.USER_BOOKMARK_HARD_DELETE,

        // USER_BOOKMARK_COLLECTION: Full management including view any
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,

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

        // NEWSLETTER: All permissions (SPEC-101)
        PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
        PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
        PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
        PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW,

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

        // TAG: All granular permissions per SPEC-086 (D-017)
        PermissionEnum.TAG_INTERNAL_UPDATE,
        PermissionEnum.TAG_INTERNAL_DELETE,
        PermissionEnum.TAG_INTERNAL_VIEW,
        PermissionEnum.TAG_INTERNAL_ASSIGN,
        PermissionEnum.TAG_SYSTEM_CREATE,
        PermissionEnum.TAG_SYSTEM_UPDATE,
        PermissionEnum.TAG_SYSTEM_DELETE,
        PermissionEnum.TAG_SYSTEM_VIEW,
        PermissionEnum.TAG_USER_CREATE,
        PermissionEnum.TAG_USER_UPDATE_OWN,
        PermissionEnum.TAG_USER_DELETE_OWN,
        PermissionEnum.TAG_USER_VIEW_OWN,
        PermissionEnum.TAG_USER_DELETE_ANY,
        PermissionEnum.TAG_VIEW_ALL_USER_TAGS,
        PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS,
        PermissionEnum.TAG_ASSIGN_VIEW,
        PermissionEnum.TAG_ASSIGN_ADD,
        PermissionEnum.TAG_ASSIGN_REMOVE,

        // POST_TAG: SEO blog taxonomy permissions (SPEC-086)
        PermissionEnum.POST_TAG_VIEW,
        PermissionEnum.POST_TAG_CREATE,
        PermissionEnum.POST_TAG_UPDATE,
        PermissionEnum.POST_TAG_DELETE,
        PermissionEnum.POST_TAG_ASSIGN,

        // METRICS: All permissions
        PermissionEnum.METRICS_RESET,

        // POST Sponsorship management
        PermissionEnum.POST_SPONSORSHIP_MANAGE,

        // SPONSORSHIP: All granular ownership-scoped permissions
        PermissionEnum.SPONSORSHIP_VIEW_ANY,
        PermissionEnum.SPONSORSHIP_VIEW_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_ANY,
        PermissionEnum.SPONSORSHIP_UPDATE_OWN,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_ANY,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN,
        PermissionEnum.SPONSORSHIP_HARD_DELETE_ANY,
        PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN,
        PermissionEnum.SPONSORSHIP_RESTORE_ANY,
        PermissionEnum.SPONSORSHIP_RESTORE_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_ANY,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN,

        // OWNER_PROMOTION: All granular ownership-scoped permissions
        PermissionEnum.OWNER_PROMOTION_VIEW_ANY,
        PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
        PermissionEnum.OWNER_PROMOTION_UPDATE_ANY,
        PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
        PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_ANY,
        PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
        PermissionEnum.OWNER_PROMOTION_HARD_DELETE_ANY,
        PermissionEnum.OWNER_PROMOTION_HARD_DELETE_OWN,
        PermissionEnum.OWNER_PROMOTION_RESTORE_ANY,
        PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
        PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_ANY,
        PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN,

        // BILLING: All billing admin permissions. MANAGE_SUBSCRIPTIONS and
        // BILLING_MANAGE gate write ops on the qzpay-hono admin tier (cancel,
        // change-plan, extend-trial, force-cancel, refund, mark-paid, void,
        // entitlements/limits manage). Without them ADMIN can only READ; today
        // only SUPER_ADMIN can write (via the actor.ts catch-all bypass that
        // grants every PermissionEnum value regardless of role_permission).
        // Surfaced during SPEC-143 Block 2 smoke 2.2 (admin subscription cancel).
        PermissionEnum.BILLING_READ_ALL,
        PermissionEnum.BILLING_MANAGE,
        PermissionEnum.MANAGE_SUBSCRIPTIONS,
        PermissionEnum.BILLING_PROMO_CODE_READ,
        PermissionEnum.BILLING_PROMO_CODE_MANAGE,
        PermissionEnum.BILLING_METRICS_READ,

        // REVALIDATION: All permissions
        PermissionEnum.REVALIDATION_TRIGGER,
        PermissionEnum.REVALIDATION_CONFIG_VIEW,
        PermissionEnum.REVALIDATION_CONFIG_EDIT,
        PermissionEnum.REVALIDATION_LOG_VIEW,

        // MEDIA: Cross-entity media management
        PermissionEnum.MEDIA_UPLOAD,
        PermissionEnum.MEDIA_DELETE,

        // CONVERSATION: All permissions
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_VIEW_ALL,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_BLOCK_OWN,
        PermissionEnum.CONVERSATION_BLOCK_ANY,
        PermissionEnum.CONVERSATION_DELETE_ANY,

        // PLATFORM SETTINGS V1 (SPEC-156): full set — SUPER_ADMIN owns every gate.
        PermissionEnum.SETTINGS_GENERAL_VIEW,
        PermissionEnum.SETTINGS_GENERAL_WRITE,
        PermissionEnum.MAINTENANCE_MODE_WRITE,
        PermissionEnum.BILLING_SETTINGS_VIEW,
        PermissionEnum.BILLING_SETTINGS_WRITE,
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
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
        PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_IA_SUGGESTIONS_VIEW,
        PermissionEnum.ACCOMMODATION_IA_CONTENT_APPROVE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,

        // ACCOMMODATION: Granular section permissions
        PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
        PermissionEnum.ACCOMMODATION_SERVICES_EDIT,
        PermissionEnum.ACCOMMODATION_PRICE_EDIT,
        PermissionEnum.ACCOMMODATION_SCHEDULE_EDIT,
        PermissionEnum.ACCOMMODATION_MEDIA_EDIT,
        PermissionEnum.ACCOMMODATION_FAQS_EDIT,
        PermissionEnum.ACCOMMODATION_STATES_EDIT,
        PermissionEnum.ACCOMMODATION_SEO_EDIT,
        PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT,

        // ACCOMMODATION: Specific field permissions
        PermissionEnum.ACCOMMODATION_OWNER_CHANGE,
        PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE,
        PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE,
        PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE,
        PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
        // Catalog management (amenities/features)
        PermissionEnum.AMENITY_CREATE,
        PermissionEnum.AMENITY_UPDATE,
        PermissionEnum.AMENITY_DELETE,
        PermissionEnum.AMENITY_FEATURED_TOGGLE,
        PermissionEnum.AMENITY_LIFECYCLE_CHANGE,
        PermissionEnum.FEATURE_CREATE,
        PermissionEnum.FEATURE_UPDATE,
        PermissionEnum.FEATURE_DELETE,
        PermissionEnum.FEATURE_FEATURED_TOGGLE,
        PermissionEnum.FEATURE_LIFECYCLE_CHANGE,

        // DESTINATION: Most permissions (no hard delete)
        PermissionEnum.DESTINATION_CREATE,
        PermissionEnum.DESTINATION_UPDATE,
        PermissionEnum.DESTINATION_DELETE,
        PermissionEnum.DESTINATION_RESTORE,
        PermissionEnum.DESTINATION_SOFT_DELETE_VIEW,
        PermissionEnum.DESTINATION_FEATURED_TOGGLE,
        PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
        PermissionEnum.DESTINATION_LIFECYCLE_CHANGE,
        PermissionEnum.DESTINATION_MODERATION_CHANGE,
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
        PermissionEnum.ATTRACTION_LIFECYCLE_CHANGE,

        // EVENT: Most permissions (no hard delete)
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_DELETE,
        PermissionEnum.EVENT_RESTORE,
        PermissionEnum.EVENT_SOFT_DELETE_VIEW,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_VISIBILITY_CHANGE,
        PermissionEnum.EVENT_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_MODERATION_CHANGE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_LOCATION_MANAGE,
        PermissionEnum.EVENT_LOCATION_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_ORGANIZER_LIFECYCLE_CHANGE,

        // POST: Most permissions (no hard delete)
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_DELETE,
        PermissionEnum.POST_RESTORE,
        PermissionEnum.POST_SOFT_DELETE_VIEW,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_SPONSOR_LIFECYCLE_CHANGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_VISIBILITY_CHANGE,
        PermissionEnum.POST_LIFECYCLE_CHANGE,
        PermissionEnum.POST_MODERATION_CHANGE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,
        PermissionEnum.POST_VIEW_ALL,

        // USER: Most permissions (no impersonate, no hard delete)
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_UPDATE_ROLES,
        PermissionEnum.USER_VISIBILITY_CHANGE,
        PermissionEnum.USER_LIFECYCLE_CHANGE,
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
        PermissionEnum.USER_BOOKMARK_VIEW_ANY,

        // USER_BOOKMARK: Full management (own + any, no hard delete)
        PermissionEnum.USER_BOOKMARK_CREATE,
        PermissionEnum.USER_BOOKMARK_UPDATE,
        PermissionEnum.USER_BOOKMARK_DELETE,
        PermissionEnum.USER_BOOKMARK_VIEW,
        PermissionEnum.USER_BOOKMARK_RESTORE,

        // USER_BOOKMARK_COLLECTION: Full management including view any
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,

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

        // NEWSLETTER: All permissions (SPEC-101)
        PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
        PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
        PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
        PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW,

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

        // TAG: Granular permissions per SPEC-086 (D-017) — admin manages SYSTEM/INTERNAL,
        // moderates user tags but cannot hard-delete arbitrary user tags by default.
        PermissionEnum.TAG_INTERNAL_UPDATE,
        PermissionEnum.TAG_INTERNAL_DELETE,
        PermissionEnum.TAG_INTERNAL_VIEW,
        PermissionEnum.TAG_INTERNAL_ASSIGN,
        PermissionEnum.TAG_SYSTEM_CREATE,
        PermissionEnum.TAG_SYSTEM_UPDATE,
        PermissionEnum.TAG_SYSTEM_DELETE,
        PermissionEnum.TAG_SYSTEM_VIEW,
        PermissionEnum.TAG_VIEW_ALL_USER_TAGS,
        PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS,
        PermissionEnum.TAG_ASSIGN_VIEW,
        PermissionEnum.TAG_ASSIGN_ADD,
        PermissionEnum.TAG_ASSIGN_REMOVE,

        // POST_TAG: SEO blog taxonomy permissions (SPEC-086)
        PermissionEnum.POST_TAG_VIEW,
        PermissionEnum.POST_TAG_CREATE,
        PermissionEnum.POST_TAG_UPDATE,
        PermissionEnum.POST_TAG_DELETE,
        PermissionEnum.POST_TAG_ASSIGN,

        // METRICS: All permissions
        PermissionEnum.METRICS_RESET,

        // SPEC-164: POST_SPONSORSHIP_MANAGE, all SPONSORSHIP _ANY, all OWNER_PROMOTION _ANY,
        // and all BILLING permissions (BILLING_READ_ALL, BILLING_MANAGE, MANAGE_SUBSCRIPTIONS,
        // BILLING_PROMO_CODE_READ, BILLING_PROMO_CODE_MANAGE, BILLING_METRICS_READ) have been
        // revoked from ADMIN (19 total). These are now SUPER_ADMIN-only.

        // REVALIDATION: All permissions
        PermissionEnum.REVALIDATION_TRIGGER,
        PermissionEnum.REVALIDATION_CONFIG_VIEW,
        PermissionEnum.REVALIDATION_CONFIG_EDIT,
        PermissionEnum.REVALIDATION_LOG_VIEW,

        // MEDIA: Cross-entity media management
        PermissionEnum.MEDIA_UPLOAD,
        PermissionEnum.MEDIA_DELETE,

        // CONVERSATION: All except CONVERSATION_DELETE_ANY
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_VIEW_ANY,
        PermissionEnum.CONVERSATION_VIEW_ALL,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_REPLY_ANY,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
        PermissionEnum.CONVERSATION_BLOCK_OWN,
        PermissionEnum.CONVERSATION_BLOCK_ANY,

        // PLATFORM SETTINGS V1 (SPEC-156): ADMIN gets all gates except MAINTENANCE_MODE_WRITE (SUPER_ADMIN-only).
        PermissionEnum.SETTINGS_GENERAL_VIEW,
        PermissionEnum.SETTINGS_GENERAL_WRITE,
        PermissionEnum.BILLING_SETTINGS_VIEW,
        PermissionEnum.BILLING_SETTINGS_WRITE,
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
    ],

    // KNOWN DEBT (SPEC-169): CLIENT_MANAGER broad grants (USER_READ_ALL, ACCOMMODATION_VIEW_ALL,
    // ACCOMMODATION_VIEW_PRIVATE, DESTINATION_VIEW_ALL, DESTINATION_VIEW_PRIVATE) are intentionally
    // NOT tightened in SPEC-169. The role is currently unused, so owner-scoping it now would be
    // untestable churn. These grants are explicitly allow-listed in the AC-6 audit test
    // (packages/seed/test/role-permission-audit.test.ts) and tracked in
    // .claude/specs/SPEC-169-role-permission-own-scoping/debt-items.md. Revisit when the role is
    // activated (likely alongside the per-user permission panel, SPEC-170).
    [RoleEnum.CLIENT_MANAGER]: [
        // USER: Client management permissions
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_DELETE,
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_BLOCK,
        PermissionEnum.USER_RESTORE,
        PermissionEnum.USER_SOFT_DELETE_VIEW,
        PermissionEnum.USER_ACTIVITY_LOG_VIEW,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // USER_BOOKMARK_COLLECTION: Own collections management
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,

        // ACCOMMODATION: View access for client support
        PermissionEnum.ACCOMMODATION_VIEW_ALL,
        PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,

        // DESTINATION: View access
        PermissionEnum.DESTINATION_VIEW_ALL,
        PermissionEnum.DESTINATION_VIEW_PRIVATE,

        // SYSTEM: Dashboard and analytics
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.DASHBOARD_FULL_VIEW,
        PermissionEnum.STATS_VIEW,
        PermissionEnum.ANALYTICS_VIEW,
        PermissionEnum.NOTIFICATION_SEND,

        // ACCESS: Admin panel and APIs
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,

        // PLATFORM SETTINGS V1 (SPEC-156): Mi cuenta self-edit + self-billing
        // (CLIENT_MANAGER buys complex tiers per SPEC-143 test users).
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
    ],

    [RoleEnum.EDITOR]: [
        // EVENT: Create, update, publish, manage
        PermissionEnum.EVENT_CREATE,
        PermissionEnum.EVENT_UPDATE,
        PermissionEnum.EVENT_PUBLISH_TOGGLE,
        PermissionEnum.EVENT_FEATURED_TOGGLE,
        PermissionEnum.EVENT_LOCATION_UPDATE,
        PermissionEnum.EVENT_LOCATION_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_ORGANIZER_MANAGE,
        PermissionEnum.EVENT_ORGANIZER_LIFECYCLE_CHANGE,
        PermissionEnum.EVENT_SLUG_MANAGE,
        PermissionEnum.EVENT_COMMENT_CREATE,
        // SPEC-169 §3 verdict (KEEP — legitimate editorial visibility, see the POST_VIEW_* note below).
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,

        // POST: Create, update, publish, manage
        PermissionEnum.POST_CREATE,
        PermissionEnum.POST_UPDATE,
        PermissionEnum.POST_PUBLISH_TOGGLE,
        PermissionEnum.POST_SPONSOR_MANAGE,
        PermissionEnum.POST_SPONSOR_LIFECYCLE_CHANGE,
        PermissionEnum.POST_TAGS_MANAGE,
        PermissionEnum.POST_FEATURED_TOGGLE,
        PermissionEnum.POST_SLUG_MANAGE,
        PermissionEnum.POST_COMMENT_CREATE,
        // SPEC-169 §3 verdict (KEEP — confirmed legitimate, not a leak): EDITOR sees ALL editorial
        // content (posts + events, including private) by design — that is the editorial role. A
        // SUPER_ADMIN can narrow this for a specific user via direct per-user permission overrides
        // (the user-permissions model already supports it; managing it from the admin UI is SPEC-170).
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,
        PermissionEnum.POST_VIEW_ALL,

        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // USER_BOOKMARK: Own bookmarks + view any (moderator support)
        PermissionEnum.USER_BOOKMARK_CREATE,
        PermissionEnum.USER_BOOKMARK_UPDATE,
        PermissionEnum.USER_BOOKMARK_DELETE,
        PermissionEnum.USER_BOOKMARK_VIEW,
        PermissionEnum.USER_BOOKMARK_RESTORE,
        PermissionEnum.USER_BOOKMARK_VIEW_ANY,

        // USER_BOOKMARK_COLLECTION: Own collections + view any (moderator support)
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,

        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // ACCESS: Admin panel and APIs
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,

        // TAG: Editor scope per SPEC-086 (D-017)
        // Editors manage SYSTEM tags (read-only), own USER tags, can assign visible
        // tags, and fully manage POST_TAG SEO blog taxonomy.
        PermissionEnum.TAG_SYSTEM_VIEW,
        PermissionEnum.TAG_USER_CREATE,
        PermissionEnum.TAG_USER_UPDATE_OWN,
        PermissionEnum.TAG_USER_DELETE_OWN,
        PermissionEnum.TAG_USER_VIEW_OWN,
        PermissionEnum.TAG_ASSIGN_VIEW,
        PermissionEnum.TAG_ASSIGN_ADD,
        PermissionEnum.TAG_ASSIGN_REMOVE,

        // POST_TAG: SEO blog taxonomy permissions (SPEC-086)
        PermissionEnum.POST_TAG_VIEW,
        PermissionEnum.POST_TAG_CREATE,
        PermissionEnum.POST_TAG_UPDATE,
        PermissionEnum.POST_TAG_DELETE,
        PermissionEnum.POST_TAG_ASSIGN,

        // MEDIA: Cross-entity media management
        PermissionEnum.MEDIA_UPLOAD,
        PermissionEnum.MEDIA_DELETE,

        // NEWSLETTER: draft/view only — send stays admin-only (SPEC-155)
        PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
        PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
        PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW,

        // PLATFORM SETTINGS V1 (SPEC-156): Mi cuenta self-edit only.
        PermissionEnum.USER_UPDATE_SELF
    ],

    [RoleEnum.HOST]: [
        // ACCOMMODATION: own accommodations only (SPEC-169: VIEW_OWN forces server-side owner
        // scoping on adminList + getById; VIEW_ALL removed — it was a cross-tenant read leak that
        // let a HOST list and open every accommodation via the admin endpoints reused by
        // /me/accommodations).
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.ACCOMMODATION_DELETE_OWN,
        PermissionEnum.ACCOMMODATION_RESTORE_OWN,
        PermissionEnum.ACCOMMODATION_PUBLISH,
        PermissionEnum.ACCOMMODATION_VIEW_OWN,
        PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
        PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
        PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
        PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
        PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
        PermissionEnum.ACCOMMODATION_SLUG_MANAGE,

        // ACCOMMODATION: Granular section permissions (for own accommodations)
        PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
        PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
        PermissionEnum.ACCOMMODATION_SERVICES_EDIT,
        PermissionEnum.ACCOMMODATION_PRICE_EDIT,
        PermissionEnum.ACCOMMODATION_SCHEDULE_EDIT,
        PermissionEnum.ACCOMMODATION_MEDIA_EDIT,
        PermissionEnum.ACCOMMODATION_FAQS_EDIT,
        PermissionEnum.ACCOMMODATION_STATES_EDIT,
        PermissionEnum.ACCOMMODATION_SEO_EDIT,
        PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT,

        // ACCOMMODATION: Specific field permissions (limited)
        PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE,

        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // USER_BOOKMARK: Own bookmarks
        PermissionEnum.USER_BOOKMARK_CREATE,
        PermissionEnum.USER_BOOKMARK_UPDATE,
        PermissionEnum.USER_BOOKMARK_DELETE,
        PermissionEnum.USER_BOOKMARK_VIEW,
        PermissionEnum.USER_BOOKMARK_RESTORE,

        // USER_BOOKMARK_COLLECTION: Own collections
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,

        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // SPONSORSHIP: Own sponsorships only (_OWN variants)
        PermissionEnum.SPONSORSHIP_VIEW_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_OWN,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN,
        PermissionEnum.SPONSORSHIP_RESTORE_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN,

        // OWNER_PROMOTION: create + own promotions (_OWN variants). CREATE is
        // gated downstream by `enforcePromotionLimit()` middleware against the
        // plan's MAX_ACTIVE_PROMOTIONS limit (owner-basico=0 blocks, owner-pro=3,
        // owner-premium=-1). Without CREATE the limit middleware is unreachable.
        PermissionEnum.OWNER_PROMOTION_CREATE,
        PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
        PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
        PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
        PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
        PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN,

        // ACCESS: Basic access
        PermissionEnum.DASHBOARD_BASE_VIEW,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_PUBLIC,

        // MEDIA: Cross-entity media management (HOST uploads images to own accommodations)
        PermissionEnum.MEDIA_UPLOAD,
        PermissionEnum.MEDIA_DELETE,

        // TAG: Host scope per SPEC-086 (D-017) — manages own USER tags, can view
        // SYSTEM tags (apply but not manage), and assigns tags to own entities.
        PermissionEnum.TAG_SYSTEM_VIEW,
        PermissionEnum.TAG_USER_CREATE,
        PermissionEnum.TAG_USER_UPDATE_OWN,
        PermissionEnum.TAG_USER_DELETE_OWN,
        PermissionEnum.TAG_USER_VIEW_OWN,
        PermissionEnum.TAG_ASSIGN_VIEW,
        PermissionEnum.TAG_ASSIGN_ADD,
        PermissionEnum.TAG_ASSIGN_REMOVE,

        // CONVERSATION: Own-scoped conversation management (owner replies and moderation)
        PermissionEnum.CONVERSATION_VIEW_OWN,
        PermissionEnum.CONVERSATION_REPLY_OWN,
        PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
        PermissionEnum.CONVERSATION_BLOCK_OWN,

        // PLATFORM SETTINGS V1 (SPEC-156): HOST self-billing landing + Mi cuenta self-edit.
        // BILLING_VIEW_OWN/SUBSCRIPTION_VIEW_OWN are distinct from BILLING_READ_ALL (admin-tier).
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
    ],

    [RoleEnum.USER]: [
        // USER: Basic profile permissions
        PermissionEnum.USER_VIEW_PROFILE,
        PermissionEnum.USER_UPDATE_PROFILE,
        PermissionEnum.USER_SETTINGS_UPDATE,

        // USER_BOOKMARK: Own bookmarks
        PermissionEnum.USER_BOOKMARK_CREATE,
        PermissionEnum.USER_BOOKMARK_UPDATE,
        PermissionEnum.USER_BOOKMARK_DELETE,
        PermissionEnum.USER_BOOKMARK_VIEW,
        PermissionEnum.USER_BOOKMARK_RESTORE,

        // USER_BOOKMARK_COLLECTION: Own collections
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,

        // PUBLIC USER ACTIONS: All permissions
        PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.DESTINATION_REVIEW_CREATE,
        PermissionEnum.DESTINATION_REVIEW_UPDATE,

        PermissionEnum.HOST_CONTACT_VIEW,
        PermissionEnum.HOST_MESSAGE_SEND,

        // ACCESS: Public API only
        PermissionEnum.ACCESS_API_PUBLIC,

        // PLATFORM SETTINGS V1 (SPEC-156): Mi cuenta self-edit + self-billing
        // (USER buys tourist tiers + needs checkout flow to upgrade to HOST).
        // BILLING_VIEW_OWN gates /protected/billing/*; ownership middleware
        // still enforces per-resource scope.
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
    ],

    [RoleEnum.SPONSOR]: [
        // SPONSORSHIP: Manage own sponsorships
        PermissionEnum.POST_SPONSORSHIP_VIEW,
        PermissionEnum.POST_SPONSORSHIP_CREATE,
        PermissionEnum.POST_SPONSORSHIP_MANAGE,

        // SPONSORSHIP: Own granular permissions (_OWN variants only)
        PermissionEnum.SPONSORSHIP_VIEW_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_OWN,
        PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN,
        PermissionEnum.SPONSORSHIP_RESTORE_OWN,
        PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN,

        // USER_BOOKMARK_COLLECTION: Own collections
        PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
        PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,

        // ACCESS: Public API only
        PermissionEnum.ACCESS_API_PUBLIC,

        // PLATFORM SETTINGS V1 (SPEC-156): Mi cuenta self-edit + self-billing
        // (SPONSOR pays for sponsorship packages — needs /protected/billing/* access).
        PermissionEnum.BILLING_VIEW_OWN,
        PermissionEnum.SUBSCRIPTION_VIEW_OWN,
        PermissionEnum.USER_UPDATE_SELF
    ],

    [RoleEnum.GUEST]: [
        // ACCESS: Public API only
        PermissionEnum.ACCESS_API_PUBLIC
    ],

    // SYSTEM role: non-loginable reserved account (SPEC-086 D-005).
    // Has no permissions — used only as assignedById for automated operations.
    [RoleEnum.SYSTEM]: []
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
                    logger.success({
                        msg: `[${created + skipped} of ${totalRolePermissions}] - Created role permission: ${role} → ${permission}${roleIcon}`
                    });

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
        logger.success({
            msg: `${STATUS_ICONS.Success}  ROLE PERMISSION ASSIGNMENT COMPLETED: ${created} created, ${skipped} skipped`
        });
    } catch (error) {
        logger.error(
            `${STATUS_ICONS.Error}  ERROR IN ROLE PERMISSION ASSIGNMENT: ${(error as Error).message}`
        );
        throw error;
    }
}

/**
 * Exported internals for unit testing.
 * Do not use these outside of tests.
 */
export const _internals = {
    ROLE_PERMISSIONS
};
