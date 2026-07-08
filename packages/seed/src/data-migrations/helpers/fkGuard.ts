/**
 * @fileoverview
 * Inbound foreign-key introspection + active-reference counting (HOS-25, T-006).
 *
 * This is the FIRST HALF of the FK-guarded hard-delete helper described in
 * `.specs/HOS-25-versioned-seed-data-migrations/spec.md` §3.3/§6.2/§6.5 and
 * risk R-3: "hard-delete on live prod is dangerous by nature. The FK guard is
 * the only thing between a delta and a referential break; it must introspect
 * **all** inbound FKs, not a hand-maintained list."
 *
 * `getInboundForeignKeys` discovers every foreign key that points at a given
 * table by querying the PostgreSQL system catalog (`pg_constraint` /
 * `pg_class` / `pg_attribute`) directly — never a hand-maintained list, so a
 * newly added FK is picked up automatically without touching this file.
 *
 * `countActiveReferences` uses that discovery to count, for one specific row
 * (identified by its primary-key column + value), how many rows across all
 * referencing tables currently point at it.
 *
 * Neither function deletes anything. Operator-edit detection (OQ-2) and the
 * actual guarded `DELETE` are T-007's job, built on top of
 * {@link countActiveReferences}'s result — see the module JSDoc there for the
 * exact contract this hands off.
 */
import type { DrizzleClient } from '@repo/db';
import { sql } from 'drizzle-orm';

/**
 * One discovered inbound foreign-key column pair: a single `(referencingColumn
 * -> referencedColumn)` mapping belonging to a single FK constraint.
 *
 * Composite foreign keys (a constraint spanning more than one column) produce
 * **one `InboundFk` entry per column pair**, all sharing the same
 * `constraintName`. Callers that need to reconstruct the full composite key
 * must group by `constraintName` themselves — see the composite-FK caveat in
 * {@link countActiveReferences}.
 */
export interface InboundFk {
    /** The table that HOLDS the foreign key (the "child" side). */
    readonly referencingTable: string;

    /** The column on {@link referencingTable} that holds the FK value. */
    readonly referencingColumn: string;

    /**
     * The column on the target table (the table passed to
     * {@link getInboundForeignKeys}) that this FK column points at. Usually
     * the primary key, but any unique/indexed column can be an FK target.
     */
    readonly referencedColumn: string;

    /** The PostgreSQL constraint name (`pg_constraint.conname`). */
    readonly constraintName: string;
}

/**
 * Per-constraint active-reference count, as returned inside
 * {@link CountActiveReferencesResult.byConstraint}.
 */
export interface ActiveReferenceCount {
    /** The PostgreSQL constraint name this count belongs to. */
    readonly constraintName: string;

    /** The referencing table this count was computed against. */
    readonly referencingTable: string;

    /** Number of rows in {@link referencingTable} currently pointing at the target row. */
    readonly count: number;
}

/**
 * Return value of {@link countActiveReferences}.
 */
export interface CountActiveReferencesResult {
    /** Grand total of active references across every discovered inbound FK. */
    readonly total: number;

    /** Per-constraint breakdown, one entry per relevant inbound FK. */
    readonly byConstraint: readonly ActiveReferenceCount[];
}

/**
 * Discovers every foreign key that points AT `table`, by querying the
 * PostgreSQL system catalog directly (`pg_constraint` joined with `pg_class`,
 * `pg_namespace`, and `pg_attribute`).
 *
 * Uses `unnest(con.conkey, con.confkey)` — PostgreSQL's documented
 * multi-array form of `unnest()`, which pairs the two arrays positionally
 * (`conkey[i]` with `confkey[i]`) — rather than joining `key_column_usage` to
 * `constraint_column_usage` on `constraint_name` alone (the
 * `information_schema` equivalent), which produces a cross join and silently
 * corrupts composite-FK column pairing. This is the standard, safe approach
 * for composite foreign keys.
 *
 * `table` is only ever used as a bound query parameter (`relname = ${table}`),
 * never spliced into the SQL text, so there is no identifier-injection risk
 * from this function despite building a fully dynamic catalog query.
 *
 * Restricted to the `public` schema, matching this repo's convention of never
 * using non-default PostgreSQL schemas for application tables.
 *
 * @example
 * ```ts
 * const fks = await getInboundForeignKeys({ db, table: 'amenities' });
 * // [{ referencingTable: 'r_accommodation_amenity', referencingColumn: 'amenity_id', referencedColumn: 'id', constraintName: '...' }, ...]
 * ```
 */
