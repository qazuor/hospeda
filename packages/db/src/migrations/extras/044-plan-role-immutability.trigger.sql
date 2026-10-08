-- ============================================================================
-- 044 — HOS-1436 (HOS-1352 program, V2, AC:V2:6/7): `plan.role` is immutable
--
-- Carril 2 (extras): Drizzle cannot declare triggers. Idempotent — re-applied
-- on every `pnpm db:apply-extras` (CREATE OR REPLACE FUNCTION + DROP TRIGGER
-- IF EXISTS), same shape as 041 and 043.
--
-- `plan.role` marks the three non-sellable plans of a vertical (trial,
-- pre_trial, floor) and is accepted only when the plan is created ("crear un
-- plan" of action 18). Changing it would silently turn one plan into another,
-- so every UPDATE that changes it is rejected. Every other column of `plan` is
-- cosmetic and mutates freely (DEC-ARCH-001); a DELETE is not this trigger's
-- concern.
--
-- Rejections raise SQLSTATE P0001 with a message naming the column.
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_plan_role_change()
  RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'plan.role is immutable: reject the plan and create another instead'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_role_immutable ON plan;
CREATE TRIGGER trg_plan_role_immutable
  BEFORE UPDATE ON plan
  FOR EACH ROW EXECUTE FUNCTION reject_plan_role_change();
