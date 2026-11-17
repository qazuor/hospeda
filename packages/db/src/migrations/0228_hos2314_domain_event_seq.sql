DROP INDEX "domain_event_entity_idx";--> statement-breakpoint
ALTER TABLE "domain_event" ADD COLUMN "seq" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "domain_event_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
CREATE INDEX "domain_event_entity_idx" ON "domain_event" USING btree ("entity_type","entity_id","occurred_at","seq");--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_seq_unique" UNIQUE("seq");