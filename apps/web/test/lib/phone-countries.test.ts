/**
 * @file phone-countries.test.ts
 * @description Tests for the curated phone country list and its parse/compose
 * helpers (BETA-139).
 */

import { describe, expect, it } from 'vitest';
import {
    composePhoneValue,
    DEFAULT_PHONE_COUNTRY,
    findPhoneCountryByLabel,
    formatPhoneCountryLabel,
    PHONE_COUNTRIES,
    parsePhoneValue
} from '@/lib/phone-countries';

describe('phone-countries', () => {
    describe('PHONE_COUNTRIES', () => {
        it('should have Argentina first as the default country', () => {
            expect(PHONE_COUNTRIES[0]?.iso).toBe('AR');
            expect(DEFAULT_PHONE_COUNTRY.iso).toBe('AR');
        });

        it('should not contain duplicate ISO codes', () => {
            const isoCodes = PHONE_COUNTRIES.map((country) => country.iso);
            expect(new Set(isoCodes).size).toBe(isoCodes.length);
        });
    });

    describe('formatPhoneCountryLabel', () => {
        it('should format as "<name> (<dialCode>)"', () => {
            expect(formatPhoneCountryLabel({ iso: 'AR', dialCode: '+54', name: 'Argentina' })).toBe(
                'Argentina (+54)'
            );
        });
    });

    describe('findPhoneCountryByLabel', () => {
        it('should find a country by its exact formatted label', () => {
            const found = findPhoneCountryByLabel('Uruguay (+598)');
            expect(found?.iso).toBe('UY');
        });

        it('should return undefined for a partial/unmatched label', () => {
            expect(findPhoneCountryByLabel('Uru')).toBeUndefined();
            expect(findPhoneCountryByLabel('')).toBeUndefined();
        });
    });

    describe('parsePhoneValue', () => {
        it('should split a known dial code from the local number', () => {
            const result = parsePhoneValue('+54 9 343 1234567');
            expect(result.country.iso).toBe('AR');
            expect(result.number).toBe('9 343 1234567');
        });

        it('should resolve a different known dial code (Uruguay)', () => {
            const result = parsePhoneValue('+598 9 111 222');
            expect(result.country.iso).toBe('UY');
            expect(result.number).toBe('9 111 222');
        });

        it('should default to Argentina and keep the full value when no known dial code matches', () => {
            const result = parsePhoneValue('343 1234567');
            expect(result.country.iso).toBe('AR');
            expect(result.number).toBe('343 1234567');
        });

        it('should return an empty number for an empty/undefined/null value, never dropping data', () => {
            expect(parsePhoneValue('')).toEqual({ country: DEFAULT_PHONE_COUNTRY, number: '' });
            expect(parsePhoneValue(undefined)).toEqual({
                country: DEFAULT_PHONE_COUNTRY,
                number: ''
            });
            expect(parsePhoneValue(null)).toEqual({ country: DEFAULT_PHONE_COUNTRY, number: '' });
        });

        it('should trim surrounding whitespace', () => {
            const result = parsePhoneValue('  +54 9 343 1234567  ');
            expect(result.country.iso).toBe('AR');
            expect(result.number).toBe('9 343 1234567');
        });
    });

    describe('composePhoneValue', () => {
        it('should join dial code and number with a single space', () => {
            expect(
                composePhoneValue({
                    country: { iso: 'AR', dialCode: '+54', name: 'Argentina' },
                    number: '9 343 1234567'
                })
            ).toBe('+54 9 343 1234567');
        });

        it('should return an empty string when the number is blank, never saving a bare dial code', () => {
            expect(
                composePhoneValue({
                    country: { iso: 'AR', dialCode: '+54', name: 'Argentina' },
                    number: ''
                })
            ).toBe('');
            expect(
                composePhoneValue({
                    country: { iso: 'AR', dialCode: '+54', name: 'Argentina' },
                    number: '   '
                })
            ).toBe('');
        });
    });

    describe('round-trip', () => {
        it('should recover the original value after parse -> compose', () => {
            const original = '+55 11 91234-5678';
            const { country, number } = parsePhoneValue(original);
            expect(composePhoneValue({ country, number })).toBe(original);
        });
    });
});
