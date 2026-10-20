-- ============================================================================
-- 042 — HOS-1443 (HOS-1352 program, V4.1, AC:V4:1): a `trial` row is never
-- deleted
--
-- Carril 2 (extras): Drizzle cannot declare triggers. Idempotent — re-applied
-- on every `pnpm db:apply-extras` (CREATE OR REPLACE FUNCTION, and the trigger
-- dropped and recreated).
--
-- The trial is single for life (INV:1, INV:2): the row, with the pseudonym of
-- the normalised mailbox, is what denies a second trial, so it survives
-- everything. The table has no `deleted_at` (no soft delete can hide a row), the
-- FK from `trial.user_id` to `users` is ON DELETE RESTRICT (an account is
-- pseudonymised, never deleted), and this trigger rejects every row DELETE.
--
-- Rejections raise SQLSTATE P0001 with a message naming the table.
--
-- TRUNCATE is not a row operation and is NOT blocked: the integration suites
-- and the seed reset wipe tables with TRUNCATE, and no application path issues
-- one. If the pseudonyms must ever be erased (legal question 5, V/22 §3.3),
-- support does it with an explicit, recorded task, not through this table's
-- normal paths.
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_trial_delete()
  RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted: the trial is single for life', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trial_no_delete ON trial;
CREATE TRIGGER trg_trial_no_delete
  BEFORE DELETE ON trial
  FOR EACH ROW
  EXECUTE FUNCTION reject_trial_delete();
