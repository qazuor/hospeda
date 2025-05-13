import { logger } from '@repo/logger';
import type { AccommodationType, UserType } from '@repo/types';

/**
 * Utility helpers for database-level operations.
 * Placeholder for future common queries, helpers, or composition utilities.
 */
export function logQueryStart(operation: string) {
    logger.info(`[DB] Executing: ${operation}`);
}

/**
 * Converts a TypeScript string enum to a readonly string tuple
 * that Drizzle ORM expects in column enum definition.
 */
export function enumToTuple<T extends Record<string, string>>(e: T): [string, ...string[]] {
    const values = Object.values(e);
    if (values.length === 0) throw new Error('Enum must have at least one value');
    return values as [string, ...string[]];
}

/**
 * Cast enum fields for a batch of DB rows.
 *
 * @template T - Type of the row object
 * @param rows Array of rows from DB
 * @param enumMap Object mapping field keys to corresponding enum objects
 * @returns A new array with corrected enum values
 *
 * @example
 * castRowsEnums(rows, { state: StateEnum, category: CategoryEnum })
 */
export function castRowsEnums<T extends object>(
    rows: T[],
    enumMap: Partial<Record<keyof T, Record<string, string>>>
): T[] {
    return rows.map((row) => {
        const newRow = { ...row };

        for (const [key, enumObj] of Object.entries(enumMap)) {
            const value = newRow[key as keyof T];
            if (typeof value === 'string' && enumObj && Object.values(enumObj).includes(value)) {
                newRow[key as keyof T] = value;
            }
        }

        return newRow as T;
    });
}

/**
 * Cast a single row's enum fields using `castRowsEnums`
 *
 * @template T - Type of the row
 * @param row A single row or undefined
 * @param enumMap Mapping of fields to enum objects
 * @returns Row with corrected enum values or undefined
 *
 * @example
 * castSingleRowEnum(row, { state: StateEnum })
 */
export function castSingleRowEnum<T extends object>(
    row: T | undefined,
    enumMap: Partial<Record<keyof T, Record<string, string>>>
): T | undefined {
    return row ? castRowsEnums([row], enumMap)[0] : undefined;
}

/**
 * Remove undefined properties from an object (for safe DB updates).
 *
 * @template T - Input object type
 * @param input Partial object
 * @returns A copy without undefined values
 *
 * @example
 * sanitizePartialUpdate({ name: "John", age: undefined }) // { name: "John" }
 */
export function sanitizePartialUpdate<T extends object>(input: Partial<T>): Partial<T> {
    return Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
}

/**
 * Ensure a row exists, otherwise throws an error
 *
 * @template T - Any value
 * @param value The value to check
 * @param msg Optional error message
 * @returns The original value if not undefined/null
 * @throws Error if value is undefined or null
 *
 * @example
 * const user = assertExists(await getUser(id), 'User not found')
 */
export function assertExists<T>(value: T | undefined | null, msg = 'Not found'): T {
    if (value === undefined || value === null) throw new Error(msg);
    return value;
}

/**
 * Escape a term for ILIKE and wrap with % for fuzzy search.
 *
 * @param term Raw search string
 * @returns Sanitized LIKE pattern
 *
 * @example
 * prepareLikeQuery("caf\u00e9") // "%caf\u00e9%"
 */
export function prepareLikeQuery(term: string): string {
    return `%${term.replace(/[%_]/g, '\\$&')}%`;
}

/**
 * Omit selected fields from an object.
 *
 * @template T - Input object
 * @param obj Object to omit from
 * @param fields Keys to omit
 * @returns New object without omitted keys
 *
 * @example
 * omitFields(user, ['passwordHash'])
 */
export function omitFields<T extends object>(obj: T, fields: (keyof T)[]): Partial<T> {
    const clone = { ...obj };
    for (const field of fields) {
        delete clone[field];
    }
    return clone;
}

/**
 * Pick only selected fields from an object.
 *
 * @template T - Input object
 * @param obj Object to pick from
 * @param fields Keys to pick
 * @returns New object with only selected keys
 *
 * @example
 * pickFields(user, ['id', 'email'])
 */
export function pickFields<T extends object>(obj: T, fields: (keyof T)[]): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([k]) => fields.includes(k as keyof T))
    ) as Partial<T>;
}

/**
 * Check if a value exists in a given enum.
 *
 * @template T - Enum object
 * @param value Raw string
 * @param enumObj Enum definition
 * @returns True if value is in enum
 *
 * @example
 * isEnumValue('ADMIN', RoleEnum) // true
 */
export function isEnumValue<T extends Record<string, string>>(
    value: string,
    enumObj: T
): value is T[keyof T] {
    return Object.values(enumObj).includes(value as T[keyof T]);
}

/**
 * Remove all null/undefined keys from an object.
 *
 * @template T - Input object
 * @param obj Object to clean
 * @returns New object without null/undefined values
 *
 * @example
 * removeNulls({ a: 1, b: null, c: undefined }) // { a: 1 }
 */
export function removeNulls<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
    ) as Partial<T>;
}

/**
 * Chunk an array into smaller arrays of a given size.
 *
 * @template T - Array element type
 * @param array Input array
 * @param size Chunk size
 * @returns Array of arrays
 *
 * @example
 * chunkArray([1,2,3,4], 2) // [[1,2],[3,4]]
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

/**
 * Group an array by a key.
 *
 * @template T - Element type
 * @param array Input array
 * @param key Key to group by
 * @returns Grouped object
 *
 * @example
 * groupBy(users, 'roleId') // { ADMIN: [...], USER: [...] }
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
        (acc, item) => {
            const group = item[key] as string;
            if (!acc[group]) acc[group] = [];
            acc[group].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}

/**
 * Casts all JSONB fields in an accommodation row to their proper types.
 * Ensures compatibility with AccommodationType.
 *
 * @param row - Accommodation record with unknown jsonb fields
 * @returns AccommodationType with casted jsonb fields
 */
export function castAccommodationJsonFields<T extends { [key: string]: unknown }>(
    row: T
): Partial<AccommodationType> {
    return {
        ...row,
        contactInfo: row.contactInfo as AccommodationType['contactInfo'],
        socialNetworks: row.socialNetworks as AccommodationType['socialNetworks'],
        price: row.price as AccommodationType['price'],
        location: row.location as AccommodationType['location'],
        media: row.media as AccommodationType['media'],
        rating: row.rating as AccommodationType['rating'],
        type: row.type as AccommodationType['type'],
        state: row.state as AccommodationType['state']
    };
}

/**
 * Casts all JSONB fields in a user row.
 */
export function castUserJsonFields<T extends { [key: string]: unknown }>(
    row: T
): Partial<UserType> {
    return {
        ...row,
        contactInfo: row.contactInfo as UserType['contactInfo'],
        socialNetworks: row.socialNetworks as UserType['socialNetworks'],
        profile: row.profile as UserType['profile'],
        settings: row.settings as UserType['settings'],
        state: row.state as UserType['state']
    };
}

/**
 * Cast the result of a Drizzle `.returning()` call to a typed array.
 *
 * @template T - The expected row type.
 * @param rows - The raw result from `await db.insert(...).returning()`
 * @returns An array of T
 *
 * @example
 * const inserted = castReturning<UserRecord>(await db.insert(users).values(data).returning());
 */
export function castReturning<T>(rows: unknown): T[] {
    return rows as T[];
}

/**
 * Wrap a Drizzle select builder as any so you can chain where/limit/orderBy without TS errors.
 * @param builder - The initial select builder, e.g. db.select().from(table)
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function rawSelect(builder: any): any {
    return builder;
}
