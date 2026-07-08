import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Seed data-migrations ledger table (HOS-25).
 *
 * Tracks which numbered seed data-migration files (e.g.
 * `0003-remove-legacy-feature`) have already been applied to this database,
 * mirroring how Drizzle's own `__drizzle_migrations` table tracks structural
 * migrations. Powers the versioned seed-data-migration runner: the runner
 * skips any migration whose `name` already has a row here (the pending set is
 * diffed by `name`). The `checksum` column records each applied file's SHA-256
 * for future drift detection (an applied file edited after the fact); a runtime
 * drift check against it is not yet wired — see the author guide's follow-up.
 *
 * Deliberately **preserved across `pnpm db:fresh-dev` / `--reset`** (see
 * `dbReset` in `packages/seed`): the ledger must survive a schema reset so a
 * freshly reseeded database is correctly stamped as "up to date" for the
 * `required` migrations already baked into the seed data, instead of
 * re-running data migrations the seed already accounts for.
 *
 * Lean append-only table (see `packages/db/CLAUDE.md` → "Lean append-only
 * tables"): no soft-delete, no `updatedAt`, no `createdById`/`updatedById`.
 * Rows are inserted once when a migration is applied and never mutated.
 */
export const seedMigrations = pgTable('seed_migrations', {
    /**
     * Migration filename without extension, e.g.
     * `'0003-remove-legacy-feature'`. Primary key — a migration can only be
     * recorded once.
     */
    name: varchar('name', { length: 255 }).primaryKey(),
    /**
     * Which seed migration group this file belongs to: `'required'` (always
     * applied) or `'example'` (demo/sample data, opt-in). Mirrors the
     * `required`/`example` split of the existing seed source directories.
     */
    group: varchar('group', { length: 20 }).notNull(),
    /** SHA-256 hex digest of the migration file's contents, for future drift detection. */
    checksum: text('checksum').notNull(),
    /** When the migration was applied. */
    appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
    /** Execution duration in milliseconds. `0` for baseline-stamped rows (never executed). */
    durationMs: integer('duration_ms'),
    /**
     * Short outcome marker, e.g. `'ok'` (normally executed) or
     * `'baseline-stamp'` (recorded without running, to mark a pre-existing
     * database as already covered by this migration).
     */
    result: varchar('result', { length: 50 }).notNull()
});

/** Insert shape for `seed_migrations`, inferred from the table definition. */
export type InsertSeedMigration = typeof seedMigrations.$inferInsert;
/** Select shape for `seed_migrations`, inferred from the table definition. */
export type SelectSeedMigration = typeof seedMigrations.$inferSelect;
