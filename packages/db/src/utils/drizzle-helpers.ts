import { type SQL, type SQLWrapper, and, asc, desc, eq, ilike, isNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Operator suffix convention for where clause values.
 * Keys ending with these suffixes trigger special operators instead of eq().
 *
 * - `_like` suffix: Uses ilike (case-insensitive LIKE with % wildcards)
 *   Example: `{ name_like: 'hotel' }` generates `WHERE name ILIKE '%hotel%'`
 */

/**
 * Builds a WHERE clause for Drizzle ORM from a plain object.
 *
 * Supports:
 * - Direct equality: `{ column: value }` -> `WHERE column = value`
 * - Null check: `{ column: null }` -> `WHERE column IS NULL`
 * - Case-insensitive search: `{ column_like: 'text' }` -> `WHERE column ILIKE '%text%'`
 *
 * @param where - Filter object with key-value pairs
 * @param table - Drizzle table schema object
 * @returns SQL clause for Drizzle .where(), or undefined if no filters
 */
export function buildWhereClause(where: Record<string, unknown>, table: unknown): SQL | undefined {
    if (typeof table !== 'object' || table === null) return undefined;
    const tableRecord = table as Record<string, unknown>;
    const clauses = Object.entries(where)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
            // Handle _like suffix for ilike queries
            if (key.endsWith('_like') && typeof value === 'string') {
                const columnName = key.slice(0, -5);
                if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
                    const column = tableRecord[columnName] as SQLWrapper;
                    return ilike(column as PgColumn, `%${value}%`);
                }
                return undefined;
            }

            if (Object.prototype.hasOwnProperty.call(tableRecord, key)) {
                const column = tableRecord[key] as SQLWrapper;
                if (value === null) {
                    return isNull(column);
                }
                return eq(column, value);
            }
            return undefined;
        })
        .filter(Boolean);
    if (clauses.length === 0) return undefined;
    if (clauses.length === 1) return clauses[0];
    return and(...clauses);
}

/**
 * Builds an ORDER BY clause for Drizzle ORM.
 *
 * @param sortBy - Column name to sort by
 * @param sortOrder - Sort direction ('asc' or 'desc'), defaults to 'asc'
 * @param table - Drizzle table schema object
 * @returns SQL order clause for Drizzle .orderBy(), or undefined if invalid
 */
export function buildOrderByClause(
    sortBy: string,
    table: unknown,
    sortOrder: 'asc' | 'desc' = 'asc'
): SQL | undefined {
    if (typeof table !== 'object' || table === null) return undefined;
    const tableRecord = table as Record<string, unknown>;

    if (!Object.prototype.hasOwnProperty.call(tableRecord, sortBy)) {
        return undefined;
    }

    const column = tableRecord[sortBy] as PgColumn;
    return sortOrder === 'desc' ? desc(column) : asc(column);
}
