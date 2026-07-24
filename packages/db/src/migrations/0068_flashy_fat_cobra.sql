ALTER TYPE "public"."permission_category_enum" ADD VALUE 'ALLIANCE_LEAD' BEFORE 'SOCIAL_POST';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'allianceLead.viewAll' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'allianceLead.manage' BEFORE 'hostTrade.view';