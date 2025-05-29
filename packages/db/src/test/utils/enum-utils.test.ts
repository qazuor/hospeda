import { describe, expect, it } from 'vitest';
import { castRowsEnums, castSingleRowEnum, enumToTuple, isEnumValue } from '../../utils/enum-utils';

enum TestEnum {
    A = 'A',
    B = 'B',
    C = 'C'
}

describe('enumToTuple', () => {
    it('returns a tuple of enum values', () => {
        expect(enumToTuple(TestEnum)).toEqual(['A', 'B', 'C']);
    });
    it('throws if enum is empty', () => {
        expect(() => enumToTuple({} as unknown as Record<string, string>)).toThrow(
            'Enum must have at least one value'
        );
    });
});

describe('castRowsEnums', () => {
    it('casts enum fields in array of rows', () => {
        const rows = [
            { state: 'A', other: 1 },
            { state: 'B', other: 2 }
        ];
        const result = castRowsEnums(rows, { state: TestEnum });
        expect(result).toEqual([
            { state: 'A', other: 1 },
            { state: 'B', other: 2 }
        ]);
    });
    it('ignores fields not in enum', () => {
        const rows = [{ state: 'X', other: 1 }];
        const result = castRowsEnums(rows, { state: TestEnum });
        expect(result).toEqual([{ state: 'X', other: 1 }]);
    });
});

describe('castSingleRowEnum', () => {
    it('casts a single row', () => {
        const row = { state: 'A', other: 1 };
        expect(castSingleRowEnum(row, { state: TestEnum })).toEqual({ state: 'A', other: 1 });
    });
    it('returns undefined if row is undefined', () => {
        expect(castSingleRowEnum(undefined, { state: TestEnum })).toBeUndefined();
    });
});

describe('isEnumValue', () => {
    it('returns true for valid enum value', () => {
        expect(isEnumValue('A', TestEnum)).toBe(true);
    });
    it('returns false for invalid value', () => {
        expect(isEnumValue('Z', TestEnum)).toBe(false);
    });
});
