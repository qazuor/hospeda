CREATE TABLE "external_oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"access_token_iv" varchar(32) NOT NULL,
	"access_token_auth_tag" varchar(32) NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"refresh_token_iv" varchar(32) NOT NULL,
	"refresh_token_auth_tag" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_external_oauth_credentials_active_provider" ON "external_oauth_credentials" USING btree ("provider") WHERE deleted_at IS NULL;