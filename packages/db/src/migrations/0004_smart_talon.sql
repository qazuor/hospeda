CREATE TABLE "entity_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	"entity_id" uuid NOT NULL,
	"visitor_hash" text NOT NULL,
	"is_authenticated" boolean DEFAULT false NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_entity_views_entity_time" ON "entity_views" USING btree ("entity_type","entity_id","viewed_at");--> statement-breakpoint
CREATE INDEX "idx_entity_views_time" ON "entity_views" USING btree ("viewed_at");