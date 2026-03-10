/**
 * Tests for validate-form.ts utilities.
 *
 * Covers:
 * - extractZodIssueParams: parameter extraction from ZodIssue variants
 * - validateFormWithZod: full schema validation returning field → message map
 * - validateFieldWithZod: single-field validation
 * - End-to-end params interpolation via the mock t function
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock @repo/i18n before importing the module under test so that
// resolveValidationMessage is replaced with a deterministic implementation.
vi.mock('@repo/i18n', () => ({
    resolveValidationMessage: vi.fn(
        ({
            key,
            t,
            params
        }: {
            key: string;
            t: (key: string, params?: Record<string, unknown>) => string;
            params?: Record<string, unknown>;
        }) => t(key, params)
    )
}));

import {
    extractZodIssueParams,
    validateFieldWithZod,
    validateFormWithZod
} from '../../../src/lib/validation/validate-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock translation function.
 *
 * Returns the key unchanged, but substitutes `{{param}}` placeholders when
 * params are provided — mirrors the real i18n interpolation contract.
 */
function createMockT() {
    return vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params) {
            let result = key;
            for (const [k, v] of Object.entries(params)) {
                result = result.replace(`{{${k}}}`, String(v));
            }
            return result;
        }
        return key;
    });
}

// ---------------------------------------------------------------------------
// Shared test schemas
// ---------------------------------------------------------------------------

const testSchema = z.object({
    name: z.string({ message: 'zodError.test.name.invalidType' }).min(2, 'zodError.test.name.min'),
    email: z.string().email('zodError.test.email.invalid'),
    price: z.object({
        basePrice: z
            .number({ message: 'zodError.test.price.basePrice.invalidType' })
            .min(0, 'zodError.test.price.basePrice.min')
    })
});

const testUpdateSchema = testSchema.partial();

// ---------------------------------------------------------------------------
// extractZodIssueParams
// ---------------------------------------------------------------------------

describe('extractZodIssueParams', () => {
    describe('too_small issue', () => {
        it('should extract { min } from a too_small string issue', () => {
            // Arrange — trigger a too_small issue on a string field
            const schema = z.string().min(5, 'err.min');
            const parseResult = schema.safeParse('ab');

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert
            expect(params).toEqual({ min: 5 });
        });

        it('should extract { min } from a too_small number issue', () => {
            // Arrange
            const schema = z.number().min(10, 'err.min');
            const parseResult = schema.safeParse(3);

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert
            expect(params).toEqual({ min: 10 });
        });
    });

    describe('too_big issue', () => {
        it('should extract { max } from a too_big string issue', () => {
            // Arrange
            const schema = z.string().max(3, 'err.max');
            const parseResult = schema.safeParse('toolong');

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert
            expect(params).toEqual({ max: 3 });
        });

        it('should extract { max } from a too_big number issue', () => {
            // Arrange
            const schema = z.number().max(100, 'err.max');
            const parseResult = schema.safeParse(999);

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert
            expect(params).toEqual({ max: 100 });
        });
    });

    describe('invalid_type issue', () => {
        it('should extract { expected } from an invalid_type issue', () => {
            // Arrange — pass a string where a number is expected.
            // In Zod v4 the `received` property is NOT present on invalid_type
            // issues; only `expected` is available.
            const schema = z.number({ message: 'err.type' });
            const parseResult = schema.safeParse('not-a-number');

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();
            expect(issue!.code).toBe('invalid_type');

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert — extractZodIssueParams only adds a key when the property
            // exists on the issue object.  Zod v4 exposes `expected` but drops
            // `received` from the issue shape, so only `expected` is extracted.
            expect(params).toHaveProperty('expected', 'number');
            // `received` is absent in Zod v4 invalid_type issues
            expect(params).not.toHaveProperty('received');
        });
    });

    describe('issue with no extra properties', () => {
        it('should return empty object for a custom issue without extra properties', () => {
            // Arrange — invalid_string (email) carries no min/max/expected/received
            const schema = z.string().email('err.email');
            const parseResult = schema.safeParse('not-an-email');

            expect(parseResult.success).toBe(false);
            if (parseResult.success) return;

            const issue = parseResult.error.issues[0];
            expect(issue).toBeDefined();

            // Act
            const params = extractZodIssueParams({ issue: issue! });

            // Assert — only keys that exist in issue should appear; email
            // validation may produce `validation` but NOT min/max/expected/received
            expect(params).not.toHaveProperty('min');
            expect(params).not.toHaveProperty('max');
        });
    });
});

