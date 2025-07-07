export enum PermissionCategoryEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    DESTINATION = 'DESTINATION',
    EVENT = 'EVENT',
    POST = 'POST',
    USER = 'USER',
    PUBLIC = 'PUBLIC',
    SYSTEM = 'SYSTEM',
    ACCESS = 'ACCESS'
}

// PermissionEnum defines all possible built-in permissions for the Hospeda platform.
// Each permission controls access to a specific action or resource.
//
// Naming convention: <entity>.<action> (e.g., 'accommodation.create')
//
// Example usage:
// - ACCOMMODATION_CREATE: Allows creating a new accommodation.
// - EVENT_PUBLISH_TOGGLE: Allows toggling the published state of an event.
// - USER_UPDATE_PROFILE: Allows a user to update their own profile.

export enum PermissionEnum {
    // ACCOMMODATION: Permissions related to accommodations (hotels, cabins, etc.)
    ACCOMMODATION_CREATE = 'accommodation.create', // Allows creating a new accommodation.
    ACCOMMODATION_UPDATE_OWN = 'accommodation.update.own', // Allows updating own accommodation.
    ACCOMMODATION_UPDATE_ANY = 'accommodation.update.any', // Allows updating any accommodation.
    ACCOMMODATION_DELETE_OWN = 'accommodation.delete.own', // Allows deleting own accommodation.
    ACCOMMODATION_DELETE_ANY = 'accommodation.delete.any', // Allows deleting any accommodation.
    ACCOMMODATION_RESTORE_OWN = 'accommodation.restore.own', // Allows restoring own deleted accommodation.
    ACCOMMODATION_RESTORE_ANY = 'accommodation.restore.any', // Allows restoring any deleted accommodation.
    ACCOMMODATION_HARD_DELETE = 'accommodation.hardDelete', // Allows permanently deleting an accommodation.
    ACCOMMODATION_SOFT_DELETE_VIEW = 'accommodation.softDelete.view', // Allows viewing soft-deleted accommodations.
    ACCOMMODATION_PUBLISH = 'accommodation.publish', // Allows publishing or unpublishing an accommodation.
    ACCOMMODATION_REVIEW_MODERATE = 'accommodation.review.moderate', // Allows moderating accommodation reviews.
    ACCOMMODATION_VIEW_ALL = 'accommodation.viewAll', // Allows viewing all accommodations (including private).
    ACCOMMODATION_VIEW_PRIVATE = 'accommodation.view.private', // Allows viewing private accommodations.
    ACCOMMODATION_VIEW_DRAFT = 'accommodation.view.draft', // Allows viewing draft accommodations.
    ACCOMMODATION_TAGS_MANAGE = 'accommodation.tags.manage', // Allows managing tags for accommodations.
    ACCOMMODATION_FEATURES_EDIT = 'accommodation.features.edit', // Allows editing accommodation features.
    ACCOMMODATION_AMENITIES_EDIT = 'accommodation.amenities.edit', // Allows editing accommodation amenities.
    ACCOMMODATION_GALLERY_MANAGE = 'accommodation.gallery.manage', // Allows managing accommodation gallery.
    ACCOMMODATION_CONTACT_UPDATE = 'accommodation.contact.update', // Allows updating accommodation contact info.
    ACCOMMODATION_IA_SUGGESTIONS_VIEW = 'accommodation.iaSuggestions.view', // Allows viewing AI suggestions for accommodations.
    ACCOMMODATION_IA_CONTENT_APPROVE = 'accommodation.iaContent.approve', // Allows approving AI-generated content for accommodations.
    ACCOMMODATION_SLUG_MANAGE = 'accommodation.slug.manage', // Allows managing accommodation slugs.

