import { describe, expect, it } from 'vitest';
import {
    isBoolean,
    isDefined,
    isFunction,
    isNumber,
    isString,
    isUsableEntityId,
    isValidEmail,
    isValidPassword,
    isValidPhone,
    isValidUrl,
    NIL_UUID
} from '../src/validation';

describe('Validation Utilities', () => {
    describe('isDefined', () => {
        it('returns false for undefined', () => {
            expect(isDefined(undefined)).toBe(false);
        });

        it('returns false for null', () => {
            expect(isDefined(null)).toBe(false);
        });

        it('returns true for defined values', () => {
            expect(isDefined(0)).toBe(true);
            expect(isDefined('')).toBe(true);
            expect(isDefined(false)).toBe(true);
            expect(isDefined({})).toBe(true);
        });
    });

    describe('isValidEmail', () => {
        it('returns true for valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.org')).toBe(true);
            expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
        });

        it('returns false for invalid emails', () => {
            expect(isValidEmail('not-an-email')).toBe(false);
            expect(isValidEmail('missing@domain')).toBe(false);
            expect(isValidEmail('@nodomain.com')).toBe(false);
            expect(isValidEmail('spaces @example.com')).toBe(false);
        });

        // Regression: ReDoS guard — 100k-char input must return false quickly without hanging.
        it('returns false quickly for an over-length input (ReDoS guard)', () => {
            // Arrange
            const oversizedEmail = 'a'.repeat(100_000);
            // Act
            const start = Date.now();
            const result = isValidEmail(oversizedEmail);
            const elapsed = Date.now() - start;
            // Assert
            expect(result).toBe(false);
            // Should complete in well under 100 ms (guard fires before the regex).
            expect(elapsed).toBeLessThan(100);
        });

        it('returns false for a 255-char email (above RFC 5321 limit)', () => {
            // Arrange
            const longEmail = `${'a'.repeat(243)}@example.com`; // 255 chars
            // Act / Assert
            expect(isValidEmail(longEmail)).toBe(false);
        });

        it('returns true for a 254-char email at the RFC 5321 boundary', () => {
            // Arrange — exactly 254 chars: 242 local + @example.com (12)
            const boundaryEmail = `${'a'.repeat(242)}@example.com`;
            // Act / Assert
            expect(isValidEmail(boundaryEmail)).toBe(true);
        });
    });

    describe('isValidUrl', () => {
        it('returns true for valid URLs', () => {
            expect(isValidUrl('https://example.com')).toBe(true);
            expect(isValidUrl('http://localhost:3000')).toBe(true);
            expect(isValidUrl('ftp://files.example.com')).toBe(true);
        });

        it('returns false for invalid URLs', () => {
            expect(isValidUrl('not-a-url')).toBe(false);
            expect(isValidUrl('www.example.com')).toBe(false);
        });
    });

    describe('isValidPhone', () => {
        it('returns true for valid phone numbers', () => {
            expect(isValidPhone('+1234567890')).toBe(true);
            expect(isValidPhone('1234567890')).toBe(true);
            expect(isValidPhone('+541234567890')).toBe(true);
        });

        it('returns false for invalid phone numbers', () => {
            expect(isValidPhone('123')).toBe(false);
            expect(isValidPhone('abc1234567')).toBe(false);
            expect(isValidPhone('123-456-7890')).toBe(false);
        });
    });

    describe('isValidPassword', () => {
        it('returns true for valid passwords with default options', () => {
            expect(isValidPassword('SecurePass1!')).toBe(true);
        });

        it('returns false for too short passwords', () => {
            expect(isValidPassword('Short1!')).toBe(false);
        });

        it('returns false for passwords missing uppercase', () => {
            expect(isValidPassword('lowercase1!')).toBe(false);
        });

        it('returns false for passwords missing lowercase', () => {
            expect(isValidPassword('UPPERCASE1!')).toBe(false);
        });

        it('returns false for passwords missing numbers', () => {
            expect(isValidPassword('NoNumbers!')).toBe(false);
        });

        it('returns false for passwords missing special characters', () => {
            expect(isValidPassword('NoSpecial1')).toBe(false);
        });

        it('respects custom options', () => {
            expect(
                isValidPassword('simplepass', {
                    requireUppercase: false,
                    requireNumbers: false,
                    requireSpecialChars: false
                })
            ).toBe(true);
        });
    });

    describe('isNumber', () => {
        it('returns true for numbers', () => {
            expect(isNumber(42)).toBe(true);
            expect(isNumber(3.14)).toBe(true);
            expect(isNumber(0)).toBe(true);
            expect(isNumber(-5)).toBe(true);
        });

        it('returns false for NaN', () => {
            expect(isNumber(Number.NaN)).toBe(false);
        });

        it('returns false for non-numbers', () => {
            expect(isNumber('42')).toBe(false);
            expect(isNumber(null)).toBe(false);
        });
    });

    describe('isString', () => {
        it('returns true for strings', () => {
            expect(isString('')).toBe(true);
            expect(isString('hello')).toBe(true);
        });

        it('returns false for non-strings', () => {
            expect(isString(42)).toBe(false);
            expect(isString(null)).toBe(false);
            expect(isString(undefined)).toBe(false);
        });
    });

    describe('isBoolean', () => {
        it('returns true for booleans', () => {
            expect(isBoolean(true)).toBe(true);
            expect(isBoolean(false)).toBe(true);
        });

        it('returns false for non-booleans', () => {
            expect(isBoolean(1)).toBe(false);
            expect(isBoolean('true')).toBe(false);
        });
    });

    describe('isFunction', () => {
        it('returns true for functions', () => {
            expect(isFunction(() => {})).toBe(true);
            expect(isFunction(function test() {})).toBe(true);
        });

        it('returns false for non-functions', () => {
            expect(isFunction({})).toBe(false);
            expect(isFunction('function')).toBe(false);
        });
    });

    describe('isUsableEntityId', () => {
        it('rejects the nil UUID even though it is a syntactically valid UUID', () => {
            // The whole point of this helper: `z.string().uuid()` accepts the
            // nil UUID, so schema validation is not enough to know an id can
            // identify a row. An LLM asked for an id it does not have answers
            // with exactly this value (HOS-298).
            expect(NIL_UUID).toBe('00000000-0000-0000-0000-000000000000');
            expect(isUsableEntityId(NIL_UUID)).toBe(false);
        });

        it('rejects absent and blank ids', () => {
            expect(isUsableEntityId(undefined)).toBe(false);
            expect(isUsableEntityId(null)).toBe(false);
            expect(isUsableEntityId('')).toBe(false);
            expect(isUsableEntityId('   ')).toBe(false);
        });

        it('accepts a real id', () => {
            expect(isUsableEntityId('a0000000-0000-4000-8000-000000000001')).toBe(true);
        });

        it('does not reject ids that merely start with zeros', () => {
            // Only the all-zero UUID is a placeholder; a real id may legitimately
            // begin with zeros and must not be thrown away with it.
            expect(isUsableEntityId('00000000-0000-4000-8000-000000000001')).toBe(true);
        });
    });
});
