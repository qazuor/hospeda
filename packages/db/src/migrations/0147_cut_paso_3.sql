CREATE TABLE "vertical_deadline_version" (
	"version" integer PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"changed_key" integer,
	"previous_value" jsonb,
	"new_value" jsonb,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_vertical_deadline_version_positive" CHECK ("vertical_deadline_version"."version" > 0),
	CONSTRAINT "ck_vertical_deadline_changed_key_range" CHECK ("vertical_deadline_version"."changed_key" BETWEEN 1 AND 9 OR "vertical_deadline_version"."changed_key" IS NULL)
);
--> statement-breakpoint
-- OWNER-PENDING (HOS-1479, D-1): PLAZO:3, :4, :7, :8 and :9 are placeholders until the owner fixes them; the PR does not merge with these values.
DO $$
DECLARE
    initial_values jsonb := '{
      "1": {"days": 90},
      "2": {"days": 180},
      "3": {"months": 3},
      "4": {"beforeArchiveDays": 15, "beforeDeletionDays": 15},
      "5": {"daysBefore": [10, 5, 2, 0]},
      "6": {"daysAfter": [1, 5, 15, 30, 60]},
      "7": {"days": 90},
      "8": {"days": 7},
      "9": {"days": 30}
    }'::jsonb;
BEGIN
    IF (SELECT count(*) FROM jsonb_object_keys(initial_values)) <> 9
       OR EXISTS (
           SELECT 1 FROM generate_series(1, 9) AS key_number
           WHERE initial_values -> key_number::text IS NULL
              OR initial_values -> key_number::text = 'null'::jsonb
              OR initial_values -> key_number::text = '{}'::jsonb
       )
       OR jsonb_path_exists(initial_values, '$.** ? (@ == null)') THEN
        RAISE EXCEPTION 'Vertical deadline version 1 is incomplete';
    END IF;
    INSERT INTO vertical_deadline_version (version, "values") VALUES (1, initial_values);
