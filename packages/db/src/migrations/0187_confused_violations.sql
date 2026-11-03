ALTER TABLE "accommodations" ADD COLUMN "business_lines" text[] DEFAULT ARRAY['standard']::text[];--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "business_lines" text[] DEFAULT ARRAY['standard']::text[];--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "business_lines" text[];--> statement-breakpoint
UPDATE "venues" SET "business_lines" = CASE "type"::text
  WHEN 'RESTAURANT' THEN ARRAY['food']::text[]
  WHEN 'CAFE' THEN ARRAY['food']::text[]
  WHEN 'PARRILLA' THEN ARRAY['food']::text[]
  WHEN 'HELADERIA' THEN ARRAY['food']::text[]
  WHEN 'PANADERIA' THEN ARRAY['food']::text[]
  WHEN 'ROTISERIA' THEN ARRAY['food']::text[]
  WHEN 'FOOD_TRUCK' THEN ARRAY['food']::text[]
  WHEN 'BAR' THEN ARRAY['food', 'nightlife']::text[]
  WHEN 'CERVECERIA' THEN ARRAY['food', 'nightlife']::text[]
  WHEN 'PUB' THEN ARRAY['food', 'nightlife']::text[]
  WHEN 'BOLICHE' THEN ARRAY['nightlife']::text[]
  ELSE ARRAY['food']::text[]
END;--> statement-breakpoint
ALTER TABLE "accommodations" ALTER COLUMN "business_lines" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "business_lines" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ALTER COLUMN "business_lines" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_business_lines_valid" CHECK (cardinality("accommodations"."business_lines") >= 1 AND "accommodations"."business_lines" <@ ARRAY['standard']::text[]);--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_business_lines_valid" CHECK (cardinality("experiences"."business_lines") >= 1 AND "experiences"."business_lines" <@ ARRAY['standard']::text[]);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_business_lines_valid" CHECK (cardinality("venues"."business_lines") >= 1 AND "venues"."business_lines" <@ ARRAY['food', 'nightlife']::text[] AND CASE "venues"."type"::text WHEN 'RESTAURANT' THEN "venues"."business_lines" <@ ARRAY['food', 'nightlife']::text[] WHEN 'CAFE' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'PARRILLA' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'HELADERIA' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'PANADERIA' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'ROTISERIA' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'FOOD_TRUCK' THEN "venues"."business_lines" <@ ARRAY['food']::text[] WHEN 'BAR' THEN "venues"."business_lines" <@ ARRAY['food', 'nightlife']::text[] WHEN 'CERVECERIA' THEN "venues"."business_lines" <@ ARRAY['food', 'nightlife']::text[] WHEN 'PUB' THEN "venues"."business_lines" <@ ARRAY['food', 'nightlife']::text[] WHEN 'BOLICHE' THEN "venues"."business_lines" <@ ARRAY['nightlife']::text[] ELSE false END);
CREATE INDEX "accommodations_business_lines_gin_idx" ON "accommodations" USING gin ("business_lines");--> statement-breakpoint
CREATE INDEX "experiences_business_lines_gin_idx" ON "experiences" USING gin ("business_lines");--> statement-breakpoint
CREATE INDEX "venues_business_lines_gin_idx" ON "venues" USING gin ("business_lines");--> statement-breakpoint
