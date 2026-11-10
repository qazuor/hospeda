ALTER TABLE "accommodations" ADD COLUMN "policies" jsonb;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "policies" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "policies" jsonb;--> statement-breakpoint
-- HOS-2060 backfill (hand-written, owner decision 2026-11-07: no backward
-- compatibility). Fills `policies` from the fields and catalog rows it
-- replaces. The legacy columns and extra_info keys stay until release N+1
-- drops them (expand/contract, HOS-601); the catalog rows are retired by seed
-- data-migration 0154, which runs after db:migrate, so this reads them first.
--
-- Rules: every listing gets cash, plus debit and credit when linked to the
-- `accepts_cards` amenity; `pet_friendly` (amenity) or `pet_suitable` /
-- `pet_friendly_area` (features) -> pets admission 'yes'; smoking: the
-- `smoking_area` feature -> 'outdoor_only', else accommodation
-- `extra_info.smokingAllowed = true` -> 'yes', else `smoke_free` -> 'no', else
-- absent. A stored `smokingAllowed: false` alone is NOT a signal: the HTTP
-- create injected it on every listing and no editor exposed it, so it carries
-- no host choice (staging: all 5 `smoking_area` listings hold it);
-- `private_events` -> eventsAllowed.
-- Only LIVE catalog rows count (deleted_at IS NULL). A missing signal leaves
-- the key absent (never false). A derived value the read schema would reject
-- is left out, so nothing stored fails validation. A key already stored wins.
-- Soft-deleted listings are filled too: a restore must not bring back a hole.
UPDATE "accommodations" AS t
SET policies = jsonb_strip_nulls(jsonb_build_object(
        'paymentMethods', CASE WHEN EXISTS (SELECT 1 FROM r_accommodation_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.accommodation_id = t.id AND c.slug = 'accepts_cards' AND c.deleted_at IS NULL) THEN '["cash","debit","credit"]'::jsonb ELSE '["cash"]'::jsonb END,
        'pets', CASE WHEN EXISTS (SELECT 1 FROM r_accommodation_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.accommodation_id = t.id AND c.slug = 'pet_friendly' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_accommodation_feature r JOIN features c ON c.id = r.feature_id WHERE r.accommodation_id = t.id AND c.slug = 'pet_suitable' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_accommodation_feature r JOIN features c ON c.id = r.feature_id WHERE r.accommodation_id = t.id AND c.slug = 'pet_friendly_area' AND c.deleted_at IS NULL) THEN jsonb_build_object('admission', 'yes') END,
        'smokingAllowed', CASE
            WHEN EXISTS (SELECT 1 FROM r_accommodation_feature r JOIN features c ON c.id = r.feature_id WHERE r.accommodation_id = t.id AND c.slug = 'smoking_area' AND c.deleted_at IS NULL) THEN 'outdoor_only'
            WHEN jsonb_typeof(t.extra_info -> 'smokingAllowed') = 'boolean' AND (t.extra_info ->> 'smokingAllowed')::boolean THEN 'yes'
            WHEN EXISTS (SELECT 1 FROM r_accommodation_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.accommodation_id = t.id AND c.slug = 'smoke_free' AND c.deleted_at IS NULL) THEN 'no'
        END,
        'eventsAllowed', CASE WHEN EXISTS (SELECT 1 FROM r_accommodation_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.accommodation_id = t.id AND c.slug = 'private_events' AND c.deleted_at IS NULL) THEN true END,
        'minNights', CASE WHEN ((CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END) = trunc((CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END)) AND (CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END) BETWEEN 1 AND 365) THEN (CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END)::int END,
        'maxNights', CASE WHEN ((CASE WHEN jsonb_typeof(t.extra_info -> 'maxNights') = 'number' THEN (t.extra_info ->> 'maxNights')::numeric END) = trunc((CASE WHEN jsonb_typeof(t.extra_info -> 'maxNights') = 'number' THEN (t.extra_info ->> 'maxNights')::numeric END)) AND (CASE WHEN jsonb_typeof(t.extra_info -> 'maxNights') = 'number' THEN (t.extra_info ->> 'maxNights')::numeric END) BETWEEN 1 AND 365) AND NOT COALESCE(((CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END) = trunc((CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END)) AND (CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END) BETWEEN 1 AND 365) AND (CASE WHEN jsonb_typeof(t.extra_info -> 'maxNights') = 'number' THEN (t.extra_info ->> 'maxNights')::numeric END) < (CASE WHEN jsonb_typeof(t.extra_info -> 'minNights') = 'number' THEN (t.extra_info ->> 'minNights')::numeric END), false) THEN (CASE WHEN jsonb_typeof(t.extra_info -> 'maxNights') = 'number' THEN (t.extra_info ->> 'maxNights')::numeric END)::int END
    )) || COALESCE(t.policies, '{}'::jsonb);
