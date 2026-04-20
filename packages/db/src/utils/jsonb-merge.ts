import type { SQL, Table } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Builds a Drizzle `set` object for an UPDATE statement where columns listed in
 * `mergeableColumns` are merged with the existing JSONB value via the `||` operator
 * instead of being replaced wholesale.
 *
 * For each key in `data`:
 * - If the key is in `mergeableColumns` AND the table has that column, the assignment
 *   becomes `column || <value>::jsonb` (PostgreSQL shallow JSONB merge).
 * - Otherwise the plain value is used (standard replacement).
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
 * // setClause.media → sql`accommodations.media || '{"gallery":[]}'::jsonb`
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
        if (mergeableColumns.includes(key) && key in tableRecord) {
            // Use PostgreSQL JSONB || operator for shallow merge.
            // JSON.stringify is safe here: value comes from a typed Partial<T> patch.
            result[key] = sql`${tableRecord[key] as SQL}::jsonb || ${JSON.stringify(value)}::jsonb`;
        } else {
            result[key] = value;
        }
    }

    return result;
}
