-- =============================================================================
-- 036-billing-customers-external-id-unique.index.sql
-- Partial UNIQUE index enforcing "at most one LIVE billing customer per
-- (external_id, livemode)" (HOS-596).
--
-- Why this file exists:
--   `BillingCustomerSyncService.ensureCustomerExists` is a read-then-insert:
--   it calls `customers.getByExternalId(userId)` and, on a miss, inserts. Two
--   concurrent requests for the same user (a double-clicked checkout, a signup
--   racing the billing-customer middleware) can both miss and both insert,
--   because `QZPayCustomersRepository.create` is a bare
--   `INSERT INTO billing_customers ... RETURNING *` with no `ON CONFLICT`.
--   Only a database-level UNIQUE constraint can make that race lose loudly.
--
--   The service already has the losing half of that race handled:
--   `isDuplicateKeyError` catches SQLSTATE 23505 and re-fetches the row that
--   won, returning it instead of failing. That branch is dead code until this
--   index exists — it is the index that raises the 23505 it catches.
--
--   Scope `(external_id, livemode)` matches the lookup exactly:
--   `QZPayCustomersRepository.findByExternalId` filters
--   `external_id = $1 AND livemode = $2 AND deleted_at IS NULL`. Live and
--   sandbox rows for the same user are distinct customers and must both be
--   allowed.
--
-- The index MUST be partial — a plain UNIQUE would break production:
--   `billing_customers` is soft-deleted (`deleted_at`), and production already
--   holds soft-deleted rows carrying the same `external_id` as a live one: HOS-596
--   documents 8 such rows, each destroyed ~470 ms after creation by qzpay-core
--   rolling back its own insert when the MercadoPago call failed. Because the
--   INSERT has no `ON CONFLICT`, a non-partial UNIQUE would make every retry for
--   those users fail with a constraint violation instead of creating the customer
--   — converting a transient provider error into a permanent lockout.
--   `WHERE deleted_at IS NULL` keeps soft-deleted history out of the constraint.
--
-- Pre-flight dedup (idempotent, non-destructive):
--   Duplicated LIVE rows are possible for accounts that retried checkout while
--   the rollback defect was in force, and the CREATE below would fail on them.
--   The DO block first soft-deletes the redundant rows of each duplicated group,
--   keeping exactly one — but ONLY rows that nothing references. The winner is
--   chosen by: has dependent rows > has a MercadoPago customer id > newest.
--   Dependent tables are discovered from the live FK catalogue, so a table added
--   to the billing schema later is covered without editing this file.
--
--   If a group still holds two or more live rows that BOTH have dependents, the
--   block deletes neither and the CREATE UNIQUE INDEX below fails loudly. That is
--   deliberate: merging two customer rows that each own subscriptions/payments is
--   a money-affecting decision and must not happen silently inside a migration.
--
-- Idempotency:
--   The dedup is a no-op once no duplicated live group remains, and
--   CREATE UNIQUE INDEX IF NOT EXISTS is idempotent. NOT created CONCURRENTLY —
--   the extras carril applies files in a single transaction, and CONCURRENTLY
--   cannot run inside one.
-- =============================================================================

DO $do$
DECLARE
    fk          record;
    dep_clause  text := 'false';
    dedupe_sql  text;
    demoted     integer;
BEGIN
    IF to_regclass('public.billing_customers') IS NULL THEN
        RAISE NOTICE '036: billing_customers does not exist yet — skipping dedup';
        RETURN;
    END IF;

    -- Build "is this row referenced by anything?" from the FK catalogue rather
    -- than a hand-maintained table list, so the guard cannot silently go stale.
    FOR fk IN
        SELECT con.conrelid::regclass AS child_table,
               att.attname            AS child_column
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.billing_customers'::regclass
          AND cardinality(con.conkey) = 1
    LOOP
        dep_clause := dep_clause
            || format(' OR EXISTS (SELECT 1 FROM %s dep WHERE dep.%I = bc.id)',
                      fk.child_table, fk.child_column);
    END LOOP;

    dedupe_sql := format($fmt$
        WITH live AS (
            SELECT bc.id,
                   bc.external_id,
                   bc.livemode,
                   bc.created_at,
                   (%s)                             AS has_dependents,
                   bc.mp_customer_id IS NOT NULL    AS has_provider_link
            FROM billing_customers bc
            WHERE bc.deleted_at IS NULL
        ),
        ranked AS (
            SELECT id,
                   has_dependents,
                   row_number() OVER (
                       PARTITION BY external_id, livemode
                       ORDER BY has_dependents    DESC,
                                has_provider_link DESC,
                                created_at        DESC,
                                id                DESC
                   ) AS rn,
                   count(*) OVER (PARTITION BY external_id, livemode) AS group_size
            FROM live
        )
        UPDATE billing_customers bc
           SET deleted_at = now(),
               updated_at = now()
          FROM ranked r
         WHERE bc.id = r.id
           AND r.group_size > 1
           AND r.rn > 1
           AND r.has_dependents = false
    $fmt$, dep_clause);

    EXECUTE dedupe_sql;
    GET DIAGNOSTICS demoted = ROW_COUNT;

    IF demoted > 0 THEN
        RAISE NOTICE '036: soft-deleted % redundant live billing_customers row(s)', demoted;
    END IF;
END
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_customers_external_id_livemode_uniq
    ON billing_customers (external_id, livemode)
    WHERE deleted_at IS NULL;
