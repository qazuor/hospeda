import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';
import { STATUS_ICONS } from './icons.js';
import { IdMapper } from './idMapper.js';
import { logger } from './logger.js';

/**
 * Tables always excluded from the reset regardless of caller-passed
 * `exclude`. `drizzle_migrations` is Drizzle's own migration-state
 * journal — wiping it would make the next `drizzle-kit migrate` reapply
 * every migration from scratch. Hospeda uses `drizzle-kit push` rather
 * than `migrate`, so the table is not currently populated, but excluding
 * it defensively prevents a footgun if the workflow changes.
 */
const ALWAYS_EXCLUDE_TABLES: ReadonlySet<string> = new Set(['drizzle_migrations']);

/**
 * Resets the database by truncating every table in the `public` schema.
 *
 * Implementation: introspects the live database via `pg_tables` rather
 * than enumerating tables from a hand-maintained list. This is the only
 * approach that stays correct as new tables are added — a hardcoded list
 * inevitably drifts (see SPEC-143 staging smoke 2026-05-21 Finding #10:
 * the `billing_*` tables were never added to the legacy list, so reseeds
 * silently preserved stale billing data and surprised the smoke run).
 *
 * Why TRUNCATE … CASCADE in a single statement (rather than per-table
 * DELETE in dependency order):
 *   - CASCADE follows foreign keys automatically — no need to encode the
 *     child-before-parent ordering by hand.
 *   - TRUNCATE is significantly faster than DELETE (no per-row WAL write)
 *     on tables of any size.
 *   - RESTART IDENTITY resets serial/identity sequences too, so reseeds
 *     get the same id values across runs (deterministic for tests).
 *   - Doing it in one statement avoids partial-state failures: either
 *     the whole reset succeeds, or PostgreSQL rolls it back atomically.
 *
 * @param exclude - Table names to preserve. Combined with
 *   {@link ALWAYS_EXCLUDE_TABLES}. Names must match the actual
 *   `pg_tables.tablename` value (snake_case in this codebase).
 * @returns Promise that resolves once the reset completes.
 *
 * @example
 * ```ts
 * // Reset everything in the public schema
 * await resetDatabase();
 *
 * // Reset everything except users and accommodations
 * await resetDatabase(['users', 'accommodations']);
 * ```
 *
 * @throws {Error} When the introspection query or TRUNCATE fails.
 */
export async function resetDatabase(exclude: string[] = []): Promise<void> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Reset}  RESETTING DATABASE`);
    logger.info(`${subSeparator}`);

    const db = getDb();

    // Discover all tables in the public schema at runtime — this is the
    // whole point: the set of tables is the live truth from Postgres,
    // not a list we have to remember to maintain.
    const introspection = await db.execute<{ tablename: string }>(sql`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    `);

    const discovered = introspection.rows.map((row) => String(row.tablename));

    if (discovered.length === 0) {
        logger.warn(
            `${STATUS_ICONS.Warning} No tables found in the public schema — nothing to reset.`
        );
        return;
    }

    const excludeSet = new Set<string>([...exclude, ...ALWAYS_EXCLUDE_TABLES]);
    const tablesToReset = discovered.filter((name) => !excludeSet.has(name));
    const tablesSkipped = discovered.filter((name) => excludeSet.has(name));

    if (tablesToReset.length === 0) {
        logger.warn(
            `${STATUS_ICONS.Warning} Every discovered table was in the exclude list — nothing to reset.`
        );
        return;
    }

    // Quote every name with double quotes so identifiers with reserved
    // words or mixed case still resolve correctly. The names come from
    // pg_tables (the database's own catalog), so injection is not a
    // concern — they are not user input.
    const quotedNames = tablesToReset.map((name) => `"${name}"`).join(', ');

    try {
        await db.execute(sql.raw(`TRUNCATE TABLE ${quotedNames} RESTART IDENTITY CASCADE`));

        for (const name of tablesToReset) {
            logger.info(`${STATUS_ICONS.Reset}  Truncated: ${name}`);
        }
        for (const name of tablesSkipped) {
            logger.info(`${STATUS_ICONS.Skip} Skipped (in exclude list): ${name}`);
        }
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error} TRUNCATE failed: ${(error as Error).message}`);
        throw error;
    }

    // Drop in-memory seed-id → real-id mappings so the next seed run
    // starts from a clean slate (no stale UUIDs from the previous run).
    const idMapper = new IdMapper(true);
    idMapper.clearAll();

    logger.info(`${subSeparator}`);
    logger.success({
        msg: `${STATUS_ICONS.Success} Database reset completed: ${tablesToReset.length} tables truncated, ${tablesSkipped.length} skipped`
    });
    logger.info(`${separator}`);
}
