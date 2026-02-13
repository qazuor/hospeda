import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DESTINATION_TYPE_LEVELS,
    DestinationTypeEnum
} from '../../src/enums/destination-type.enum.js';
import { DestinationTypeEnumSchema } from '../../src/enums/destination-type.schema.js';

describe('DestinationTypeEnumSchema', () => {
    it('should validate all destination type values', () => {
        for (const type of Object.values(DestinationTypeEnum)) {
            expect(() => DestinationTypeEnumSchema.parse(type)).not.toThrow();
        }
    });

    it('should have exactly 7 destination types', () => {
        expect(Object.values(DestinationTypeEnum)).toHaveLength(7);
    });

    it('should validate COUNTRY type', () => {
        expect(() => DestinationTypeEnumSchema.parse(DestinationTypeEnum.COUNTRY)).not.toThrow();
    });

    it('should validate CITY type', () => {
        expect(() => DestinationTypeEnumSchema.parse(DestinationTypeEnum.CITY)).not.toThrow();
    });

    it('should validate NEIGHBORHOOD type', () => {
        expect(() =>
            DestinationTypeEnumSchema.parse(DestinationTypeEnum.NEIGHBORHOOD)
        ).not.toThrow();
    });

    it('should reject invalid destination type values', () => {
        const invalidTypes = ['invalid-type', 'STATE', 'VILLAGE', '', null, undefined, 123, {}];

        for (const type of invalidTypes) {
            expect(() => DestinationTypeEnumSchema.parse(type)).toThrow(ZodError);
        }
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            DestinationTypeEnumSchema.parse('invalid-type');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.destinationType.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validType = DestinationTypeEnumSchema.parse(DestinationTypeEnum.CITY);

        const _typeCheck: DestinationTypeEnum = validType;
        expect(validType).toBe(DestinationTypeEnum.CITY);
    });
});

describe('DESTINATION_TYPE_LEVELS', () => {
    it('should map COUNTRY to level 0', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.COUNTRY]).toBe(0);
    });

    it('should map REGION to level 1', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.REGION]).toBe(1);
    });

    it('should map PROVINCE to level 2', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.PROVINCE]).toBe(2);
    });

    it('should map DEPARTMENT to level 3', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.DEPARTMENT]).toBe(3);
    });

    it('should map CITY to level 4', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.CITY]).toBe(4);
    });

    it('should map TOWN to level 5', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.TOWN]).toBe(5);
    });

    it('should map NEIGHBORHOOD to level 6', () => {
        expect(DESTINATION_TYPE_LEVELS[DestinationTypeEnum.NEIGHBORHOOD]).toBe(6);
    });

    it('should have an entry for every destination type', () => {
        for (const type of Object.values(DestinationTypeEnum)) {
            expect(DESTINATION_TYPE_LEVELS[type]).toBeDefined();
            expect(typeof DESTINATION_TYPE_LEVELS[type]).toBe('number');
        }
    });

    it('should have unique levels for each type', () => {
        const levels = Object.values(DESTINATION_TYPE_LEVELS);
        const uniqueLevels = new Set(levels);
        expect(uniqueLevels.size).toBe(levels.length);
    });

    it('should have consecutive levels starting from 0', () => {
        const levels = Object.values(DESTINATION_TYPE_LEVELS).sort((a, b) => a - b);
        for (let i = 0; i < levels.length; i++) {
            expect(levels[i]).toBe(i);
        }
    });
});
