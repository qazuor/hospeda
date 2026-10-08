-- ============================================================================
-- 041 — HOS-1434 (HOS-1352 program, V2, AC:V2:1): the catalog versions are
-- immutable
--
-- Carril 2 (extras): Drizzle cannot declare triggers. Idempotent — re-applied
-- on every `pnpm db:apply-extras` (CREATE OR REPLACE FUNCTION, and each
-- trigger dropped and recreated).
--
-- What it enforces (DEC-ARCH-001, "se versiona lo que tiene efecto"):
--   - `plan_version`: an UPDATE may change `current` (its only mutable column)
--     and nothing else with an effect; `updated_at` follows along, written by
--     the set_updated_at trigger of extras 002. A DELETE is rejected: a
--     subscription anchors its version and must never lose it.
--   - `addon_version`: fully immutable; UPDATE and DELETE are rejected.
--   - what a version grants (`plan_version_entitlement`, `plan_version_limit`,
--     `addon_version_entitlement`, `addon_version_limit`): UPDATE and DELETE
--     are rejected, and so is an INSERT under a version created by ANOTHER
--     transaction. A version and what it grants are written in the transaction
--     that creates the version (action 18, the catalog load of V2.4); a row
--     added later would change what a subscription anchored to it receives.
--   Changing anything with an effect is publishing a NEW version, never
--   editing the one somebody anchored to.
--
-- How "created by this transaction" is decided: an AFTER INSERT trigger on
-- `plan_version` and on `addon_version` appends the new id to the
-- transaction-local setting `hospeda.catalog_versions_created_in_xact`
-- (set_config(..., is_local => true)), and the child BEFORE INSERT trigger
-- accepts only a parent whose id is in that list. A local setting is undone at
-- the end of the transaction and when a savepoint is rolled back, so the list
-- names exactly the versions this transaction (still) created; a savepoint
-- that is released keeps its additions. The trigger is AFTER, not BEFORE, so
-- an INSERT that never lands (ON CONFLICT DO NOTHING on an existing id) does
-- not add that id. Consequence: the version must be inserted by an EARLIER
-- statement than its rows; one statement doing both (a data-modifying CTE)
-- is rejected, because AFTER row triggers fire at the end of the statement.
--
-- Why not `xmin` (the first version of this file used it): a row's `xmin` is
-- the transaction that wrote its CURRENT tuple, not the one that inserted it.
-- `plan_version.current` is mutable, so `UPDATE plan_version SET current =
-- current WHERE id = <published>` gave the published row a fresh xmin and let
-- the same transaction add grants to a version subscriptions were anchored to
-- (and the catalog load, which flips `current` on the old version, could do it
-- by accident).
--
-- Rejections raise SQLSTATE P0001 with a message naming the table.
--
-- TRUNCATE is not a row operation and is NOT blocked: the integration suites
-- and the seed reset wipe tables with TRUNCATE, and no application path issues
-- one.
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_catalog_version_change()
  RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is immutable: publish a new version instead of % on it', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- The xmin-based check this file used before; nothing calls it anymore.
DROP FUNCTION IF EXISTS catalog_row_written_by_current_xact(xid);

-- AFTER INSERT on a version table: record the new version as created by the
-- current transaction (see the header).
CREATE OR REPLACE FUNCTION record_catalog_version_created_in_xact()
  RETURNS TRIGGER AS $$
DECLARE
  created text := coalesce(current_setting('hospeda.catalog_versions_created_in_xact', true), '');
