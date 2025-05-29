import { describe, expect, it } from 'vitest';
import {
    castAccommodationJsonFields,
    castReturning,
    castUserJsonFields,
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery,
    rawSelect
} from '../../utils/drizzle-utils';

describe('prepareLikeQuery', () => {
    it('escapes % and _ and wraps with %', () => {
        expect(prepareLikeQuery('foo%_bar')).toBe('%foo\\%\\_bar%');
    });
    it('works with normal string', () => {
        expect(prepareLikeQuery('test')).toBe('%test%');
    });
});

describe('createOrderableColumnsAndMapping', () => {
    it('creates columns, type, and mapping', () => {
        const table = { a: 1, b: 2, c: 3 };
        const result = createOrderableColumnsAndMapping(['a', 'b'] as const, table);
        expect(result.columns).toEqual(['a', 'b']);
        expect(result.mapping).toEqual({ a: 1, b: 2 });
    });
});

describe('getOrderableColumn', () => {
    const mapping = { a: 1, b: 2 };
    it('returns column if valid', () => {
        expect(getOrderableColumn(mapping, 'a', 0)).toBe(1);
    });
    it('returns default if orderBy is undefined', () => {
        expect(getOrderableColumn(mapping, undefined, 0)).toBe(0);
    });
    it('returns default if orderBy is invalid and throwOnInvalid is false', () => {
        expect(getOrderableColumn(mapping, 'z', 0)).toBe(0);
    });
    it('throws if orderBy is invalid and throwOnInvalid is true', () => {
        expect(() => getOrderableColumn(mapping, 'z', 0, true)).toThrow(
            'Invalid orderBy column: z'
        );
    });
});

describe('castAccommodationJsonFields', () => {
    it('casts fields to correct types', () => {
        const row = { contactInfo: { email: 'a' }, tags: ['t'] };
        const result = castAccommodationJsonFields(row);
        expect(result.contactInfo).toEqual({ email: 'a' });
        expect(result.tags).toEqual(['t']);
    });
});

describe('castUserJsonFields', () => {
    it('casts fields to correct types', () => {
        const row = { contactInfo: { email: 'a' }, bookmarks: ['b'] };
        const result = castUserJsonFields(row);
        expect(result.contactInfo).toEqual({ email: 'a' });
        expect(result.bookmarks).toEqual(['b']);
    });
});

describe('castReturning', () => {
    it('casts unknown to typed array', () => {
        const arr = [{ a: 1 }, { a: 2 }];
        expect(castReturning<(typeof arr)[0]>(arr)).toEqual(arr);
    });
});

describe('rawSelect', () => {
    it('returns the builder as is', () => {
        const builder = { test: 1 };
        expect(rawSelect(builder)).toBe(builder);
    });
});
