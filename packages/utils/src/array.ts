/**
 * Array utility functions
 * @module utils/array
 */

/**
 * Check if an array is empty
 * @param arr - Array to check
 * @returns Whether the array is empty
 */
export function isEmptyArray<T>(arr?: T[] | null): boolean {
    return !arr || arr.length === 0;
}

/**
 * Get a random item from an array
 * @param arr - Array to get item from
 * @returns Random item
 */
export function getRandomItem<T>(arr: T[]): T | undefined {
    if (isEmptyArray(arr)) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle an array
 * @param arr - Array to shuffle
 * @returns Shuffled array
 */
export function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
}

/**
 * Group array items by a key
 * @param arr - Array to group
 * @param keyGetter - Function to get the key
 * @returns Grouped object
 */
export function groupBy<T, K extends string | number | symbol>(
    arr: T[],
    keyGetter: (item: T) => K
): Record<K, T[]> {
    return arr.reduce(
        (result, item) => {
            const key = keyGetter(item);
            if (!result[key]) {
                result[key] = [];
            }
            result[key].push(item);
            return result;
        },
        {} as Record<K, T[]>
    );
}

/**
 * Remove duplicates from an array
 * @param arr - Array to deduplicate
 * @param keyGetter - Optional function to get the key for comparison
 * @returns Deduplicated array
 */
export function uniqueArray<T, K>(arr: T[], keyGetter?: (item: T) => K): T[] {
    if (keyGetter) {
        const seen = new Set();
        return arr.filter((item) => {
            const key = keyGetter(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    return [...new Set(arr)];
}

/**
 * Chunk an array into smaller arrays
 * @param arr - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
    if (size <= 0) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

/**
 * Find the intersection of two arrays
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Intersection array
 */
export function arrayIntersection<T>(arr1: T[], arr2: T[]): T[] {
    return arr1.filter((item) => arr2.includes(item));
}

/**
 * Find the difference between two arrays
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Difference array
 */
export function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
    return arr1.filter((item) => !arr2.includes(item));
}

/**
 * Sort an array by a key
 * @param arr - Array to sort
 * @param key - Key to sort by
 * @param direction - Sort direction
 * @returns Sorted array
 */
export function sortArrayByKey<T>(arr: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...arr].sort((a, b) => {
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}
