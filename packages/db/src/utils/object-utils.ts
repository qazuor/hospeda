/**
 * Removes undefined properties from an object (for safe DB updates).
 * @template T - Input object type
 * @param input - Partial object
 * @returns Copy without undefined values
 * @example
 * sanitizePartialUpdate({ name: "John", age: undefined }) // { name: "John" }
 */
export function sanitizePartialUpdate<T extends object>(input: Partial<T>): Partial<T> {
    return Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
}

/**
 * Omits selected fields from an object.
 * @template T - Input object
 * @template K - Keys to omit
 * @param obj - Object to omit from
 * @param fields - Keys to omit
 * @returns New object without omitted keys
 * @example
 * omitFields(user, ['password'])
 */
export function omitFields<T extends object, K extends keyof T>(obj: T, fields: K[]): Omit<T, K> {
    const clone = { ...obj } as Omit<T, K>;
    for (const field of fields) {
        delete clone[field as unknown as keyof typeof clone];
    }
    return clone;
}

/**
 * Picks only selected fields from an object.
 * @template T - Input object
 * @template K extends keyof T - Keys to pick
 * @param obj - Object to pick from
 * @param fields - Keys to pick
 * @returns New object with only selected keys
 * @example
 * pickFields(user, ['id', 'email'])
 */
export function pickFields<T extends object, K extends keyof T>(obj: T, fields: K[]): Pick<T, K> {
    const result: Partial<Pick<T, K>> = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(obj, field)) {
            result[field] = obj[field];
        }
    }
    return result as Pick<T, K>;
}

/**
 * Removes all null/undefined keys from an object.
 * @template T - Input object
 * @param obj - Object to clean
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
 * Chunks an array into smaller arrays of a given size.
 * @template T - Array element type
 * @param array - Input array
 * @param size - Chunk size
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
 * Groups an array by a key.
 * @template T - Element type
 * @param array - Input array
 * @param key - Key to group by
 * @returns Grouped object
 * @example
 * groupBy(users, 'roleId') // { ADMIN: [...], USER: ...] }
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
        (acc, item) => {
            const group = String(item[key]);
            if (!acc[group]) acc[group] = [];
            acc[group].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}

/**
 * Ensures a value exists, otherwise throws an error.
 * @template T - Any value
 * @param value - The value to check
 * @param msg - Optional error message
 * @returns The original value if not undefined/null
 * @throws Error if value is undefined or null
 * @example
 * const user = assertExists(await getUser(id), 'User not found')
 */
export function assertExists<T>(value: T | undefined | null, msg = 'Not found'): T {
    if (value === undefined || value === null) throw new Error(msg);
    return value;
}
