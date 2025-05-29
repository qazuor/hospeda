import { describe, expect, it } from 'vitest';
import {
    assertExists,
    chunkArray,
    groupBy,
    omitFields,
    pickFields,
    removeNulls,
    sanitizePartialUpdate
} from '../../utils/object-utils';

describe('sanitizePartialUpdate', () => {
    it('removes undefined properties', () => {
        expect(sanitizePartialUpdate({ a: 1, b: undefined, c: 2 })).toEqual({ a: 1, c: 2 });
    });
    it('returns empty object if all undefined', () => {
        expect(sanitizePartialUpdate({ a: undefined })).toEqual({});
    });
});

describe('omitFields', () => {
    it('omits specified fields', () => {
        expect(omitFields({ a: 1, b: 2, c: 3 }, ['b', 'c'])).toEqual({ a: 1 });
    });
    it('returns original if no fields omitted', () => {
        expect(omitFields({ a: 1 }, [])).toEqual({ a: 1 });
    });
});

describe('pickFields', () => {
    it('picks only specified fields', () => {
        expect(pickFields({ a: 1, b: 2, c: 3 }, ['b', 'c'])).toEqual({ b: 2, c: 3 });
    });
    it('returns empty object if no fields picked', () => {
        expect(pickFields({ a: 1 }, [])).toEqual({});
    });
});

describe('removeNulls', () => {
    it('removes null and undefined', () => {
        expect(removeNulls({ a: 1, b: null, c: undefined, d: 2 })).toEqual({ a: 1, d: 2 });
    });
    it('returns empty object if all null/undefined', () => {
        expect(removeNulls({ a: null, b: undefined })).toEqual({});
    });
});

describe('chunkArray', () => {
    it('chunks array into correct sizes', () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
    it('returns empty array if input is empty', () => {
        expect(chunkArray([], 3)).toEqual([]);
    });
});

describe('groupBy', () => {
    it('groups array by key', () => {
        const arr = [
            { type: 'A', value: 1 },
            { type: 'B', value: 2 },
            { type: 'A', value: 3 }
        ];
        expect(groupBy(arr, 'type')).toEqual({ A: [arr[0], arr[2]], B: [arr[1]] });
    });
    it('returns empty object if array is empty', () => {
        expect(groupBy([], 'type')).toEqual({});
    });
});

describe('assertExists', () => {
    it('returns value if defined', () => {
        expect(assertExists(5)).toBe(5);
    });
    it('throws if value is undefined', () => {
        expect(() => assertExists(undefined)).toThrow('Not found');
    });
    it('throws with custom message', () => {
        expect(() => assertExists(null, 'Custom')).toThrow('Custom');
    });
});