    // DESTINATION: Permissions related to destinations (cities, regions, etc.)
    DESTINATION_CREATE = 'destination.create', // Allows creating a new destination.
    DESTINATION_UPDATE = 'destination.update', // Allows updating a destination.
    DESTINATION_DELETE = 'destination.delete', // Allows deleting a destination.
    DESTINATION_RESTORE = 'destination.restore', // Allows restoring a deleted destination.
    DESTINATION_HARD_DELETE = 'destination.hardDelete', // Allows permanently deleting a destination.
    DESTINATION_SOFT_DELETE_VIEW = 'destination.softDelete.view', // Allows viewing soft-deleted destinations.
    DESTINATION_FEATURED_TOGGLE = 'destination.featured.toggle', // Allows toggling featured status of a destination.
    DESTINATION_VISIBILITY_TOGGLE = 'destination.visibility.toggle', // Allows toggling visibility of a destination.
    DESTINATION_REVIEW_MODERATE = 'destination.review.moderate', // Allows moderating destination reviews.
    DESTINATION_TAGS_MANAGE = 'destination.tags.manage', // Allows managing tags for destinations.
    DESTINATION_GALLERY_MANAGE = 'destination.gallery.manage', // Allows managing destination gallery.
    DESTINATION_IA_SUGGESTIONS_VIEW = 'destination.iaSuggestions.view', // Allows viewing AI suggestions for destinations.
    DESTINATION_IA_CONTENT_APPROVE = 'destination.iaContent.approve', // Allows approving AI-generated content for destinations.
    DESTINATION_SLUG_MANAGE = 'destination.slug.manage', // Allows managing destination slugs.
    DESTINATION_VIEW_PRIVATE = 'destination.view.private', // Allows viewing private destinations.
    DESTINATION_VIEW_DRAFT = 'destination.view.draft', // Allows viewing draft destinations.

    // EVENT: Permissions related to events (festivals, shows, etc.)
    EVENT_CREATE = 'event.create', // Allows creating a new event.
    EVENT_UPDATE = 'event.update', // Allows updating an event.
    EVENT_DELETE = 'event.delete', // Allows deleting an event.
    EVENT_RESTORE = 'event.restore', // Allows restoring a deleted event.
    EVENT_HARD_DELETE = 'event.hardDelete', // Allows permanently deleting an event.
    EVENT_SOFT_DELETE_VIEW = 'event.softDelete.view', // Allows viewing soft-deleted events.
    EVENT_PUBLISH_TOGGLE = 'event.publish.toggle', // Allows publishing or unpublishing an event.
    EVENT_FEATURED_TOGGLE = 'event.featured.toggle', // Allows toggling featured status of an event.
    EVENT_LOCATION_UPDATE = 'event.location.update', // Allows updating event location.
    EVENT_ORGANIZER_MANAGE = 'event.organizer.manage', // Allows managing event organizers.
    EVENT_SLUG_MANAGE = 'event.slug.manage', // Allows managing event slugs.
    EVENT_COMMENT_CREATE = 'event.comment.create', // Allows creating comments on events.
    EVENT_VIEW_PRIVATE = 'event.view.private', // Allows viewing private events.
    EVENT_VIEW_DRAFT = 'event.view.draft', // Allows viewing draft events.

    // POST: Permissions related to blog posts and articles
    POST_CREATE = 'post.create', // Allows creating a new post.
    POST_UPDATE = 'post.update', // Allows updating a post.
    POST_DELETE = 'post.delete', // Allows deleting a post.
    POST_RESTORE = 'post.restore', // Allows restoring a deleted post.
    POST_HARD_DELETE = 'post.hardDelete', // Allows permanently deleting a post.
    POST_SOFT_DELETE_VIEW = 'post.softDelete.view', // Allows viewing soft-deleted posts.
    POST_PUBLISH_TOGGLE = 'post.publish.toggle', // Allows publishing or unpublishing a post.
    POST_SPONSOR_MANAGE = 'post.sponsor.manage', // Allows managing post sponsors.
    POST_TAGS_MANAGE = 'post.tags.manage', // Allows managing tags for posts.
    POST_FEATURED_TOGGLE = 'post.featured.toggle', // Allows toggling featured status of a post.
    POST_SLUG_MANAGE = 'post.slug.manage', // Allows managing post slugs.
    POST_COMMENT_CREATE = 'post.comment.create', // Allows creating comments on posts.
    POST_VIEW_PRIVATE = 'post.view.private', // Allows viewing private posts.
    POST_VIEW_DRAFT = 'post.view.draft', // Allows viewing draft posts.

