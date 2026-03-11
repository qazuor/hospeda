/**
 * Tests for validateField helper (GAP-009).
 *
 * Verifies each validation rule, edge cases, and i18n key output.
 */

import { describe, expect, it } from 'vitest';
import { validateField } from '../../../src/lib/validation/validate-field';

describe('validateField', () => {
    describe('required rule', () => {
        it('should return required key for empty string', () => {
            const result = validateField('', { required: true });
            expect(result).toBe('validationError.field.required');
        });

        it('should return required key for whitespace-only string', () => {
            const result = validateField('   ', { required: true });
            expect(result).toBe('validationError.field.required');
        });

        it('should return undefined for non-empty string', () => {
            const result = validateField('hello', { required: true });
            expect(result).toBeUndefined();
        });

        it('should return undefined when required is false and value is empty', () => {
            const result = validateField('', { required: false });
            expect(result).toBeUndefined();
        });
    });

    describe('minLength rule', () => {
        it('should return tooSmall key when value is shorter than minLength', () => {
            const result = validateField('ab', { minLength: 5 });
            expect(result).toBe('validationError.field.tooSmall');
        });

        it('should return undefined when value equals minLength (boundary)', () => {
            const result = validateField('hello', { minLength: 5 });
            expect(result).toBeUndefined();
        });

        it('should return undefined when value exceeds minLength', () => {
            const result = validateField('hello world', { minLength: 5 });
            expect(result).toBeUndefined();
        });

        it('should not validate empty optional field (skip rule for empty)', () => {
            const result = validateField('', { minLength: 3 });
            expect(result).toBeUndefined();
        });
    });

    describe('maxLength rule', () => {
        it('should return tooBig key when value exceeds maxLength', () => {
            const result = validateField('hello world', { maxLength: 5 });
            expect(result).toBe('validationError.field.tooBig');
        });

        it('should return undefined when value equals maxLength (boundary)', () => {
            const result = validateField('hello', { maxLength: 5 });
            expect(result).toBeUndefined();
        });

        it('should return undefined when value is shorter than maxLength', () => {
            const result = validateField('hi', { maxLength: 5 });
            expect(result).toBeUndefined();
        });
    });

    describe('email rule', () => {
        it('should return invalidEmail key for a non-email string', () => {
            const result = validateField('not-an-email', { email: true });
            expect(result).toBe('validationError.field.invalidEmail');
        });

        it('should return undefined for a valid email', () => {
            const result = validateField('user@example.com', { email: true });
            expect(result).toBeUndefined();
        });

        it('should return invalidEmail for email without domain', () => {
            const result = validateField('user@', { email: true });
            expect(result).toBe('validationError.field.invalidEmail');
        });

        it('should return invalidEmail for email without TLD', () => {
            const result = validateField('user@domain', { email: true });
            expect(result).toBe('validationError.field.invalidEmail');
        });
    });

    describe('pattern rule', () => {
        it('should return invalidFormat key when value does not match pattern', () => {
            const result = validateField('abc', { pattern: /^\d+$/ });
            expect(result).toBe('validationError.field.invalidFormat');
        });

        it('should return undefined when value matches pattern', () => {
            const result = validateField('12345', { pattern: /^\d+$/ });
            expect(result).toBeUndefined();
        });

        it('should use patternKey when provided', () => {
            const result = validateField('abc', {
                pattern: /^\d+$/,
                patternKey: 'zodError.common.code.invalidFormat'
            });
            expect(result).toBe('zodError.common.code.invalidFormat');
        });
    });

    describe('rule evaluation order', () => {
        it('should evaluate required before minLength', () => {
            // Empty string triggers required before minLength
            const result = validateField('', { required: true, minLength: 3 });
            expect(result).toBe('validationError.field.required');
        });

        it('should evaluate minLength before maxLength', () => {
            // 1 char is below min (3) — minLength fires before maxLength (100)
            const result = validateField('a', { minLength: 3, maxLength: 100 });
            expect(result).toBe('validationError.field.tooSmall');
        });

        it('should evaluate email before pattern when both provided', () => {
            // Invalid email — email rule fires before pattern
            const result = validateField('bad', { email: true, pattern: /^.{10,}$/ });
            expect(result).toBe('validationError.field.invalidEmail');
        });
    });

    describe('edge cases', () => {
        it('should return undefined when no rules are provided', () => {
            const result = validateField('any value', {});
            expect(result).toBeUndefined();
        });

        it('should return undefined for empty value with no rules', () => {
            const result = validateField('', {});
            expect(result).toBeUndefined();
        });

        it('should trim whitespace before evaluating minLength', () => {
            // "  ab  " trimmed is "ab" (2 chars) — below minLength 3
            const result = validateField('  ab  ', { minLength: 3 });
            expect(result).toBe('validationError.field.tooSmall');
        });
    });
});
