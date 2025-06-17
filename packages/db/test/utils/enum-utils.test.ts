import { describe, expect, it } from 'vitest';
import {
    castRowsEnums,
    castSingleRowEnum,
    enumToTuple,
    isEnumValue
} from '../../src/utils/enum-utils';

enum ColorEnum {
    RED = 'RED',
    GREEN = 'GREEN',
    BLUE = 'BLUE'
}

enum NumberEnum {
    ONE = '1',
    TWO = '2'
}

describe('enumToTuple', () => {
    it('converts enum to tuple', () => {
        const tuple = enumToTuple(ColorEnum);
        expect(tuple).toEqual(['RED', 'GREEN', 'BLUE']);
    });
    it('throws if enum is empty', () => {
        expect(() => enumToTuple({} as unknown as Record<string, string>)).toThrow();
    });
    it('works with numeric string enums', () => {
        const tuple = enumToTuple(NumberEnum);
        expect(tuple).toEqual(['1', '2']);
    });
    it('works with enums with duplicate values', () => {
        enum DupEnum {
            A = 'X',
            B = 'X'
        }
        const tuple = enumToTuple(DupEnum);
        expect(tuple).toEqual(['X', 'X']);
    });
});

describe('isEnumValue', () => {
    it('returns true for valid value', () => {
        expect(isEnumValue('RED', ColorEnum)).toBe(true);
    });
    it('returns false for invalid value', () => {
        expect(isEnumValue('YELLOW', ColorEnum)).toBe(false);
    });
    it('returns false for non-string value', () => {
        expect(isEnumValue(1 as unknown as string, ColorEnum)).toBe(false);
    });
});

describe('castRowsEnums', () => {
    it('returns rows with valid enum values unchanged', () => {
        const rows = [
            { color: 'RED', other: 1 },
            { color: 'GREEN', other: 2 }
        ];
        const result = castRowsEnums(rows, { color: ColorEnum });
        expect(result).toEqual(rows);
    });
    it('ignores fields not in enumMap', () => {
        const rows = [{ foo: 'bar' }];
        const result = castRowsEnums(rows, { foo: ColorEnum });
        expect(result).toEqual(rows);
    });
    it('does not mutate the original array', () => {
        const rows = [{ color: 'RED' }];
        const copy = [...rows];
        castRowsEnums(rows, { color: ColorEnum });
        expect(rows).toEqual(copy);
    });
    it('handles rows with invalid enum values', () => {
        const rows = [{ color: 'RED' }, { color: 'YELLOW' }, { color: 123 }, { color: undefined }];
        const result = castRowsEnums(rows, { color: ColorEnum });
        expect(result).toEqual(rows);
    });
    it('handles enumMap with missing fields', () => {
        const rows = [{ color: 'RED', shape: 'CIRCLE' }];
        const result = castRowsEnums(rows, {});
        expect(result).toEqual(rows);
    });
    it('handles extra fields in rows', () => {
        const rows = [{ color: 'RED', extra: 42 }];
        const result = castRowsEnums(rows, { color: ColorEnum });
        expect(result).toEqual(rows);
    });
});

describe('castSingleRowEnum', () => {
    it('returns row with valid enum value unchanged', () => {
        const row = { color: 'BLUE', other: 3 };
        const result = castSingleRowEnum(row, { other: ColorEnum });
        expect(result).toEqual(row);
    });
    it('returns undefined if row is undefined', () => {
        const result = castSingleRowEnum(undefined, { other: ColorEnum });
        expect(result).toBeUndefined();
    });
    it('handles row with invalid enum value', () => {
        const row = { color: 'YELLOW', other: 3 };
        const result = castSingleRowEnum(row, { other: ColorEnum });
        expect(result).toEqual(row);
    });
    it('handles row with missing enum field', () => {
        const row = { other: 3 };
        const result = castSingleRowEnum(row, { other: ColorEnum });
        expect(result).toEqual(row);
    });
});
