-- =============================================================================
-- 013-moderation-role-grants.data.sql
--
-- Purpose:
--   Bootstrap MODERATION_* permission grants for the ADMIN and SUPER_ADMIN
--   roles (SPEC-195). These rows are normally provided by the required seed
--   (`hops db-seed --required`), but that step is NOT guaranteed to run on
--   every production deploy. Without these grants, the ADMIN role cannot
--   access the content-moderation admin panel; SUPER_ADMIN already bypasses
--   the grant table at runtime (actor.ts all-perms), but is included for
--   consistency and so the seed audit test stays passing.
--
--   The 10 MODERATION_* values were added to permission_enum by migration
--   0009_tricky_kat_farrell.sql. This file only inserts rows into
--   role_permission — no schema changes.
--
-- Idempotency:
--   Every INSERT uses ON CONFLICT DO NOTHING on the composite primary key
--   (role, permission). Re-applying is safe and produces no duplicates.
--
-- Runs via:
--   pnpm db:apply-extras   (local dev, staging deploy, prod deploy)
--   hops db-migrate --target=staging|prod  (includes apply-extras)
--
-- NOTE: The term corpus (content_moderation_terms) depends on env vars and
-- is admin-managed via the UI after first deploy. It is intentionally NOT
-- seeded here. The default 'default' threshold row IS ensured below (idempotent
-- WHERE NOT EXISTS), so prod does not depend on the optional seed step for it.
-- Running `hops db-seed --target=prod --no-reset --no-example --pull --yes`
-- remains the way to (re)import the optional term corpus from env vars, but is
-- not required for the moderation engine to function.
--
-- NEVER run drizzle-kit push against staging/prod — see packages/db/CLAUDE.md.
-- =============================================================================

DO $$
BEGIN
    -- Guard: skip gracefully if the table or enum values do not exist yet
    -- (e.g. 0009_tricky_kat_farrell.sql has not been applied).
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'role_permission'
    ) THEN
        RAISE NOTICE '013-moderation-role-grants: role_permission table not found, skipping.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'permission_enum'
          AND e.enumlabel = 'moderation.term.view'
    ) THEN
        RAISE NOTICE '013-moderation-role-grants: permission_enum lacks moderation values, skipping.';
        RETURN;
    END IF;

    -- ── SUPER_ADMIN grants ────────────────────────────────────────────────────
    INSERT INTO role_permission (role, permission) VALUES
        ('SUPER_ADMIN', 'moderation.term.view'),
        ('SUPER_ADMIN', 'moderation.term.create'),
        ('SUPER_ADMIN', 'moderation.term.update'),
        ('SUPER_ADMIN', 'moderation.term.delete'),
        ('SUPER_ADMIN', 'moderation.term.restore'),
        ('SUPER_ADMIN', 'moderation.term.hardDelete'),
        ('SUPER_ADMIN', 'moderation.threshold.view'),
        ('SUPER_ADMIN', 'moderation.threshold.update'),
        ('SUPER_ADMIN', 'moderation.threshold.restore'),
        ('SUPER_ADMIN', 'moderation.threshold.hardDelete')
    ON CONFLICT (role, permission) DO NOTHING;

    -- ── ADMIN grants ──────────────────────────────────────────────────────────
    INSERT INTO role_permission (role, permission) VALUES
        ('ADMIN', 'moderation.term.view'),
        ('ADMIN', 'moderation.term.create'),
        ('ADMIN', 'moderation.term.update'),
        ('ADMIN', 'moderation.term.delete'),
        ('ADMIN', 'moderation.term.restore'),
        ('ADMIN', 'moderation.term.hardDelete'),
        ('ADMIN', 'moderation.threshold.view'),
        ('ADMIN', 'moderation.threshold.update'),
        ('ADMIN', 'moderation.threshold.restore'),
        ('ADMIN', 'moderation.threshold.hardDelete')
    ON CONFLICT (role, permission) DO NOTHING;

    -- ── Default threshold row ─────────────────────────────────────────────────
    -- Ensures the editable 'default' threshold row exists on prod without
    -- depending on the optional `hops db-seed` step. A plain INSERT guarded by
    -- WHERE NOT EXISTS (the table has a partial unique index on context WHERE
    -- deleted_at IS NULL, so this is idempotent and re-apply-safe). pending/reject
    -- match the code-constant fallback so behaviour is unchanged until an admin
    -- edits the row.
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'content_moderation_thresholds'
    ) THEN
        INSERT INTO content_moderation_thresholds (context, pending, reject)
        SELECT 'default', 0.5, 0.85
        WHERE NOT EXISTS (
            SELECT 1 FROM content_moderation_thresholds
            WHERE context = 'default' AND deleted_at IS NULL
        );
    END IF;

    RAISE NOTICE '013-moderation-role-grants: MODERATION_* grants + default threshold row ensured.';
END;
$$;
