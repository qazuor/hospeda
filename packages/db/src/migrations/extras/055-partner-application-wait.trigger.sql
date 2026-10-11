-- V6 ESQ:2: a rejected application keeps its PLAZO:9 wait until cancelled or elapsed.
CREATE OR REPLACE FUNCTION reject_partner_application_wait_active()
RETURNS TRIGGER AS $$
DECLARE
    rejected_application partner_application%ROWTYPE;
    deadline_days integer;
    deadline_version integer;
BEGIN
    SELECT * INTO rejected_application
    FROM partner_application
    WHERE lower(email) = lower(NEW.email)
      AND status = 'REJECTED'
      AND wait_cancelled_at IS NULL
    ORDER BY resolved_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    deadline_version := COALESCE(
        rejected_application.deadlines_version,
        (SELECT max(version) FROM vertical_deadline_version)
    );

    SELECT ("values" -> '9' ->> 'days')::integer INTO deadline_days
    FROM vertical_deadline_version
    WHERE version = deadline_version;

    IF deadline_days IS NULL OR rejected_application.resolved_at IS NULL THEN
        RAISE EXCEPTION 'partner_application_wait_active: PLAZO:9 unavailable'
            USING ERRCODE = 'P0001';
    END IF;

    IF rejected_application.resolved_at + make_interval(days => deadline_days) > now() THEN
        RAISE EXCEPTION 'partner_application_wait_active: rejection wait has not elapsed'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_application_wait_active ON partner_application;
CREATE TRIGGER partner_application_wait_active
BEFORE INSERT ON partner_application
FOR EACH ROW EXECUTE FUNCTION reject_partner_application_wait_active();
