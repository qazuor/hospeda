CREATE TYPE "public"."exchange_rate_source_enum" AS ENUM('dolarapi', 'exchangerate-api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."exchange_rate_type_enum" AS ENUM('oficial', 'blue', 'mep', 'ccl', 'tarjeta', 'standard');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'EXCHANGE_RATE' BEFORE 'INVOICE';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.view' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.create' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.update' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.delete' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.config.update' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'exchange_rate.fetch' BEFORE 'invoice.create';--> statement-breakpoint
ALTER TYPE "public"."price_currency_enum" ADD VALUE 'BRL';