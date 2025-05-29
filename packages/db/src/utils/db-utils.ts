import type { AccommodationType, UserType } from '@repo/types';
import type { PgColumn } from 'drizzle-orm/pg-core'; // Import PgColumn type
import { dbLogger } from './logger.ts';

/**
 * Converts a TypeScript string enum to a readonly string tuple
 * that Drizzle ORM expects in column enum definition.
 * @template T - The enum type.
 * @param e - The enum object.
 * @returns A readonly tuple of enum values.
 */
export function enumToTuple<T extends Record<string, string>>(e: T): [string, ...string[]] {
    const values = Object.values(e);
    if (values.length === 0) throw new Error('Enum must have at least one value');
    return values as [string, ...string[]];
}

/**
 * Cast enum fields for a batch of DB rows.
 * @template T - Type of the row object
 * @param rows Array of rows from DB
 * @param enumMap Object mapping field keys to corresponding enum objects
 * @returns A new array with corrected enum values
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
 * @template T - Type of the row
 * @param row A single row or undefined
 * @param enumMap Mapping of fields to enum objects
 * @returns Row with corrected enum values or undefined
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
 * @template T - Input object type
 * @param input Partial object
 * @returns A copy without undefined values
 * @example
 * sanitizePartialUpdate({ name: "John", age: undefined }) // { name: "John" }
 */
export function sanitizePartialUpdate<T extends object>(input: Partial<T>): Partial<T> {
    return Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
}

/**
 * Ensure a value exists, otherwise throws an error
 * @template T - Any value
 * @param value The value to check
 * @param msg Optional error message
 * @returns The original value if not undefined/null
 * @throws Error if value is undefined or null
 * @example
 * const user = assertExists(await getUser(id), 'User not found')
 */
export function assertExists<T>(value: T | undefined | null, msg = 'Not found'): T {
    if (value === undefined || value === null) throw new Error(msg);
    return value;
}

/**
 * Escape a term for ILIKE and wrap with % for fuzzy search.
 * @param term Raw search string
 * @returns Sanitized LIKE pattern
 * @example
 * prepareLikeQuery("caf\u00e9") // "%caf\u00e9%"
 */
export function prepareLikeQuery(term: string): string {
    // Escape LIKE wildcards (%) and underscores (_) by preceding them with a backslash.
    // The double backslash in the regex and replacement is because the backslash itself needs escaping in the string literal.
    return `%${term.replace(/[%_]/g, '\\$&')}%`;
}

/**
 * Dynamically gets the Drizzle column object for orderBy from a table schema object.
 * This provides a type-safe way to order by a column specified as a string,
 * provided the string key exists in the schema object and refers to a column.
 *
 * @template TSchema extends Record<string, PgColumn<any, any, any>> - The Drizzle schema type (e.g., typeof accommodations). This constraint ensures that the schema object keys map to PgColumn instances.
 * @param schema - The Drizzle table schema object (e.g., `users`, `posts`)
 * @param orderByString - The column name string from the filter (e.g., `filter.orderBy`)
 * @param defaultColumn - The default column object to use if orderByString is invalid or not provided (e.g., `schema.createdAt`)
 * @returns The Drizzle column object to use in orderBy.
 */

// biome-ignore lint/suspicious/noExplicitAny: Casting to a Record is necessary because Drizzle's PgTable type doesn't formally extend Record<string, ...> in a way the compiler fully recognizes in this generic context, despite behaving like one for column access.
export function getOrderByColumn<TSchema extends Record<string, PgColumn<any, any, any>>>(
    schema: TSchema,
    orderByString: string | undefined,
    // biome-ignore lint/suspicious/noExplicitAny: This matches the type constraint for TSchema values
    defaultColumn: PgColumn<any, any, any> // Use a specific column like createdAt
    // biome-ignore lint/suspicious/noExplicitAny: This matches the type constraint for TSchema values
): PgColumn<any, any, any> {
    // Cast the schema to a Record<string, PgColumn<any, any, any>> to satisfy TypeScript
    // when accessing properties via string keys, as PgTable doesn't formally have
    // a string index signature despite allowing bracket access for column names.
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const indexableSchema = schema as Record<string, PgColumn<any, any, any>>;

    // Check if orderByString is provided and corresponds to a key in the schema object
    if (orderByString && Object.prototype.hasOwnProperty.call(indexableSchema, orderByString)) {
        const column = indexableSchema[orderByString];
        // Although TSchema constraint implies it's a column, a final check for undefined is good practice
        // in case hasOwnProperty returns true for a property that is undefined.
        if (column !== undefined) {
            return column;
        }
    }
    if (orderByString) {
        // Log a warning if the requested orderBy string is not found as a property on the schema
        // The schema object itself might not have a getName() method, so logging the available keys is more helpful.
        dbLogger.warn(
            {
                requestedOrderBy: orderByString,
                availableKeys: Object.keys(schema)
            },
            `Attempted to order by unknown property "${orderByString}" on schema`
        );
    }

    // Return default column if orderByString is not provided or is invalid/not found
    return defaultColumn;
}

/**
 * Omit selected fields from an object.
 * @template T - Input object
 * @template K - Keys to omit
 * @param obj Object to omit from
 * @param fields Keys to omit
 * @returns New object without omitted keys
 * @example
 * omitFields(user, ['password'])
 */
