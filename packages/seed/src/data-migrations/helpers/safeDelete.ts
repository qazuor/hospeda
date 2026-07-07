/**
 * @fileoverview
 * FK-guarded, operator-edit-aware hard delete (HOS-25, T-007).
 *
 * This is the SECOND HALF of the FK-guarded hard-delete helper described in
 * `.specs/HOS-25-versioned-seed-data-migrations/spec.md` §3.3/§6.2/§6.5/G-4
 * and risk R-3. `fkGuard.ts` (T-006) provides the inbound-FK introspection
 * primitive ({@link countActiveReferences}); this module builds the actual
 * guarded `DELETE` on top of it and adds the second guard — operator-edit
 * detection — before ever issuing a physical delete.
 *
 * `safeDelete` is what a data-migration's `up()` calls — via
 * `ctx.helpers.safeDelete` (the context factory, `../context.ts`, T-005,
 * binds this function to the migration's transaction-scoped `db` as a
 * closure) or via a direct import when a caller already holds its own `db`
 * handle outside a migration context — instead of hand-rolling a raw
 * `DELETE`. It NEVER cascades: if either guard trips, the delete is withheld
 * and a structured skip reason is returned and logged.
 *
 * ### Single-row contract
 *
 * `safeDelete` targets **exactly one row per call**:
 *
 * - If `where` matches **zero** rows, this is treated as a no-op success:
 *   the desired end state (row absent) already holds, so it returns
 *   `{ deleted: true }` without touching anything. This matters for
 *   idempotent-migration-authoring ergonomics — a migration author does not
 *   need to guard "does this row still exist?" before calling `safeDelete`.
 * - If `where` matches **more than one** row, this is a caller usage error
 *   (an under-specified `where` clause), not a data-state condition, so it
 *   throws rather than silently deleting/skipping multiple rows. Migration
 *   authors must narrow `where` to identify a single row (typically by
 *   primary key or another unique column).
 *
 * ### `ctx.helpers.safeDelete` vs direct import
 *
 * `SeedMigrationHelpers.safeDelete` (in `../types.ts`) is typed as
 * `SafeDeleteFn = (args: SafeDeleteArgs) => Promise<SafeDeleteResult>`, and
 * `SafeDeleteArgs` includes the same optional `isOperatorEdited` field this
 * module's {@link safeDelete} accepts — so a migration calling
 * `ctx.helpers.safeDelete({ table, where, reason, isOperatorEdited })` gets
 * full operator-edit-guard support with no extra step. This module's
 * {@link SafeDeleteInput} is a strict superset of `SafeDeleteArgs`, adding
 * only `db` (required — supplied automatically by the context factory's
 * closure when called via `ctx.helpers.safeDelete`).
 *
 * A migration author only needs to import {@link safeDelete} directly
 * (bypassing `ctx.helpers.safeDelete`) when calling it OUTSIDE a migration
 * context entirely (no `ctx` available) — in that case pass `db` explicitly
 * alongside the same `table`/`where`/`reason`/`isOperatorEdited` fields. See
 * {@link IsOperatorEditedPredicate}'s JSDoc (in `../types.ts`) for a worked
 * `billing_plans` Model C example.
 *
 * @module data-migrations/helpers/safeDelete
 */
import type { DrizzleClient } from '@repo/db';
import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import type { IsOperatorEditedPredicate, SafeDeleteArgs, SafeDeleteResult } from '../types.js';
import { countActiveReferences } from './fkGuard.js';

/**
 * Re-exported for callers that import the predicate type from this module
 * (its original home before T-005). {@link IsOperatorEditedPredicate} is now
 * defined ONCE in `../types.ts` (the shared contract file) — see that
 * declaration's JSDoc for the full predicate contract, including the
 * raw-snake_case-column contract, the documented "omitted = not
 * operator-edited" default, and the `billing_plans` (Model C) /
 * amenities-opt-out worked examples.
 */
export type { IsOperatorEditedPredicate };

/**
 * Arguments accepted by {@link safeDelete}. A strict superset of
 * {@link SafeDeleteArgs} (`table`, `where`, `reason`), adding:
 *
 * - `db` (required) — the active Drizzle client. Always pass the
 *   transaction-scoped client the runner (T-009) hands the migration via
 *   `ctx.db`; never a fresh top-level connection, or the delete/guard reads
 *   would run outside the migration's transaction.
 * - `isOperatorEdited` (optional) — see {@link IsOperatorEditedPredicate}.
 */
export interface SafeDeleteInput extends SafeDeleteArgs {
    /** Active Drizzle client — pass the transaction-scoped client, not a fresh connection. */
    readonly db: DrizzleClient;

    /**
     * Optional operator-edit detection predicate. See
     * {@link IsOperatorEditedPredicate}.
     *
     * **Default when omitted**: the row is treated as NOT operator-edited,
     * so deletion proceeds as long as the FK guard also clears it. This is a
     * conscious, documented choice — most catalog rows this helper targets
     * (amenities, features, tags, etc.) have no operator-edit surface at
     * all, so requiring every caller to supply a predicate would be pure
     * ceremony for the common case. Tables that DO have a meaningful
     * provenance signal (e.g. `billing_plans`, via the Model C commercial
     * layer) should always pass an explicit predicate. Whenever the default
     * applies, an info-level log line is emitted so the choice is visible in
     * migration run output, not silent.
     *
     * @default undefined (treated as "not operator-edited")
     */
    readonly isOperatorEdited?: IsOperatorEditedPredicate;
}

