import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';
import { STATUS_ICONS } from './icons.js';
import { IdMapper } from './idMapper.js';
import { logger } from './logger.js';

/**
 * Tables always excluded from the reset regardless of caller-passed
 * `exclude`.
 *
 * - `drizzle_migrations`: intended as a defensive entry for Drizzle's own
 *   migration-state journal, but note it does NOT match drizzle-kit's real
 *   default table name (`__drizzle_migrations`, which additionally lives in
 *   the `drizzle` schema, not `public`). This mismatch is harmless today only
 *   because the introspection query below is scoped to `schemaname = 'public'`
 *   — the real migrations table is never discovered in the first place, so
 *   this entry is currently inert. Left as-is (not renamed/removed): fixing
 *   the name is out of scope here and could surprise whoever added it.
 * - `seed_migrations` (HOS-25): the versioned seed data-migration ledger.
 *   Unlike `drizzle_migrations` above, this table genuinely lives in
 *   `public` and IS discovered by the introspection query, so it needs a
 *   real exclusion entry — without it, `--reset` would wipe the
 *   applied-migrations record and every seed data-migration would silently
 *   re-run from scratch on the next seed.
 */
const ALWAYS_EXCLUDE_TABLES: ReadonlySet<string> = new Set([
    'drizzle_migrations',
    'seed_migrations'
]);

/**
 * Splits a list of discovered `public`-schema table names into those that
 * will be truncated and those that will be preserved, given the
 * caller-supplied `exclude` list combined with {@link ALWAYS_EXCLUDE_TABLES}.
 *
 * Extracted as a pure function (no DB access) so the exclude-list logic —
 * the part that must never regress, since accidentally truncating
 * `seed_migrations` would wipe the data-migration ledger on every reset —
 * can be unit-tested without a live database connection.
 *
 * @param input - Discovered tables plus caller-supplied excludes.
 * @returns The partitioned `tablesToReset` / `tablesSkipped` lists, in the
 *   same relative order as `discoveredTables`.
 *
 * @example
 * ```ts
 * partitionTablesForReset({
 *   discoveredTables: ['users', 'seed_migrations'],
 *   exclude: ['users'],
 * });
 * // { tablesToReset: [], tablesSkipped: ['users', 'seed_migrations'] }
 * ```
 */
export function partitionTablesForReset(input: { discoveredTables: string[]; exclude: string[] }): {
    tablesToReset: string[];
    tablesSkipped: string[];
} {
    const { discoveredTables, exclude } = input;
    const excludeSet = new Set<string>([...exclude, ...ALWAYS_EXCLUDE_TABLES]);
    const tablesToReset = discoveredTables.filter((name) => !excludeSet.has(name));
    const tablesSkipped = discoveredTables.filter((name) => excludeSet.has(name));
    return { tablesToReset, tablesSkipped };
}

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

    const { tablesToReset, tablesSkipped } = partitionTablesForReset({
        discoveredTables: discovered,
        exclude
    });

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
