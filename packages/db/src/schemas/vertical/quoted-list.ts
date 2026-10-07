import { sql } from 'drizzle-orm';

/**
 * Builds a raw SQL fragment `'a', 'b', 'c'` from closed-list values, for CHECK
 * constraints of the form `col IN (...)`. Values come from code constants, never
 * from user input.
 *
 * @param values - The closed-list members to quote.
 * @returns A raw SQL fragment listing the quoted members.
 */
export function quotedList(values: readonly string[]): ReturnType<typeof sql.raw> {
    return sql.raw(values.map((v) => `'${v}'`).join(', '));
}
