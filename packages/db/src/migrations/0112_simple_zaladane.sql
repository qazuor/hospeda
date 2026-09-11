ALTER TYPE "public"."permission_category_enum" ADD VALUE 'QR_CODE';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'platform.qrCode.view' BEFORE 'moderation.term.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'platform.qrCode.create' BEFORE 'moderation.term.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'platform.qrCode.update' BEFORE 'moderation.term.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'platform.qrCode.delete' BEFORE 'moderation.term.view';