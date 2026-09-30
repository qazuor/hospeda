import { describe, expect, it } from 'vitest';
import { queryDateParam, queryNumberParam } from '../../src/common/query-helpers.js';

describe('queryDateParam', () => {
    const schema = queryDateParam();

    describe('missing / empty values', () => {
        it('should return undefined for undefined', () => {
            const result = schema.parse(undefined);

            expect(result).toBeUndefined();
        });

        it('should return undefined for null', () => {
            const result = schema.parse(null);

            expect(result).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            const result = schema.parse('');

            expect(result).toBeUndefined();
        });
    });

    describe('valid ISO 8601 strings', () => {
        it('should parse a UTC datetime string into a Date instance', () => {
            // Arrange
            const isoString = '2026-04-08T00:00:00Z';

            // Act
            const result = schema.parse(isoString);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2026-04-08T00:00:00.000Z');
        });

        it('should parse a datetime with positive timezone offset', () => {
            const result = schema.parse('2026-04-08T10:30:00+03:00');

            expect(result).toBeInstanceOf(Date);
        });

        it('should parse a datetime with negative timezone offset', () => {
            const result = schema.parse('2026-04-08T10:30:00-05:00');

            expect(result).toBeInstanceOf(Date);
        });
    });

    describe('invalid values', () => {
        it('should fail for non-ISO date string (US format)', () => {
            // Arrange
            const nonIso = '01/15/2026';

            // Act
            const result = schema.safeParse(nonIso);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should fail for date-only string without time (not ISO 8601 datetime)', () => {
            // z.string().datetime() requires time component — date-only fails
            const result = schema.safeParse('2026-04-08');

            expect(result.success).toBe(false);
        });

        it('should fail for arbitrary non-date string', () => {
            const result = schema.safeParse('not-a-date');

            expect(result.success).toBe(false);
        });

        it('should fail for a number passed as value', () => {
            const result = schema.safeParse(1712534400000);

            expect(result.success).toBe(false);
        });
    });
});

describe('queryNumberParam', () => {
    const schema = queryNumberParam();

    describe('missing / empty values', () => {
        it('should return undefined for undefined', () => {
            const result = schema.parse(undefined);

            expect(result).toBeUndefined();
        });

        it('should return undefined for null', () => {
            const result = schema.parse(null);

            expect(result).toBeUndefined();
        });

        it('should return undefined for empty string (NOT 0)', () => {
            // This is the critical fix — z.coerce.number() converts '' to 0
            const result = schema.parse('');

            expect(result).toBeUndefined();
            expect(result).not.toBe(0);
        });
    });

    describe('valid numeric strings', () => {
        it('should parse integer string "42" as 42', () => {
            // Arrange
            const input = '42';

            // Act
            const result = schema.parse(input);

            // Assert
            expect(result).toBe(42);
        });

        it('should parse float string "3.14" as 3.14', () => {
            const result = schema.parse('3.14');

            expect(result).toBe(3.14);
        });

        it('should parse negative number string "-7" as -7', () => {
            const result = schema.parse('-7');

            expect(result).toBe(-7);
        });

        it('should parse numeric value (number type) directly', () => {
            const result = schema.parse(100);

            expect(result).toBe(100);
        });
    });

    describe('invalid values', () => {
        it('should fail for non-numeric string "abc"', () => {
            // Arrange
            const input = 'abc';

            // Act
            const result = schema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should fail for mixed string "12abc"', () => {
            const result = schema.safeParse('12abc');

            expect(result.success).toBe(false);
        });
    });
});
