export enum PermissionCategoryEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    ACCOMMODATION_LISTING = 'ACCOMMODATION_LISTING',
    ACCOMMODATION_LISTING_PLAN = 'ACCOMMODATION_LISTING_PLAN',
    ACCOMMODATION_REVIEW = 'ACCOMMODATION_REVIEW',
    AD_PRICING_CATALOG = 'AD_PRICING_CATALOG',
    ATTRACTION = 'ATTRACTION',
    CLIENT_ACCESS_RIGHT = 'CLIENT_ACCESS_RIGHT',
    CREDIT_NOTE = 'CREDIT_NOTE',
    DESTINATION = 'DESTINATION',
    DESTINATION_REVIEW = 'DESTINATION_REVIEW',
    DISCOUNT_CODE_USAGE = 'DISCOUNT_CODE_USAGE',
    EVENT = 'EVENT',
    EVENT_LOCATION = 'EVENT_LOCATION',
    EVENT_ORGANIZER = 'EVENT_ORGANIZER',
    INVOICE = 'INVOICE',
    INVOICE_LINE = 'INVOICE_LINE',
    PAYMENT = 'PAYMENT',
    PAYMENT_METHOD = 'PAYMENT_METHOD',
    PERMISSION = 'PERMISSION',
    POST = 'POST',
    POST_SPONSOR = 'POST_SPONSOR',
    POST_SPONSORSHIP = 'POST_SPONSORSHIP',
    PURCHASE = 'PURCHASE',
    REFUND = 'REFUND',
    USER = 'USER',
    USER_BOOKMARK = 'USER_BOOKMARK',
    CLIENT = 'CLIENT',
    PRODUCT = 'PRODUCT',
    SUBSCRIPTION = 'SUBSCRIPTION',
    SUBSCRIPTION_ITEM = 'SUBSCRIPTION_ITEM',
    PROMOTION = 'PROMOTION',
    DISCOUNT_CODE = 'DISCOUNT_CODE',
    CAMPAIGN = 'CAMPAIGN',
    SERVICE_LISTING = 'SERVICE_LISTING',
    BENEFIT_LISTING = 'BENEFIT_LISTING',
    BENEFIT_PARTNER = 'BENEFIT_PARTNER',
    BENEFIT_LISTING_PLAN = 'BENEFIT_LISTING_PLAN',
    TOURIST_SERVICE = 'TOURIST_SERVICE',
    SERVICE_LISTING_PLAN = 'SERVICE_LISTING_PLAN',
    NOTIFICATION = 'NOTIFICATION',
    SERVICE_ORDER = 'SERVICE_ORDER',
    PROFESSIONAL_SERVICE = 'PROFESSIONAL_SERVICE',
    PROFESSIONAL_SERVICE_ORDER = 'PROFESSIONAL_SERVICE_ORDER',
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

    // ACCOMMODATION: Granular section permissions
    ACCOMMODATION_BASIC_INFO_EDIT = 'accommodation.basicInfo.edit', // Allows editing basic accommodation information
    ACCOMMODATION_CONTACT_INFO_EDIT = 'accommodation.contactInfo.edit', // Allows editing accommodation contact information
    ACCOMMODATION_LOCATION_EDIT = 'accommodation.location.edit', // Allows editing accommodation location
    ACCOMMODATION_SERVICES_EDIT = 'accommodation.services.edit', // Allows editing accommodation services and amenities
    ACCOMMODATION_PRICE_EDIT = 'accommodation.price.edit', // Allows editing accommodation pricing
    ACCOMMODATION_SCHEDULE_EDIT = 'accommodation.schedule.edit', // Allows editing accommodation schedule
    ACCOMMODATION_MEDIA_EDIT = 'accommodation.media.edit', // Allows editing accommodation media
    ACCOMMODATION_FAQS_EDIT = 'accommodation.faqs.edit', // Allows editing accommodation FAQs
    ACCOMMODATION_STATES_EDIT = 'accommodation.states.edit', // Allows editing accommodation states
    ACCOMMODATION_SEO_EDIT = 'accommodation.seo.edit', // Allows editing accommodation SEO information
    ACCOMMODATION_ADMIN_INFO_EDIT = 'accommodation.adminInfo.edit', // Allows editing accommodation admin information

    // ACCOMMODATION: Specific field permissions
    ACCOMMODATION_OWNER_CHANGE = 'accommodation.owner.change', // Allows changing accommodation owner
    ACCOMMODATION_FEATURED_TOGGLE = 'accommodation.featured.toggle', // Allows toggling featured status
    ACCOMMODATION_VISIBILITY_CHANGE = 'accommodation.visibility.change', // Allows changing accommodation visibility
    ACCOMMODATION_LIFECYCLE_CHANGE = 'accommodation.lifecycle.change', // Allows changing accommodation lifecycle state
    ACCOMMODATION_MODERATION_CHANGE = 'accommodation.moderation.change', // Allows changing accommodation moderation state

    // ACCOMMODATION_LISTING: Permissions related to accommodation listing management
    ACCOMMODATION_LISTING_CREATE = 'accommodationListing.create', // Allows creating a new accommodation listing.
    ACCOMMODATION_LISTING_UPDATE = 'accommodationListing.update', // Allows updating an accommodation listing.
    ACCOMMODATION_LISTING_DELETE = 'accommodationListing.delete', // Allows deleting an accommodation listing (soft delete).
    ACCOMMODATION_LISTING_VIEW = 'accommodationListing.view', // Allows viewing accommodation listing information.
    ACCOMMODATION_LISTING_RESTORE = 'accommodationListing.restore', // Allows restoring a deleted accommodation listing.
    ACCOMMODATION_LISTING_HARD_DELETE = 'accommodationListing.hardDelete', // Allows permanently deleting an accommodation listing.
    ACCOMMODATION_LISTING_STATUS_MANAGE = 'accommodationListing.status.manage', // Allows managing accommodation listing status (draft, active, paused, archived).

    // ACCOMMODATION_LISTING_PLAN: Permissions related to accommodation listing plan management
    ACCOMMODATION_LISTING_PLAN_CREATE = 'accommodationListingPlan.create', // Allows creating a new accommodation listing plan.
    ACCOMMODATION_LISTING_PLAN_UPDATE = 'accommodationListingPlan.update', // Allows updating an accommodation listing plan.
    ACCOMMODATION_LISTING_PLAN_DELETE = 'accommodationListingPlan.delete', // Allows deleting an accommodation listing plan (soft delete).
    ACCOMMODATION_LISTING_PLAN_VIEW = 'accommodationListingPlan.view', // Allows viewing accommodation listing plan information.
    ACCOMMODATION_LISTING_PLAN_RESTORE = 'accommodationListingPlan.restore', // Allows restoring a deleted accommodation listing plan.
    ACCOMMODATION_LISTING_PLAN_HARD_DELETE = 'accommodationListingPlan.hardDelete', // Allows permanently deleting an accommodation listing plan.
    ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE = 'accommodationListingPlan.status.manage', // Allows managing accommodation listing plan status (activate, deactivate).

    // Catalog management for amenities/features
    AMENITY_CREATE = 'amenity.create', // Allows creating a new amenity in the catalog.
    AMENITY_UPDATE = 'amenity.update', // Allows updating an amenity in the catalog.
    AMENITY_DELETE = 'amenity.delete', // Allows deleting an amenity from the catalog.
    FEATURE_CREATE = 'feature.create', // Allows creating a new feature in the catalog.
    FEATURE_UPDATE = 'feature.update', // Allows updating a feature in the catalog.
    FEATURE_DELETE = 'feature.delete', // Allows deleting a feature from the catalog.

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
    DESTINATION_VIEW_ALL = 'destination.viewAll', // Allows viewing all destinations.
    DESTINATION_ATTRACTION_MANAGE = 'destination.attraction.manage', // Allows managing destination attractions.

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
    EVENT_VIEW_ALL = 'event.viewAll', // Allows viewing all events.
    EVENT_LOCATION_MANAGE = 'event.location.manage', // Allows managing event locations catalog.

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
    POST_VIEW_ALL = 'post.viewAll', // Allows viewing all posts.
    POST_SPONSORSHIP_MANAGE = 'post.sponsorship.manage', // Allows managing post sponsorships/contracts.

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
    USER_SETTINGS_UPDATE = 'user.settings.update', // Allows updating own user settings.
    MANAGE_USERS = 'user.manage', // Allows full management of users (create, update, delete, roles).

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
    MANAGE_CONTENT = 'content.manage', // Allows full management of content (posts, events, accommodations).
    DASHBOARD_BASE_VIEW = 'dashboard.baseView', // Allows viewing the base dashboard.
    DASHBOARD_FULL_VIEW = 'dashboard.fullView', // Allows viewing the full dashboard.
    SETTINGS_MANAGE = 'settings.manage', // Allows managing system settings.
    STATS_VIEW = 'stats.view', // Allows viewing system statistics.
    NOTIFICATION_CONFIGURE = 'notification.configure', // Allows configuring notification settings.
    SEO_MANAGE = 'seo.manage', // Allows managing SEO settings.

    // ACCESS: Permissions for accessing different panels and APIs
    ACCESS_PANEL_ADMIN = 'access.panelAdmin', // Allows accessing the admin panel.
    ACCESS_API_ADMIN = 'access.apiAdmin', // Allows accessing the admin API.
    ACCESS_API_PUBLIC = 'access.apiPublic', // Allows accessing the public API.
    ACCESS_API_PRIVATE = 'access.apiPrivate', // Allows accessing private API endpoints.
    ACCESS_PERMISSIONS_MANAGE = 'access.permissions.manage', // Allows managing permission assignments.

    // LOGGING & ERROR TRACKING: Permissions for logs, errors, analytics
    LOGS_VIEW_ALL = 'logs.viewAll', // Allows viewing all logs.
    ERRORS_VIEW = 'errors.view', // Allows viewing error logs.
    ANALYTICS_VIEW = 'analytics.view', // Allows viewing analytics data.
    VIEW_ANALYTICS = 'analytics.view', // Alias for ANALYTICS_VIEW (for backward compatibility).

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
    TAG_DELETE = 'tag.delete', // Allows deleting a tag.

    // CLIENT: Permissions related to client management (billing, subscriptions)
    CLIENT_CREATE = 'client.create', // Allows creating a new client.
    CLIENT_UPDATE = 'client.update', // Allows updating a client.
    CLIENT_DELETE = 'client.delete', // Allows deleting a client (soft delete).
    CLIENT_VIEW = 'client.view', // Allows viewing client information.
    CLIENT_RESTORE = 'client.restore', // Allows restoring a deleted client.
    CLIENT_HARD_DELETE = 'client.hardDelete', // Allows permanently deleting a client.
    MANAGE_CLIENTS = 'client.manage', // Allows full management of clients.

    // SUBSCRIPTION: Permissions related to subscription management
    SUBSCRIPTION_CREATE = 'subscription.create', // Allows creating a new subscription.
    SUBSCRIPTION_UPDATE = 'subscription.update', // Allows updating a subscription.
    SUBSCRIPTION_DELETE = 'subscription.delete', // Allows deleting a subscription.
    SUBSCRIPTION_VIEW = 'subscription.view', // Allows viewing subscription information.
    MANAGE_SUBSCRIPTIONS = 'subscription.manage', // Allows full management of subscriptions.

    // SUBSCRIPTION_ITEM: Permissions related to subscription item management
    SUBSCRIPTION_ITEM_CREATE = 'subscriptionItem.create', // Allows creating a new subscription item.
    SUBSCRIPTION_ITEM_UPDATE = 'subscriptionItem.update', // Allows updating a subscription item.
    SUBSCRIPTION_ITEM_DELETE = 'subscriptionItem.delete', // Allows deleting a subscription item (soft delete).
    SUBSCRIPTION_ITEM_VIEW = 'subscriptionItem.view', // Allows viewing subscription item information.
    SUBSCRIPTION_ITEM_RESTORE = 'subscriptionItem.restore', // Allows restoring a deleted subscription item.
    SUBSCRIPTION_ITEM_HARD_DELETE = 'subscriptionItem.hardDelete', // Allows permanently deleting a subscription item.
    SUBSCRIPTION_ITEM_LINK_MANAGE = 'subscriptionItem.link.manage', // Allows managing links between subscriptions/purchases and entities.

    // PRODUCT: Permissions related to product management
    PRODUCT_CREATE = 'product.create', // Allows creating a new product.
    PRODUCT_UPDATE = 'product.update', // Allows updating a product.
    PRODUCT_DELETE = 'product.delete', // Allows deleting a product.
    PRODUCT_VIEW = 'product.view', // Allows viewing product information.
    MANAGE_PRODUCTS = 'product.manage', // Allows full management of products.

    // PRICING_PLAN: Permissions related to pricing plan management
    PRICING_PLAN_CREATE = 'pricingPlan.create', // Allows creating a new pricing plan.
    PRICING_PLAN_UPDATE = 'pricingPlan.update', // Allows updating a pricing plan.
    PRICING_PLAN_DELETE = 'pricingPlan.delete', // Allows deleting a pricing plan.
    PRICING_PLAN_VIEW = 'pricingPlan.view', // Allows viewing pricing plan information.

    // PRICING_TIER: Permissions related to pricing tier management
    PRICING_TIER_CREATE = 'pricingTier.create', // Allows creating a new pricing tier.
    PRICING_TIER_UPDATE = 'pricingTier.update', // Allows updating a pricing tier.
    PRICING_TIER_DELETE = 'pricingTier.delete', // Allows deleting a pricing tier.
    PRICING_TIER_VIEW = 'pricingTier.view', // Allows viewing pricing tier information.

    // PROMOTION: Permissions related to marketing promotions management
    PROMOTION_CREATE = 'promotion.create', // Allows creating a new promotion.
    PROMOTION_UPDATE = 'promotion.update', // Allows updating a promotion.
    PROMOTION_DELETE = 'promotion.delete', // Allows deleting a promotion.
    PROMOTION_VIEW = 'promotion.view', // Allows viewing promotion information.
    PROMOTION_RESTORE = 'promotion.restore', // Allows restoring a deleted promotion.
    PROMOTION_HARD_DELETE = 'promotion.hardDelete', // Allows permanently deleting a promotion.
    PROMOTION_SOFT_DELETE_VIEW = 'promotion.softDelete.view', // Allows viewing soft-deleted promotions.
    PROMOTION_MANAGE_RULES = 'promotion.rules.manage', // Allows managing promotion rules and conditions.
    PROMOTION_ANALYTICS_VIEW = 'promotion.analytics.view', // Allows viewing promotion performance analytics.
    PROMOTION_APPLY = 'promotion.apply', // Allows applying promotions to purchases.

    // DISCOUNT_CODE: Permissions related to discount code management
    DISCOUNT_CODE_CREATE = 'discountCode.create', // Allows creating a new discount code.
    DISCOUNT_CODE_UPDATE = 'discountCode.update', // Allows updating a discount code.
    DISCOUNT_CODE_DELETE = 'discountCode.delete', // Allows deleting a discount code (soft delete).
    DISCOUNT_CODE_VIEW = 'discountCode.view', // Allows viewing discount code information.
    DISCOUNT_CODE_RESTORE = 'discountCode.restore', // Allows restoring a deleted discount code.
    DISCOUNT_CODE_HARD_DELETE = 'discountCode.hardDelete', // Allows permanently deleting a discount code.
    DISCOUNT_CODE_SOFT_DELETE_VIEW = 'discountCode.softDelete.view', // Allows viewing soft-deleted discount codes.
    DISCOUNT_CODE_VALIDATE = 'discountCode.validate', // Allows validating if a discount code can be used.
    DISCOUNT_CODE_APPLY = 'discountCode.apply', // Allows applying discount codes to purchases.
    DISCOUNT_CODE_USAGE_VIEW = 'discountCode.usage.view', // Allows viewing discount code usage history.
    DISCOUNT_CODE_ANALYTICS_VIEW = 'discountCode.analytics.view', // Allows viewing discount code performance analytics.

    // CAMPAIGN: Permissions related to marketing campaign management
    CAMPAIGN_CREATE = 'campaign.create', // Allows creating a new campaign.
    CAMPAIGN_UPDATE = 'campaign.update', // Allows updating a campaign.
    CAMPAIGN_DELETE = 'campaign.delete', // Allows deleting a campaign (soft delete).
    CAMPAIGN_VIEW = 'campaign.view', // Allows viewing campaign information.
    CAMPAIGN_RESTORE = 'campaign.restore', // Allows restoring a deleted campaign.
    CAMPAIGN_HARD_DELETE = 'campaign.hardDelete', // Allows permanently deleting a campaign.
    CAMPAIGN_SOFT_DELETE_VIEW = 'campaign.softDelete.view', // Allows viewing soft-deleted campaigns.
    CAMPAIGN_STATUS_MANAGE = 'campaign.status.manage', // Allows managing campaign status (activate, pause, complete, cancel).
    CAMPAIGN_BUDGET_MANAGE = 'campaign.budget.manage', // Allows managing campaign budget and spending.
    CAMPAIGN_PERFORMANCE_VIEW = 'campaign.performance.view', // Allows viewing campaign performance metrics.
    CAMPAIGN_ANALYTICS_VIEW = 'campaign.analytics.view', // Allows viewing campaign analytics and ROI.

    // AD_MEDIA_ASSET: Permissions related to advertising media asset management
    AD_MEDIA_ASSET_CREATE = 'adMediaAsset.create', // Allows creating a new advertising media asset.
    AD_MEDIA_ASSET_UPDATE = 'adMediaAsset.update', // Allows updating an advertising media asset.
    AD_MEDIA_ASSET_DELETE = 'adMediaAsset.delete', // Allows deleting an advertising media asset (soft delete).
    AD_MEDIA_ASSET_VIEW = 'adMediaAsset.view', // Allows viewing advertising media asset information.
    AD_MEDIA_ASSET_RESTORE = 'adMediaAsset.restore', // Allows restoring a deleted advertising media asset.
    AD_MEDIA_ASSET_HARD_DELETE = 'adMediaAsset.hardDelete', // Allows permanently deleting an advertising media asset.
    AD_MEDIA_ASSET_SOFT_DELETE_VIEW = 'adMediaAsset.softDelete.view', // Allows viewing soft-deleted advertising media assets.
    AD_MEDIA_ASSET_STATUS_MANAGE = 'adMediaAsset.status.manage', // Allows managing advertising media asset status.
    AD_MEDIA_ASSET_PERFORMANCE_VIEW = 'adMediaAsset.performance.view', // Allows viewing advertising media asset performance metrics.

    // AD_SLOT: Permissions related to advertising slot management
    AD_SLOT_CREATE = 'adSlot.create', // Allows creating a new advertising slot.
    AD_SLOT_UPDATE = 'adSlot.update', // Allows updating an advertising slot.
    AD_SLOT_DELETE = 'adSlot.delete', // Allows deleting an advertising slot (soft delete).
    AD_SLOT_VIEW = 'adSlot.view', // Allows viewing advertising slot information.
    AD_SLOT_RESTORE = 'adSlot.restore', // Allows restoring a deleted advertising slot.
    AD_SLOT_HARD_DELETE = 'adSlot.hardDelete', // Allows permanently deleting an advertising slot.
    AD_SLOT_SOFT_DELETE_VIEW = 'adSlot.softDelete.view', // Allows viewing soft-deleted advertising slots.
    AD_SLOT_STATUS_MANAGE = 'adSlot.status.manage', // Allows managing advertising slot status (activate/deactivate).
    AD_SLOT_PRICING_MANAGE = 'adSlot.pricing.manage', // Allows managing advertising slot pricing and rates.
    AD_SLOT_AVAILABILITY_MANAGE = 'adSlot.availability.manage', // Allows managing advertising slot availability and scheduling.
    AD_SLOT_PERFORMANCE_VIEW = 'adSlot.performance.view', // Allows viewing advertising slot performance metrics.

    // AD_SLOT_RESERVATION: Permissions related to advertising slot reservation management
    AD_SLOT_RESERVATION_CREATE = 'adSlotReservation.create', // Allows creating a new advertising slot reservation.
    AD_SLOT_RESERVATION_UPDATE = 'adSlotReservation.update', // Allows updating an advertising slot reservation.
    AD_SLOT_RESERVATION_DELETE = 'adSlotReservation.delete', // Allows deleting an advertising slot reservation (soft delete).
    AD_SLOT_RESERVATION_VIEW = 'adSlotReservation.view', // Allows viewing advertising slot reservation information.
    AD_SLOT_RESERVATION_RESTORE = 'adSlotReservation.restore', // Allows restoring a deleted advertising slot reservation.
    AD_SLOT_RESERVATION_HARD_DELETE = 'adSlotReservation.hardDelete', // Allows permanently deleting an advertising slot reservation.
    AD_SLOT_RESERVATION_SOFT_DELETE_VIEW = 'adSlotReservation.softDelete.view', // Allows viewing soft-deleted advertising slot reservations.
    AD_SLOT_RESERVATION_STATUS_MANAGE = 'adSlotReservation.status.manage', // Allows managing advertising slot reservation status (activate/pause/cancel/end).

    // SPONSORSHIP: Permissions related to sponsorship management
    SPONSORSHIP_CREATE = 'sponsorship.create', // Allows creating a new sponsorship.
    SPONSORSHIP_UPDATE = 'sponsorship.update', // Allows updating a sponsorship.
    SPONSORSHIP_DELETE = 'sponsorship.delete', // Allows deleting a sponsorship (soft delete).
    SPONSORSHIP_VIEW = 'sponsorship.view', // Allows viewing sponsorship information.
    SPONSORSHIP_RESTORE = 'sponsorship.restore', // Allows restoring a deleted sponsorship.
    SPONSORSHIP_HARD_DELETE = 'sponsorship.hardDelete', // Allows permanently deleting a sponsorship.
    SPONSORSHIP_STATUS_MANAGE = 'sponsorship.status.manage', // Allows managing sponsorship status (activate, pause, expire, cancel).

    // FEATURED_ACCOMMODATION: Permissions related to featured accommodation management
    FEATURED_ACCOMMODATION_CREATE = 'featuredAccommodation.create', // Allows creating a new featured accommodation.
    FEATURED_ACCOMMODATION_UPDATE = 'featuredAccommodation.update', // Allows updating a featured accommodation.
    FEATURED_ACCOMMODATION_DELETE = 'featuredAccommodation.delete', // Allows deleting a featured accommodation (soft delete).
    FEATURED_ACCOMMODATION_VIEW = 'featuredAccommodation.view', // Allows viewing featured accommodation information.
    FEATURED_ACCOMMODATION_RESTORE = 'featuredAccommodation.restore', // Allows restoring a deleted featured accommodation.
    FEATURED_ACCOMMODATION_HARD_DELETE = 'featuredAccommodation.hardDelete', // Allows permanently deleting a featured accommodation.
    FEATURED_ACCOMMODATION_STATUS_MANAGE = 'featuredAccommodation.status.manage', // Allows managing featured accommodation status and priority.

    // SERVICE_LISTING: Permissions related to service listing management
    SERVICE_LISTING_CREATE = 'serviceListing.create', // Allows creating a new service listing.
    SERVICE_LISTING_UPDATE = 'serviceListing.update', // Allows updating a service listing.
    SERVICE_LISTING_DELETE = 'serviceListing.delete', // Allows deleting a service listing (soft delete).
    SERVICE_LISTING_VIEW = 'serviceListing.view', // Allows viewing service listing information.
    SERVICE_LISTING_RESTORE = 'serviceListing.restore', // Allows restoring a deleted service listing.
    SERVICE_LISTING_HARD_DELETE = 'serviceListing.hardDelete', // Allows permanently deleting a service listing.
    SERVICE_LISTING_STATUS_MANAGE = 'serviceListing.status.manage', // Allows managing service listing status (draft, pending, active, paused, rejected, expired).

    // ACCOMMODATION_REVIEW: Permissions related to accommodation review management (additional)
    ACCOMMODATION_REVIEW_DELETE = 'accommodationReview.delete', // Allows deleting an accommodation review (soft delete).
    ACCOMMODATION_REVIEW_VIEW = 'accommodationReview.view', // Allows viewing accommodation review information.
    ACCOMMODATION_REVIEW_RESTORE = 'accommodationReview.restore', // Allows restoring a deleted accommodation review.
    ACCOMMODATION_REVIEW_HARD_DELETE = 'accommodationReview.hardDelete', // Allows permanently deleting an accommodation review.
    ACCOMMODATION_REVIEW_REPORT = 'accommodationReview.report', // Allows reporting inappropriate reviews.

    // AD_PRICING_CATALOG: Permissions related to ad pricing catalog management
    AD_PRICING_CATALOG_CREATE = 'adPricingCatalog.create', // Allows creating a new ad pricing catalog.
    AD_PRICING_CATALOG_UPDATE = 'adPricingCatalog.update', // Allows updating an ad pricing catalog.
    AD_PRICING_CATALOG_DELETE = 'adPricingCatalog.delete', // Allows deleting an ad pricing catalog (soft delete).
    AD_PRICING_CATALOG_VIEW = 'adPricingCatalog.view', // Allows viewing ad pricing catalog information.
    AD_PRICING_CATALOG_RESTORE = 'adPricingCatalog.restore', // Allows restoring a deleted ad pricing catalog.
    AD_PRICING_CATALOG_HARD_DELETE = 'adPricingCatalog.hardDelete', // Allows permanently deleting an ad pricing catalog.
    AD_PRICING_CATALOG_CALCULATE_PRICE = 'adPricingCatalog.calculatePrice', // Allows calculating prices based on catalog rules.

    // ATTRACTION: Permissions related to attraction catalog management
    ATTRACTION_CREATE = 'attraction.create', // Allows creating a new attraction.
    ATTRACTION_UPDATE = 'attraction.update', // Allows updating an attraction.
    ATTRACTION_DELETE = 'attraction.delete', // Allows deleting an attraction (soft delete).
    ATTRACTION_VIEW = 'attraction.view', // Allows viewing attraction information.
    ATTRACTION_RESTORE = 'attraction.restore', // Allows restoring a deleted attraction.
    ATTRACTION_HARD_DELETE = 'attraction.hardDelete', // Allows permanently deleting an attraction.

    // CLIENT_ACCESS_RIGHT: Permissions related to client access rights management
    CLIENT_ACCESS_RIGHT_CREATE = 'clientAccessRight.create', // Allows creating a new client access right.
    CLIENT_ACCESS_RIGHT_UPDATE = 'clientAccessRight.update', // Allows updating a client access right.
    CLIENT_ACCESS_RIGHT_DELETE = 'clientAccessRight.delete', // Allows deleting a client access right (soft delete).
    CLIENT_ACCESS_RIGHT_VIEW = 'clientAccessRight.view', // Allows viewing client access right information.
    CLIENT_ACCESS_RIGHT_RESTORE = 'clientAccessRight.restore', // Allows restoring a deleted client access right.
    CLIENT_ACCESS_RIGHT_HARD_DELETE = 'clientAccessRight.hardDelete', // Allows permanently deleting a client access right.
    CLIENT_ACCESS_RIGHT_GRANT = 'clientAccessRight.grant', // Allows granting access rights to clients.
    CLIENT_ACCESS_RIGHT_REVOKE = 'clientAccessRight.revoke', // Allows revoking access rights from clients.

    // CREDIT_NOTE: Permissions related to credit note management
    CREDIT_NOTE_CREATE = 'creditNote.create', // Allows creating a new credit note.
    CREDIT_NOTE_UPDATE = 'creditNote.update', // Allows updating a credit note.
    CREDIT_NOTE_DELETE = 'creditNote.delete', // Allows deleting a credit note (soft delete).
    CREDIT_NOTE_VIEW = 'creditNote.view', // Allows viewing credit note information.
    CREDIT_NOTE_RESTORE = 'creditNote.restore', // Allows restoring a deleted credit note.
    CREDIT_NOTE_HARD_DELETE = 'creditNote.hardDelete', // Allows permanently deleting a credit note.
    CREDIT_NOTE_ISSUE = 'creditNote.issue', // Allows issuing a credit note.
    CREDIT_NOTE_APPLY = 'creditNote.apply', // Allows applying a credit note to an invoice.
    CREDIT_NOTE_VOID = 'creditNote.void', // Allows voiding a credit note.

    // DESTINATION_REVIEW: Permissions related to destination review management (additional)
    DESTINATION_REVIEW_DELETE = 'destinationReview.delete', // Allows deleting a destination review (soft delete).
    DESTINATION_REVIEW_VIEW = 'destinationReview.view', // Allows viewing destination review information.
    DESTINATION_REVIEW_RESTORE = 'destinationReview.restore', // Allows restoring a deleted destination review.
    DESTINATION_REVIEW_HARD_DELETE = 'destinationReview.hardDelete', // Allows permanently deleting a destination review.
    DESTINATION_REVIEW_REPORT = 'destinationReview.report', // Allows reporting inappropriate reviews.

    // DISCOUNT_CODE_USAGE: Permissions related to discount code usage tracking (additional)
    // Note: DISCOUNT_CODE_USAGE_VIEW already exists in DISCOUNT_CODE section
    DISCOUNT_CODE_USAGE_CREATE = 'discountCodeUsage.create', // Allows creating a new discount code usage record.
    DISCOUNT_CODE_USAGE_UPDATE = 'discountCodeUsage.update', // Allows updating a discount code usage record.
    DISCOUNT_CODE_USAGE_DELETE = 'discountCodeUsage.delete', // Allows deleting a discount code usage record (soft delete).
    DISCOUNT_CODE_USAGE_RESTORE = 'discountCodeUsage.restore', // Allows restoring a deleted discount code usage record.
    DISCOUNT_CODE_USAGE_HARD_DELETE = 'discountCodeUsage.hardDelete', // Allows permanently deleting a discount code usage record.

    // EVENT_LOCATION: Permissions related to event location catalog management (additional)
    // Note: EVENT_LOCATION_UPDATE already exists in EVENT section
    EVENT_LOCATION_CREATE = 'eventLocation.create', // Allows creating a new event location.
    EVENT_LOCATION_DELETE = 'eventLocation.delete', // Allows deleting an event location (soft delete).
    EVENT_LOCATION_VIEW = 'eventLocation.view', // Allows viewing event location information.
    EVENT_LOCATION_RESTORE = 'eventLocation.restore', // Allows restoring a deleted event location.
    EVENT_LOCATION_HARD_DELETE = 'eventLocation.hardDelete', // Allows permanently deleting an event location.

    // EVENT_ORGANIZER: Permissions related to event organizer catalog management
    EVENT_ORGANIZER_CREATE = 'eventOrganizer.create', // Allows creating a new event organizer.
    EVENT_ORGANIZER_UPDATE = 'eventOrganizer.update', // Allows updating an event organizer.
    EVENT_ORGANIZER_DELETE = 'eventOrganizer.delete', // Allows deleting an event organizer (soft delete).
    EVENT_ORGANIZER_VIEW = 'eventOrganizer.view', // Allows viewing event organizer information.
    EVENT_ORGANIZER_RESTORE = 'eventOrganizer.restore', // Allows restoring a deleted event organizer.
    EVENT_ORGANIZER_HARD_DELETE = 'eventOrganizer.hardDelete', // Allows permanently deleting an event organizer.

    // INVOICE: Permissions related to invoice management
    INVOICE_CREATE = 'invoice.create', // Allows creating a new invoice.
    INVOICE_UPDATE = 'invoice.update', // Allows updating an invoice.
    INVOICE_DELETE = 'invoice.delete', // Allows deleting an invoice (soft delete).
    INVOICE_VIEW = 'invoice.view', // Allows viewing invoice information.
    INVOICE_RESTORE = 'invoice.restore', // Allows restoring a deleted invoice.
    INVOICE_HARD_DELETE = 'invoice.hardDelete', // Allows permanently deleting an invoice.
    INVOICE_GENERATE = 'invoice.generate', // Allows generating invoices.
    INVOICE_SEND = 'invoice.send', // Allows sending invoices to clients.
    INVOICE_VOID = 'invoice.void', // Allows voiding an invoice.
    INVOICE_MARK_PAID = 'invoice.markPaid', // Allows marking an invoice as paid.

    // INVOICE_LINE: Permissions related to invoice line item management
    INVOICE_LINE_CREATE = 'invoiceLine.create', // Allows creating a new invoice line item.
    INVOICE_LINE_UPDATE = 'invoiceLine.update', // Allows updating an invoice line item.
    INVOICE_LINE_DELETE = 'invoiceLine.delete', // Allows deleting an invoice line item (soft delete).
    INVOICE_LINE_VIEW = 'invoiceLine.view', // Allows viewing invoice line item information.
    INVOICE_LINE_RESTORE = 'invoiceLine.restore', // Allows restoring a deleted invoice line item.
    INVOICE_LINE_HARD_DELETE = 'invoiceLine.hardDelete', // Allows permanently deleting an invoice line item.

    // PAYMENT: Permissions related to payment processing
    PAYMENT_CREATE = 'payment.create', // Allows creating a new payment record.
    PAYMENT_UPDATE = 'payment.update', // Allows updating a payment record.
    PAYMENT_DELETE = 'payment.delete', // Allows deleting a payment record (soft delete).
    PAYMENT_VIEW = 'payment.view', // Allows viewing payment information.
    PAYMENT_RESTORE = 'payment.restore', // Allows restoring a deleted payment record.
    PAYMENT_HARD_DELETE = 'payment.hardDelete', // Allows permanently deleting a payment record.
    PAYMENT_PROCESS = 'payment.process', // Allows processing payments.
    PAYMENT_REFUND = 'payment.refund', // Allows processing payment refunds.
    PAYMENT_CANCEL = 'payment.cancel', // Allows canceling payments.

    // PAYMENT_METHOD: Permissions related to payment method management
    PAYMENT_METHOD_CREATE = 'paymentMethod.create', // Allows creating a new payment method.
    PAYMENT_METHOD_UPDATE = 'paymentMethod.update', // Allows updating a payment method.
    PAYMENT_METHOD_DELETE = 'paymentMethod.delete', // Allows deleting a payment method (soft delete).
    PAYMENT_METHOD_VIEW = 'paymentMethod.view', // Allows viewing payment method information.
    PAYMENT_METHOD_RESTORE = 'paymentMethod.restore', // Allows restoring a deleted payment method.
    PAYMENT_METHOD_HARD_DELETE = 'paymentMethod.hardDelete', // Allows permanently deleting a payment method.

    // PERMISSION: Permissions related to permission system management
    PERMISSION_CREATE = 'permission.create', // Allows creating a new permission.
    PERMISSION_UPDATE = 'permission.update', // Allows updating a permission.
    PERMISSION_DELETE = 'permission.delete', // Allows deleting a permission (soft delete).
    PERMISSION_VIEW = 'permission.view', // Allows viewing permission information.
    PERMISSION_RESTORE = 'permission.restore', // Allows restoring a deleted permission.
    PERMISSION_HARD_DELETE = 'permission.hardDelete', // Allows permanently deleting a permission.
    PERMISSION_ASSIGN = 'permission.assign', // Allows assigning permissions to roles/users.
    PERMISSION_REVOKE = 'permission.revoke', // Allows revoking permissions from roles/users.

    // POST_SPONSOR: Permissions related to post sponsor catalog management
    POST_SPONSOR_CREATE = 'postSponsor.create', // Allows creating a new post sponsor.
    POST_SPONSOR_UPDATE = 'postSponsor.update', // Allows updating a post sponsor.
    POST_SPONSOR_DELETE = 'postSponsor.delete', // Allows deleting a post sponsor (soft delete).
    POST_SPONSOR_VIEW = 'postSponsor.view', // Allows viewing post sponsor information.
    POST_SPONSOR_RESTORE = 'postSponsor.restore', // Allows restoring a deleted post sponsor.
    POST_SPONSOR_HARD_DELETE = 'postSponsor.hardDelete', // Allows permanently deleting a post sponsor.

    // POST_SPONSORSHIP: Permissions related to post sponsorship contract management
    POST_SPONSORSHIP_CREATE = 'postSponsorship.create', // Allows creating a new post sponsorship contract.
    POST_SPONSORSHIP_UPDATE = 'postSponsorship.update', // Allows updating a post sponsorship contract.
    POST_SPONSORSHIP_DELETE = 'postSponsorship.delete', // Allows deleting a post sponsorship contract (soft delete).
    POST_SPONSORSHIP_VIEW = 'postSponsorship.view', // Allows viewing post sponsorship contract information.
    POST_SPONSORSHIP_RESTORE = 'postSponsorship.restore', // Allows restoring a deleted post sponsorship contract.
    POST_SPONSORSHIP_HARD_DELETE = 'postSponsorship.hardDelete', // Allows permanently deleting a post sponsorship contract.
    POST_SPONSORSHIP_STATUS_MANAGE = 'postSponsorship.status.manage', // Allows managing post sponsorship status (activate, pause, expire, cancel).

    // PURCHASE: Permissions related to purchase management
    PURCHASE_CREATE = 'purchase.create', // Allows creating a new purchase.
    PURCHASE_UPDATE = 'purchase.update', // Allows updating a purchase.
    PURCHASE_DELETE = 'purchase.delete', // Allows deleting a purchase (soft delete).
    PURCHASE_VIEW = 'purchase.view', // Allows viewing purchase information.
    PURCHASE_RESTORE = 'purchase.restore', // Allows restoring a deleted purchase.
    PURCHASE_HARD_DELETE = 'purchase.hardDelete', // Allows permanently deleting a purchase.
    PURCHASE_PROCESS = 'purchase.process', // Allows processing purchases.
    PURCHASE_CANCEL = 'purchase.cancel', // Allows canceling purchases.
    MANAGE_PURCHASES = 'purchase.manage', // Allows full management of purchases.

    // REFUND: Permissions related to refund management
    REFUND_CREATE = 'refund.create', // Allows creating a new refund.
    REFUND_UPDATE = 'refund.update', // Allows updating a refund.
    REFUND_DELETE = 'refund.delete', // Allows deleting a refund (soft delete).
    REFUND_VIEW = 'refund.view', // Allows viewing refund information.
    REFUND_RESTORE = 'refund.restore', // Allows restoring a deleted refund.
    REFUND_HARD_DELETE = 'refund.hardDelete', // Allows permanently deleting a refund.
    REFUND_PROCESS = 'refund.process', // Allows processing refunds.
    REFUND_APPROVE = 'refund.approve', // Allows approving refund requests.
    REFUND_REJECT = 'refund.reject', // Allows rejecting refund requests.

    // USER_BOOKMARK: Permissions related to user bookmark management
    USER_BOOKMARK_CREATE = 'userBookmark.create', // Allows creating a new user bookmark.
    USER_BOOKMARK_UPDATE = 'userBookmark.update', // Allows updating a user bookmark.
    USER_BOOKMARK_DELETE = 'userBookmark.delete', // Allows deleting a user bookmark (soft delete).
    USER_BOOKMARK_VIEW = 'userBookmark.view', // Allows viewing user bookmark information.
    USER_BOOKMARK_RESTORE = 'userBookmark.restore', // Allows restoring a deleted user bookmark.
    USER_BOOKMARK_HARD_DELETE = 'userBookmark.hardDelete', // Allows permanently deleting a user bookmark.

    // BENEFIT_LISTING: Permissions related to benefit listing management
    BENEFIT_LISTING_CREATE = 'benefitListing.create', // Allows creating a new benefit listing.
    BENEFIT_LISTING_UPDATE = 'benefitListing.update', // Allows updating a benefit listing.
    BENEFIT_LISTING_DELETE = 'benefitListing.delete', // Allows deleting a benefit listing (soft delete).
    BENEFIT_LISTING_VIEW = 'benefitListing.view', // Allows viewing benefit listing information.
    BENEFIT_LISTING_RESTORE = 'benefitListing.restore', // Allows restoring a deleted benefit listing.
    BENEFIT_LISTING_HARD_DELETE = 'benefitListing.hardDelete', // Allows permanently deleting a benefit listing.
    BENEFIT_LISTING_SOFT_DELETE_VIEW = 'benefitListing.softDelete.view', // Allows viewing soft-deleted benefit listings.
    BENEFIT_LISTING_STATUS_MANAGE = 'benefitListing.status.manage', // Allows managing benefit listing status.

    // NOTIFICATION: Permissions related to notification management
    NOTIFICATION_CREATE = 'notification.create', // Allows creating a new notification.
    NOTIFICATION_UPDATE = 'notification.update', // Allows updating a notification.
    NOTIFICATION_DELETE = 'notification.delete', // Allows deleting a notification (soft delete).
    NOTIFICATION_VIEW = 'notification.view', // Allows viewing notification information.
    NOTIFICATION_RESTORE = 'notification.restore', // Allows restoring a deleted notification.
    NOTIFICATION_HARD_DELETE = 'notification.hardDelete', // Allows permanently deleting a notification.
    NOTIFICATION_SOFT_DELETE_VIEW = 'notification.softDelete.view', // Allows viewing soft-deleted notifications.
    NOTIFICATION_SEND = 'notification.send', // Allows sending notifications.
    NOTIFICATION_STATUS_MANAGE = 'notification.status.manage', // Allows managing notification status.

    // PROFESSIONAL_SERVICE: Permissions related to professional service management
    PROFESSIONAL_SERVICE_CREATE = 'professionalService.create', // Allows creating a new professional service.
    PROFESSIONAL_SERVICE_UPDATE = 'professionalService.update', // Allows updating a professional service.
    PROFESSIONAL_SERVICE_DELETE = 'professionalService.delete', // Allows deleting a professional service (soft delete).
    PROFESSIONAL_SERVICE_VIEW = 'professionalService.view', // Allows viewing professional service information.
    PROFESSIONAL_SERVICE_RESTORE = 'professionalService.restore', // Allows restoring a deleted professional service.
    PROFESSIONAL_SERVICE_HARD_DELETE = 'professionalService.hardDelete', // Allows permanently deleting a professional service.
    PROFESSIONAL_SERVICE_SOFT_DELETE_VIEW = 'professionalService.softDelete.view', // Allows viewing soft-deleted professional services.
    PROFESSIONAL_SERVICE_STATUS_MANAGE = 'professionalService.status.manage', // Allows managing professional service status.

    // PROFESSIONAL_SERVICE_ORDER: Permissions related to professional service order management
    PROFESSIONAL_SERVICE_ORDER_CREATE = 'professionalServiceOrder.create', // Allows creating a new professional service order.
    PROFESSIONAL_SERVICE_ORDER_UPDATE = 'professionalServiceOrder.update', // Allows updating a professional service order.
    PROFESSIONAL_SERVICE_ORDER_DELETE = 'professionalServiceOrder.delete', // Allows deleting a professional service order (soft delete).
    PROFESSIONAL_SERVICE_ORDER_VIEW = 'professionalServiceOrder.view', // Allows viewing professional service order information.
    PROFESSIONAL_SERVICE_ORDER_RESTORE = 'professionalServiceOrder.restore', // Allows restoring a deleted professional service order.
    PROFESSIONAL_SERVICE_ORDER_HARD_DELETE = 'professionalServiceOrder.hardDelete', // Allows permanently deleting a professional service order.
    PROFESSIONAL_SERVICE_ORDER_SOFT_DELETE_VIEW = 'professionalServiceOrder.softDelete.view', // Allows viewing soft-deleted professional service orders.
    PROFESSIONAL_SERVICE_ORDER_STATUS_MANAGE = 'professionalServiceOrder.status.manage', // Allows managing professional service order status.

    // BENEFIT_PARTNER: Permissions related to benefit partner management
    BENEFIT_PARTNER_CREATE = 'benefitPartner.create', // Allows creating a new benefit partner.
    BENEFIT_PARTNER_UPDATE = 'benefitPartner.update', // Allows updating a benefit partner.
    BENEFIT_PARTNER_DELETE = 'benefitPartner.delete', // Allows deleting a benefit partner (soft delete).
    BENEFIT_PARTNER_VIEW = 'benefitPartner.view', // Allows viewing benefit partner information.
    BENEFIT_PARTNER_RESTORE = 'benefitPartner.restore', // Allows restoring a deleted benefit partner.
    BENEFIT_PARTNER_HARD_DELETE = 'benefitPartner.hardDelete', // Allows permanently deleting a benefit partner.
    BENEFIT_PARTNER_SOFT_DELETE_VIEW = 'benefitPartner.softDelete.view', // Allows viewing soft-deleted benefit partners.
    BENEFIT_PARTNER_STATUS_MANAGE = 'benefitPartner.status.manage', // Allows managing benefit partner status.

    // BENEFIT_LISTING_PLAN: Permissions related to benefit listing plan management
    BENEFIT_LISTING_PLAN_CREATE = 'benefitListingPlan.create', // Allows creating a new benefit listing plan.
    BENEFIT_LISTING_PLAN_UPDATE = 'benefitListingPlan.update', // Allows updating a benefit listing plan.
    BENEFIT_LISTING_PLAN_DELETE = 'benefitListingPlan.delete', // Allows deleting a benefit listing plan (soft delete).
    BENEFIT_LISTING_PLAN_VIEW = 'benefitListingPlan.view', // Allows viewing benefit listing plan information.
    BENEFIT_LISTING_PLAN_RESTORE = 'benefitListingPlan.restore', // Allows restoring a deleted benefit listing plan.
    BENEFIT_LISTING_PLAN_HARD_DELETE = 'benefitListingPlan.hardDelete', // Allows permanently deleting a benefit listing plan.
    BENEFIT_LISTING_PLAN_SOFT_DELETE_VIEW = 'benefitListingPlan.softDelete.view', // Allows viewing soft-deleted benefit listing plans.
    BENEFIT_LISTING_PLAN_STATUS_MANAGE = 'benefitListingPlan.status.manage', // Allows managing benefit listing plan status.

    // TOURIST_SERVICE: Permissions related to tourist service management
    TOURIST_SERVICE_CREATE = 'touristService.create', // Allows creating a new tourist service.
    TOURIST_SERVICE_UPDATE = 'touristService.update', // Allows updating a tourist service.
    TOURIST_SERVICE_DELETE = 'touristService.delete', // Allows deleting a tourist service (soft delete).
    TOURIST_SERVICE_VIEW = 'touristService.view', // Allows viewing tourist service information.
    TOURIST_SERVICE_RESTORE = 'touristService.restore', // Allows restoring a deleted tourist service.
    TOURIST_SERVICE_HARD_DELETE = 'touristService.hardDelete', // Allows permanently deleting a tourist service.
    TOURIST_SERVICE_SOFT_DELETE_VIEW = 'touristService.softDelete.view', // Allows viewing soft-deleted tourist services.
    TOURIST_SERVICE_STATUS_MANAGE = 'touristService.status.manage', // Allows managing tourist service status.

    // SERVICE_LISTING_PLAN: Permissions related to service listing plan management
    SERVICE_LISTING_PLAN_CREATE = 'serviceListingPlan.create', // Allows creating a new service listing plan.
    SERVICE_LISTING_PLAN_UPDATE = 'serviceListingPlan.update', // Allows updating a service listing plan.
    SERVICE_LISTING_PLAN_DELETE = 'serviceListingPlan.delete', // Allows deleting a service listing plan (soft delete).
    SERVICE_LISTING_PLAN_VIEW = 'serviceListingPlan.view', // Allows viewing service listing plan information.
    SERVICE_LISTING_PLAN_RESTORE = 'serviceListingPlan.restore', // Allows restoring a deleted service listing plan.
    SERVICE_LISTING_PLAN_HARD_DELETE = 'serviceListingPlan.hardDelete', // Allows permanently deleting a service listing plan.
    SERVICE_LISTING_PLAN_SOFT_DELETE_VIEW = 'serviceListingPlan.softDelete.view', // Allows viewing soft-deleted service listing plans.
    SERVICE_LISTING_PLAN_STATUS_MANAGE = 'serviceListingPlan.status.manage', // Allows managing service listing plan status.

    // SERVICE_ORDER: Permissions related to professional service order management
    SERVICE_ORDER_CREATE = 'serviceOrder.create', // Allows creating a new service order.
    SERVICE_ORDER_UPDATE = 'serviceOrder.update', // Allows updating a service order.
    SERVICE_ORDER_DELETE = 'serviceOrder.delete', // Allows deleting a service order (soft delete).
    SERVICE_ORDER_VIEW = 'serviceOrder.view', // Allows viewing service order information.
    SERVICE_ORDER_RESTORE = 'serviceOrder.restore', // Allows restoring a deleted service order.
    SERVICE_ORDER_HARD_DELETE = 'serviceOrder.hardDelete', // Allows permanently deleting a service order.
    SERVICE_ORDER_SOFT_DELETE_VIEW = 'serviceOrder.softDelete.view', // Allows viewing soft-deleted service orders.
    SERVICE_ORDER_STATUS_MANAGE = 'serviceOrder.status.manage', // Allows managing service order status (start, complete, cancel, refund).
    SERVICE_ORDER_DELIVERABLES_MANAGE = 'serviceOrder.deliverables.manage', // Allows managing service order deliverables and revisions.
    SERVICE_ORDER_PRICING_MANAGE = 'serviceOrder.pricing.manage' // Allows managing service order pricing and charges.
}
