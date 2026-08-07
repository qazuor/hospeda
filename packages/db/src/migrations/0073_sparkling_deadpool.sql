ALTER TYPE "public"."permission_enum" ADD VALUE 'event.view.own' BEFORE 'post.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'event.update.own' BEFORE 'post.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'event.delete.own' BEFORE 'post.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'event.publish.own' BEFORE 'post.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'post.view.own' BEFORE 'user.read.all';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'post.update.own' BEFORE 'user.read.all';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'post.delete.own' BEFORE 'user.read.all';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'post.publish.own' BEFORE 'user.read.all';