END $$;
--> statement-breakpoint
-- Cutover passage table (DEC-MIG-003 📌9 and 📌10): this SQL owns it; V6.12 step 5b drops it. It is deliberately absent from packages/db/src/schemas/.
CREATE TABLE "cutover_v6_deleted_listing" (
    "entity_type" varchar(32) NOT NULL,
    "entity_id" uuid NOT NULL,
    "photos" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "calendar_tokens" jsonb NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY ("entity_type", "entity_id")
);
--> statement-breakpoint
DO $$
DECLARE
    -- CUT-LIST:BEGIN (DEC-MIG-006 📌2: the owner's closed list of five listings; OWNER-PENDING, D-2)
    cut_list jsonb := '[]'::jsonb;
    -- CUT-LIST:END
    cut_item jsonb;
    cut_type text;
    cut_id uuid;
    cut_status text;
    cut_owner uuid;
    seen_owners uuid[] := ARRAY[]::uuid[];
BEGIN
    IF jsonb_typeof(cut_list) <> 'array' THEN
        RAISE EXCEPTION 'CUT-LIST must be an array';
    END IF;
    IF jsonb_array_length(cut_list) = 0 THEN
        RAISE NOTICE 'CUT-LIST is empty: placeholder mode keeps every listing';
        UPDATE accommodations SET
            publication_status = CASE WHEN lifecycle_state = 'ACTIVE' AND visibility = 'PUBLIC'
                AND owner_suspended IS NOT TRUE AND plan_restricted IS NOT TRUE
                THEN 'PUBLISHED'::publication_status_enum ELSE 'DRAFT'::publication_status_enum END,
            inactive_since = now(), deadlines_version = 1;
        UPDATE gastronomies SET
            publication_status = CASE WHEN lifecycle_state = 'ACTIVE' AND visibility = 'PUBLIC'
                THEN 'PUBLISHED'::publication_status_enum ELSE 'DRAFT'::publication_status_enum END,
            inactive_since = now(), deadlines_version = 1;
        UPDATE experiences SET
            publication_status = CASE WHEN lifecycle_state = 'ACTIVE' AND visibility = 'PUBLIC'
                THEN 'PUBLISHED'::publication_status_enum ELSE 'DRAFT'::publication_status_enum END,
            inactive_since = now(), deadlines_version = 1;
    ELSE
        IF jsonb_array_length(cut_list) > 5 THEN
            RAISE EXCEPTION 'CUT-LIST has more than five listings';
        END IF;
        FOR cut_item IN SELECT value FROM jsonb_array_elements(cut_list) LOOP
            cut_type := cut_item ->> 'entityType';
            IF cut_type IS NULL OR cut_type NOT IN ('accommodation', 'gastronomy', 'experience') THEN
                RAISE EXCEPTION 'CUT-LIST has invalid entityType: %', cut_type;
            END IF;
            IF cut_item ->> 'entityId' IS NULL OR
                cut_item ->> 'entityId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                RAISE EXCEPTION 'CUT-LIST has invalid entityId: %', cut_item ->> 'entityId';
            END IF;
            cut_id := (cut_item ->> 'entityId')::uuid;
            cut_status := COALESCE(cut_item ->> 'publicationStatus', 'PUBLISHED');
            IF cut_status NOT IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'MODERATED') THEN
                RAISE EXCEPTION 'CUT-LIST has invalid publicationStatus: %', cut_status;
            END IF;
            cut_owner := NULL;
            CASE cut_type
                WHEN 'accommodation' THEN SELECT owner_id INTO cut_owner FROM accommodations WHERE id = cut_id;
                WHEN 'gastronomy' THEN SELECT owner_id INTO cut_owner FROM gastronomies WHERE id = cut_id;
                WHEN 'experience' THEN SELECT owner_id INTO cut_owner FROM experiences WHERE id = cut_id;
            END CASE;
            IF cut_owner IS NULL THEN
                RAISE EXCEPTION 'CUT-LIST entityId does not exist: % %', cut_type, cut_id;
            END IF;
            IF cut_owner = ANY(seen_owners) THEN
                RAISE EXCEPTION 'CUT-LIST repeats owner_id: %', cut_owner;
            END IF;
            seen_owners := array_append(seen_owners, cut_owner);
        END LOOP;

        INSERT INTO cutover_v6_deleted_listing (entity_type, entity_id, photos, calendar_tokens)
        SELECT 'accommodation', a.id,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('publicId', m.public_id, 'url', m.url))
                FROM accommodation_media m WHERE m.accommodation_id = a.id), '[]'::jsonb),
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'access_token_ciphertext', c.access_token_ciphertext,
                'access_token_iv', c.access_token_iv,
                'access_token_auth_tag', c.access_token_auth_tag,
                'refresh_token_ciphertext', c.refresh_token_ciphertext,
                'refresh_token_iv', c.refresh_token_iv,
                'refresh_token_auth_tag', c.refresh_token_auth_tag,
                'external_calendar_id', c.external_calendar_id))
                FROM accommodation_calendar_sync c WHERE c.accommodation_id = a.id), '[]'::jsonb)
        FROM accommodations a
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'accommodation' AND (item ->> 'entityId')::uuid = a.id);
        INSERT INTO cutover_v6_deleted_listing (entity_type, entity_id, photos, calendar_tokens)
        SELECT 'gastronomy', g.id,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('publicId', m.public_id, 'url', m.url))
                FROM gastronomy_media m WHERE m.gastronomy_id = g.id), '[]'::jsonb), '[]'::jsonb
        FROM gastronomies g
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'gastronomy' AND (item ->> 'entityId')::uuid = g.id);
        INSERT INTO cutover_v6_deleted_listing (entity_type, entity_id, photos, calendar_tokens)
        SELECT 'experience', e.id,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('publicId', m.public_id, 'url', m.url))
                FROM experience_media m WHERE m.experience_id = e.id), '[]'::jsonb), '[]'::jsonb
        FROM experiences e
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'experience' AND (item ->> 'entityId')::uuid = e.id);

        DELETE FROM conversations WHERE accommodation_id IN (
            SELECT a.id FROM accommodations a
            WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
                WHERE item ->> 'entityType' = 'accommodation' AND (item ->> 'entityId')::uuid = a.id)
        );
        DELETE FROM accommodations a WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'accommodation' AND (item ->> 'entityId')::uuid = a.id);
        DELETE FROM gastronomies g WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'gastronomy' AND (item ->> 'entityId')::uuid = g.id);
        DELETE FROM experiences e WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cut_list) item
            WHERE item ->> 'entityType' = 'experience' AND (item ->> 'entityId')::uuid = e.id);

        UPDATE accommodations a SET publication_status =
            COALESCE((SELECT item ->> 'publicationStatus' FROM jsonb_array_elements(cut_list) item
                WHERE item ->> 'entityType' = 'accommodation' AND (item ->> 'entityId')::uuid = a.id), 'PUBLISHED')::publication_status_enum,
            inactive_since = now(), deadlines_version = 1;
        UPDATE gastronomies g SET publication_status =
            COALESCE((SELECT item ->> 'publicationStatus' FROM jsonb_array_elements(cut_list) item
                WHERE item ->> 'entityType' = 'gastronomy' AND (item ->> 'entityId')::uuid = g.id), 'PUBLISHED')::publication_status_enum,
            inactive_since = now(), deadlines_version = 1;
        UPDATE experiences e SET publication_status =
            COALESCE((SELECT item ->> 'publicationStatus' FROM jsonb_array_elements(cut_list) item
                WHERE item ->> 'entityType' = 'experience' AND (item ->> 'entityId')::uuid = e.id), 'PUBLISHED')::publication_status_enum,
            inactive_since = now(), deadlines_version = 1;
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM accommodations WHERE publication_status IS NULL OR inactive_since IS NULL OR deadlines_version IS NULL) THEN
        RAISE EXCEPTION 'Listing rows without publication state: accommodations';
    END IF;
    IF EXISTS (SELECT 1 FROM gastronomies WHERE publication_status IS NULL OR inactive_since IS NULL OR deadlines_version IS NULL) THEN
        RAISE EXCEPTION 'Listing rows without publication state: gastronomies';
    END IF;
    IF EXISTS (SELECT 1 FROM experiences WHERE publication_status IS NULL OR inactive_since IS NULL OR deadlines_version IS NULL) THEN
        RAISE EXCEPTION 'Listing rows without publication state: experiences';
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "accommodations" ALTER COLUMN "publication_status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "accommodations" ALTER COLUMN "inactive_since" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "accommodations" ALTER COLUMN "deadlines_version" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "publication_status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "inactive_since" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "deadlines_version" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "gastronomies" ALTER COLUMN "publication_status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "gastronomies" ALTER COLUMN "inactive_since" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "gastronomies" ALTER COLUMN "deadlines_version" SET NOT NULL;
