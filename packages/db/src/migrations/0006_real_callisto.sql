DELETE FROM "destination_reviews"
WHERE "id" NOT IN (
    SELECT DISTINCT ON ("user_id", "destination_id") "id"
    FROM "destination_reviews"
    ORDER BY "user_id", "destination_id", "created_at" DESC
);
--> statement-breakpoint
CREATE UNIQUE INDEX "destination_reviews_user_destination_uniq" ON "destination_reviews" USING btree ("user_id","destination_id");