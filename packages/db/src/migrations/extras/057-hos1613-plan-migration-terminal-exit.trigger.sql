-- HOS-1613, AC:B12:6: a terminal subscription exits any pending plan migration in the same transaction.
CREATE OR REPLACE FUNCTION "plan_migration_subscription_exit_on_terminal"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "plan_migration_subscription"
    SET "status" = 'FUERA', "out_reason" = 'TERMINO'
    WHERE "subscription_id" = NEW."id"
      AND "status" IN ('PENDIENTE', 'PARA_RESOLVER');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "subscription_plan_migration_exit_on_terminal" ON "subscription";
CREATE TRIGGER "subscription_plan_migration_exit_on_terminal"
    AFTER UPDATE OF "status" ON "subscription"
    FOR EACH ROW
    WHEN (OLD."status" IS DISTINCT FROM NEW."status"
      AND NEW."status" IN ('ABANDONED', 'CANCELLED', 'CHARGE_DECLINED'))
    EXECUTE FUNCTION "plan_migration_subscription_exit_on_terminal"();
