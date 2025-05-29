/**
 * Converts a TypeScript string enum to a readonly string tuple for Drizzle ORM column definitions.
 * @template T - Enum type
 * @param e - Enum object
 * @returns Readonly tuple of enum values
 */
export function enumToTuple<T extends Record<string, string>>(e: T): [string, ...string[]] {
    const values = Object.values(e);
    if (values.length === 0) throw new Error('Enum must have at least one value');
    return values as [string, ...string[]];
}

/**
 * Casts enum fields for a batch of DB rows.
 * @template T - Row type
 * @param rows - Array of DB rows
 * @param enumMap - Object mapping field keys to enum objects
 * @returns New array with corrected enum values
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
 * Casts a single row's enum fields using `castRowsEnums`.
 * @template T - Row type
 * @param row - Single row or undefined
 * @param enumMap - Mapping of fields to enum objects
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
 * Checks if a value exists in a given enum.
 * @template T - Enum object
 * @param value - Raw string
 * @param enumObj - Enum definition
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
