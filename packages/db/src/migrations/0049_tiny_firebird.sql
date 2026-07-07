CREATE TABLE "seed_migrations" (
	"name" varchar(255) PRIMARY KEY NOT NULL,
	"group" varchar(20) NOT NULL,
	"checksum" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"result" varchar(50) NOT NULL
);