// ---------------------------------------------------------------------------
// validateFormWithZod
// ---------------------------------------------------------------------------

describe('validateFormWithZod', () => {
    describe('when data is valid', () => {
        it('should return empty error map for fully valid data', () => {
            // Arrange
            const t = createMockT();
            const data = {
                name: 'Alice',
                email: 'alice@example.com',
                'price.basePrice': 50
            };

            // Act
            const errors = validateFormWithZod({ schema: testSchema, data, t });

            // Assert
            expect(errors).toEqual({});
        });
    });

    describe('when required field is missing', () => {
        it('should return translated error for the missing field', () => {
            // Arrange
            const t = createMockT();
            const data = {
                // name is absent — triggers invalid_type (expected string, received undefined)
                email: 'alice@example.com',
                'price.basePrice': 50
            };

            // Act
            const errors = validateFormWithZod({ schema: testSchema, data, t });

            // Assert
            expect(errors).toHaveProperty('name');
            expect(typeof errors.name).toBe('string');
            expect(errors.name!.length).toBeGreaterThan(0);
        });
    });

    describe('when multiple fields are invalid', () => {
        it('should return one entry per invalid field', () => {
            // Arrange
            const t = createMockT();
            const data = {
                // name too short, email malformed, basePrice missing
                name: 'A',
                email: 'not-an-email',
                'price.basePrice': 50
            };

            // Act
            const errors = validateFormWithZod({ schema: testSchema, data, t });

            // Assert
            expect(Object.keys(errors).length).toBeGreaterThanOrEqual(2);
            expect(errors).toHaveProperty('name');
            expect(errors).toHaveProperty('email');
        });
    });

    describe('nested field paths', () => {
        it('should produce dot-notation field ids for nested fields', () => {
            // Arrange — provide `price.basePrice` as a flat dot-notation key so
            // that unflattenValues builds `{ price: { basePrice: undefined } }`.
            // This ensures Zod emits a path of ['price', 'basePrice'] rather than
            // just ['price'] (which happens when the whole `price` object is absent).
            const t = createMockT();
            const data: Record<string, unknown> = {
                name: 'Alice',
                email: 'alice@example.com',
                'price.basePrice': undefined // present key, missing value
            };

            // Act
            const errors = validateFormWithZod({ schema: testSchema, data, t });

            // Assert — nested path must be joined with a dot.
            // Use Object.keys() to check the literal key string because Vitest's
            // toHaveProperty() interprets dots as path separators.
            expect(Object.keys(errors)).toContain('price.basePrice');
        });
    });

    describe('with update (partial) schema', () => {
        it('should allow missing fields when schema is .partial()', () => {
            // Arrange
            const t = createMockT();
            // No fields at all — partial schema makes them all optional
            const data: Record<string, unknown> = {};

            // Act
            const errors = validateFormWithZod({ schema: testUpdateSchema, data, t });

            // Assert
            expect(errors).toEqual({});
        });

        it('should still validate fields that are present', () => {
            // Arrange
            const t = createMockT();
            const data = { name: 'A' }; // present but too short

            // Act
            const errors = validateFormWithZod({ schema: testUpdateSchema, data, t });

            // Assert
            expect(errors).toHaveProperty('name');
        });
    });
});