    // USER: Permissions related to user management and actions
    USER_READ_ALL = 'user.read.all', // Allows reading all user profiles.
    USER_IMPERSONATE = 'user.impersonate', // Allows impersonating another user.
    USER_CREATE = 'user.create', // Allows creating a new user.
    USER_UPDATE_ROLES = 'user.update.roles', // Allows updating user roles.
    USER_DELETE = 'user.delete', // Allows deleting a user.
    USER_BOOKMARK_MANAGE = 'user.bookmark.manage', // Allows managing user bookmarks.
    USER_VIEW_PROFILE = 'user.view.profile', // Allows viewing own user profile.
    USER_BLOCK = 'user.block', // Allows blocking a user.
    USER_RESTORE = 'user.restore', // Allows restoring a deleted user.
    USER_HARD_DELETE = 'user.hardDelete', // Allows permanently deleting a user.
    USER_SOFT_DELETE_VIEW = 'user.softDelete.view', // Allows viewing soft-deleted users.
    USER_ACTIVITY_LOG_VIEW = 'user.activityLog.view', // Allows viewing user activity logs.
    USER_PASSWORD_RESET = 'user.password.reset', // Allows resetting user password.
    USER_UPDATE_PROFILE = 'user.update.profile', // Allows updating own user profile.

    // PUBLIC USER ACTIONS: Permissions for actions available to public or logged-in users
    ACCOMMODATION_REVIEW_CREATE = 'accommodation.review.create', // Allows creating a review for an accommodation.
    ACCOMMODATION_REVIEW_UPDATE = 'accommodation.review.update', // Allows updating own accommodation review.
    DESTINATION_REVIEW_CREATE = 'destination.review.create', // Allows creating a review for a destination.
    DESTINATION_REVIEW_UPDATE = 'destination.review.update', // Allows updating own destination review.
    FAVORITE_ENTITY = 'entity.favorite', // Allows favoriting any entity (accommodation, post, etc.).
    HOST_CONTACT_VIEW = 'host.contact.view', // Allows viewing host contact information.
    HOST_MESSAGE_SEND = 'host.message.send', // Allows sending a message to a host.

    // SYSTEM: System-level permissions
    AUDIT_LOG_VIEW = 'auditLog.view', // Allows viewing the audit log.
    SYSTEM_MAINTENANCE_MODE = 'system.maintenanceMode', // Allows toggling system maintenance mode.
    TRANSLATIONS_MANAGE = 'translations.manage', // Allows managing translations.
    MULTILANGUAGE_CONTENT_EDIT = 'content.multilanguage.edit', // Allows editing multilingual content.
    DASHBOARD_BASE_VIEW = 'dashboard.baseView', // Allows viewing the base dashboard.
    DASHBOARD_FULL_VIEW = 'dashboard.fullView', // Allows viewing the full dashboard.
    SETTINGS_MANAGE = 'settings.manage', // Allows managing system settings.
    STATS_VIEW = 'stats.view', // Allows viewing system statistics.
    NOTIFICATION_SEND = 'notification.send', // Allows sending notifications.
    NOTIFICATION_CONFIGURE = 'notification.configure', // Allows configuring notification settings.

    // ACCESS: Permissions for accessing different panels and APIs
    ACCESS_PANEL_ADMIN = 'access.panelAdmin', // Allows accessing the admin panel.
    ACCESS_API_ADMIN = 'access.apiAdmin', // Allows accessing the admin API.
    ACCESS_API_PUBLIC = 'access.apiPublic', // Allows accessing the public API.

    // LOGGING & ERROR TRACKING: Permissions for logs, errors, analytics
    LOGS_VIEW_ALL = 'logs.viewAll', // Allows viewing all logs.
    ERRORS_VIEW = 'errors.view', // Allows viewing error logs.
    ANALYTICS_VIEW = 'analytics.view', // Allows viewing analytics data.

    // DEBUG & DEPLOY: Permissions for debugging and bulk operations
    DEBUG_TOOLS_ACCESS = 'system.debugTools.access', // Allows accessing debug tools.
    ENTITIES_BULK_IMPORT = 'entities.bulk.import', // Allows bulk importing entities.
    ENTITIES_BULK_EXPORT = 'entities.bulk.export', // Allows bulk exporting entities.

    // UI / CUSTOMIZATION: Permissions for UI and layout configuration
    THEME_EDIT = 'ui.theme.edit', // Allows editing the UI theme.
    HOMEPAGE_LAYOUT_CONFIGURE = 'ui.homepageLayout.configure', // Allows configuring the homepage layout.

    // TAG: Permissions related to tags (categorization, filtering, etc.)
    TAG_CREATE = 'tag.create', // Allows creating a new tag.
    TAG_UPDATE = 'tag.update', // Allows updating a tag.
    TAG_DELETE = 'tag.delete' // Allows deleting a tag.
}
