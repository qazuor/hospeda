DROP INDEX "accommodations_visibility_featuredByEntitlement_idx";--> statement-breakpoint
DROP INDEX "accommodations_destinationId_featuredByEntitlement_visibility_idx";--> statement-breakpoint
DROP INDEX "accommodations_ownerSuspended_idx";--> statement-breakpoint
DROP INDEX "accommodations_planRestricted_idx";--> statement-breakpoint
DROP INDEX "accommodations_visibility_idx";--> statement-breakpoint
DROP INDEX "accommodations_lifecycle_idx";--> statement-breakpoint
DROP INDEX "accommodations_destinationId_visibility_idx";--> statement-breakpoint
DROP INDEX "accommodations_moderationState_idx";--> statement-breakpoint
DROP INDEX "experiences_visibility_idx";--> statement-breakpoint
DROP INDEX "experiences_moderationState_idx";--> statement-breakpoint
DROP INDEX "experiences_destinationId_visibility_idx";--> statement-breakpoint
DROP INDEX "gastronomies_visibility_idx";--> statement-breakpoint
DROP INDEX "gastronomies_moderationState_idx";--> statement-breakpoint
DROP INDEX "gastronomies_destinationId_visibility_idx";--> statement-breakpoint
CREATE INDEX "accommodations_publicationStatus_idx" ON "accommodations" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "accommodations_destinationId_publicationStatus_idx" ON "accommodations" USING btree ("destination_id","publication_status");--> statement-breakpoint
CREATE INDEX "experiences_publicationStatus_idx" ON "experiences" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "experiences_destinationId_publicationStatus_idx" ON "experiences" USING btree ("destination_id","publication_status");--> statement-breakpoint
CREATE INDEX "gastronomies_publicationStatus_idx" ON "gastronomies" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "gastronomies_destinationId_publicationStatus_idx" ON "gastronomies" USING btree ("destination_id","publication_status");--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "owner_suspended";--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "plan_restricted";--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "billing_unpublished_at";--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "lifecycle_state";--> statement-breakpoint
ALTER TABLE "accommodations" DROP COLUMN "moderation_state";--> statement-breakpoint
ALTER TABLE "experiences" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "experiences" DROP COLUMN "lifecycle_state";--> statement-breakpoint
ALTER TABLE "experiences" DROP COLUMN "moderation_state";--> statement-breakpoint
ALTER TABLE "gastronomies" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "gastronomies" DROP COLUMN "lifecycle_state";--> statement-breakpoint
ALTER TABLE "gastronomies" DROP COLUMN "moderation_state";