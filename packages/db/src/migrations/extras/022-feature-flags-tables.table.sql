-- 022-feature-flags-tables.table.sql
-- Creates feature_flags and feature_flag_audit_log tables (idempotent).
-- Feature flags are system-level toggles, not business entities — they live
-- in the extras carril because they do not extend BaseModel and omit soft-delete.

DO $$
BEGIN

-- ─── feature_flags ──────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feature_flags'
) THEN
    CREATE TABLE public.feature_flags (
        id            uuid        NOT NULL DEFAULT gen_random_uuid(),
        key           varchar(100) NOT NULL,
        description   varchar(2000) NOT NULL DEFAULT '',
        enabled       boolean     NOT NULL DEFAULT false,
        is_active     boolean     NOT NULL DEFAULT true,
        force_on_user_ids  uuid[]  NOT NULL DEFAULT '{}',
        force_off_user_ids uuid[]  NOT NULL DEFAULT '{}',
        enabled_for_roles  text[]  NOT NULL DEFAULT '{}',
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        created_by_id uuid,
        updated_by_id uuid,
        CONSTRAINT pk_feature_flags PRIMARY KEY (id)
    );

    COMMENT ON TABLE  feature_flags IS 'System-level feature flags with per-user and per-role overrides';
    COMMENT ON COLUMN feature_flags.key IS 'Unique feature flag key (e.g. new-checkout, ai-chat)';
    COMMENT ON COLUMN feature_flags.is_active IS 'Kill-switch: false = force-disabled regardless of enabled, user/role overrides';
    COMMENT ON COLUMN feature_flags.force_on_user_ids IS 'Users who always see this flag as enabled';
    COMMENT ON COLUMN feature_flags.force_off_user_ids IS 'Users who always see this flag as disabled';
    COMMENT ON COLUMN feature_flags.enabled_for_roles IS 'Roles that see this flag as enabled (supersedes enabled when set)';
END IF;

-- ─── unique index on key ───────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'feature_flags' AND indexname = 'idx_feature_flags_key_unique'
) THEN
    CREATE UNIQUE INDEX idx_feature_flags_key_unique ON public.feature_flags (key);
END IF;

-- ─── feature_flag_audit_log ─────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feature_flag_audit_log'
) THEN
    CREATE TABLE public.feature_flag_audit_log (
        id              uuid        NOT NULL DEFAULT gen_random_uuid(),
        flag_id         uuid        NOT NULL,
        action          varchar(50) NOT NULL,
        previous_value  jsonb,
        new_value       jsonb,
        reason          varchar(500),
        performed_by_id uuid        NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_feature_flag_audit_log PRIMARY KEY (id)
    );

    COMMENT ON TABLE  feature_flag_audit_log IS 'Audit trail for feature flag changes (create, update, toggle)';
END IF;

-- ─── audit log FK + index ──────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'feature_flag_audit_log' AND indexname = 'idx_feature_flag_audit_log_flag_id'
) THEN
    CREATE INDEX idx_feature_flag_audit_log_flag_id
        ON public.feature_flag_audit_log (flag_id);
END IF;

RAISE NOTICE '022: feature_flags and feature_flag_audit_log tables ensured.';
END;
$$;
