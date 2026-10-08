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

-- Whether a row whose `xmin` is given was written by the CURRENT transaction
-- (or one of its subtransactions: a savepoint gets its own xid, so comparing
-- with pg_current_xact_id() alone would reject a version created under a
-- savepoint). The row is visible to us, and another transaction's uncommitted
-- rows never are, so "its xmin is still in progress" means "it is ours".
-- `xmin` is a 32-bit `xid`; `pg_xact_status` takes a 64-bit `xid8`, rebuilt
-- with the epoch of pg_current_xact_id() (one epoch back when the low 32 bits
-- are far ahead, i.e. the row predates a wraparound). A frozen or truncated xid
-- answers NULL, which is "not ours".
CREATE OR REPLACE FUNCTION catalog_row_written_by_current_xact(row_xmin xid)
  RETURNS boolean AS $$
DECLARE
  current_full bigint := pg_current_xact_id()::text::bigint;
  low bigint := row_xmin::text::bigint;
  full_xid bigint := ((current_full >> 32) << 32) | low;
BEGIN
  IF low > (current_full & 4294967295) + 2147483648 THEN
    full_xid := full_xid - 4294967296;
  END IF;
  IF full_xid < 0 THEN
    RETURN false;
  END IF;
  RETURN coalesce(pg_xact_status(full_xid::text::xid8) = 'in progress', false);
END;
$$ LANGUAGE plpgsql;

-- BEFORE INSERT on a version's child rows: the version must have been created
-- by this same transaction. TG_ARGV[0] is the parent table, TG_ARGV[1] the FK
-- column of the child that names it.
CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()
  RETURNS TRIGGER AS $$
DECLARE
  parent_id uuid;
  parent_xmin xid;
BEGIN
  parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  EXECUTE format('SELECT xmin FROM %I WHERE id = $1', TG_ARGV[0])
    INTO parent_xmin USING parent_id;
  -- A missing parent is left to the foreign key, which names it.
  IF parent_xmin IS NOT NULL AND NOT catalog_row_written_by_current_xact(parent_xmin) THEN
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
