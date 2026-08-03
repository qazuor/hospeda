ALTER TABLE "revalidation_log" RENAME COLUMN "path" TO "target";--> statement-breakpoint
DROP INDEX "revalidation_log_path_idx";--> statement-breakpoint
CREATE INDEX "revalidation_log_target_idx" ON "revalidation_log" USING btree ("target");