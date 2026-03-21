import {
    type SQL,
    type SQLWrapper,
    and,
    asc,
    desc,
    eq,
    gte,
    ilike,
    isNull,
    lte,
    or
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { dbLogger } from './logger.ts';

/**
 * Operator suffix convention for where clause values.
 * Keys ending with these suffixes trigger special operators instead of eq().
 *
 * - `_like` suffix: Uses ilike (case-insensitive LIKE with % wildcards)
 *   Example: `{ name_like: 'hotel' }` generates `WHERE name ILIKE '%hotel%'`
 * - `_gte` suffix: Uses >= comparison
 *   Example: `{ price_gte: 100 }` generates `WHERE price >= 100`
 * - `_lte` suffix: Uses <= comparison
 *   Example: `{ price_lte: 500 }` generates `WHERE price <= 500`
 */

/**
 * Builds a WHERE clause for Drizzle ORM from a plain object.
 *
 * Supports:
 * - Direct equality: `{ column: value }` -> `WHERE column = value`
 * - Null check: `{ column: null }` -> `WHERE column IS NULL`
 * - Case-insensitive search: `{ column_like: 'text' }` -> `WHERE column ILIKE '%text%'`
 * - Greater than or equal: `{ column_gte: value }` -> `WHERE column >= value`
 * - Less than or equal: `{ column_lte: value }` -> `WHERE column <= value`
 *
 * @param where - Filter object with key-value pairs
 * @param table - Drizzle table schema object
 * @returns SQL clause for Drizzle .where(), or undefined if no filters
 */
export function buildWhereClause(where: Record<string, unknown>, table: unknown): SQL | undefined {
    if (typeof table !== 'object' || table === null) return undefined;
    const tableRecord = table as Record<string, unknown>;
    const unknownKeys: string[] = [];

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
                unknownKeys.push(key);
                return undefined;
            }

            // Handle _gte suffix for >= comparisons
            if (key.endsWith('_gte')) {
                const columnName = key.slice(0, -4);
                if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
                    const column = tableRecord[columnName] as PgColumn;
                    return gte(column, value);
                }
                unknownKeys.push(key);
                return undefined;
            }

            // Handle _lte suffix for <= comparisons
            if (key.endsWith('_lte')) {
                const columnName = key.slice(0, -4);
                if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
                    const column = tableRecord[columnName] as PgColumn;
                    return lte(column, value);
                }
                unknownKeys.push(key);
                return undefined;
            }

            if (Object.prototype.hasOwnProperty.call(tableRecord, key)) {
                const column = tableRecord[key] as SQLWrapper;
                if (value === null) {
                    return isNull(column);
                }
                return eq(column, value);
            }
            unknownKeys.push(key);
            return undefined;
        })
        .filter(Boolean);

    if (unknownKeys.length > 0) {
        const tableName =
            (table as Record<symbol, string>)[Symbol.for('drizzle:Name')] ?? 'unknown';
        for (const key of unknownKeys) {
            dbLogger.warn(
                { key, tableName },
                'buildWhereClause: key does not match any table column, skipping'
            );
        }
    }

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

/**
 * Builds an OR search condition across multiple columns using ILIKE.
 *
 * @param term - The search term to match
 * @param columns - Array of column names to search across
 * @param table - Drizzle table schema object
 * @returns SQL OR clause, or undefined if no valid columns found
 */
export function buildSearchCondition(
    term: string,
    columns: readonly string[],
    table: unknown
): SQL | undefined {
    if (!term || term.trim().length === 0) return undefined;
    if (typeof table !== 'object' || table === null) return undefined;

    const tableRecord = table as Record<string, unknown>;
    const trimmedTerm = term.trim();

    const conditions = columns
        .filter((col) => Object.prototype.hasOwnProperty.call(tableRecord, col))
        .map((col) => {
            const column = tableRecord[col] as PgColumn;
            return ilike(column, `%${trimmedTerm}%`);
        });

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return or(...conditions);
}
