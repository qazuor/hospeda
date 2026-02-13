CREATE TYPE "public"."destination_type_enum" AS ENUM('COUNTRY', 'REGION', 'PROVINCE', 'DEPARTMENT', 'CITY', 'TOWN', 'NEIGHBORHOOD');--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "parent_destination_id" uuid;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "destination_type" "destination_type_enum" NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "path_ids" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_parent_destination_id_destinations_id_fk" FOREIGN KEY ("parent_destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "destinations_parentDestinationId_idx" ON "destinations" USING btree ("parent_destination_id");--> statement-breakpoint
CREATE INDEX "destinations_destinationType_idx" ON "destinations" USING btree ("destination_type");--> statement-breakpoint
CREATE INDEX "destinations_level_idx" ON "destinations" USING btree ("level");--> statement-breakpoint
CREATE INDEX "destinations_path_idx" ON "destinations" USING btree ("path");--> statement-breakpoint
CREATE INDEX "destinations_pathIds_idx" ON "destinations" USING btree ("path_ids");--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_path_unique" UNIQUE("path");