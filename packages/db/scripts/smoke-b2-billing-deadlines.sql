-- TEST:B2:11 / AC:B2:8 — run on staging at cut step 3a, after the structural migration.
-- The current billing_option prices must also be compared with the pre-cut
-- commercial catalog by the operator; B2.1 owns and loads that table.
DO $$
DECLARE
    actual jsonb;
    expected jsonb := '{
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
    SELECT "values" INTO actual FROM billing_deadline_version WHERE version = 1;
    IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'TEST:B2:11: billing deadline version 1 does not match the cut catalog';
    END IF;
    IF to_regclass('billing_option') IS NULL THEN
        RAISE EXCEPTION 'TEST:B2:11: billing_option has not been installed by B2.1';
    END IF;
END $$;

-- Review these rows against the pre-cut prices before declaring the smoke passed.
SELECT to_jsonb(option_row) FROM billing_option AS option_row;
