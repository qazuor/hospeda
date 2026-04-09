import {
    type SQL,
    type SQLWrapper,
    type Table,
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
import { DbError } from './error.ts';
import { dbLogger } from './logger.ts';

/**
 * Escapes PostgreSQL LIKE/ILIKE wildcard metacharacters in a user-provided search term.
 *
 * PostgreSQL LIKE uses three metacharacters:
 * - `%` matches zero or more characters
 * - `_` matches exactly one character
 * - `\` is the default escape character
 *
 * This function escapes all three so the term is matched literally.
 * The backslash MUST be escaped first to avoid double-escaping.
 *
 * @param term - Raw user-provided search term
 * @returns Escaped term safe for interpolation into a LIKE/ILIKE pattern
 *
 * @example
 * ```ts
 * escapeLikePattern('10%')      // '10\\%'
 * escapeLikePattern('test_data') // 'test\\_data'
 * escapeLikePattern('C:\\Users') // 'C:\\\\Users'
 * escapeLikePattern('normal')    // 'normal' (unchanged)
 * ```
 */
export function escapeLikePattern(term: string): string {
    return term
        .replace(/\\/g, '\\\\') // Escape backslash FIRST (order matters)
        .replace(/%/g, '\\%') // Escape percent
        .replace(/_/g, '\\_'); // Escape underscore
}

/**
 * Safe wrapper around Drizzle's `ilike()` that automatically escapes LIKE
 * wildcard metacharacters (`%`, `_`, `\`) in user-provided search terms.
 *
 * Equivalent to: `ilike(column, \`%${escapeLikePattern(term)}%\`)`
 *
 * Always use this instead of raw `ilike()` to prevent LIKE wildcard injection.
 * The only place that should import `ilike` directly from `drizzle-orm` is this file.
 *
 * @param column - Drizzle column reference
 * @param term - Raw user-provided search term (will be escaped and wrapped with %)
 * @returns SQL condition for use in WHERE clauses
 *
 * @example
 * ```ts
 * // Before:
 * ilike(users.name, `%${escapeLikePattern(q)}%`)
 *
 * // After:
 * safeIlike(users.name, q)
 * ```
 */
export function safeIlike(column: PgColumn, term: string): SQL {
    return ilike(column, `%${escapeLikePattern(term)}%`);
}

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
export function buildWhereClause(where: Record<string, unknown>, table: Table): SQL | undefined {
    if (typeof table !== 'object' || table === null) return undefined;
    const tableRecord = table as unknown as Record<string, unknown>;
    const unknownKeys: string[] = [];

    const clauses = Object.entries(where)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
            // Handle _like suffix for ilike queries
            if (key.endsWith('_like') && typeof value === 'string') {
                const columnName = key.slice(0, -5);
                if (Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
                    const column = tableRecord[columnName] as SQLWrapper;
                    return safeIlike(column as PgColumn, value);
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
                if (
                    typeof value === 'object' &&
                    !Array.isArray(value) &&
                    !(value instanceof Date)
                ) {
                    throw new DbError(
                        'unknown',
                        'buildWhereClause',
                        { key, value },
                        `buildWhereClause: value for key "${key}" is a plain object. Use ilike()/eq() directly via additionalConditions instead of passing objects in the where clause.`
                    );
                }
                return eq(column, value);
            }
            unknownKeys.push(key);
            return undefined;
        })
        .filter(Boolean);

    if (unknownKeys.length > 0) {
        const tableName =
            (table as unknown as Record<symbol, string>)[Symbol.for('drizzle:Name')] ?? 'unknown';
        for (const key of unknownKeys) {
            dbLogger.warn(
                { key, tableName },
                'buildWhereClause: key does not match any table column, skipping'
            );
        }
    }

    if (clauses.length === 0 && Object.keys(where).length > 0) {
        throw new DbError(
            'unknown',
            'buildWhereClause',
            where,
            `All ${Object.keys(where).length} key(s) in where clause were unknown columns — likely a programming error. Keys: ${Object.keys(where).join(', ')}`
        );
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
    table: Table,
    sortOrder: 'asc' | 'desc' = 'asc'
): SQL | undefined {
    if (typeof table !== 'object' || table === null) return undefined;
    const tableRecord = table as unknown as Record<string, unknown>;

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
    table: Table
): SQL | undefined {
    if (!term || term.trim().length === 0) return undefined;
    if (typeof table !== 'object' || table === null) return undefined;

    const tableRecord = table as unknown as Record<string, unknown>;
    const trimmedTerm = term.trim();

    const conditions = columns
        .filter((col) => Object.prototype.hasOwnProperty.call(tableRecord, col))
        .map((col) => {
            const column = tableRecord[col] as PgColumn;
            return safeIlike(column, trimmedTerm);
        });

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return or(...conditions);
}
