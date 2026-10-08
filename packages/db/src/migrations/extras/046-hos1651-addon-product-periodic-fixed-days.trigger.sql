-- HOS-1651: a periodic product cannot sell a fixed-days addon version.
-- The rule crosses tables, so Drizzle cannot express it. Safe to reapply.
CREATE OR REPLACE FUNCTION addon_product_periodic_requires_non_fixed_days()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.charge_kind = 'PERIODICO' AND EXISTS (
        SELECT 1 FROM addon_version
        WHERE id = NEW.version_id AND validity = 'FIXED_DAYS'
    ) THEN
        RAISE EXCEPTION 'periodic addon product cannot use a fixed-days version'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'ck_addon_product_periodic_not_fixed_days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS addon_product_periodic_fixed_days ON addon_product;
CREATE TRIGGER addon_product_periodic_fixed_days
BEFORE INSERT OR UPDATE OF version_id, charge_kind ON addon_product
FOR EACH ROW EXECUTE FUNCTION addon_product_periodic_requires_non_fixed_days();
