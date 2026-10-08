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
--     are rejected.
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
