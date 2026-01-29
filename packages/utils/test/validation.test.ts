import { describe, expect, it } from 'vitest';
import {
    isBoolean,
    isDefined,
    isFunction,
    isNumber,
    isString,
    isValidEmail,
    isValidPassword,
    isValidPhone,
    isValidUrl
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
});
