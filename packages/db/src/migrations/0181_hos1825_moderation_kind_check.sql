-- HOS-1825: recreate ck_content_moderation_terms_kind with the exact 0009 definition.
-- Production stored this CHECK with a per-literal text cast
-- (ARRAY['word'::varchar::text, ...]) while a database built from scratch stores
-- a whole-array cast (ARRAY['word'::varchar, ...]::text[]). Same semantics, but
-- the cutover schema fingerprint compares the stored text, so production must be
-- rebuilt into the from-scratch form. Idempotent: DROP ... IF EXISTS + ADD.
-- The ADD revalidates every row; the predicate is unchanged, so no row can fail.
ALTER TABLE "content_moderation_terms" DROP CONSTRAINT IF EXISTS "ck_content_moderation_terms_kind";--> statement-breakpoint
ALTER TABLE "content_moderation_terms" ADD CONSTRAINT "ck_content_moderation_terms_kind" CHECK ("content_moderation_terms"."kind" IN ('word', 'domain'));