/**
 * FK-guarded, operator-edit-aware hard delete. Centralizes both safety
 * checks — active inbound FK references (T-006's {@link countActiveReferences})
 * and operator-edit provenance (this module) — so no individual data-migration
 * hand-rolls deletion safety or accidentally cascades a delete.
 *
 * Order of operations:
 *
 * 1. Resolve the table's name and single primary-key column (throws if the
 *    table has zero or more than one primary-key column — composite and
 *    missing-PK tables are out of scope, matching {@link countActiveReferences}'s
 *    documented composite-FK caveat).
 * 2. Run `where` against `table` to find the target row.
 *    - Zero matches → no-op success, `{ deleted: true }` (see the module
 *      JSDoc's "Single-row contract" section).
 *    - More than one match → throws (caller usage error).
 * 3. FK guard: {@link countActiveReferences} on the resolved primary-key
 *    value. `total > 0` → withhold the delete, return a skip result naming
 *    every blocking table. **Never cascades.**
 * 4. Operator-edit guard: `isOperatorEdited(row)` (or the documented default
 *    of `false` when omitted). `true` → withhold the delete, return a skip
 *    result.
 * 5. Only when BOTH guards clear → issue the physical `DELETE` using the
 *    SAME `db` handle passed in (no new transaction is opened — safe to call
 *    inside an existing transaction, matching `ledger.ts`'s `recordApplied`
 *    convention).
 *
 * Every skip is also logged as a warning via `@repo/logger` (the seed
 * package's shared `logger`), so a migration run's console/CI output makes
 * withheld deletes visible without the caller having to inspect the return
 * value.
 *
 * @param args - RO-RO input. See {@link SafeDeleteInput}.
 * @returns `{ deleted: true }` when the row was deleted (or was already
 *   absent); `{ deleted: false, skipped: true, reason }` when either guard
 *   withheld the delete.
 *
 * @example
 * ```ts
 * const result = await safeDelete({
 *   db: ctx.db,
 *   table: featuresTable,
 *   where: eq(featuresTable.slug, 'legacy-feature'),
 *   reason: 'Superseded by SPEC-266 amenity/feature catalog rework',
 * });
 * if (!result.deleted) {
 *   // result.reason explains why (FK reference or operator-edit)
 * }
 * ```
 */
export async function safeDelete(args: SafeDeleteInput): Promise<SafeDeleteResult> {
    const { db, table, where, reason, isOperatorEdited } = args;

    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    const primaryKeyColumns = Object.values(columns).filter((column) => column.primary);

    if (primaryKeyColumns.length !== 1) {
        throw new Error(
            `safeDelete only supports tables with exactly one primary-key column; "${tableName}" has ${primaryKeyColumns.length}. Composite or missing primary keys are out of scope (see fkGuard.ts's composite-FK caveat).`
        );
    }

    const primaryKeyColumnName = primaryKeyColumns[0]?.name as string;

    const matchResult = await db.execute<Record<string, unknown>>(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${where}`
    );

    if (matchResult.rows.length === 0) {
        logger.info(
            `safeDelete: no row in "${tableName}" matched the where-clause — nothing to delete (already absent). Reason context: ${reason}`
        );
        return { deleted: true };
    }

    if (matchResult.rows.length > 1) {
        throw new Error(
            `safeDelete targets exactly one row per call; the where-clause matched ${matchResult.rows.length} rows in "${tableName}". Narrow the where-clause to identify a single row (e.g. by primary key or another unique column).`
        );
    }

    const row = matchResult.rows[0] as Record<string, unknown>;
    const primaryKeyValue = row[primaryKeyColumnName];

    if (typeof primaryKeyValue !== 'string' && typeof primaryKeyValue !== 'number') {
        throw new Error(
            `safeDelete could not resolve a usable primary-key value for "${tableName}.${primaryKeyColumnName}" (got ${typeof primaryKeyValue}).`
        );
    }

    // ── Guard 1: active inbound FK references (T-006) ───────────────────────
    const { total, byConstraint } = await countActiveReferences({
        db,
        table: tableName,
        primaryKeyColumn: primaryKeyColumnName,
        primaryKeyValue
    });

    if (total > 0) {
        const blockers = byConstraint
            .filter((entry) => entry.count > 0)
            .map((entry) => `${entry.count} in "${entry.referencingTable}"`)
            .join(', ');
        const skipReason = `${total} active FK reference(s) block delete of "${tableName}" (pk=${primaryKeyValue}): ${blockers}. Original reason: ${reason}`;
        logger.warn(`safeDelete: skipped — ${skipReason}`);
        return { deleted: false, skipped: true, reason: skipReason };
    }

    // ── Guard 2: operator-edit provenance ────────────────────────────────────
    if (!isOperatorEdited) {
        logger.info(
            `safeDelete: no isOperatorEdited predicate supplied for "${tableName}" — defaulting to NOT operator-edited (most catalog rows have no operator-edit surface). Pass isOperatorEdited to opt into provenance-aware skipping.`
        );
    }
    const wasOperatorEdited = isOperatorEdited ? isOperatorEdited(row) : false;

    if (wasOperatorEdited) {
        const skipReason = `operator-edited: row in "${tableName}" (pk=${primaryKeyValue}) was flagged by the supplied isOperatorEdited predicate — delete withheld to avoid clobbering a manual/operator change. Original reason: ${reason}`;
        logger.warn(`safeDelete: skipped — ${skipReason}`);
        return { deleted: false, skipped: true, reason: skipReason };
    }

    // ── Both guards cleared — issue the physical DELETE ──────────────────────
    await db.execute(sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${where}`);

    return { deleted: true };
}
