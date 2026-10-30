-- HOS-1820: physical venue rename. CHECK value rewrites are omitted per Q1; domain_event stays append-only per Q2.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM vertical WHERE id = 'gastronomy') THEN RAISE EXCEPTION 'HOS-1787: esta base necesita reset (DEC-FAC-029)'; END IF; END $$;
--> statement-breakpoint
-- Convert persisted values before the enum labels change.
UPDATE qr_codes
SET target_url = replace(target_url, '/gastronomia/', '/comer-y-salir/')
WHERE entity_type::text = 'GASTRONOMY'
  AND source = 'GENERATED'
  AND target_url LIKE '%/gastronomia/%';
--> statement-breakpoint
UPDATE amenities SET applicable_verticals = array_replace(applicable_verticals, 'gastronomy', 'venue') WHERE 'gastronomy' = ANY(applicable_verticals);
UPDATE features SET applicable_verticals = array_replace(applicable_verticals, 'gastronomy', 'venue') WHERE 'gastronomy' = ANY(applicable_verticals);
--> statement-breakpoint
UPDATE ai_settings
SET value = jsonb_set(
    value,
    '{features}',
    ((value->'features') - 'chat_gastronomy') || jsonb_build_object('chat_venue', value #> '{features,chat_gastronomy}')
)
WHERE value #> '{features,chat_gastronomy}' IS NOT NULL;
--> statement-breakpoint
UPDATE ai_usage SET feature = 'chat_venue' WHERE feature = 'chat_gastronomy';
UPDATE ai_conversations SET feature = 'chat_venue' WHERE feature = 'chat_gastronomy';
UPDATE ai_request_log SET feature = 'chat_venue' WHERE feature = 'chat_gastronomy';
UPDATE ai_prompt_versions SET feature = 'chat_venue' WHERE feature = 'chat_gastronomy';
--> statement-breakpoint
UPDATE revalidation_config SET entity_type = 'venue' WHERE entity_type = 'gastronomy';
--> statement-breakpoint
UPDATE email_outbox SET payload = jsonb_set(payload, '{vertical}', '"venue"'::jsonb)
WHERE payload->>'vertical' = 'gastronomy';
--> statement-breakpoint
UPDATE cutover_v6_deleted_listing SET entity_type = 'venue' WHERE entity_type = 'gastronomy';
--> statement-breakpoint
ALTER TABLE "gastronomies" RENAME TO "venues";
--> statement-breakpoint
ALTER TABLE "gastronomy_daily_specials" RENAME TO "venue_daily_specials";
--> statement-breakpoint
ALTER TABLE "gastronomy_events" RENAME TO "venue_events";
--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" RENAME TO "venue_faqs";
--> statement-breakpoint
ALTER TABLE "gastronomy_media" RENAME TO "venue_media";
--> statement-breakpoint
ALTER TABLE "gastronomy_menu_items" RENAME TO "venue_menu_items";
--> statement-breakpoint
ALTER TABLE "gastronomy_menu_sections" RENAME TO "venue_menu_sections";
--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" RENAME TO "venue_reviews";
--> statement-breakpoint
ALTER TABLE "r_gastronomy_amenity" RENAME TO "r_venue_amenity";
--> statement-breakpoint
ALTER TABLE "r_gastronomy_feature" RENAME TO "r_venue_feature";
--> statement-breakpoint
ALTER TABLE "venue_daily_specials" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_events" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_media" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_menu_sections" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "r_venue_amenity" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "r_venue_feature" RENAME COLUMN "gastronomy_id" TO "venue_id";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_pkey" TO "venues_pkey";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_slug_unique" TO "venues_slug_unique";
--> statement-breakpoint
ALTER TABLE "venue_daily_specials" RENAME CONSTRAINT "gastronomy_daily_specials_pkey" TO "venue_daily_specials_pkey";
--> statement-breakpoint
ALTER TABLE "venue_events" RENAME CONSTRAINT "gastronomy_events_pkey" TO "venue_events_pkey";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME CONSTRAINT "gastronomy_faqs_pkey" TO "venue_faqs_pkey";
--> statement-breakpoint
ALTER TABLE "venue_media" RENAME CONSTRAINT "gastronomy_media_pkey" TO "venue_media_pkey";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME CONSTRAINT "gastronomy_menu_items_pkey" TO "venue_menu_items_pkey";
--> statement-breakpoint
ALTER TABLE "venue_menu_sections" RENAME CONSTRAINT "gastronomy_menu_sections_pkey" TO "venue_menu_sections_pkey";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_pkey" TO "venue_reviews_pkey";
--> statement-breakpoint
ALTER TABLE "r_venue_amenity" RENAME CONSTRAINT "r_gastronomy_amenity_gastronomy_id_amenity_id_pk" TO "r_venue_amenity_venue_id_amenity_id_pk";
--> statement-breakpoint
ALTER TABLE "r_venue_feature" RENAME CONSTRAINT "r_gastronomy_feature_gastronomy_id_feature_id_pk" TO "r_venue_feature_venue_id_feature_id_pk";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_created_by_id_users_id_fk" TO "venues_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_deleted_by_id_users_id_fk" TO "venues_deleted_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_destination_id_destinations_id_fk" TO "venues_destination_id_destinations_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_owner_id_users_id_fk" TO "venues_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venues" RENAME CONSTRAINT "gastronomies_updated_by_id_users_id_fk" TO "venues_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_daily_specials" RENAME CONSTRAINT "gastronomy_daily_specials_created_by_id_users_id_fk" TO "venue_daily_specials_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_daily_specials" RENAME CONSTRAINT "gastronomy_daily_specials_gastronomy_id_gastronomies_id_fk" TO "venue_daily_specials_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_daily_specials" RENAME CONSTRAINT "gastronomy_daily_specials_updated_by_id_users_id_fk" TO "venue_daily_specials_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_events" RENAME CONSTRAINT "gastronomy_events_created_by_id_users_id_fk" TO "venue_events_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_events" RENAME CONSTRAINT "gastronomy_events_gastronomy_id_gastronomies_id_fk" TO "venue_events_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_events" RENAME CONSTRAINT "gastronomy_events_updated_by_id_users_id_fk" TO "venue_events_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME CONSTRAINT "gastronomy_faqs_created_by_id_users_id_fk" TO "venue_faqs_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME CONSTRAINT "gastronomy_faqs_deleted_by_id_users_id_fk" TO "venue_faqs_deleted_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME CONSTRAINT "gastronomy_faqs_gastronomy_id_gastronomies_id_fk" TO "venue_faqs_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_faqs" RENAME CONSTRAINT "gastronomy_faqs_updated_by_id_users_id_fk" TO "venue_faqs_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_media" RENAME CONSTRAINT "gastronomy_media_gastronomy_id_gastronomies_id_fk" TO "venue_media_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME CONSTRAINT "gastronomy_menu_items_created_by_id_users_id_fk" TO "venue_menu_items_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME CONSTRAINT "gastronomy_menu_items_gastronomy_id_gastronomies_id_fk" TO "venue_menu_items_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME CONSTRAINT "gastronomy_menu_items_section_id_gastronomy_menu_sections_id_fk" TO "venue_menu_items_section_id_venue_menu_sections_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_items" RENAME CONSTRAINT "gastronomy_menu_items_updated_by_id_users_id_fk" TO "venue_menu_items_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_sections" RENAME CONSTRAINT "gastronomy_menu_sections_created_by_id_users_id_fk" TO "venue_menu_sections_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_sections" RENAME CONSTRAINT "gastronomy_menu_sections_gastronomy_id_gastronomies_id_fk" TO "venue_menu_sections_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_menu_sections" RENAME CONSTRAINT "gastronomy_menu_sections_updated_by_id_users_id_fk" TO "venue_menu_sections_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_created_by_id_users_id_fk" TO "venue_reviews_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_deleted_by_id_users_id_fk" TO "venue_reviews_deleted_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_gastronomy_id_gastronomies_id_fk" TO "venue_reviews_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_moderated_by_id_users_id_fk" TO "venue_reviews_moderated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_updated_by_id_users_id_fk" TO "venue_reviews_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "venue_reviews" RENAME CONSTRAINT "gastronomy_reviews_user_id_users_id_fk" TO "venue_reviews_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "r_venue_amenity" RENAME CONSTRAINT "r_gastronomy_amenity_amenity_id_amenities_id_fk" TO "r_venue_amenity_amenity_id_amenities_id_fk";
--> statement-breakpoint
ALTER TABLE "r_venue_amenity" RENAME CONSTRAINT "r_gastronomy_amenity_gastronomy_id_gastronomies_id_fk" TO "r_venue_amenity_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER TABLE "r_venue_feature" RENAME CONSTRAINT "r_gastronomy_feature_feature_id_features_id_fk" TO "r_venue_feature_feature_id_features_id_fk";
--> statement-breakpoint
ALTER TABLE "r_venue_feature" RENAME CONSTRAINT "r_gastronomy_feature_gastronomy_id_gastronomies_id_fk" TO "r_venue_feature_venue_id_venues_id_fk";
--> statement-breakpoint
ALTER INDEX "gastronomies_deletedAt_idx" RENAME TO "venues_deletedAt_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_destinationId_idx" RENAME TO "venues_destinationId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_destinationId_publicationStatus_idx" RENAME TO "venues_destinationId_publicationStatus_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_featuredByEntitlement_idx" RENAME TO "venues_featuredByEntitlement_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_ownerId_deletedAt_idx" RENAME TO "venues_ownerId_deletedAt_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_ownerId_idx" RENAME TO "venues_ownerId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_publicationStatus_idx" RENAME TO "venues_publicationStatus_idx";
--> statement-breakpoint
ALTER INDEX "gastronomies_type_idx" RENAME TO "venues_type_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyDailySpecials_gastronomyId_idx" RENAME TO "venueDailySpecials_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyDailySpecials_gastronomyId_validity_idx" RENAME TO "venueDailySpecials_venueId_validity_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyEvents_gastronomyId_displayOrder_idx" RENAME TO "venueEvents_venueId_displayOrder_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyEvents_gastronomyId_idx" RENAME TO "venueEvents_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyFaqs_category_idx" RENAME TO "venueFaqs_category_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyFaqs_gastronomyId_idx" RENAME TO "venueFaqs_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMedia_deletedAt_idx" RENAME TO "venueMedia_deletedAt_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMedia_gastronomyId_idx" RENAME TO "venueMedia_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMedia_gastronomyId_state_sortOrder_idx" RENAME TO "venueMedia_venueId_state_sortOrder_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMedia_isFeatured_idx" RENAME TO "venueMedia_isFeatured_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMedia_state_idx" RENAME TO "venueMedia_state_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "uq_gastronomy_media_single_featured" RENAME TO "uq_venue_media_single_featured";
--> statement-breakpoint
ALTER INDEX "gastronomyMenuItems_gastronomyId_idx" RENAME TO "venueMenuItems_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMenuItems_sectionId_displayOrder_idx" RENAME TO "venueMenuItems_sectionId_displayOrder_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMenuItems_sectionId_idx" RENAME TO "venueMenuItems_sectionId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMenuSections_gastronomyId_displayOrder_idx" RENAME TO "venueMenuSections_venueId_displayOrder_idx";
--> statement-breakpoint
ALTER INDEX "gastronomyMenuSections_gastronomyId_idx" RENAME TO "venueMenuSections_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_gastronomyId_idx" RENAME TO "venue_reviews_venueId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_gastronomyId_lifecycleState_idx" RENAME TO "venue_reviews_venueId_lifecycleState_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_lifecycleState_idx" RENAME TO "venue_reviews_lifecycleState_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_moderationState_idx" RENAME TO "venue_reviews_moderationState_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_userId_idx" RENAME TO "venue_reviews_userId_idx";
--> statement-breakpoint
ALTER INDEX "gastronomy_reviews_user_gastronomy_uniq" RENAME TO "venue_reviews_user_venue_uniq";
--> statement-breakpoint
ALTER INDEX "r_gastronomy_amenity_amenityId_idx" RENAME TO "r_venue_amenity_amenityId_idx";
--> statement-breakpoint
ALTER INDEX "r_gastronomy_amenity_gastronomyId_amenityId_idx" RENAME TO "r_venue_amenity_venueId_amenityId_idx";
--> statement-breakpoint
ALTER INDEX "r_gastronomy_feature_featureId_idx" RENAME TO "r_venue_feature_featureId_idx";
--> statement-breakpoint
ALTER INDEX "r_gastronomy_feature_gastronomyId_featureId_idx" RENAME TO "r_venue_feature_venueId_featureId_idx";
--> statement-breakpoint
ALTER TYPE "public"."gastronomy_event_recurrence_enum" RENAME TO "venue_event_recurrence_enum";
--> statement-breakpoint
ALTER TYPE "public"."gastronomy_media_state_enum" RENAME TO "venue_media_state_enum";
--> statement-breakpoint
ALTER TYPE "public"."gastronomy_menu_file_kind_enum" RENAME TO "venue_menu_file_kind_enum";
--> statement-breakpoint
ALTER TYPE "public"."gastronomy_type_enum" RENAME TO "venue_type_enum";
--> statement-breakpoint
ALTER TYPE "public"."entity_type_enum" RENAME VALUE 'GASTRONOMY' TO 'VENUE';
--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" RENAME VALUE 'GASTRONOMY' TO 'VENUE';
--> statement-breakpoint
ALTER TYPE "public"."role_enum" RENAME VALUE 'GASTRONOMY_OWNER' TO 'VENUE_OWNER';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.create' TO 'venue.create';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.delete' TO 'venue.delete';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.editAll' TO 'venue.editAll';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.editOwn' TO 'venue.editOwn';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.moderateReview' TO 'venue.moderateReview';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.moderationChange' TO 'venue.moderationChange';
--> statement-breakpoint
ALTER TYPE "public"."permission_enum" RENAME VALUE 'gastronomy.viewAll' TO 'venue.viewAll';
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomies' AND tgrelid = '"venues"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomies" ON "venues" RENAME TO "trg_set_updated_at_venues"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_daily_specials' AND tgrelid = '"venue_daily_specials"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_daily_specials" ON "venue_daily_specials" RENAME TO "trg_set_updated_at_venue_daily_specials"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_events' AND tgrelid = '"venue_events"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_events" ON "venue_events" RENAME TO "trg_set_updated_at_venue_events"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_faqs' AND tgrelid = '"venue_faqs"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_faqs" ON "venue_faqs" RENAME TO "trg_set_updated_at_venue_faqs"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_gastronomy_media_featured_not_archived') THEN ALTER TABLE "venue_media" RENAME CONSTRAINT "chk_gastronomy_media_featured_not_archived" TO "chk_venue_media_featured_not_archived"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_media' AND tgrelid = '"venue_media"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_media" ON "venue_media" RENAME TO "trg_set_updated_at_venue_media"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_menu_items' AND tgrelid = '"venue_menu_items"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_menu_items" ON "venue_menu_items" RENAME TO "trg_set_updated_at_venue_menu_items"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_menu_sections' AND tgrelid = '"venue_menu_sections"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_menu_sections" ON "venue_menu_sections" RENAME TO "trg_set_updated_at_venue_menu_sections"; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gastronomy_reviews' AND tgrelid = '"venue_reviews"'::regclass) THEN ALTER TRIGGER "trg_set_updated_at_gastronomy_reviews" ON "venue_reviews" RENAME TO "trg_set_updated_at_venue_reviews"; END IF; END $$;
--> statement-breakpoint
