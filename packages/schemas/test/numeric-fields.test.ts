import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAverageRatingField } from '../src/common/helpers.schema.js';
import { numericField } from '../src/utils/utils.js';

describe('numericField()', () => {
    it('accepts number input and returns number', () => {
        const schema = numericField();

        const result = schema.parse(42);

        expect(result).toBe(42);
        expect(typeof result).toBe('number');
    });

    it('accepts string input and returns number', () => {
        const schema = numericField();

        const result = schema.parse('3.50');

        expect(result).toBe(3.5);
        expect(typeof result).toBe('number');
    });

    it('coerces integer strings correctly', () => {
        const schema = numericField();

        const result = schema.parse('100');

        expect(result).toBe(100);
    });

    it('coerces negative string values correctly', () => {
        const schema = numericField();

        const result = schema.parse('-7.25');

        expect(result).toBe(-7.25);
    });

    it('coerces zero string correctly', () => {
        const schema = numericField();

        const result = schema.parse('0');

        expect(result).toBe(0);
    });

    it('rejects non-numeric string', () => {
        const schema = numericField();

        const result = schema.safeParse('abc');

        expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
        const schema = numericField();

        const result = schema.safeParse('');

        expect(result.success).toBe(false);
    });

    it('rejects null', () => {
        const schema = numericField();

        const result = schema.safeParse(null);

        expect(result.success).toBe(false);
    });

    it('rejects undefined', () => {
        const schema = numericField();

        const result = schema.safeParse(undefined);

        expect(result.success).toBe(false);
    });

    it('rejects boolean values', () => {
        const schema = numericField();

        const resultTrue = schema.safeParse(true);
        const resultFalse = schema.safeParse(false);

        expect(resultTrue.success).toBe(false);
        expect(resultFalse.success).toBe(false);
    });

    it('rejects object values', () => {
        const schema = numericField();

        const result = schema.safeParse({ value: 42 });

        expect(result.success).toBe(false);
    });

    it('applies custom validation pipe', () => {
        const schema = numericField(z.number().positive());

        // Positive number should pass
        const validResult = schema.safeParse(5);
        expect(validResult.success).toBe(true);

        // Zero should fail (not positive)
        const zeroResult = schema.safeParse(0);
        expect(zeroResult.success).toBe(false);

        // Negative number should fail
        const negativeResult = schema.safeParse(-3);
        expect(negativeResult.success).toBe(false);
    });

    it('applies custom min/max validation pipe', () => {
        const schema = numericField(z.number().min(0).max(100));

        // Within range passes
        const validResult = schema.safeParse('50');
        expect(validResult.success).toBe(true);
        if (validResult.success) {
            expect(validResult.data).toBe(50);
        }

        // Above max fails
        const aboveResult = schema.safeParse('101');
        expect(aboveResult.success).toBe(false);

        // Below min fails
        const belowResult = schema.safeParse('-1');
        expect(belowResult.success).toBe(false);
    });

    it('applies custom integer validation pipe', () => {
        const schema = numericField(z.number().int());

        // Integer passes
        const intResult = schema.safeParse(5);
        expect(intResult.success).toBe(true);

        // Float fails
        const floatResult = schema.safeParse(5.5);
        expect(floatResult.success).toBe(false);
    });

    it('works without custom validation (uses default z.number())', () => {
        const schema = numericField();

        // Any valid number should pass
        const result = schema.safeParse(3.14);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe(3.14);
        }
    });
});

describe('createAverageRatingField()', () => {
    it('accepts number 0-5 and returns number', () => {
        const schema = createAverageRatingField();

        const result = schema.parse(4.5);

        expect(result).toBe(4.5);
        expect(typeof result).toBe('number');
    });

    it('accepts boundary value 0', () => {
        const schema = createAverageRatingField();

        const result = schema.parse(0);

        expect(result).toBe(0);
    });

    it('accepts boundary value 5', () => {
        const schema = createAverageRatingField();

        const result = schema.parse(5);

        expect(result).toBe(5);
    });

    it('accepts string "3.50" and returns 3.5', () => {
        const schema = createAverageRatingField();

        const result = schema.parse('3.50');

        expect(result).toBe(3.5);
        expect(typeof result).toBe('number');
    });

    it('accepts string "0" and returns 0', () => {
        const schema = createAverageRatingField();

        const result = schema.parse('0');

        expect(result).toBe(0);
    });

    it('accepts string "5" and returns 5', () => {
        const schema = createAverageRatingField();

        const result = schema.parse('5');

        expect(result).toBe(5);
    });

    it('rejects values greater than 5', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(5.1);

        expect(result.success).toBe(false);
    });

    it('rejects string values greater than 5', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse('6');

        expect(result.success).toBe(false);
    });

    it('rejects values less than 0', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(-0.1);

        expect(result.success).toBe(false);
    });

    it('rejects string values less than 0', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse('-1');

        expect(result.success).toBe(false);
    });

    it('rejects non-numeric strings', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse('abc');

        expect(result.success).toBe(false);
    });

    it('rejects null', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(null);

        expect(result.success).toBe(false);
    });

    it('handles optional variant - undefined passes', () => {
        const schema = createAverageRatingField({ optional: true });

        const result = schema.safeParse(undefined);

        expect(result.success).toBe(true);
    });

    it('handles optional variant - valid number passes', () => {
        const schema = createAverageRatingField({ optional: true });

        const result = schema.safeParse(3.5);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe(3.5);
        }
    });

    it('handles optional variant - still validates range', () => {
        const schema = createAverageRatingField({ optional: true });

        const result = schema.safeParse(6);

        expect(result.success).toBe(false);
    });

    it('applies default value when undefined', () => {
        const schema = createAverageRatingField({ default: 0 });

        const result = schema.parse(undefined);

        expect(result).toBe(0);
    });

    it('applies default value - explicit value overrides default', () => {
        const schema = createAverageRatingField({ default: 0 });

        const result = schema.parse(4.2);

        expect(result).toBe(4.2);
    });

    it('applies default value - string value overrides default', () => {
        const schema = createAverageRatingField({ default: 0 });

        const result = schema.parse('3.75');

        expect(result).toBe(3.75);
    });

    it('handles optional + default combined - undefined returns default', () => {
        const schema = createAverageRatingField({ optional: true, default: 2.5 });

        const result = schema.parse(undefined);

        expect(result).toBe(2.5);
    });

    it('handles optional + default combined - explicit value overrides', () => {
        const schema = createAverageRatingField({ optional: true, default: 2.5 });

        const result = schema.parse(4.0);

        expect(result).toBe(4.0);
    });

    it('handles no options (required, no default)', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(undefined);

        expect(result.success).toBe(false);
    });

    it('handles empty options object same as no options', () => {
        const schema = createAverageRatingField({});

        const validResult = schema.safeParse(3.0);
        expect(validResult.success).toBe(true);

        const undefinedResult = schema.safeParse(undefined);
        expect(undefinedResult.success).toBe(false);
    });

    it('rejects NaN', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(Number.NaN);

        expect(result.success).toBe(false);
    });

    it('rejects Infinity', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(Number.POSITIVE_INFINITY);

        expect(result.success).toBe(false);
    });

    it('rejects -Infinity', () => {
        const schema = createAverageRatingField();

        const result = schema.safeParse(Number.NEGATIVE_INFINITY);

        expect(result.success).toBe(false);
    });
});
