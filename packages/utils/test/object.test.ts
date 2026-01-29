import { describe, expect, it } from 'vitest';
import {
    deepClone,
    deepMerge,
    flattenObject,
    isEmptyObject,
    isObject,
    objectToQueryString,
    omit,
    pick
} from '../src/object';

describe('Object Utilities', () => {
    describe('isEmptyObject', () => {
        it('returns true for empty object', () => {
            expect(isEmptyObject({})).toBe(true);
        });

        it('returns false for non-empty object', () => {
            expect(isEmptyObject({ key: 'value' })).toBe(false);
        });
    });

    describe('pick', () => {
        it('picks specified keys', () => {
            const obj = { a: 1, b: 2, c: 3 };
            expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
        });

        it('ignores non-existent keys', () => {
            const obj = { a: 1, b: 2 };
            expect(pick(obj, ['a', 'c' as keyof typeof obj])).toEqual({ a: 1 });
        });
    });

    describe('omit', () => {
        it('omits specified keys', () => {
            const obj = { a: 1, b: 2, c: 3 };
            expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
        });

        it('returns object unchanged if key does not exist', () => {
            const obj = { a: 1, b: 2 };
            expect(omit(obj, ['c' as keyof typeof obj])).toEqual({ a: 1, b: 2 });
        });
    });

    describe('deepClone', () => {
        it('creates a deep copy of an object', () => {
            const obj = { a: 1, b: { c: 2 } };
            const clone = deepClone(obj);
            expect(clone).toEqual(obj);
            expect(clone).not.toBe(obj);
            expect(clone.b).not.toBe(obj.b);
        });

        it('handles arrays', () => {
            const arr = [1, [2, 3], { a: 4 }];
            const clone = deepClone(arr);
            expect(clone).toEqual(arr);
            expect(clone).not.toBe(arr);
        });

        it('handles Date objects', () => {
            const date = new Date();
            const clone = deepClone(date);
            expect(clone).toEqual(date);
            expect(clone).not.toBe(date);
        });

        it('handles null', () => {
            expect(deepClone(null)).toBeNull();
        });

        it('handles primitives', () => {
            expect(deepClone(42)).toBe(42);
            expect(deepClone('hello')).toBe('hello');
        });
    });

    describe('deepMerge', () => {
        it('merges objects deeply', () => {
            const target = { a: 1, b: { c: 2 } };
            const source = { b: { d: 3 }, e: 4 };
            const merged = deepMerge(target, source);
            expect(merged).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
        });

        it('overrides primitive values', () => {
            const target = { a: 1, b: 2 };
            const source = { b: 3 };
            expect(deepMerge(target, source)).toEqual({ a: 1, b: 3 });
        });
    });

    describe('isObject', () => {
        it('returns true for objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ a: 1 })).toBe(true);
        });

        it('returns false for arrays', () => {
            expect(isObject([])).toBe(false);
        });

        it('returns false for null', () => {
            expect(isObject(null)).toBe(false);
        });

        it('returns false for primitives', () => {
            expect(isObject(42)).toBe(false);
            expect(isObject('hello')).toBe(false);
        });
    });

    describe('flattenObject', () => {
        it('flattens nested object', () => {
            const obj = { a: { b: { c: 1 } } };
            expect(flattenObject(obj)).toEqual({ 'a.b.c': 1 });
        });

        it('handles flat objects', () => {
            const obj = { a: 1, b: 2 };
            expect(flattenObject(obj)).toEqual({ a: 1, b: 2 });
        });
    });

    describe('objectToQueryString', () => {
        it('converts object to query string', () => {
            const obj = { a: 1, b: 'hello' };
            expect(objectToQueryString(obj)).toBe('a=1&b=hello');
        });

        it('filters out undefined and null values', () => {
            const obj = { a: 1, b: undefined, c: null, d: 2 };
            expect(objectToQueryString(obj)).toBe('a=1&d=2');
        });

        it('encodes special characters', () => {
            const obj = { key: 'hello world' };
            expect(objectToQueryString(obj)).toBe('key=hello%20world');
        });
    });
});
