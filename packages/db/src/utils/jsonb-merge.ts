import type { SQL, Table } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Builds a Drizzle `set` object for an UPDATE statement where columns listed in
 * `mergeableColumns` are merged with the existing JSONB value via the `||` operator
 * instead of being replaced wholesale.
 *
 * For each key in `data`:
 * - If the key is in `mergeableColumns` AND the table has that column AND the value is
 *   not `null`, the assignment becomes `COALESCE(column, '{}'::jsonb) || <value>::jsonb`
 *   (PostgreSQL shallow JSONB merge). The `COALESCE` is required because the bare `||`
 *   operator returns SQL `NULL` when the existing column value is `NULL`
 *   (`NULL || '{...}'::jsonb` → `NULL`), which would silently drop the patch on any
 *   nullable JSONB column that has not been set yet. Coalescing to an empty object
 *   makes the merge start from `{}` so the patch always lands.
 * - Otherwise the plain value is used (standard replacement). In particular, a `null`
 *   value for a mergeable column falls through to plain assignment so the column is set
 *   to SQL `NULL` (explicit clear). This is deliberate: `existing::jsonb || 'null'::jsonb`
 *   does NOT clear — PostgreSQL treats it as array concatenation and yields the corrupt
 *   value `[<existing>, null]`. Routing `null` through plain assignment gives the correct
 *   "clear the whole column" semantics callers expect.
 *
 * **Semantics of `||` (shallow merge):**
 * The PostgreSQL `||` operator on two JSONB objects produces a new object containing
 * all keys from both sides. When a key exists in both, the right operand wins. This
 * is a *shallow* merge — nested objects at the same key are replaced, not recursively
 * merged. Example:
 * ```sql
 * '{"a": 1, "b": 2}'::jsonb || '{"b": 99, "c": 3}'::jsonb
 * -- → '{"a": 1, "b": 99, "c": 3}'
 * ```
 *
 * @param data - Partial entity fields to apply as an update patch.
 * @param table - The Drizzle table object that owns the columns.
 * @param mergeableColumns - Column names (camelCase Drizzle property keys) that should
 *   use JSONB merge semantics instead of plain replacement.
 * @returns A plain object suitable for passing directly to `.set()`.
 *
 * @example
 * ```ts
 * const setClause = buildMergeSetClause(
 *   { media: { gallery: [] }, name: 'Updated' },
 *   accommodations,
 *   ['media']
 * );
 * // setClause.media → sql`COALESCE(accommodations.media, '{}'::jsonb) || '{"gallery":[]}'::jsonb`
 * // setClause.name  → 'Updated'
 * ```
 */
export function buildMergeSetClause(
    data: Record<string, unknown>,
    table: Table,
    mergeableColumns: readonly string[]
): Record<string, unknown | SQL> {
    const result: Record<string, unknown | SQL> = {};
    const tableRecord = table as unknown as Record<string, unknown>;

    for (const [key, value] of Object.entries(data)) {
        if (mergeableColumns.includes(key) && key in tableRecord && value !== null) {
            // Use PostgreSQL JSONB || operator for shallow merge.
            // JSON.stringify is safe here: value comes from a typed Partial<T> patch.
            result[key] =
                sql`COALESCE(${tableRecord[key] as SQL}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`;
        } else {
            // Plain assignment — including `null`, which clears the column (see JSDoc).
            result[key] = value;
        }
    }

    return result;
}