--> statement-breakpoint
UPDATE "venues" AS t
SET policies = jsonb_strip_nulls(jsonb_build_object(
        'paymentMethods', CASE WHEN EXISTS (SELECT 1 FROM r_venue_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.venue_id = t.id AND c.slug = 'accepts_cards' AND c.deleted_at IS NULL) THEN '["cash","debit","credit"]'::jsonb ELSE '["cash"]'::jsonb END,
        'pets', CASE WHEN EXISTS (SELECT 1 FROM r_venue_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.venue_id = t.id AND c.slug = 'pet_friendly' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_venue_feature r JOIN features c ON c.id = r.feature_id WHERE r.venue_id = t.id AND c.slug = 'pet_suitable' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_venue_feature r JOIN features c ON c.id = r.feature_id WHERE r.venue_id = t.id AND c.slug = 'pet_friendly_area' AND c.deleted_at IS NULL) THEN jsonb_build_object('admission', 'yes') END,
        'smokingAllowed', CASE
            WHEN EXISTS (SELECT 1 FROM r_venue_feature r JOIN features c ON c.id = r.feature_id WHERE r.venue_id = t.id AND c.slug = 'smoking_area' AND c.deleted_at IS NULL) THEN 'outdoor_only'
            WHEN EXISTS (SELECT 1 FROM r_venue_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.venue_id = t.id AND c.slug = 'smoke_free' AND c.deleted_at IS NULL) THEN 'no'
        END,
        'eventsAllowed', CASE WHEN EXISTS (SELECT 1 FROM r_venue_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.venue_id = t.id AND c.slug = 'private_events' AND c.deleted_at IS NULL) THEN true END,
        'minAge', CASE WHEN t.min_age BETWEEN 13 AND 30 THEN t.min_age END,
        'dressCode', t.dress_code::text,
        'dressCodeNote', CASE WHEN jsonb_typeof(t.dress_code_note_i18n) = 'object' AND jsonb_typeof(t.dress_code_note_i18n -> 'es') = 'string' AND char_length(t.dress_code_note_i18n ->> 'es') <= 200 AND jsonb_typeof(t.dress_code_note_i18n -> 'en') = 'string' AND char_length(t.dress_code_note_i18n ->> 'en') <= 200 AND jsonb_typeof(t.dress_code_note_i18n -> 'pt') = 'string' AND char_length(t.dress_code_note_i18n ->> 'pt') <= 200 THEN t.dress_code_note_i18n END
    )) || COALESCE(t.policies, '{}'::jsonb);
--> statement-breakpoint
UPDATE "experiences" AS t
SET policies = jsonb_strip_nulls(jsonb_build_object(
        'paymentMethods', CASE WHEN EXISTS (SELECT 1 FROM r_experience_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.experience_id = t.id AND c.slug = 'accepts_cards' AND c.deleted_at IS NULL) THEN '["cash","debit","credit"]'::jsonb ELSE '["cash"]'::jsonb END,
        'pets', CASE WHEN EXISTS (SELECT 1 FROM r_experience_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.experience_id = t.id AND c.slug = 'pet_friendly' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_experience_feature r JOIN features c ON c.id = r.feature_id WHERE r.experience_id = t.id AND c.slug = 'pet_suitable' AND c.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM r_experience_feature r JOIN features c ON c.id = r.feature_id WHERE r.experience_id = t.id AND c.slug = 'pet_friendly_area' AND c.deleted_at IS NULL) THEN jsonb_build_object('admission', 'yes') END,
        'smokingAllowed', CASE
            WHEN EXISTS (SELECT 1 FROM r_experience_feature r JOIN features c ON c.id = r.feature_id WHERE r.experience_id = t.id AND c.slug = 'smoking_area' AND c.deleted_at IS NULL) THEN 'outdoor_only'
            WHEN EXISTS (SELECT 1 FROM r_experience_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.experience_id = t.id AND c.slug = 'smoke_free' AND c.deleted_at IS NULL) THEN 'no'
        END,
        'eventsAllowed', CASE WHEN EXISTS (SELECT 1 FROM r_experience_amenity r JOIN amenities c ON c.id = r.amenity_id WHERE r.experience_id = t.id AND c.slug = 'private_events' AND c.deleted_at IS NULL) THEN true END,
        'privateGroups', CASE WHEN t.accepts_private_groups THEN true END,
        'cancellation', CASE WHEN btrim(COALESCE(t.cancellation_policy, '')) <> '' AND char_length(t.cancellation_policy) <= 1500 THEN t.cancellation_policy END
    )) || COALESCE(t.policies, '{}'::jsonb);
