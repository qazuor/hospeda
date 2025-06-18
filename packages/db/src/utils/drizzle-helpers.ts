import { type SQL, and, eq } from 'drizzle-orm';

/**
 * Builds a WHERE clause for Drizzle ORM from a plain object.
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
            if (Object.prototype.hasOwnProperty.call(tableRecord, key)) {
                // @ts-expect-error: dynamic access to Drizzle column
                return eq(tableRecord[key], value);
            }
            return undefined;
        })
        .filter(Boolean);
    if (clauses.length === 0) return undefined;
    if (clauses.length === 1) return clauses[0];
    return and(...clauses);
}
