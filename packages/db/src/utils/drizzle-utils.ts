import type { AccommodationType, UserType } from '@repo/types';

/**
 * Escapes a term for ILIKE and wraps with % for fuzzy search.
 * @param term - Raw search string
 * @returns Sanitized LIKE pattern
 * @example
 * prepareLikeQuery("café") // "%café%"
 */
export function prepareLikeQuery(term: string): string {
    return `%${term.replace(/[%_]/g, '\\$&')}%`;
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
 * @param orderBy - The column name string (e.g., 'createdAt')
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

/**
 * Casts all JSONB and relation fields in an accommodation row to their proper types.
 * Ensures compatibility with AccommodationType.
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
 * Casts the result of a Drizzle `.returning()` call to a typed array.
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
 * Wraps a Drizzle select builder as any so you can chain where/limit/orderBy without TS errors.
 * @param builder - The initial select builder, e.g. db.select().from(table)
 */
// biome-ignore lint/suspicious/noExplicitAny: necesario para queries complejas
export function rawSelect(builder: any): any {
    return builder;
}
