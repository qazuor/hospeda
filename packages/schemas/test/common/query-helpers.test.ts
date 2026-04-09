import { describe, expect, it } from 'vitest';
import {
    queryBooleanParam,
    queryDateParam,
    queryNumberParam
} from '../../src/common/query-helpers.js';

describe('queryBooleanParam', () => {
    const schema = queryBooleanParam();

    describe('truthy values', () => {
        it('should parse "true" string as true', () => {
            const result = schema.parse('true');

            expect(result).toBe(true);
        });

        it('should parse "1" string as true', () => {
            const result = schema.parse('1');

            expect(result).toBe(true);
        });

        it('should parse boolean true as true', () => {
            const result = schema.parse(true);

            expect(result).toBe(true);
        });
    });

    describe('falsy values', () => {
        it('should parse "false" string as false (critical: z.coerce.boolean bug fix)', () => {
            // z.coerce.boolean() would incorrectly convert "false" to true
            // because Boolean("false") === true. This helper fixes that.
            const result = schema.parse('false');

            expect(result).toBe(false);
        });

        it('should parse "0" string as false', () => {
            const result = schema.parse('0');

            expect(result).toBe(false);
        });

        it('should parse boolean false as false', () => {
            const result = schema.parse(false);

            expect(result).toBe(false);
        });
    });

    describe('undefined/empty values', () => {
        it('should parse undefined as undefined', () => {
            const result = schema.parse(undefined);

            expect(result).toBeUndefined();
        });

        it('should parse empty string as undefined (treated as not provided)', () => {
            const result = schema.parse('');

            expect(result).toBeUndefined();
        });

        it('should parse null as undefined (treated as not provided)', () => {
            const result = schema.parse(null);

            expect(result).toBeUndefined();
        });
    });

    describe('strict matching - non-canonical strings', () => {
        it('should parse "yes" as false (only "true" and "1" are truthy)', () => {
            const result = schema.parse('yes');

            expect(result).toBe(false);
        });

        it('should parse "no" as false', () => {
            const result = schema.parse('no');

            expect(result).toBe(false);
        });

        it('should parse arbitrary string as false', () => {
            const result = schema.parse('anything');

            expect(result).toBe(false);
        });
    });

    describe('double-optional fix', () => {
        it('should not wrap result in extra optional layer (regression: removed redundant .optional())', () => {
            // Ensure removing the outer .optional() did not break the schema —
            // the inner z.boolean().optional() already handles undefined.
            const result = schema.safeParse(undefined);

            expect(result.success).toBe(true);
            expect(result.data).toBeUndefined();
        });
    });
});

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
