/**
 * @file ProfileCompletion.helpers.test.ts
 * @description Unit tests for the pure validation helpers extracted from
 * `ProfileCompletion.client.tsx` (SPEC-113 T-113-09). These mirror the
 * server-side Zod validation in `CompleteProfileBodySchema`.
 */

import { describe, expect, it } from 'vitest';
import {
    COUNTRY_CODES,
    validateProfileCompletionFields
} from '../../../src/components/account/ProfileCompletion.helpers';

describe('validateProfileCompletionFields', () => {
    const baseValid = {
        displayName: 'Maria Fernanda',
        phone: '',
        acceptedTerms: true
    };

    it('returns empty errors for a minimally valid input', () => {
        expect(validateProfileCompletionFields(baseValid)).toEqual({});
    });

    describe('displayName', () => {
        it('flags empty string as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, displayName: '' });
            expect(errors.displayName).toBe('required');
        });

        it('flags whitespace-only as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, displayName: '   ' });
            expect(errors.displayName).toBe('required');
        });

        it('flags single character as min', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, displayName: 'A' });
            expect(errors.displayName).toBe('min');
        });

        it('accepts two characters', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, displayName: 'Al' });
            expect(errors.displayName).toBeUndefined();
        });

        it('flags strings longer than 50 chars as max', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                displayName: 'a'.repeat(51)
            });
            expect(errors.displayName).toBe('max');
        });
    });

    describe('phone', () => {
        it('accepts empty phone (optional field)', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, phone: '' });
            expect(errors.phone).toBeUndefined();
        });

        it('accepts a well-formed +54 number', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                phone: '+5493415551234'
            });
            expect(errors.phone).toBeUndefined();
        });

        it('strips spaces, dashes, parens before validating', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                phone: '+54 (341) 555-1234'
            });
            expect(errors.phone).toBeUndefined();
        });

        it('flags phone without leading + as format error', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                phone: '5493415551234'
            });
            expect(errors.phone).toBe('format');
        });

        it('flags phone shorter than 7 digits as format error', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, phone: '+12345' });
            expect(errors.phone).toBe('format');
        });

        it('flags phone longer than 15 digits as format error', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                phone: '+1234567890123456'
            });
            expect(errors.phone).toBe('format');
        });
    });

    describe('terms', () => {
        it('flags acceptedTerms=false as required', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                acceptedTerms: false
            });
            expect(errors.terms).toBe('required');
        });

        it('does not flag terms when acceptedTerms=true', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                acceptedTerms: true
            });
            expect(errors.terms).toBeUndefined();
        });
    });

    it('accumulates multiple errors at once', () => {
        const errors = validateProfileCompletionFields({
            displayName: '',
            phone: 'abc',
            acceptedTerms: false
        });
        expect(errors.displayName).toBe('required');
        expect(errors.phone).toBe('format');
        expect(errors.terms).toBe('required');
    });
});

describe('COUNTRY_CODES', () => {
    it('lists Argentina first (default market)', () => {
        expect(COUNTRY_CODES[0]?.code).toBe('+54');
    });

    it('contains the expected primary markets', () => {
        const codes = COUNTRY_CODES.map((c) => c.code);
        expect(codes).toContain('+54'); // AR
        expect(codes).toContain('+55'); // BR
        expect(codes).toContain('+598'); // UY
        expect(codes).toContain('+1'); // US/CA
        expect(codes).toContain('+34'); // ES
    });
});
