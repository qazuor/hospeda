ALTER TABLE "ai_conversations" ADD COLUMN "listing_entity_type" varchar(20);--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN "listing_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "answer_status" varchar(20);--> statement-breakpoint
CREATE INDEX "aiConversations_listing_idx" ON "ai_conversations" USING btree ("listing_entity_type","listing_entity_id");--> statement-breakpoint
CREATE INDEX "aiMessages_answerStatus_created_idx" ON "ai_messages" USING btree ("answer_status","created_at");--> statement-breakpoint
-- HOS-2101 backfill: copy the listing reference that chat conversations carried
-- only inside the free-text `context_note` JSON into the new indexed columns.
-- Regex extraction instead of a JSON cast: a single malformed `context_note`
-- would abort a cast for the whole table, while a non-matching regex just
-- leaves that row NULL. The UUID pattern is strict so the `::uuid` cast cannot fail.
UPDATE "ai_conversations"
SET
    "listing_entity_type" = COALESCE(
        substring("context_note" from '"entityType"\s*:\s*"(accommodation|venue|experience)"'),
        'accommodation'
    ),
    "listing_entity_id" = COALESCE(
        substring("context_note" from '"entityId"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"'),
        substring("context_note" from '"accommodationId"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"')
    )::uuid
WHERE "feature" = 'chat'
  AND "listing_entity_id" IS NULL
  AND (
    "context_note" ~ '"entityId"\s*:\s*"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"'
    OR "context_note" ~ '"accommodationId"\s*:\s*"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"'
  );
