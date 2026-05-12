-- =============================================================================
-- 0024_newsletter_seed_existing_optins.sql
--
-- SPEC-101 T-101-03 — one-time seed of legacy newsletter opt-ins.
--
-- Before SPEC-101 the only newsletter signal was the boolean
-- `users.settings.newsletter`. After SPEC-101 the source of truth lives in
-- `newsletter_subscribers`. This migration creates an ACTIVE row for every
-- user whose legacy flag was already true at migration time, so we honour
-- their existing consent without forcing a re-opt-in.
--
-- Locale derivation:
--   1. Prefer settings.languageWeb when it's one of the three supported codes.
--   2. Fall back to the legacy `language` field on the same conditions.
--   3. Default to 'es' (platform default per LanguageEnumSchema).
--
-- Consent audit columns (consent_ip, consent_ua, consent_version) are left
-- NULL — the legacy flag predates the consent capture work and we cannot
-- retroactively invent values. The `source='migration'` row tags these rows
-- so they're filterable in admin and excluded from "real" consent reporting.
--
-- Timestamps:
--   - subscribed_at and verified_at are set to the user's created_at so
--     dispatch soft-cap logic sees these rows as "old enough" to be eligible
--     for the next send.
--
-- Idempotency:
--   - ON CONFLICT DO NOTHING leverages the partial UNIQUE (user_id, channel)
--     WHERE deleted_at IS NULL from 0022. Re-running this file on a DB that
--     already has migrated rows is a no-op.
-- =============================================================================

INSERT INTO newsletter_subscribers (
    id,
    user_id,
    email,
    channel,
    status,
    locale,
    source,
    subscribed_at,
    verified_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    u.email,
    'email',
    'active',
    CASE
        WHEN (u.settings->>'languageWeb') IN ('es', 'en', 'pt')
            THEN (u.settings->>'languageWeb')
        WHEN (u.settings->>'language') IN ('es', 'en', 'pt')
            THEN (u.settings->>'language')
        ELSE 'es'
    END,
    'migration',
    u.created_at,
    u.created_at,
    NOW(),
    NOW()
FROM users u
WHERE
    (u.settings->>'newsletter')::boolean IS TRUE
    AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