// ---------------------------------------------------------------------------
// validateFieldWithZod
// ---------------------------------------------------------------------------

describe('validateFieldWithZod', () => {
    describe('when the target field is invalid', () => {
        it('should return the translated error message for that field', () => {
            // Arrange
            const t = createMockT();
            const data = {
                name: 'A', // too short
                email: 'alice@example.com',
                'price.basePrice': 50
            };

            // Act
            const error = validateFieldWithZod({
                schema: testSchema,
                data,
                fieldId: 'name',
                t
            });

            // Assert
            expect(error).toBeDefined();
            expect(typeof error).toBe('string');
            expect((error ?? '').length).toBeGreaterThan(0);
        });

        it('should return only the error for the requested field, not others', () => {
            // Arrange
            const t = createMockT();
            const data = {
                name: 'A', // too short
                email: 'not-an-email' // also invalid, but we ask for 'name' only
            };

            // Act
            const error = validateFieldWithZod({
                schema: testSchema,
                data,
                fieldId: 'name',
                t
            });

            // Assert — returns a single string, not an object with multiple keys
            expect(typeof error).toBe('string');
        });
    });

    describe('when the target field is valid', () => {
        it('should return undefined', () => {
            // Arrange
            const t = createMockT();
            const data = {
                name: 'Alice', // valid
                email: 'not-an-email', // other field invalid, but we ask for 'name'
                'price.basePrice': 50
            };

            // Act
            const error = validateFieldWithZod({
                schema: testSchema,
                data,
                fieldId: 'name',
                t
            });

            // Assert
            expect(error).toBeUndefined();
        });

        it('should return undefined when all data is valid', () => {
            // Arrange
            const t = createMockT();
            const data = {
                name: 'Alice',
                email: 'alice@example.com',
                'price.basePrice': 50
            };

            // Act
            const error = validateFieldWithZod({
                schema: testSchema,
                data,
                fieldId: 'email',
                t
            });

            // Assert
            expect(error).toBeUndefined();
        });
    });
});

// ---------------------------------------------------------------------------
// End-to-end: params interpolation
// ---------------------------------------------------------------------------

describe('end-to-end params interpolation', () => {
    it('should resolve {{min}} placeholder in translated key for too_small constraint', () => {
        // Arrange — schema uses a message key that contains {{min}} placeholder
        const minConstraintSchema = z.object({
            title: z.string().min(5, 'zodError.test.title.minLength')
        });

        const t = createMockT();
        // Simulate what the real t function does: replace {{min}} with the
        // actual value when the key is 'zodError.test.title.minLength'
        t.mockImplementation((key: string, params?: Record<string, unknown>) => {
            if (key === 'zodError.test.title.minLength' && params?.min !== undefined) {
                return 'El título debe tener al menos {{min}} caracteres'.replace(
                    '{{min}}',
                    String(params.min)
                );
            }
            return key;
        });

        const data = { title: 'Hi' }; // length 2, below min 5

        // Act
        const errors = validateFormWithZod({ schema: minConstraintSchema, data, t });

        // Assert — the message includes the interpolated min value
        expect(errors).toHaveProperty('title');
        expect(errors.title).toContain('5');
        expect(errors.title).toBe('El título debe tener al menos 5 caracteres');
    });

    it('should pass params object to t function when issue has minimum', () => {
        // Arrange
        const schema = z.object({
            count: z.number().min(10, 'zodError.count.min')
        });

        const t = createMockT();
        const data = { count: 1 };

        // Act
        validateFormWithZod({ schema, data, t });

        // Assert — t was called with params that include { min: 10 }
        const calls = t.mock.calls;
        const callWithMin = calls.find(
            ([, params]) => params !== undefined && 'min' in (params as Record<string, unknown>)
        );
        expect(callWithMin).toBeDefined();
        expect((callWithMin?.[1] as Record<string, unknown>).min).toBe(10);
    });
});
