/**
 * Object utility functions
 * @module utils/object
 */

/**
 * Check if an object is empty
 * @param obj - Object to check
 * @returns Whether the object is empty
 */
export function isEmptyObject(obj: Record<string, unknown>): boolean {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Pick specific properties from an object
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with picked properties
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    return keys.reduce(
        (result, key) => {
            if (key in obj) {
                result[key] = obj[key];
            }
            return result;
        },
        {} as Pick<T, K>
    );
}

/**
 * Omit specific properties from an object
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without omitted properties
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item)) as unknown as T;
    }

    if (obj instanceof Object) {
        const copy: Record<string, unknown> = {};
        for (const key of Object.keys(obj)) {
            copy[key] = deepClone((obj as Record<string, unknown>)[key]);
        }
        return copy as T;
    }

    return obj;
}

/**
 * Merge two objects deeply
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>, U extends Record<string, unknown>>(
    target: T,
    source: U
): T & U {
    const output = { ...target } as Record<string, unknown>;

    if (isObject(target) && isObject(source)) {
        for (const key of Object.keys(source)) {
            if (isObject(source[key])) {
                if (key in target) {
                    if (isObject(target[key]) && isObject(source[key])) {
                        output[key] = deepMerge(
                            target[key] as Record<string, unknown>,
                            source[key] as Record<string, unknown>
                        );
                    } else {
                        output[key] = source[key];
                    }
                } else {
                    output[key] = source[key];
                }
            } else {
                output[key] = source[key];
            }
        }
    }

    return output as T & U;
}

/**
 * Check if a value is an object
 * @param item - Value to check
 * @returns Whether the value is an object
 */
export function isObject(item: unknown): boolean {
    return item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Flatten an object with nested properties
 * @param obj - Object to flatten
 * @param prefix - Prefix for flattened keys
 * @returns Flattened object
 */
export function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    return Object.keys(obj).reduce(
        (acc, k) => {
            const pre = prefix.length ? `${prefix}.` : '';
            if (isObject(obj[k])) {
                Object.assign(acc, flattenObject(obj[k] as Record<string, unknown>, pre + k));
            } else {
                acc[pre + k] = obj[k];
            }
            return acc;
        },
        {} as Record<string, unknown>
    );
}

/**
 * Convert an object to query string parameters
 * @param params - Object to convert
 * @returns Query string
 */
export function objectToQueryString(params: Record<string, unknown>): string {
    return Object.keys(params)
        .filter((key) => params[key] !== undefined && params[key] !== null)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
        .join('&');
}
