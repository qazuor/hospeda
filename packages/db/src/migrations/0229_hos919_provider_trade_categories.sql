-- HOS-919 EXPAND step. host_trades.category, alliance_leads.category, their indexes and host_trade_category_enum are intentionally NOT dropped here: they go in the contract release, after this one is live (HOS-433 rule).
-- The new permission labels are only added here, never used in this transaction, so ADD VALUE inside the migration transaction is safe.
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.view' BEFORE 'hostTrade.review.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.create' BEFORE 'hostTrade.review.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.update' BEFORE 'hostTrade.review.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.delete' BEFORE 'hostTrade.review.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.restore' BEFORE 'hostTrade.review.create';--> statement-breakpoint
CREATE TABLE "host_trade_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"group_id" uuid NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"keywords_i18n" jsonb DEFAULT '{}'::jsonb,
	"translation_meta" jsonb DEFAULT '{}'::jsonb,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "host_trade_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "host_trade_category_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"translation_meta" jsonb DEFAULT '{}'::jsonb,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "host_trade_category_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "r_host_trade_category" (
	"host_trade_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "r_host_trade_category_host_trade_id_category_id_pk" PRIMARY KEY("host_trade_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "host_trades" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "category_slugs" text[];--> statement-breakpoint
ALTER TABLE "host_trade_categories" ADD CONSTRAINT "host_trade_categories_group_id_host_trade_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."host_trade_category_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_categories" ADD CONSTRAINT "host_trade_categories_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_categories" ADD CONSTRAINT "host_trade_categories_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_categories" ADD CONSTRAINT "host_trade_categories_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_category_groups" ADD CONSTRAINT "host_trade_category_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_category_groups" ADD CONSTRAINT "host_trade_category_groups_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_category_groups" ADD CONSTRAINT "host_trade_category_groups_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_host_trade_category" ADD CONSTRAINT "r_host_trade_category_host_trade_id_host_trades_id_fk" FOREIGN KEY ("host_trade_id") REFERENCES "public"."host_trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_host_trade_category" ADD CONSTRAINT "r_host_trade_category_category_id_host_trade_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."host_trade_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hostTradeCategories_groupId_idx" ON "host_trade_categories" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "hostTradeCategories_lifecycleState_idx" ON "host_trade_categories" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "hostTradeCategoryGroups_lifecycleState_idx" ON "host_trade_category_groups" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "r_host_trade_category_categoryId_idx" ON "r_host_trade_category" USING btree ("category_id");