/**
 * @fileoverview
 * Pre-execution gate for a data-migration's declared column dependencies
 * (HOS-433).
 *
 * A data-migration that moves data OUT of a column scheduled for removal has a
 * dependency the documented run order cannot express. `db:migrate` applies
 * every pending schema change before `db:seed:migrate` runs any data change,
 * so a structural migration creating the destination and one dropping the
 * source land in the same run — and the data-migration executes against a
 * column that is already gone.
 *
 * Its own existence check cannot catch that, because from inside `up()` the two
 * explanations for a missing column are indistinguishable: "everything already
 * migrated, nothing left to do" and "the run order was wrong, the data is being
 * lost right now" look exactly alike. So the migration reads nothing, reports
 * moving zero rows, and the ledger records it `ok` — closing it permanently.
 *
 * This module answers that question one level up, where it IS answerable: a
 * migration declares what it needs via `SeedMigrationMeta.requiresColumns`, and
 * the runner refuses to execute it when the declaration is not satisfied.
 *
 * @see SeedMigrationMeta.requiresColumns
 */
import { sql } from '@repo/db';
import type { RequiredColumn, SeedMigrationCtx, SeedMigrationMeta } from './types.js';

/** Arguments for {@link assertRequiredColumns}. */
export interface AssertRequiredColumnsArgs {
    /** Transaction-scoped Drizzle client the migration is about to run on. */
    readonly db: SeedMigrationCtx['db'];

    /** The migration's static metadata, carrying its declared dependencies. */
    readonly meta: SeedMigrationMeta;
}

/**
 * Resolves whether a single `(table, column)` pair currently exists in the
 * `public` schema.
 *
 * One query per declared column rather than a single batched `IN`/`ANY`: a
 * migration declares one to three columns, so the round-trip cost is
 * irrelevant, and passing a JS array into a Drizzle `sql` template does NOT
 * produce a SQL array — it interpolates positionally and the cast fails at
 * runtime. A plain loop cannot hit that.
 */
async function columnExists(
    db: AssertRequiredColumnsArgs['db'],
    { table, column }: RequiredColumn
): Promise<boolean> {
    const result = await db.execute(
        sql`SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ${table}
              AND column_name = ${column}`
    );
    return (result.rows?.length ?? 0) > 0;
}

/**
 * Counts rows in a table, returning 0 when the table itself does not exist.
 *
 * A missing table is not an error here: the migration may predate it, or run
 * against a database where it was never created. Either way there is nothing to
 * lose, which is the only question this module is asking.
 */
async function countRows(db: AssertRequiredColumnsArgs['db'], table: string): Promise<number> {
    const exists = await db.execute(
        sql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`
    );
    if (!(exists.rows?.[0] as { present?: boolean } | undefined)?.present) {
        return 0;
    }
    // `sql.raw` is safe: `table` comes from a migration's own `meta`, which is
    // source code, never caller-supplied text.
    const result = await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.raw(`"${table}"`)}`);
    return Number((result.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
}

/**
 * Verifies every column a migration declared via
 * `SeedMigrationMeta.requiresColumns` before its `up()` is allowed to run.
 *
 * Throws when a declaration is unsatisfied **and there is data at stake**,
 * naming the migration, the missing columns and the run-order cause. The runner
 * turns that into an aborted run with no ledger row, so the migration stays
 * pending and can be re-run once the environment is fixed.
 *
 * ## Why an empty table is not an error
 *
 * A missing column means one of two things, and the difference is the row count
 * of the table it belongs to:
 *
 * - **The table has rows.** Data exists that this migration was written to move
 *   and can no longer read. That is the HOS-433 failure — abort.
 * - **The table is empty.** Nothing was lost, because there was nothing there.
 *   This is an ordinary, legitimate state: a database built from scratch runs
 *   every migration in sequence against the CURRENT schema, where a column
 *   dropped by a later structural migration never existed at all. Refusing here
 *   would break `--data-migrate` on any fresh database, which is exactly what
 *   `cli-data-migrate.integration.test.ts` caught.
 *
 * The first version of this guard checked only for the column's absence, on the
 * reasoning that a fresh environment stamps migrations rather than running
 * them. That reasoning was wrong: the day-1 bootstrap and the integration suite
 * both run them for real.
 *
 * A migration that declares nothing is not touched: this gate is opt-in per
 * migration and cannot change how an existing one behaves.
 *
 * @param args - See {@link AssertRequiredColumnsArgs}.
 * @throws {Error} When a declared column is absent AND its table holds rows.
 */
export async function assertRequiredColumns({
    db,
    meta
}: AssertRequiredColumnsArgs): Promise<void> {
    const required = meta.requiresColumns;
    if (!required || required.length === 0) return;

    const missing: RequiredColumn[] = [];
    for (const dependency of required) {
        if (await columnExists(db, dependency)) continue;
        // The column is gone. Whether that matters depends entirely on whether
        // there is anything in the table to have lost.
        if ((await countRows(db, dependency.table)) === 0) continue;
        missing.push(dependency);
    }

    if (missing.length === 0) return;

    const columnList = missing.map(({ table, column }) => `${table}.${column}`).join(', ');

    throw new Error(
        `Data-migration "${meta.name}" declares a dependency on ${columnList}, ` +
            `which ${missing.length === 1 ? 'does' : 'do'} not exist, ` +
            'while the table(s) still hold rows this migration was written to move. ' +
            'This almost always means the run order was wrong: a schema migration ' +
            'dropped the source column before this data-migration could read it. ' +
            'Running anyway would move zero rows, record the migration as applied, ' +
            'and close it in the ledger forever — so the run is aborted instead. ' +
            'Apply the schema migrations up to (but not including) the DROP, run ' +
            'the seed data-migrations, then apply the rest.'
    );
}
