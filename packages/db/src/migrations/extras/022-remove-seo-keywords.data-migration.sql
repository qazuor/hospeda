-- SPEC-267: Remove `seo.keywords` from all 6 entity jsonb columns
-- Idempotent: the WHERE clause skips rows already cleaned.

UPDATE accommodations SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE destinations  SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE events        SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE posts         SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE gastronomies  SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE experiences   SET seo = seo - 'keywords' WHERE seo ? 'keywords';
