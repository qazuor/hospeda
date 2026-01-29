import { describe, expect, it } from 'vitest';
import {
    arrayDifference,
    arrayIntersection,
    chunkArray,
    getRandomItem,
    groupBy,
    isEmptyArray,
    shuffleArray,
    sortArrayByKey,
    uniqueArray
} from '../src/array';

describe('Array Utilities', () => {
    describe('isEmptyArray', () => {
        it('returns true for undefined', () => {
            expect(isEmptyArray(undefined)).toBe(true);
        });

        it('returns true for null', () => {
            expect(isEmptyArray(null)).toBe(true);
        });

        it('returns true for empty array', () => {
            expect(isEmptyArray([])).toBe(true);
        });

        it('returns false for non-empty array', () => {
            expect(isEmptyArray([1, 2, 3])).toBe(false);
        });
    });

    describe('getRandomItem', () => {
        it('returns undefined for empty array', () => {
            expect(getRandomItem([])).toBeUndefined();
        });

        it('returns an item from the array', () => {
            const arr = [1, 2, 3, 4, 5];
            const item = getRandomItem(arr);
            expect(arr).toContain(item);
        });
    });

    describe('shuffleArray', () => {
        it('returns array with same elements', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = shuffleArray(arr);
            expect(shuffled.sort()).toEqual(arr.sort());
        });

        it('does not modify original array', () => {
            const arr = [1, 2, 3, 4, 5];
            const original = [...arr];
            shuffleArray(arr);
            expect(arr).toEqual(original);
        });
    });

    describe('groupBy', () => {
        it('groups items by key', () => {
            const items = [
                { type: 'a', value: 1 },
                { type: 'b', value: 2 },
                { type: 'a', value: 3 }
            ];
            const grouped = groupBy(items, (item) => item.type);
            expect(grouped.a).toHaveLength(2);
            expect(grouped.b).toHaveLength(1);
        });
    });

    describe('uniqueArray', () => {
        it('removes duplicates from simple array', () => {
            const arr = [1, 2, 2, 3, 3, 3];
            expect(uniqueArray(arr)).toEqual([1, 2, 3]);
        });

        it('removes duplicates using key getter', () => {
            const arr = [
                { id: 1, name: 'a' },
                { id: 2, name: 'b' },
                { id: 1, name: 'c' }
            ];
            const unique = uniqueArray(arr, (item) => item.id);
            expect(unique).toHaveLength(2);
        });
    });

    describe('chunkArray', () => {
        it('chunks array into smaller arrays', () => {
            const arr = [1, 2, 3, 4, 5, 6];
            const chunks = chunkArray(arr, 2);
            expect(chunks).toEqual([
                [1, 2],
                [3, 4],
                [5, 6]
            ]);
        });

        it('handles uneven chunks', () => {
            const arr = [1, 2, 3, 4, 5];
            const chunks = chunkArray(arr, 2);
            expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('returns original array in single chunk when size is 0 or negative', () => {
            const arr = [1, 2, 3];
            expect(chunkArray(arr, 0)).toEqual([[1, 2, 3]]);
            expect(chunkArray(arr, -1)).toEqual([[1, 2, 3]]);
        });
    });

    describe('arrayIntersection', () => {
        it('finds common elements', () => {
            const arr1 = [1, 2, 3, 4];
            const arr2 = [3, 4, 5, 6];
            expect(arrayIntersection(arr1, arr2)).toEqual([3, 4]);
        });

        it('returns empty array when no common elements', () => {
            const arr1 = [1, 2];
            const arr2 = [3, 4];
            expect(arrayIntersection(arr1, arr2)).toEqual([]);
        });
    });

    describe('arrayDifference', () => {
        it('finds elements in first array not in second', () => {
            const arr1 = [1, 2, 3, 4];
            const arr2 = [3, 4, 5, 6];
            expect(arrayDifference(arr1, arr2)).toEqual([1, 2]);
        });
    });

    describe('sortArrayByKey', () => {
        it('sorts by key ascending', () => {
            const arr = [{ value: 3 }, { value: 1 }, { value: 2 }];
            const sorted = sortArrayByKey(arr, 'value', 'asc');
            expect(sorted.map((x) => x.value)).toEqual([1, 2, 3]);
        });

        it('sorts by key descending', () => {
            const arr = [{ value: 1 }, { value: 3 }, { value: 2 }];
            const sorted = sortArrayByKey(arr, 'value', 'desc');
            expect(sorted.map((x) => x.value)).toEqual([3, 2, 1]);
        });

        it('does not modify original array', () => {
            const arr = [{ value: 3 }, { value: 1 }, { value: 2 }];
            const original = JSON.stringify(arr);
            sortArrayByKey(arr, 'value');
            expect(JSON.stringify(arr)).toBe(original);
        });
    });
});