export const getInboundForeignKeys = async (args: {
    readonly db: DrizzleClient;
    readonly table: string;
}): Promise<InboundFk[]> => {
    const { db, table } = args;

    const result = await db.execute<{
        constraint_name: string;
        referencing_table: string;
        referencing_column: string;
        referenced_column: string;
    }>(sql`
        SELECT
            con.conname AS constraint_name,
            rel_referencing.relname AS referencing_table,
            att_referencing.attname AS referencing_column,
            att_referenced.attname AS referenced_column
        FROM pg_constraint con
        JOIN pg_class rel_referencing ON rel_referencing.oid = con.conrelid
        JOIN pg_class rel_referenced ON rel_referenced.oid = con.confrelid
        JOIN pg_namespace ns_referenced ON ns_referenced.oid = rel_referenced.relnamespace
        JOIN LATERAL unnest(con.conkey, con.confkey)
            AS cols(referencing_attnum, referenced_attnum) ON true
        JOIN pg_attribute att_referencing
            ON att_referencing.attrelid = con.conrelid
            AND att_referencing.attnum = cols.referencing_attnum
        JOIN pg_attribute att_referenced
            ON att_referenced.attrelid = con.confrelid
            AND att_referenced.attnum = cols.referenced_attnum
        WHERE con.contype = 'f'
          AND ns_referenced.nspname = 'public'
          AND rel_referenced.relname = ${table}
        ORDER BY con.conname, cols.referencing_attnum
    `);

    return result.rows.map((row) => ({
        referencingTable: row.referencing_table,
        referencingColumn: row.referencing_column,
        referencedColumn: row.referenced_column,
        constraintName: row.constraint_name
    }));
};

/**
 * Counts how many rows across every inbound foreign key currently reference a
 * specific row of `table`, identified by `primaryKeyColumn` + `primaryKeyValue`.
 *
 * This is the primitive T-007's `safeDelete` uses to decide "0 active refs ->
 * deletable": call this first, and only proceed with the physical `DELETE` when
 * `result.total === 0`. See the module JSDoc for the split of responsibilities.
 *
 * ### Composite-FK caveat
 *
 * This function filters {@link getInboundForeignKeys}'s output down to FK
 * column pairs whose `referencedColumn` matches `primaryKeyColumn`, then
 * counts `referencingTable` rows where `referencingColumn = primaryKeyValue`.
 * For a **single-column** FK this is exact. For a **composite** FK (one
 * `constraintName` with multiple column pairs) that happens to include
 * `primaryKeyColumn` among its referenced columns, this counts rows matching
 * ONLY that one column — it does NOT verify the other columns of the
 * composite key also match. That can overcount (a referencing row whose other
 * composite-key column(s) point elsewhere still gets counted here). No
 * composite FK exists in this codebase's schema today referencing a
 * single-primary-key table this way, so it is a documented limitation rather
 * than a fix — flagged explicitly for T-007 to decide whether it needs
 * full composite-match counting before relying on this for a composite-keyed
 * target table.
 *
 * ### Self-referencing FK caveat
 *
 * If `table` has a self-referencing FK (e.g. a `parentId` column pointing at
 * the same table's `id`), `referencingTable === table` and this function does
 * NOT exclude the target row's own FK column from the count. A row cannot
 * reference itself via a real parent/child edge in practice (that would be a
 * cycle), so this is expected to be a non-issue in practice, but it is not
 * defended against here.
 *
 * @example
 * ```ts
 * const { total, byConstraint } = await countActiveReferences({
 *   db,
 *   table: 'amenities',
 *   primaryKeyColumn: 'id',
 *   primaryKeyValue: amenityId,
 * });
 * if (total === 0) {
 *   // safe to hard-delete
 * }
 * ```
 */
export const countActiveReferences = async (args: {
    readonly db: DrizzleClient;
    readonly table: string;
    readonly primaryKeyColumn: string;
    readonly primaryKeyValue: string | number;
}): Promise<CountActiveReferencesResult> => {
    const { db, table, primaryKeyColumn, primaryKeyValue } = args;

    const inboundFks = await getInboundForeignKeys({ db, table });
    const relevantFks = inboundFks.filter((fk) => fk.referencedColumn === primaryKeyColumn);

    const byConstraint = await Promise.all(
        relevantFks.map(async (fk): Promise<ActiveReferenceCount> => {
            // `fk.referencingTable` / `fk.referencingColumn` never come from
            // caller input — they are discovered from the pg catalog above —
            // but `sql.identifier()` is still used (rather than raw string
            // concatenation) so the identifiers are always correctly quoted.
            const result = await db.execute<{ count: string }>(sql`
                SELECT COUNT(*) AS count
                FROM ${sql.identifier(fk.referencingTable)}
                WHERE ${sql.identifier(fk.referencingColumn)} = ${primaryKeyValue}
            `);

            return {
                constraintName: fk.constraintName,
                referencingTable: fk.referencingTable,
                count: Number(result.rows[0]?.count ?? 0)
            };
        })
    );

    const total = byConstraint.reduce((sum, entry) => sum + entry.count, 0);

    return { total, byConstraint };
};
