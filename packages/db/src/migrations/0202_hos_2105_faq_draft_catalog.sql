-- Owner decision 2026-11-12: grant FAQ drafts to existing subscribers immediately.
-- The local additive grant signal is bounded by extras 041's trigger: only new
-- child-table keys may be inserted; duplicates, UPDATE, and DELETE remain rejected.
-- New plan versions are intentionally not published: subscriptions anchor
-- plan_version_id and billing_option_id through a composite FK, and billing
-- options are tied to MercadoPago.
-- Live runs apply this migration before extras, so define the exact same function
-- body here. Fresh databases have no trigger yet; extras later installs the
-- triggers and re-applies this identical function. Keep every INSERT as a
-- separate statement: restoreProductionPlanCatalog replays the two child INSERT
-- chunks inside the transaction that creates the versions.
CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()
  RETURNS TRIGGER AS $$
DECLARE
  parent_id uuid;
  parent_exists boolean;
  created text := coalesce(current_setting('hospeda.catalog_versions_created_in_xact', true), '');
  additive_grant text := coalesce(current_setting('hospeda.catalog_additive_grant', true), '');
  key_exists boolean;
BEGIN
  parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1)', TG_ARGV[0])
    INTO parent_exists USING parent_id;
  -- A missing parent is left to the foreign key, which names it.
  IF parent_exists AND NOT (parent_id::text = ANY (string_to_array(created, ','))) THEN
    IF additive_grant = '' THEN
      RAISE EXCEPTION '% is immutable: % % was published by another transaction; publish a new version instead',
        TG_TABLE_NAME, TG_ARGV[0], parent_id
        USING ERRCODE = 'P0001';
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1 AND key = $2)', TG_TABLE_NAME, TG_ARGV[1])
      INTO key_exists USING parent_id, to_jsonb(NEW) ->> 'key';
    IF key_exists THEN
      RAISE EXCEPTION '% is immutable: additive grant % cannot duplicate key % for version %',
        TG_TABLE_NAME, additive_grant, to_jsonb(NEW) ->> 'key', parent_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Use a transaction-local reason, never claim old versions were created here.
SELECT set_config('hospeda.catalog_additive_grant', 'HOS-2105', true);
--> statement-breakpoint

INSERT INTO "catalog_key" ("key", "kind", "scope", "aggregation_strategy", "enforcement_strategy", "key_class") VALUES
	('ai_faq_draft', 'entitlement', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'),
	('max_ai_faq_draft_per_month', 'limit', 'vertical', 'SUM', 'DISABLE', 'COMMERCIAL');

--> statement-breakpoint
INSERT INTO "plan_version_entitlement" ("id", "plan_version_id", "key", "plan_quota", "trial_quota") VALUES
	('7664b2a4-a036-5865-967d-cb3524883b24', '8f23bcdd-1abc-5342-bfb4-b7dcca4bbf9d', 'ai_faq_draft', NULL, NULL),
	('8d1a7a34-d885-5490-b78b-f1d2d481cd4d', '5171d736-8b7d-5840-9262-4ac6cb83bcac', 'ai_faq_draft', NULL, NULL),
	('36f1659b-0bd4-5d92-8a6c-4272dd1c2a25', '3696b354-122a-528f-9090-41e22a61091f', 'ai_faq_draft', NULL, NULL),
	('a11ae672-f002-5ae4-947b-b963a71d8507', '8e4b0c4e-702f-5203-85e3-e9c06365eb87', 'ai_faq_draft', NULL, NULL),
	('8fad0382-880d-5271-a25c-bc60a3b308a1', 'e06ceb6a-7caa-5794-879a-1f1bb4e81ad9', 'ai_faq_draft', NULL, NULL);

--> statement-breakpoint
INSERT INTO "plan_version_limit" ("id", "plan_version_id", "key", "value") VALUES
	('6662ad6d-bd0d-5d97-9ae1-0665b6d7f667', '8f23bcdd-1abc-5342-bfb4-b7dcca4bbf9d', 'max_ai_faq_draft_per_month', 50),
	('218e76dd-df8f-5f34-9c96-db1ca9d1c0a7', '5171d736-8b7d-5840-9262-4ac6cb83bcac', 'max_ai_faq_draft_per_month', 250),
	('6a5d401e-c7c8-521b-a2f4-6e4277f3ff99', '3696b354-122a-528f-9090-41e22a61091f', 'max_ai_faq_draft_per_month', 1250),
	('031d576d-a495-59f5-aa77-b00b9c0291c7', '54a6f750-1b4c-53ff-ba51-c27f51921598', 'max_ai_faq_draft_per_month', 0),
	('0c416815-dbbe-513f-bf27-e189b96e67ab', '3b701ee3-ea7b-5360-a6fb-58bc75842680', 'max_ai_faq_draft_per_month', 0),
	('9e576931-310e-5795-8266-24ef64be7cac', '8e4b0c4e-702f-5203-85e3-e9c06365eb87', 'max_ai_faq_draft_per_month', 1250),
	('1721f1b4-71bb-5572-8158-a793b06a1237', 'c42b276a-4382-5f17-b81e-19f6ab4a55f2', 'max_ai_faq_draft_per_month', 0),
	('7584baff-d302-5486-a9e2-c08ea8594b2f', 'cfbb3e23-b39b-5711-985a-ce20714a05df', 'max_ai_faq_draft_per_month', 0),
	('2a7e71d3-bd73-5c37-84f7-1eb6b574cb54', 'e06ceb6a-7caa-5794-879a-1f1bb4e81ad9', 'max_ai_faq_draft_per_month', 1250);