export function omitFields<T extends object, K extends keyof T>(obj: T, fields: K[]): Omit<T, K> {
    const clone = { ...obj } as Omit<T, K>;
    for (const field of fields) {
        // Type assertion needed because TypeScript might not be sure if 'field' is a valid key of the Partial<Omit<T, K>> result type after spreading
        delete clone[field as unknown as keyof typeof clone];
    }
    return clone;
}

/**
 * Pick only selected fields from an object.
 * @template T - Input object
 * @template K extends keyof T - Keys to pick
 * @param obj Object to pick from
 * @param fields Keys to pick
 * @returns New object with only selected keys
 * @example
 * pickFields(user, ['id', 'email'])
 */
export function pickFields<T extends object, K extends keyof T>(obj: T, fields: K[]): Pick<T, K> {
    const result: Partial<Pick<T, K>> = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(obj, field)) {
            // Use hasOwnProperty for safety
            result[field] = obj[field];
        }
    }
    return result as Pick<T, K>;
}

/**
 * Check if a value exists in a given enum.
 * @template T - Enum object
 * @param value Raw string
 * @param enumObj Enum definition
 * @returns True if value is in enum
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
 * @template T - Input object
 * @param obj Object to clean
 * @returns New object without null/undefined values
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
 * @template T - Array element type
 * @param array Input array
 * @param size Chunk size
 * @returns Array of arrays
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
 * @template T - Element type
 * @param array Input array
 * @param key Key to group by
 * @returns Grouped object
 * @example
 * groupBy(users, 'roleId') // { ADMIN: [...], USER: ...] }
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
        (acc, item) => {
            const group = String(item[key]); // Ensure key is string for object key
            if (!acc[group]) acc[group] = [];
            acc[group].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}

/**
 * Casts all JSONB and relation fields in an accommodation row to their proper types.
 * Asegura compatibilidad con AccommodationType.
 * @param row - Accommodation record with unknown jsonb/relation fields
 * @returns AccommodationType with casted fields
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
        schedule: row.schedule as AccommodationType['schedule'],
        extraInfo: row.extraInfo as AccommodationType['extraInfo'],
        seo: row.seo as AccommodationType['seo'],
        owner: row.owner as AccommodationType['owner'],
        destination: row.destination as AccommodationType['destination'],
        features: row.features as AccommodationType['features'],
        amenities: row.amenities as AccommodationType['amenities'],
        reviews: row.reviews as AccommodationType['reviews'],
        faqs: row.faqs as AccommodationType['faqs'],
        iaData: row.iaData as AccommodationType['iaData'],
        tags: row.tags as AccommodationType['tags']
    };
}

/**
 * Casts all JSONB and relation fields in a user row.
 * @param row - User record with unknown jsonb/relation fields
 * @returns UserType with casted fields
 */
export function castUserJsonFields<T extends { [key: string]: unknown }>(
    row: T
): Partial<UserType> {
    return {
        ...row,
        contactInfo: row.contactInfo as UserType['contactInfo'],
        location: row.location as UserType['location'],
        socialNetworks: row.socialNetworks as UserType['socialNetworks'],
        profile: row.profile as UserType['profile'],
        settings: row.settings as UserType['settings'],
        bookmarks: row.bookmarks as UserType['bookmarks']
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
// biome-ignore lint/suspicious/noExplicitAny: This is a necessary escape hatch for complex dynamic queries
export function rawSelect(builder: any): any {
    return builder;
}

/**
 * Creates a readonly array of orderable columns, the associated type, and a Drizzle mapping in one statement.
 * Keeps everything in sync and DRY for models.
 */
export function createOrderableColumnsAndMapping<
    const T extends readonly string[],
    Table extends Record<string, unknown>
>(columns: T, table: Table) {
    return {
        columns,
        type: null as unknown as T[number],
        mapping: Object.fromEntries(columns.map((col) => [col, table[col]])) as Record<
            T[number],
            Table[keyof Table]
        >
    };
}

/**
 * Returns the Drizzle column object for a given orderBy string, using a mapping.
 * Falls back to a default column if the string is invalid or not provided,
 * unless throwOnInvalid is true (then throws an error).
 *
 * @param mapping - The mapping from allowed column names to Drizzle columns (from createOrderableColumnsAndMapping)
 * @param orderBy - The column name string from the filter (e.g., 'createdAt')
 * @param defaultColumn - The default column object to use if orderBy is invalid or not provided
 * @param throwOnInvalid - If true, throws an error on invalid orderBy. Defaults to process.env.DB_ORDERBY_THROW_ON_INVALID or false.
 * @returns The Drizzle column object to use in orderBy
 */
export function getOrderableColumn<Mapping extends Record<string, unknown>, ColType>(
    mapping: Mapping,
    orderBy: string | undefined,
    defaultColumn: ColType,
    throwOnInvalid?: boolean
): ColType {
    const shouldThrow =
        throwOnInvalid ??
        (typeof process !== 'undefined' && process.env?.DB_ORDERBY_THROW_ON_INVALID === 'true');
    if (!orderBy) return defaultColumn;
    if (orderBy in mapping) {
        return mapping[orderBy as keyof Mapping] as ColType;
    }
    if (shouldThrow) {
        throw new Error(`Invalid orderBy column: ${orderBy}`);
    }
    return defaultColumn;
}
