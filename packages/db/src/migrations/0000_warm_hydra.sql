CREATE TYPE "public"."access_right_scope_enum" AS ENUM('accommodation', 'placement', 'merchant', 'service', 'global');--> statement-breakpoint
CREATE TYPE "public"."accommodation_type_enum" AS ENUM('APARTMENT', 'HOUSE', 'COUNTRY_HOUSE', 'CABIN', 'HOTEL', 'HOSTEL', 'CAMPING', 'ROOM', 'MOTEL', 'RESORT');--> statement-breakpoint
CREATE TYPE "public"."amenities_type_enum" AS ENUM('CLIMATE_CONTROL', 'CONNECTIVITY', 'ENTERTAINMENT', 'KITCHEN', 'BED_AND_BATH', 'OUTDOORS', 'ACCESSIBILITY', 'SERVICES', 'SAFETY', 'FAMILY_FRIENDLY', 'WORK_FRIENDLY', 'GENERAL_APPLIANCES');--> statement-breakpoint
CREATE TYPE "public"."auth_provider_enum" AS ENUM('BETTER_AUTH', 'CLERK', 'AUTH0', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."billing_interval_enum" AS ENUM('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."client_type_enum" AS ENUM('POST_SPONSOR', 'ADVERTISER', 'HOST');--> statement-breakpoint
CREATE TYPE "public"."destination_type_enum" AS ENUM('COUNTRY', 'REGION', 'PROVINCE', 'DEPARTMENT', 'CITY', 'TOWN', 'NEIGHBORHOOD');--> statement-breakpoint
CREATE TYPE "public"."entity_permission_reason_enum" AS ENUM('SUPER_ADMIN', 'ADMIN', 'OWNER', 'PUBLIC_ACCESS', 'NOT_OWNER', 'NOT_ADMIN', 'NOT_SUPER_ADMIN', 'NOT_PUBLIC', 'DELETED', 'ARCHIVED', 'DRAFT', 'REJECTED', 'PENDING', 'APPROVED', 'PRIVATE', 'RESTRICTED', 'DENIED', 'MISSING_PERMISSION');--> statement-breakpoint
CREATE TYPE "public"."entity_type_enum" AS ENUM('ACCOMMODATION', 'DESTINATION', 'USER', 'POST', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."event_category_enum" AS ENUM('MUSIC', 'CULTURE', 'SPORTS', 'GASTRONOMY', 'FESTIVAL', 'NATURE', 'THEATER', 'WORKSHOP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."exchange_rate_source_enum" AS ENUM('dolarapi', 'exchangerate-api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."exchange_rate_type_enum" AS ENUM('oficial', 'blue', 'mep', 'ccl', 'tarjeta', 'standard');--> statement-breakpoint
CREATE TYPE "public"."invoice_status_enum" AS ENUM('draft', 'issued', 'sent', 'paid', 'partial_paid', 'overdue', 'cancelled', 'voided');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."moderation_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."owner_promotion_discount_type_enum" AS ENUM('percentage', 'fixed', 'free_night');--> statement-breakpoint
CREATE TYPE "public"."payment_status_enum" AS ENUM('pending', 'authorized', 'captured', 'declined', 'failed', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."permission_category_enum" AS ENUM('ACCOMMODATION', 'ACCOMMODATION_LISTING', 'ACCOMMODATION_LISTING_PLAN', 'ACCOMMODATION_REVIEW', 'AD_PRICING_CATALOG', 'ATTRACTION', 'CLIENT_ACCESS_RIGHT', 'CREDIT_NOTE', 'DESTINATION', 'DESTINATION_REVIEW', 'DISCOUNT_CODE_USAGE', 'EVENT', 'EVENT_LOCATION', 'EVENT_ORGANIZER', 'EXCHANGE_RATE', 'INVOICE', 'INVOICE_LINE', 'METRICS', 'PAYMENT', 'PAYMENT_METHOD', 'PERMISSION', 'POST', 'POST_SPONSOR', 'POST_SPONSORSHIP', 'PURCHASE', 'REFUND', 'REVALIDATION', 'USER', 'USER_BOOKMARK', 'CLIENT', 'PRODUCT', 'SUBSCRIPTION', 'SUBSCRIPTION_ITEM', 'PROMOTION', 'DISCOUNT_CODE', 'CAMPAIGN', 'SERVICE_LISTING', 'BENEFIT_LISTING', 'BENEFIT_PARTNER', 'BENEFIT_LISTING_PLAN', 'TOURIST_SERVICE', 'SERVICE_LISTING_PLAN', 'NOTIFICATION', 'SERVICE_ORDER', 'PROFESSIONAL_SERVICE', 'PROFESSIONAL_SERVICE_ORDER', 'BILLING', 'PUBLIC', 'SPONSORSHIP', 'OWNER_PROMOTION', 'FEATURED_ACCOMMODATION', 'SYSTEM', 'ACCESS');--> statement-breakpoint
CREATE TYPE "public"."permission_enum" AS ENUM('accommodation.create', 'accommodation.update.own', 'accommodation.update.any', 'accommodation.delete.own', 'accommodation.delete.any', 'accommodation.restore.own', 'accommodation.restore.any', 'accommodation.hardDelete', 'accommodation.softDelete.view', 'accommodation.publish', 'accommodation.review.moderate', 'accommodation.viewAll', 'accommodation.view.private', 'accommodation.view.draft', 'accommodation.tags.manage', 'accommodation.features.edit', 'accommodation.amenities.edit', 'accommodation.gallery.manage', 'accommodation.contact.update', 'accommodation.iaSuggestions.view', 'accommodation.iaContent.approve', 'accommodation.slug.manage', 'accommodation.basicInfo.edit', 'accommodation.contactInfo.edit', 'accommodation.location.edit', 'accommodation.services.edit', 'accommodation.price.edit', 'accommodation.schedule.edit', 'accommodation.media.edit', 'accommodation.faqs.edit', 'accommodation.states.edit', 'accommodation.seo.edit', 'accommodation.adminInfo.edit', 'accommodation.owner.change', 'accommodation.featured.toggle', 'accommodation.visibility.change', 'accommodation.lifecycle.change', 'accommodation.moderation.change', 'accommodationListing.create', 'accommodationListing.update', 'accommodationListing.delete', 'accommodationListing.view', 'accommodationListing.restore', 'accommodationListing.hardDelete', 'accommodationListing.status.manage', 'accommodationListingPlan.create', 'accommodationListingPlan.update', 'accommodationListingPlan.delete', 'accommodationListingPlan.view', 'accommodationListingPlan.restore', 'accommodationListingPlan.hardDelete', 'accommodationListingPlan.status.manage', 'amenity.view', 'amenity.create', 'amenity.update', 'amenity.delete', 'feature.view', 'feature.create', 'feature.update', 'feature.delete', 'destination.create', 'destination.update', 'destination.delete', 'destination.restore', 'destination.hardDelete', 'destination.softDelete.view', 'destination.featured.toggle', 'destination.visibility.toggle', 'destination.review.moderate', 'destination.tags.manage', 'destination.gallery.manage', 'destination.iaSuggestions.view', 'destination.iaContent.approve', 'destination.slug.manage', 'destination.view.private', 'destination.view.draft', 'destination.viewAll', 'destination.attraction.manage', 'event.create', 'event.update', 'event.delete', 'event.restore', 'event.hardDelete', 'event.softDelete.view', 'event.publish.toggle', 'event.featured.toggle', 'event.location.update', 'event.organizer.manage', 'event.slug.manage', 'event.comment.create', 'event.view.private', 'event.view.draft', 'event.viewAll', 'event.location.manage', 'post.create', 'post.update', 'post.delete', 'post.restore', 'post.hardDelete', 'post.softDelete.view', 'post.publish.toggle', 'post.sponsor.manage', 'post.tags.manage', 'post.featured.toggle', 'post.slug.manage', 'post.comment.create', 'post.view.private', 'post.view.draft', 'post.viewAll', 'post.sponsorship.manage', 'user.read.all', 'user.impersonate', 'user.create', 'user.update.roles', 'user.update.any', 'user.delete', 'user.bookmark.manage', 'user.view.profile', 'user.block', 'user.restore', 'user.hardDelete', 'user.softDelete.view', 'user.activityLog.view', 'user.password.reset', 'user.update.profile', 'user.settings.update', 'user.manage', 'accommodation.review.create', 'accommodation.review.update', 'destination.review.create', 'destination.review.update', 'host.contact.view', 'host.message.send', 'metrics.reset', 'auditLog.view', 'system.maintenanceMode', 'translations.manage', 'content.multilanguage.edit', 'content.manage', 'dashboard.baseView', 'dashboard.fullView', 'settings.manage', 'stats.view', 'notification.configure', 'seo.manage', 'access.panelAdmin', 'access.apiAdmin', 'access.apiPublic', 'access.apiPrivate', 'access.permissions.manage', 'logs.viewAll', 'errors.view', 'analytics.view', 'system.debugTools.access', 'entities.bulk.import', 'entities.bulk.export', 'ui.theme.edit', 'ui.homepageLayout.configure', 'tag.view', 'tag.create', 'tag.update', 'tag.delete', 'client.create', 'client.update', 'client.delete', 'client.view', 'client.restore', 'client.hardDelete', 'client.manage', 'subscription.create', 'subscription.update', 'subscription.delete', 'subscription.view', 'subscription.manage', 'subscriptionItem.create', 'subscriptionItem.update', 'subscriptionItem.delete', 'subscriptionItem.view', 'subscriptionItem.restore', 'subscriptionItem.hardDelete', 'subscriptionItem.link.manage', 'product.create', 'product.update', 'product.delete', 'product.view', 'product.manage', 'pricingPlan.create', 'pricingPlan.update', 'pricingPlan.delete', 'pricingPlan.view', 'pricingTier.create', 'pricingTier.update', 'pricingTier.delete', 'pricingTier.view', 'promotion.create', 'promotion.update', 'promotion.delete', 'promotion.view', 'promotion.restore', 'promotion.hardDelete', 'promotion.softDelete.view', 'promotion.rules.manage', 'promotion.analytics.view', 'promotion.apply', 'discountCode.create', 'discountCode.update', 'discountCode.delete', 'discountCode.view', 'discountCode.restore', 'discountCode.hardDelete', 'discountCode.softDelete.view', 'discountCode.validate', 'discountCode.apply', 'discountCode.usage.view', 'discountCode.analytics.view', 'campaign.create', 'campaign.update', 'campaign.delete', 'campaign.view', 'campaign.restore', 'campaign.hardDelete', 'campaign.softDelete.view', 'campaign.status.manage', 'campaign.budget.manage', 'campaign.performance.view', 'campaign.analytics.view', 'adMediaAsset.create', 'adMediaAsset.update', 'adMediaAsset.delete', 'adMediaAsset.view', 'adMediaAsset.restore', 'adMediaAsset.hardDelete', 'adMediaAsset.softDelete.view', 'adMediaAsset.status.manage', 'adMediaAsset.performance.view', 'adSlot.create', 'adSlot.update', 'adSlot.delete', 'adSlot.view', 'adSlot.restore', 'adSlot.hardDelete', 'adSlot.softDelete.view', 'adSlot.status.manage', 'adSlot.pricing.manage', 'adSlot.availability.manage', 'adSlot.performance.view', 'adSlotReservation.create', 'adSlotReservation.update', 'adSlotReservation.delete', 'adSlotReservation.view', 'adSlotReservation.restore', 'adSlotReservation.hardDelete', 'adSlotReservation.softDelete.view', 'adSlotReservation.status.manage', 'sponsorship.create', 'sponsorship.update', 'sponsorship.delete', 'sponsorship.view', 'sponsorship.restore', 'sponsorship.hardDelete', 'sponsorship.status.manage', 'sponsorship.view.any', 'sponsorship.view.own', 'sponsorship.update.any', 'sponsorship.update.own', 'sponsorship.softDelete.any', 'sponsorship.softDelete.own', 'sponsorship.hardDelete.any', 'sponsorship.hardDelete.own', 'sponsorship.restore.any', 'sponsorship.restore.own', 'sponsorship.updateVisibility.any', 'sponsorship.updateVisibility.own', 'ownerPromotion.create', 'ownerPromotion.update', 'ownerPromotion.delete', 'ownerPromotion.view', 'ownerPromotion.restore', 'ownerPromotion.hardDelete', 'ownerPromotion.status.manage', 'ownerPromotion.view.any', 'ownerPromotion.view.own', 'ownerPromotion.update.any', 'ownerPromotion.update.own', 'ownerPromotion.softDelete.any', 'ownerPromotion.softDelete.own', 'ownerPromotion.hardDelete.any', 'ownerPromotion.hardDelete.own', 'ownerPromotion.restore.any', 'ownerPromotion.restore.own', 'ownerPromotion.updateVisibility.any', 'ownerPromotion.updateVisibility.own', 'featuredAccommodation.create', 'featuredAccommodation.update', 'featuredAccommodation.delete', 'featuredAccommodation.view', 'featuredAccommodation.restore', 'featuredAccommodation.hardDelete', 'featuredAccommodation.status.manage', 'serviceListing.create', 'serviceListing.update', 'serviceListing.delete', 'serviceListing.view', 'serviceListing.restore', 'serviceListing.hardDelete', 'serviceListing.status.manage', 'accommodationReview.delete', 'accommodationReview.view', 'accommodationReview.restore', 'accommodationReview.hardDelete', 'accommodationReview.report', 'adPricingCatalog.create', 'adPricingCatalog.update', 'adPricingCatalog.delete', 'adPricingCatalog.view', 'adPricingCatalog.restore', 'adPricingCatalog.hardDelete', 'adPricingCatalog.calculatePrice', 'attraction.create', 'attraction.update', 'attraction.delete', 'attraction.view', 'attraction.restore', 'attraction.hardDelete', 'clientAccessRight.create', 'clientAccessRight.update', 'clientAccessRight.delete', 'clientAccessRight.view', 'clientAccessRight.restore', 'clientAccessRight.hardDelete', 'clientAccessRight.grant', 'clientAccessRight.revoke', 'creditNote.create', 'creditNote.update', 'creditNote.delete', 'creditNote.view', 'creditNote.restore', 'creditNote.hardDelete', 'creditNote.issue', 'creditNote.apply', 'creditNote.void', 'destinationReview.delete', 'destinationReview.view', 'destinationReview.restore', 'destinationReview.hardDelete', 'destinationReview.report', 'discountCodeUsage.create', 'discountCodeUsage.update', 'discountCodeUsage.delete', 'discountCodeUsage.restore', 'discountCodeUsage.hardDelete', 'eventLocation.create', 'eventLocation.delete', 'eventLocation.view', 'eventLocation.restore', 'eventLocation.hardDelete', 'eventOrganizer.create', 'eventOrganizer.update', 'eventOrganizer.delete', 'eventOrganizer.view', 'eventOrganizer.restore', 'eventOrganizer.hardDelete', 'exchange_rate.view', 'exchange_rate.create', 'exchange_rate.update', 'exchange_rate.delete', 'exchange_rate.config.update', 'exchange_rate.fetch', 'invoice.create', 'invoice.update', 'invoice.delete', 'invoice.view', 'invoice.restore', 'invoice.hardDelete', 'invoice.generate', 'invoice.send', 'invoice.void', 'invoice.markPaid', 'invoiceLine.create', 'invoiceLine.update', 'invoiceLine.delete', 'invoiceLine.view', 'invoiceLine.restore', 'invoiceLine.hardDelete', 'payment.create', 'payment.update', 'payment.delete', 'payment.view', 'payment.restore', 'payment.hardDelete', 'payment.process', 'payment.refund', 'payment.cancel', 'paymentMethod.create', 'paymentMethod.update', 'paymentMethod.delete', 'paymentMethod.view', 'paymentMethod.restore', 'paymentMethod.hardDelete', 'permission.create', 'permission.update', 'permission.delete', 'permission.view', 'permission.restore', 'permission.hardDelete', 'permission.assign', 'permission.revoke', 'postSponsor.create', 'postSponsor.update', 'postSponsor.delete', 'postSponsor.view', 'postSponsor.restore', 'postSponsor.hardDelete', 'postSponsorship.create', 'postSponsorship.update', 'postSponsorship.delete', 'postSponsorship.view', 'postSponsorship.restore', 'postSponsorship.hardDelete', 'postSponsorship.status.manage', 'purchase.create', 'purchase.update', 'purchase.delete', 'purchase.view', 'purchase.restore', 'purchase.hardDelete', 'purchase.process', 'purchase.cancel', 'purchase.manage', 'refund.create', 'refund.update', 'refund.delete', 'refund.view', 'refund.restore', 'refund.hardDelete', 'refund.process', 'refund.approve', 'refund.reject', 'userBookmark.create', 'userBookmark.update', 'userBookmark.delete', 'userBookmark.view', 'userBookmark.restore', 'userBookmark.hardDelete', 'userBookmark.viewAny', 'benefitListing.create', 'benefitListing.update', 'benefitListing.delete', 'benefitListing.view', 'benefitListing.restore', 'benefitListing.hardDelete', 'benefitListing.softDelete.view', 'benefitListing.status.manage', 'notification.create', 'notification.update', 'notification.delete', 'notification.view', 'notification.restore', 'notification.hardDelete', 'notification.softDelete.view', 'notification.send', 'notification.status.manage', 'professionalService.create', 'professionalService.update', 'professionalService.delete', 'professionalService.view', 'professionalService.restore', 'professionalService.hardDelete', 'professionalService.softDelete.view', 'professionalService.status.manage', 'professionalServiceOrder.create', 'professionalServiceOrder.update', 'professionalServiceOrder.delete', 'professionalServiceOrder.view', 'professionalServiceOrder.restore', 'professionalServiceOrder.hardDelete', 'professionalServiceOrder.softDelete.view', 'professionalServiceOrder.status.manage', 'benefitPartner.create', 'benefitPartner.update', 'benefitPartner.delete', 'benefitPartner.view', 'benefitPartner.restore', 'benefitPartner.hardDelete', 'benefitPartner.softDelete.view', 'benefitPartner.status.manage', 'benefitListingPlan.create', 'benefitListingPlan.update', 'benefitListingPlan.delete', 'benefitListingPlan.view', 'benefitListingPlan.restore', 'benefitListingPlan.hardDelete', 'benefitListingPlan.softDelete.view', 'benefitListingPlan.status.manage', 'touristService.create', 'touristService.update', 'touristService.delete', 'touristService.view', 'touristService.restore', 'touristService.hardDelete', 'touristService.softDelete.view', 'touristService.status.manage', 'serviceListingPlan.create', 'serviceListingPlan.update', 'serviceListingPlan.delete', 'serviceListingPlan.view', 'serviceListingPlan.restore', 'serviceListingPlan.hardDelete', 'serviceListingPlan.softDelete.view', 'serviceListingPlan.status.manage', 'serviceOrder.create', 'serviceOrder.update', 'serviceOrder.delete', 'serviceOrder.view', 'serviceOrder.restore', 'serviceOrder.hardDelete', 'serviceOrder.softDelete.view', 'serviceOrder.status.manage', 'serviceOrder.deliverables.manage', 'serviceOrder.pricing.manage', 'billing.readAll', 'billing.promoCode.read', 'billing.promoCode.manage', 'billing.metrics.read', 'billing.manage', 'revalidation.trigger', 'revalidation.config.view', 'revalidation.config.edit', 'revalidation.log.view');--> statement-breakpoint
CREATE TYPE "public"."post_category_enum" AS ENUM('EVENTS', 'CULTURE', 'GASTRONOMY', 'NATURE', 'TOURISM', 'GENERAL', 'SPORT', 'CARNIVAL', 'NIGHTLIFE', 'HISTORY', 'TRADITIONS', 'WELLNESS', 'FAMILY', 'TIPS', 'ART', 'BEACH', 'RURAL', 'FESTIVALS');--> statement-breakpoint
CREATE TYPE "public"."preferred_contact_enum" AS ENUM('HOME', 'WORK', 'MOBILE');--> statement-breakpoint
CREATE TYPE "public"."price_currency_enum" AS ENUM('ARS', 'USD', 'BRL');--> statement-breakpoint
CREATE TYPE "public"."product_type_enum" AS ENUM('sponsorship', 'campaign', 'featured', 'prof_service', 'listing_plan', 'placement_rate');--> statement-breakpoint
CREATE TYPE "public"."recurrence_type_enum" AS ENUM('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."refund_status_enum" AS ENUM('pending', 'approved', 'processing', 'completed', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role_enum" AS ENUM('SUPER_ADMIN', 'ADMIN', 'CLIENT_MANAGER', 'EDITOR', 'HOST', 'SPONSOR', 'USER', 'GUEST');--> statement-breakpoint
CREATE TYPE "public"."sponsorship_status_enum" AS ENUM('pending', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sponsorship_target_type_enum" AS ENUM('event', 'post');--> statement-breakpoint
CREATE TYPE "public"."sponsorship_tier_enum" AS ENUM('bronze', 'silver', 'gold', 'standard', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'trialing', 'past_due', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tag_color_enum" AS ENUM('RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BROWN', 'GREY', 'WHITE', 'CYAN', 'MAGENTA', 'LIGHT_BLUE', 'LIGHT_GREEN');--> statement-breakpoint
CREATE TYPE "public"."visibility_enum" AS ENUM('PUBLIC', 'PRIVATE', 'RESTRICTED');--> statement-breakpoint
CREATE TABLE "accommodations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"type" "accommodation_type_enum" NOT NULL,
	"description" text NOT NULL,
	"contact_info" jsonb,
	"social_networks" jsonb,
	"price" jsonb,
	"location" jsonb,
	"media" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"owner_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"seo" jsonb,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"extra_info" jsonb,
	"schedule" jsonb,
	"rating" jsonb,
	CONSTRAINT "accommodations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "accommodation_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "accommodation_ia_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "accommodation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"content" text,
	"rating" jsonb NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"type" "amenities_type_enum" NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "amenities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "features_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "r_accommodation_amenity" (
	"accommodation_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"additional_cost" jsonb,
	"additional_cost_percent" double precision,
	CONSTRAINT "r_accommodation_amenity_accommodation_id_amenity_id_pk" PRIMARY KEY("accommodation_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "r_accommodation_feature" (
	"accommodation_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"host_rewrite_name" text,
	"comments" text,
	CONSTRAINT "r_accommodation_feature_accommodation_id_feature_id_pk" PRIMARY KEY("accommodation_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "billing_addon_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"addon_slug" varchar(100) NOT NULL,
	"addon_id" uuid,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"payment_id" varchar(255),
	"limit_adjustments" jsonb DEFAULT '[]'::jsonb,
	"entitlement_adjustments" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_dunning_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"result" varchar(50) NOT NULL,
	"amount" integer,
	"currency" varchar(3),
	"payment_id" varchar(255),
	"failure_code" varchar(100),
	"error_message" text,
	"provider" varchar(50) DEFAULT 'mercadopago' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"type" varchar(100) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"template_id" varchar(100),
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"previous_status" varchar(50) NOT NULL,
	"new_status" varchar(50) NOT NULL,
	"trigger_source" varchar(50) NOT NULL,
	"provider_event_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "attractions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_destination_id" uuid,
	"destination_type" "destination_type_enum" NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"path_ids" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"location" jsonb NOT NULL,
	"media" jsonb NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"accommodations_count" integer DEFAULT 0 NOT NULL,
	"seo" jsonb,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"rating" jsonb,
	CONSTRAINT "destinations_path_unique" UNIQUE("path"),
	CONSTRAINT "destinations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "destination_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"title" text,
	"content" text,
	"rating" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "r_destination_attraction" (
	"destination_id" uuid NOT NULL,
	"attraction_id" uuid NOT NULL,
	CONSTRAINT "r_destination_attraction_destination_id_attraction_id_pk" PRIMARY KEY("destination_id","attraction_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"media" jsonb,
	"category" "event_category_enum" NOT NULL,
	"date" jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"location_id" uuid,
	"organizer_id" uuid,
	"pricing" jsonb,
	"contact" jsonb,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"seo" jsonb,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"street" text,
	"number" text,
	"floor" text,
	"apartment" text,
	"neighborhood" text,
	"city" text NOT NULL,
	"department" text,
	"place_name" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "event_locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo" text,
	"contact_info" jsonb,
	"social" jsonb,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "event_organizers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_rate_type" "exchange_rate_type_enum" DEFAULT 'oficial' NOT NULL,
	"dolar_api_fetch_interval_minutes" integer DEFAULT 15 NOT NULL,
	"exchange_rate_api_fetch_interval_hours" integer DEFAULT 6 NOT NULL,
	"show_conversion_disclaimer" boolean DEFAULT true NOT NULL,
	"disclaimer_text" text,
	"enable_auto_fetch" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" "price_currency_enum" NOT NULL,
	"to_currency" "price_currency_enum" NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"inverse_rate" numeric(20, 10) NOT NULL,
	"rate_type" "exchange_rate_type_enum" NOT NULL,
	"source" "exchange_rate_source_enum" NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"accommodation_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"discount_type" "owner_promotion_discount_type_enum" NOT NULL,
	"discount_value" integer NOT NULL,
	"min_nights" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"max_redemptions" integer,
	"current_redemptions" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "owner_promotions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category" "post_category_enum" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"media" jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"sponsorship_id" uuid,
	"related_accommodation_id" uuid,
	"related_destination_id" uuid,
	"related_event_id" uuid,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"is_news" boolean DEFAULT false NOT NULL,
	"is_featured_in_website" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"reading_time_minutes" integer DEFAULT 5 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"seo" jsonb,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "client_type_enum" NOT NULL,
	"description" text NOT NULL,
	"logo" jsonb,
	"contact_info" jsonb,
	"social_networks" jsonb,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "post_sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"message" text,
	"description" text NOT NULL,
	"paid" jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"from_date" timestamp with time zone,
	"to_date" timestamp with time zone,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "revalidation_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"auto_revalidate_on_change" boolean DEFAULT true NOT NULL,
	"cron_interval_minutes" integer DEFAULT 60 NOT NULL,
	"debounce_seconds" integer DEFAULT 5 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "revalidation_config_entity_type_unique" UNIQUE("entity_type")
);
--> statement-breakpoint
CREATE TABLE "revalidation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"trigger" text NOT NULL,
	"triggered_by" text,
	"status" text DEFAULT 'success' NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"sponsor_user_id" uuid NOT NULL,
	"target_type" "sponsorship_target_type_enum" NOT NULL,
	"target_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"package_id" uuid,
	"status" "sponsorship_status_enum" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"payment_id" text,
	"logo_url" text,
	"link_url" text,
	"coupon_code" text,
	"coupon_discount_percent" integer,
	"analytics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorships_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sponsorship_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_type" "sponsorship_target_type_enum" NOT NULL,
	"tier" "sponsorship_tier_enum" NOT NULL,
	"price_amount" integer NOT NULL,
	"price_currency" "price_currency_enum" DEFAULT 'ARS' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorship_levels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sponsorship_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_amount" integer NOT NULL,
	"price_currency" "price_currency_enum" DEFAULT 'ARS' NOT NULL,
	"included_posts" integer NOT NULL,
	"included_events" integer NOT NULL,
	"event_level_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorship_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "r_entity_tag" (
	"tag_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	CONSTRAINT "r_entity_tag_tag_id_entity_id_entity_type_pk" PRIMARY KEY("tag_id","entity_id","entity_type")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" "tag_color_enum" NOT NULL,
	"icon" text,
	"notes" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role" "role_enum" NOT NULL,
	"permission" "permission_enum" NOT NULL,
	CONSTRAINT "role_permission_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
CREATE TABLE "user_permission" (
	"user_id" uuid NOT NULL,
	"permission" "permission_enum" NOT NULL,
	CONSTRAINT "user_permission_user_id_permission_pk" PRIMARY KEY("user_id","permission")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" text,
	"two_factor_verified" boolean,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"auth_provider" text DEFAULT 'BETTER_AUTH',
	"auth_provider_user_id" text,
	"display_name" text,
	"first_name" text,
	"last_name" text,
	"birth_date" timestamp with time zone,
	"contact_info" jsonb,
	"location" jsonb,
	"social_networks" jsonb,
	"role" "role_enum" DEFAULT 'USER' NOT NULL,
	"profile" jsonb,
	"settings" jsonb DEFAULT '{"notifications":{"enabled":true,"allowEmails":true,"allowSms":false,"allowPush":false}}'::jsonb NOT NULL,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "users_slug_unique" UNIQUE("slug"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	"name" text,
	"description" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider_enum" NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text,
	"username" text,
	"avatar_url" text,
	"raw" jsonb,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"billing_interval_count" integer DEFAULT 1 NOT NULL,
	"compatible_plan_ids" text[] DEFAULT '{}' NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"max_quantity" integer,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(255),
	"changes" jsonb,
	"previous_values" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"entitlement_key" varchar(100) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"limit_key" varchar(100) NOT NULL,
	"max_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"phone" varchar(20),
	"stripe_customer_id" varchar(255),
	"mp_customer_id" varchar(255),
	"preferred_language" varchar(10) DEFAULT 'en',
	"segment" varchar(50),
	"tier" varchar(20),
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"tax_id" varchar(50),
	"tax_id_type" varchar(20),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_entitlements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"request_params" jsonb,
	"response_body" jsonb,
	"status_code" varchar(10),
	"livemode" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_idempotency_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price_id" varchar(255),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"proration" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_applied" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"number" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0,
	"tax" integer DEFAULT 0,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"amount_remaining" integer,
	"currency" varchar(3) NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"stripe_invoice_id" varchar(255),
	"mp_invoice_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"default_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_method_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_four" varchar(4),
	"brand" varchar(50),
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false,
	"billing_details" jsonb,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"base_amount" integer,
	"base_currency" varchar(3),
	"exchange_rate" numeric(18, 8),
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_ids" jsonb DEFAULT '{}'::jsonb,
	"payment_method_id" uuid,
	"refunded_amount" integer DEFAULT 0,
	"failure_code" varchar(100),
	"failure_message" text,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"nickname" varchar(255),
	"currency" varchar(3) NOT NULL,
	"unit_amount" integer NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"trial_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"stripe_price_id" varchar(255),
	"mp_price_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_promo_code_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"discount_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"max_uses" integer,
	"used_count" integer DEFAULT 0,
	"max_per_customer" integer DEFAULT 1,
	"valid_plans" text[],
	"new_customers_only" boolean DEFAULT false,
	"existing_customers_only" boolean DEFAULT false,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"combinable" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"reason" varchar(100),
	"provider_refund_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscription_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"trial_converted" boolean DEFAULT false,
	"trial_converted_at" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"ended_at" timestamp with time zone,
	"promo_code_id" uuid,
	"default_payment_method_id" uuid,
	"grace_period_ends_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp with time zone,
	"stripe_subscription_id" varchar(255),
	"mp_subscription_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"action" varchar(20) DEFAULT 'increment' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_vendor_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payout_id" varchar(255),
	"failure_code" varchar(100),
	"failure_message" varchar(500),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"commission_rate" numeric(5, 2) NOT NULL,
	"payout_schedule" jsonb,
	"payment_mode" varchar(50) DEFAULT 'automatic',
	"stripe_account_id" varchar(255),
	"mp_merchant_id" varchar(255),
	"onboarding_status" varchar(50) DEFAULT 'pending',
	"can_receive_payments" boolean DEFAULT false,
	"pending_balance" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "billing_vendors_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_dead_letter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"attempts" integer NOT NULL,
	"resolved_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_faqs" ADD CONSTRAINT "accommodation_faqs_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_faqs" ADD CONSTRAINT "accommodation_faqs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_faqs" ADD CONSTRAINT "accommodation_faqs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_faqs" ADD CONSTRAINT "accommodation_faqs_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_ia_data" ADD CONSTRAINT "accommodation_ia_data_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_ia_data" ADD CONSTRAINT "accommodation_ia_data_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_ia_data" ADD CONSTRAINT "accommodation_ia_data_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_ia_data" ADD CONSTRAINT "accommodation_ia_data_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_accommodation_amenity" ADD CONSTRAINT "r_accommodation_amenity_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_accommodation_amenity" ADD CONSTRAINT "r_accommodation_amenity_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_accommodation_feature" ADD CONSTRAINT "r_accommodation_feature_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_accommodation_feature" ADD CONSTRAINT "r_accommodation_feature_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."billing_addons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ADD CONSTRAINT "billing_dunning_attempts_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_dunning_attempts" ADD CONSTRAINT "billing_dunning_attempts_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_notification_log" ADD CONSTRAINT "billing_notification_log_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_events" ADD CONSTRAINT "billing_subscription_events_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_parent_destination_id_destinations_id_fk" FOREIGN KEY ("parent_destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_destination_attraction" ADD CONSTRAINT "r_destination_attraction_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_destination_attraction" ADD CONSTRAINT "r_destination_attraction_attraction_id_attractions_id_fk" FOREIGN KEY ("attraction_id") REFERENCES "public"."attractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_event_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."event_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_event_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."event_organizers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_organizers" ADD CONSTRAINT "event_organizers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_config" ADD CONSTRAINT "exchange_rate_config_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_sponsorship_id_post_sponsorships_id_fk" FOREIGN KEY ("sponsorship_id") REFERENCES "public"."post_sponsorships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_related_accommodation_id_accommodations_id_fk" FOREIGN KEY ("related_accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_related_destination_id_destinations_id_fk" FOREIGN KEY ("related_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsors" ADD CONSTRAINT "post_sponsors_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsors" ADD CONSTRAINT "post_sponsors_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsors" ADD CONSTRAINT "post_sponsors_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsorships" ADD CONSTRAINT "post_sponsorships_sponsor_id_post_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."post_sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsorships" ADD CONSTRAINT "post_sponsorships_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsorships" ADD CONSTRAINT "post_sponsorships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsorships" ADD CONSTRAINT "post_sponsorships_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sponsorships" ADD CONSTRAINT "post_sponsorships_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsor_user_id_users_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_level_id_sponsorship_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."sponsorship_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_package_id_sponsorship_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sponsorship_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_event_level_id_sponsorship_levels_id_fk" FOREIGN KEY ("event_level_id") REFERENCES "public"."sponsorship_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_entity_tag" ADD CONSTRAINT "r_entity_tag_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer_entitlements" ADD CONSTRAINT "billing_customer_entitlements_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer_limits" ADD CONSTRAINT "billing_customer_limits_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_lines" ADD CONSTRAINT "billing_invoice_lines_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_payments" ADD CONSTRAINT "billing_invoice_payments_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_promo_code_usage" ADD CONSTRAINT "billing_promo_code_usage_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."billing_promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_payment_id_billing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."billing_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_addons" ADD CONSTRAINT "billing_subscription_addons_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription_addons" ADD CONSTRAINT "billing_subscription_addons_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."billing_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."billing_promo_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_vendor_payouts" ADD CONSTRAINT "billing_vendor_payouts_vendor_id_billing_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."billing_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodations_isFeatured_idx" ON "accommodations" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "accommodations_visibility_idx" ON "accommodations" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "accommodations_lifecycle_idx" ON "accommodations" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "accommodations_visibility_isFeatured_idx" ON "accommodations" USING btree ("visibility","is_featured");--> statement-breakpoint
CREATE INDEX "accommodations_destinationId_visibility_idx" ON "accommodations" USING btree ("destination_id","visibility");--> statement-breakpoint
CREATE INDEX "accommodations_ownerId_idx" ON "accommodations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "accommodations_type_idx" ON "accommodations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "accommodations_createdAt_idx" ON "accommodations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accommodations_destinationId_isFeatured_visibility_idx" ON "accommodations" USING btree ("destination_id","is_featured","visibility");--> statement-breakpoint
CREATE INDEX "accommodations_deletedAt_idx" ON "accommodations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "accommodations_moderationState_idx" ON "accommodations" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "accommodations_ownerId_deletedAt_idx" ON "accommodations" USING btree ("owner_id","deleted_at");--> statement-breakpoint
CREATE INDEX "accommodationFaqs_accommodationId_idx" ON "accommodation_faqs" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodationFaqs_category_idx" ON "accommodation_faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "accommodationIaData_accommodationId_idx" ON "accommodation_ia_data" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodationIaData_category_idx" ON "accommodation_ia_data" USING btree ("category");--> statement-breakpoint
CREATE INDEX "accommodation_reviews_accommodationId_idx" ON "accommodation_reviews" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodation_reviews_userId_idx" ON "accommodation_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accommodation_reviews_user_accommodation_uniq" ON "accommodation_reviews" USING btree ("user_id","accommodation_id");--> statement-breakpoint
CREATE INDEX "type_idx" ON "amenities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "slug_idx" ON "amenities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "accommodationId_amenityId_idx" ON "r_accommodation_amenity" USING btree ("accommodation_id","amenity_id");--> statement-breakpoint
CREATE INDEX "r_accommodation_amenity_amenityId_idx" ON "r_accommodation_amenity" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "accommodationId_featureId_idx" ON "r_accommodation_feature" USING btree ("accommodation_id","feature_id");--> statement-breakpoint
CREATE INDEX "r_accommodation_feature_featureId_idx" ON "r_accommodation_feature" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "addonPurchases_customerId_idx" ON "billing_addon_purchases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "addonPurchases_addonSlug_idx" ON "billing_addon_purchases" USING btree ("addon_slug");--> statement-breakpoint
CREATE INDEX "addonPurchases_status_idx" ON "billing_addon_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "addonPurchases_expiresAt_idx" ON "billing_addon_purchases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "addonPurchases_customer_status_idx" ON "billing_addon_purchases" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "addonPurchases_customer_addon_idx" ON "billing_addon_purchases" USING btree ("customer_id","addon_slug");--> statement-breakpoint
CREATE INDEX "addonPurchases_active_customer_idx" ON "billing_addon_purchases" USING btree ("customer_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_addon_purchases_active_unique" ON "billing_addon_purchases" USING btree ("customer_id","addon_slug") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "addonPurchases_entitlement_idx" ON "billing_addon_purchases" USING btree ("customer_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_addon_purchases_subscription_active" ON "billing_addon_purchases" USING btree ("subscription_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "dunningAttempts_subscriptionId_idx" ON "billing_dunning_attempts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "dunningAttempts_customerId_idx" ON "billing_dunning_attempts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "dunningAttempts_result_idx" ON "billing_dunning_attempts" USING btree ("result");--> statement-breakpoint
CREATE UNIQUE INDEX "dunningAttempts_subscription_attempt_idx" ON "billing_dunning_attempts" USING btree ("subscription_id","attempt_number");--> statement-breakpoint
CREATE INDEX "dunningAttempts_customer_result_idx" ON "billing_dunning_attempts" USING btree ("customer_id","result");--> statement-breakpoint
CREATE INDEX "dunningAttempts_recent_idx" ON "billing_dunning_attempts" USING btree ("attempted_at") WHERE result = 'failed';--> statement-breakpoint
CREATE INDEX "notificationLog_customerId_idx" ON "billing_notification_log" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "notificationLog_type_idx" ON "billing_notification_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notificationLog_status_idx" ON "billing_notification_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notificationLog_createdAt_idx" ON "billing_notification_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notificationLog_customer_type_idx" ON "billing_notification_log" USING btree ("customer_id","type");--> statement-breakpoint
CREATE INDEX "notificationLog_status_created_idx" ON "billing_notification_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notificationLog_expiredAt_idx" ON "billing_notification_log" USING btree ("expired_at");--> statement-breakpoint
CREATE INDEX "billingSettings_updatedBy_idx" ON "billing_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_subscription_id" ON "billing_subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_created_at" ON "billing_subscription_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "attractions_slug_idx" ON "attractions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "attractions_isFeatured_idx" ON "attractions" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "attractions_lifecycleState_idx" ON "attractions" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "destinations_isFeatured_idx" ON "destinations" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "destinations_visibility_idx" ON "destinations" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "destinations_lifecycle_idx" ON "destinations" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "destinations_visibility_isFeatured_idx" ON "destinations" USING btree ("visibility","is_featured");--> statement-breakpoint
CREATE INDEX "destinations_createdById_idx" ON "destinations" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "destinations_deletedAt_idx" ON "destinations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "destinations_moderationState_idx" ON "destinations" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "destinations_parentDestinationId_idx" ON "destinations" USING btree ("parent_destination_id");--> statement-breakpoint
CREATE INDEX "destinations_destinationType_idx" ON "destinations" USING btree ("destination_type");--> statement-breakpoint
CREATE INDEX "destinations_level_idx" ON "destinations" USING btree ("level");--> statement-breakpoint
CREATE INDEX "destinations_path_idx" ON "destinations" USING btree ("path");--> statement-breakpoint
CREATE INDEX "destinations_pathIds_idx" ON "destinations" USING btree ("path_ids");--> statement-breakpoint
CREATE INDEX "destination_reviews_destinationId_idx" ON "destination_reviews" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "destination_reviews_userId_idx" ON "destination_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "destinationId_attractionId_idx" ON "r_destination_attraction" USING btree ("destination_id","attraction_id");--> statement-breakpoint
CREATE INDEX "r_destination_attraction_attractionId_idx" ON "r_destination_attraction" USING btree ("attraction_id");--> statement-breakpoint
CREATE INDEX "events_isFeatured_idx" ON "events" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "events_visibility_idx" ON "events" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "events_lifecycle_idx" ON "events" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "events_category_idx" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "events_visibility_isFeatured_idx" ON "events" USING btree ("visibility","is_featured");--> statement-breakpoint
CREATE INDEX "events_category_visibility_idx" ON "events" USING btree ("category","visibility");--> statement-breakpoint
CREATE INDEX "events_deletedAt_idx" ON "events" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "events_moderationState_idx" ON "events" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "events_authorId_idx" ON "events" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "eventLocations_slug_idx" ON "event_locations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "eventLocations_lifecycleState_idx" ON "event_locations" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "eventLocations_city_idx" ON "event_locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "eventLocations_createdById_idx" ON "event_locations" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "eventOrganizers_slug_idx" ON "event_organizers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "eventOrganizers_lifecycleState_idx" ON "event_organizers" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "exchange_rates_currency_pair_type_idx" ON "exchange_rates" USING btree ("from_currency","to_currency","rate_type");--> statement-breakpoint
CREATE INDEX "exchange_rates_fetched_at_idx" ON "exchange_rates" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "exchange_rates_source_idx" ON "exchange_rates" USING btree ("source");--> statement-breakpoint
CREATE INDEX "ownerPromotions_ownerId_idx" ON "owner_promotions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ownerPromotions_accommodationId_idx" ON "owner_promotions" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "ownerPromotions_isActive_idx" ON "owner_promotions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ownerPromotions_validFrom_idx" ON "owner_promotions" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "ownerPromotions_deletedAt_idx" ON "owner_promotions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "ownerPromotions_ownerId_isActive_idx" ON "owner_promotions" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX "posts_isNews_idx" ON "posts" USING btree ("is_news");--> statement-breakpoint
CREATE INDEX "posts_visibility_idx" ON "posts" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "posts_lifecycle_idx" ON "posts" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "posts_relatedAccommodationId_idx" ON "posts" USING btree ("related_accommodation_id");--> statement-breakpoint
CREATE INDEX "posts_relatedDestinationId_idx" ON "posts" USING btree ("related_destination_id");--> statement-breakpoint
CREATE INDEX "posts_relatedEventId_idx" ON "posts" USING btree ("related_event_id");--> statement-breakpoint
CREATE INDEX "posts_sponsorshipId_idx" ON "posts" USING btree ("sponsorship_id");--> statement-breakpoint
CREATE INDEX "postSponsorships_sponsorId_idx" ON "post_sponsorships" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "revalidation_log_entity_type_idx" ON "revalidation_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "revalidation_log_trigger_idx" ON "revalidation_log" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "revalidation_log_created_at_idx" ON "revalidation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "revalidation_log_path_idx" ON "revalidation_log" USING btree ("path");--> statement-breakpoint
CREATE INDEX "sponsorships_sponsorUserId_idx" ON "sponsorships" USING btree ("sponsor_user_id");--> statement-breakpoint
CREATE INDEX "sponsorships_targetType_idx" ON "sponsorships" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "sponsorships_targetId_idx" ON "sponsorships" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "sponsorships_status_idx" ON "sponsorships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sponsorships_startsAt_idx" ON "sponsorships" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sponsorships_deletedAt_idx" ON "sponsorships" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sponsorships_targetType_targetId_idx" ON "sponsorships" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_slug_idx" ON "sponsorship_levels" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_targetType_idx" ON "sponsorship_levels" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_tier_idx" ON "sponsorship_levels" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_sortOrder_idx" ON "sponsorship_levels" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_isActive_idx" ON "sponsorship_levels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_deletedAt_idx" ON "sponsorship_levels" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sponsorshipLevels_targetType_tier_idx" ON "sponsorship_levels" USING btree ("target_type","tier");--> statement-breakpoint
CREATE INDEX "sponsorshipPackages_slug_idx" ON "sponsorship_packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sponsorshipPackages_sortOrder_idx" ON "sponsorship_packages" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sponsorshipPackages_isActive_idx" ON "sponsorship_packages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sponsorshipPackages_deletedAt_idx" ON "sponsorship_packages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sponsorshipPackages_isActive_deletedAt_idx" ON "sponsorship_packages" USING btree ("is_active","deleted_at");--> statement-breakpoint
CREATE INDEX "entityType_entityId_idx" ON "r_entity_tag" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "r_entity_tag_tagId_idx" ON "r_entity_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_lifecycle_idx" ON "tags" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "user_permission_userId_idx" ON "user_permission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_permission_permission_idx" ON "user_permission" USING btree ("permission");--> statement-breakpoint
CREATE UNIQUE INDEX "users_slug_key" ON "users" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_provider_user_id_key" ON "users" USING btree ("auth_provider","auth_provider_user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_lifecycleState_idx" ON "users" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "users_visibility_idx" ON "users" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "users_deletedAt_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_createdAt_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_role_deletedAt_idx" ON "users" USING btree ("role","deleted_at");--> statement-breakpoint
CREATE INDEX "users_lifecycleState_deletedAt_idx" ON "users" USING btree ("lifecycle_state","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_identity_provider_user_id_key" ON "user_auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "idx_addons_active" ON "billing_addons" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_addons_livemode" ON "billing_addons" USING btree ("livemode");--> statement-breakpoint
CREATE INDEX "idx_addons_billing_interval" ON "billing_addons" USING btree ("billing_interval");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "billing_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "billing_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "billing_audit_logs" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "billing_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_customer_id" ON "billing_customer_entitlements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_key" ON "billing_customer_entitlements" USING btree ("entitlement_key");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_customer_key" ON "billing_customer_entitlements" USING btree ("customer_id","entitlement_key");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_expires_at" ON "billing_customer_entitlements" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_source" ON "billing_customer_entitlements" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_customer_id" ON "billing_customer_limits" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_key" ON "billing_customer_limits" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_customer_key" ON "billing_customer_limits" USING btree ("customer_id","limit_key");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_reset_at" ON "billing_customer_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_source" ON "billing_customer_limits" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "idx_customers_external_id" ON "billing_customers" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_customers_email" ON "billing_customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_customers_stripe_id" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_mp_id" ON "billing_customers" USING btree ("mp_customer_id");--> statement-breakpoint
CREATE INDEX "idx_entitlements_key" ON "billing_entitlements" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_key" ON "billing_idempotency_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires" ON "billing_idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_lines_invoice" ON "billing_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_invoice" ON "billing_invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_payment" ON "billing_invoice_payments" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_customer" ON "billing_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_subscription" ON "billing_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "billing_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "billing_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "billing_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_limits_key" ON "billing_limits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_customer" ON "billing_payment_methods" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_provider_id" ON "billing_payment_methods" USING btree ("provider_payment_method_id");--> statement-breakpoint
CREATE INDEX "idx_payments_customer" ON "billing_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_payments_subscription" ON "billing_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "billing_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_idempotency" ON "billing_payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_plans_active" ON "billing_plans" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_plans_livemode" ON "billing_plans" USING btree ("livemode");--> statement-breakpoint
CREATE INDEX "idx_prices_plan_id" ON "billing_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_prices_active" ON "billing_prices" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_prices_stripe_price_id" ON "billing_prices" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "idx_prices_mp_price_id" ON "billing_prices" USING btree ("mp_price_id");--> statement-breakpoint
CREATE INDEX "idx_prices_currency_interval" ON "billing_prices" USING btree ("currency","billing_interval");--> statement-breakpoint
CREATE INDEX "idx_promo_usage_code" ON "billing_promo_code_usage" USING btree ("promo_code_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usage_customer" ON "billing_promo_code_usage" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_promo_codes_code" ON "billing_promo_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_promo_codes_active" ON "billing_promo_codes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_refunds_payment" ON "billing_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_provider_id" ON "billing_refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_addons_subscription" ON "billing_subscription_addons" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_addons_addon" ON "billing_subscription_addons" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_addons_status" ON "billing_subscription_addons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscription_addons_composite" ON "billing_subscription_addons" USING btree ("subscription_id","addon_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_customer" ON "billing_subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_customer_status" ON "billing_subscriptions" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_stripe_id" ON "billing_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_mp_id" ON "billing_subscriptions" USING btree ("mp_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_renewal" ON "billing_subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_lifecycle_renewal" ON "billing_subscriptions" USING btree ("status","livemode","current_period_end","cancel_at_period_end");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_lifecycle_retry" ON "billing_subscriptions" USING btree ("status","next_retry_at","grace_period_ends_at");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_lifecycle_grace" ON "billing_subscriptions" USING btree ("status","grace_period_ends_at");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_lifecycle_trial" ON "billing_subscriptions" USING btree ("status","trial_end");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_lifecycle_cancel" ON "billing_subscriptions" USING btree ("cancel_at_period_end","status","current_period_end");--> statement-breakpoint
CREATE INDEX "idx_usage_records_subscription" ON "billing_usage_records" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_usage_records_metric" ON "billing_usage_records" USING btree ("metric_name");--> statement-breakpoint
CREATE INDEX "idx_usage_records_timestamp" ON "billing_usage_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_usage_records_idempotency" ON "billing_usage_records" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_vendor" ON "billing_vendor_payouts" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_status" ON "billing_vendor_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_provider_id" ON "billing_vendor_payouts" USING btree ("provider_payout_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_external_id" ON "billing_vendors" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_stripe_account" ON "billing_vendors" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_mp_merchant" ON "billing_vendors" USING btree ("mp_merchant_id");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_provider_id" ON "billing_webhook_dead_letter" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_resolved" ON "billing_webhook_dead_letter" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_provider_id" ON "billing_webhook_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_type" ON "billing_webhook_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_status" ON "billing_webhook_events" USING btree ("status");