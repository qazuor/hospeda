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
 * Verifies every column a migration declared via
 * `SeedMigrationMeta.requiresColumns` before its `up()` is allowed to run.
 *
 * Throws when any declaration is unsatisfied, naming the migration, every
 * missing column, and the run-order cause — the runner turns that into an
 * aborted run with no ledger row, so the migration stays pending and can be
 * re-run once the environment is fixed.
 *
 * A migration that declares nothing is not touched: this gate is opt-in per
 * migration and cannot change how an existing one behaves.
 *
 * @param args - See {@link AssertRequiredColumnsArgs}.
 * @throws {Error} When any declared column is absent from the `public` schema.
 */
export async function assertRequiredColumns({
    db,
    meta
}: AssertRequiredColumnsArgs): Promise<void> {
    const required = meta.requiresColumns;
    if (!required || required.length === 0) return;

    const missing: RequiredColumn[] = [];
    for (const dependency of required) {
        if (!(await columnExists(db, dependency))) {
            missing.push(dependency);
        }
    }

    if (missing.length === 0) return;

    const columnList = missing.map(({ table, column }) => `${table}.${column}`).join(', ');

    throw new Error(
        `Data-migration "${meta.name}" declares a dependency on ${columnList}, ` +
            `which ${missing.length === 1 ? 'does' : 'do'} not exist. ` +
            'This almost always means the run order was wrong: a schema migration ' +
            'dropped the source column before this data-migration could read it. ' +
            'Running anyway would move zero rows, record the migration as applied, ' +
            'and close it in the ledger forever — so the run is aborted instead. ' +
            'Apply the schema migrations up to (but not including) the DROP, run ' +
            'the seed data-migrations, then apply the rest.'
    );
}
