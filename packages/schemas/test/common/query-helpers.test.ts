import { describe, expect, it } from 'vitest';
import { queryBooleanParam } from '../../src/common/query-helpers.js';

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

        it('should reject empty string (preprocess returns undefined, inner boolean rejects)', () => {
            const result = schema.safeParse('');

            expect(result.success).toBe(false);
        });

        it('should reject null (preprocess returns undefined, inner boolean rejects)', () => {
            const result = schema.safeParse(null);

            expect(result.success).toBe(false);
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
});
