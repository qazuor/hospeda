CREATE TABLE "billing_deadline_version" (
	"version" integer PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"changed_key" integer,
	"previous_value" jsonb,
	"new_value" jsonb,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_billing_deadline_version_positive" CHECK ("billing_deadline_version"."version" > 0),
	CONSTRAINT "ck_billing_deadline_changed_key_range" CHECK ("billing_deadline_version"."changed_key" BETWEEN 10 AND 19 OR "billing_deadline_version"."changed_key" IS NULL)
);
--> statement-breakpoint
-- HOS-1516 / AC:B2:6, AC:B2:11: the structural migration owns version 1.
-- A missing or empty key aborts the migration, including reconciliation key 19.
DO $$
DECLARE
    initial_values jsonb := '{
      "10": {"cardHours": 72, "manualDays": 7},
      "11": {"noticeDays": 60, "contactDays": [30, 7]},
      "12": {"noticeDays": 60, "contactDays": [30, 7]},
      "13": {"daysBefore": [5, 1]},
      "14": {"daysBefore": 7},
      "15": {"hoursRemaining": 24},
      "16": {"days": 7},
      "17": {"days": 7},
      "18": {"days": 180},
      "19": {"minutes": 60}
    }'::jsonb;
BEGIN
    IF (SELECT count(*) FROM jsonb_object_keys(initial_values)) <> 10
       OR EXISTS (
           SELECT 1 FROM generate_series(10, 19) AS key_number
           WHERE initial_values -> key_number::text IS NULL
              OR initial_values -> key_number::text = 'null'::jsonb
              OR initial_values -> key_number::text = '{}'::jsonb
       )
       OR jsonb_path_exists(initial_values, '$.** ? (@ == null)') THEN
        RAISE EXCEPTION 'Billing deadline version 1 is incomplete';
    END IF;
    INSERT INTO billing_deadline_version (version, "values") VALUES (1, initial_values);
END $$;
