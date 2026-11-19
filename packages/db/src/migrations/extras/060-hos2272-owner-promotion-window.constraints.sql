-- HOS-2272: keep recurring promotion windows complete and unambiguous when
-- writes bypass the API. PostgreSQL time values are local venue wall time.
CREATE OR REPLACE FUNCTION owner_promotion_window_weekdays_valid(smallint[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT $1 IS NULL OR (
        cardinality($1) BETWEEN 1 AND 7
        AND (SELECT count(*) = count(day) AND count(*) = count(DISTINCT day)
             FROM unnest($1) AS weekdays(day))
        AND $1 <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
    )
$$;

DO $$ BEGIN
    ALTER TABLE owner_promotions
        ADD CONSTRAINT owner_promotions_window_complete_check
        CHECK ((window_weekdays IS NULL) = (window_start IS NULL)
            AND (window_start IS NULL) = (window_end IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE owner_promotions
        ADD CONSTRAINT owner_promotions_window_weekdays_check
        CHECK (owner_promotion_window_weekdays_valid(window_weekdays));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE owner_promotions
        ADD CONSTRAINT owner_promotions_window_times_check
        CHECK (window_start IS NULL OR window_start <> window_end);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