BEGIN
  PERFORM set_config(
    'hospeda.catalog_versions_created_in_xact',
    CASE WHEN created = '' THEN NEW.id::text ELSE created || ',' || NEW.id::text END,
    true
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- BEFORE INSERT on a version's child rows: the version must have been created
-- by this same transaction. TG_ARGV[0] is the parent table, TG_ARGV[1] the FK
-- column of the child that names it.
CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()
  RETURNS TRIGGER AS $$
DECLARE
  parent_id uuid;
  parent_exists boolean;
  created text := coalesce(current_setting('hospeda.catalog_versions_created_in_xact', true), '');
BEGIN
  parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1)', TG_ARGV[0])
    INTO parent_exists USING parent_id;
  -- A missing parent is left to the foreign key, which names it.
  IF parent_exists AND NOT (parent_id::text = ANY (string_to_array(created, ','))) THEN
    RAISE EXCEPTION '% is immutable: % % was published by another transaction; publish a new version instead',
      TG_TABLE_NAME, TG_ARGV[0], parent_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_plan_version_effect_change()
  RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'plan_version is immutable: a version is never deleted'
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.vertical IS DISTINCT FROM OLD.vertical
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.sellable IS DISTINCT FROM OLD.sellable
     OR NEW.grace_days IS DISTINCT FROM OLD.grace_days
     OR NEW.trial_days IS DISTINCT FROM OLD.trial_days
     OR NEW.allows_pause IS DISTINCT FROM OLD.allows_pause
     OR NEW.inherits_tourist_vip IS DISTINCT FROM OLD.inherits_tourist_vip
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'plan_version is immutable except current: publish a new version instead'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_version_immutable ON plan_version;
CREATE TRIGGER trg_plan_version_immutable
  BEFORE UPDATE OR DELETE ON plan_version
  FOR EACH ROW EXECUTE FUNCTION reject_plan_version_effect_change();

DROP TRIGGER IF EXISTS trg_plan_version_entitlement_immutable ON plan_version_entitlement;
CREATE TRIGGER trg_plan_version_entitlement_immutable
  BEFORE UPDATE OR DELETE ON plan_version_entitlement
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_change();

DROP TRIGGER IF EXISTS trg_plan_version_limit_immutable ON plan_version_limit;
CREATE TRIGGER trg_plan_version_limit_immutable
  BEFORE UPDATE OR DELETE ON plan_version_limit
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_change();

DROP TRIGGER IF EXISTS trg_addon_version_immutable ON addon_version;
CREATE TRIGGER trg_addon_version_immutable
  BEFORE UPDATE OR DELETE ON addon_version
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_change();

DROP TRIGGER IF EXISTS trg_addon_version_entitlement_immutable ON addon_version_entitlement;
CREATE TRIGGER trg_addon_version_entitlement_immutable
  BEFORE UPDATE OR DELETE ON addon_version_entitlement
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_change();

DROP TRIGGER IF EXISTS trg_addon_version_limit_immutable ON addon_version_limit;
CREATE TRIGGER trg_addon_version_limit_immutable
  BEFORE UPDATE OR DELETE ON addon_version_limit
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_version_change();

DROP TRIGGER IF EXISTS trg_plan_version_record_created_in_xact ON plan_version;
CREATE TRIGGER trg_plan_version_record_created_in_xact
  AFTER INSERT ON plan_version
  FOR EACH ROW EXECUTE FUNCTION record_catalog_version_created_in_xact();

DROP TRIGGER IF EXISTS trg_addon_version_record_created_in_xact ON addon_version;
CREATE TRIGGER trg_addon_version_record_created_in_xact
  AFTER INSERT ON addon_version
  FOR EACH ROW EXECUTE FUNCTION record_catalog_version_created_in_xact();

DROP TRIGGER IF EXISTS trg_plan_version_entitlement_insert_same_xact ON plan_version_entitlement;
CREATE TRIGGER trg_plan_version_entitlement_insert_same_xact
  BEFORE INSERT ON plan_version_entitlement
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_child_insert_into_published_version('plan_version', 'plan_version_id');

DROP TRIGGER IF EXISTS trg_plan_version_limit_insert_same_xact ON plan_version_limit;
CREATE TRIGGER trg_plan_version_limit_insert_same_xact
  BEFORE INSERT ON plan_version_limit
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_child_insert_into_published_version('plan_version', 'plan_version_id');

DROP TRIGGER IF EXISTS trg_addon_version_entitlement_insert_same_xact ON addon_version_entitlement;
CREATE TRIGGER trg_addon_version_entitlement_insert_same_xact
  BEFORE INSERT ON addon_version_entitlement
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_child_insert_into_published_version('addon_version', 'addon_version_id');

DROP TRIGGER IF EXISTS trg_addon_version_limit_insert_same_xact ON addon_version_limit;
CREATE TRIGGER trg_addon_version_limit_insert_same_xact
  BEFORE INSERT ON addon_version_limit
  FOR EACH ROW EXECUTE FUNCTION reject_catalog_child_insert_into_published_version('addon_version', 'addon_version_id');
