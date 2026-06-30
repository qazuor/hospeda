/**
 * @file ProfileCompletion.helpers.test.ts
 * @description Unit tests for the pure validation and computation helpers extracted from
 * `ProfileCompletion.client.tsx` (SPEC-113 T-113-09 — updated for polish round).
 * These mirror the server-side Zod validation in `CompleteProfileBodySchema`.
 */

import { describe, expect, it } from 'vitest';
import {
    COUNTRY_CODES,
    LOCATION_COUNTRIES,
    SOCIAL_PLATFORMS,
    computeDisplayName,
    computeInitialDisplayNameOverride,
    splitFullName,
    validateProfileCompletionFields
} from '../../../src/components/account/ProfileCompletion.helpers';

// ─── validateProfileCompletionFields ─────────────────────────────────────────

describe('validateProfileCompletionFields', () => {
    const baseValid = {
        firstName: 'Maria',
        lastName: 'Fernanda',
        phone: '',
        acceptedTerms: true
    };

    it('returns empty errors for a minimally valid input', () => {
        // Arrange / Act
        const errors = validateProfileCompletionFields(baseValid);
        // Assert
        expect(errors).toEqual({});
    });

    // ── firstName ──────────────────────────────────────────────────────────────

    describe('firstName', () => {
        it('flags empty string as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, firstName: '' });
            expect(errors.firstName).toBe('required');
        });

        it('flags whitespace-only as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, firstName: '   ' });
            expect(errors.firstName).toBe('required');
        });

        it('accepts a single character', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, firstName: 'A' });
            expect(errors.firstName).toBeUndefined();
        });

        it('flags strings longer than 50 chars as max', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                firstName: 'a'.repeat(51)
            });
            expect(errors.firstName).toBe('max');
        });

        it('accepts exactly 50 characters', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                firstName: 'a'.repeat(50)
            });
            expect(errors.firstName).toBeUndefined();
        });
    });

    // ── lastName ───────────────────────────────────────────────────────────────

    describe('lastName', () => {
        it('flags empty string as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, lastName: '' });
            expect(errors.lastName).toBe('required');
        });

        it('flags whitespace-only as required', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, lastName: '   ' });
            expect(errors.lastName).toBe('required');
        });

        it('accepts a single character', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, lastName: 'A' });
            expect(errors.lastName).toBeUndefined();
        });

        it('flags strings longer than 50 chars as max', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                lastName: 'a'.repeat(51)
            });
            expect(errors.lastName).toBe('max');
        });
    });

    // ── phone ──────────────────────────────────────────────────────────────────

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

        it('accepts a short but E.164-valid number (no artificial min length)', () => {
            // The canonical InternationalPhoneRegex allows 2+ digits; the old
            // client-only /^\+\d{7,15}$/ wrongly rejected this. Now kept in sync
            // with the server's CompleteProfileBodySchema.
            const errors = validateProfileCompletionFields({ ...baseValid, phone: '+12345' });
            expect(errors.phone).toBeUndefined();
        });

        it('flags a leading-zero country digit as format error', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, phone: '+0123456' });
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

    // ── birthDate (optional) ─────────────────────────────────────────────────────

    describe('birthDate', () => {
        it('skips validation when birthDate is undefined', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, birthDate: undefined });
            expect(errors.birthDate).toBeUndefined();
        });

        it('skips validation when birthDate is empty', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, birthDate: '' });
            expect(errors.birthDate).toBeUndefined();
        });

        it('accepts a valid dd/mm/yyyy date', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                birthDate: '15/05/1990'
            });
            expect(errors.birthDate).toBeUndefined();
        });

        it('flags a calendar-impossible date (roll-over) as invalid', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                birthDate: '31/02/2000'
            });
            expect(errors.birthDate).toBe('invalid');
        });

        it('flags an incomplete date as invalid', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, birthDate: '12/05' });
            expect(errors.birthDate).toBe('invalid');
        });
    });

    // ── terms ──────────────────────────────────────────────────────────────────

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

    // ── bio (optional) ─────────────────────────────────────────────────────────

    describe('bio', () => {
        it('skips validation when bio is undefined', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, bio: undefined });
            expect(errors.bio).toBeUndefined();
        });

        it('skips validation when bio is empty string', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, bio: '' });
            expect(errors.bio).toBeUndefined();
        });

        it('flags bio shorter than 10 chars as min', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, bio: 'short' });
            expect(errors.bio).toBe('min');
        });

        it('accepts bio with exactly 10 chars', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                bio: '1234567890'
            });
            expect(errors.bio).toBeUndefined();
        });

        it('accepts bio with exactly 300 chars', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                bio: 'a'.repeat(300)
            });
            expect(errors.bio).toBeUndefined();
        });

        it('flags bio longer than 300 chars as max', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                bio: 'a'.repeat(301)
            });
            expect(errors.bio).toBe('max');
        });
    });

    // ── website (optional) ─────────────────────────────────────────────────────

    describe('website', () => {
        it('skips validation when website is undefined', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, website: undefined });
            expect(errors.website).toBeUndefined();
        });

        it('skips validation when website is empty string', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, website: '' });
            expect(errors.website).toBeUndefined();
        });

        it('accepts a valid https URL', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                website: 'https://mipagina.com'
            });
            expect(errors.website).toBeUndefined();
        });

        it('accepts a valid http URL', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                website: 'http://example.com/path'
            });
            expect(errors.website).toBeUndefined();
        });

        it('flags non-URL string as url error', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                website: 'not-a-url'
            });
            expect(errors.website).toBe('url');
        });

        it('flags plain domain without protocol as url error', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                website: 'example.com'
            });
            expect(errors.website).toBe('url');
        });
    });

    // ── occupation (optional) ──────────────────────────────────────────────────

    describe('occupation', () => {
        it('skips validation when occupation is undefined', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                occupation: undefined
            });
            expect(errors.occupation).toBeUndefined();
        });

        it('skips validation when occupation is empty string', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, occupation: '' });
            expect(errors.occupation).toBeUndefined();
        });

        it('flags occupation shorter than 2 chars as min', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                occupation: 'a'
            });
            expect(errors.occupation).toBe('min');
        });

        it('accepts occupation with exactly 2 chars', () => {
            const errors = validateProfileCompletionFields({ ...baseValid, occupation: 'DJ' });
            expect(errors.occupation).toBeUndefined();
        });

        it('flags occupation longer than 100 chars as max', () => {
            const errors = validateProfileCompletionFields({
                ...baseValid,
                occupation: 'a'.repeat(101)
            });
            expect(errors.occupation).toBe('max');
        });
    });

    // ── multiple errors ────────────────────────────────────────────────────────

    it('accumulates multiple errors at once', () => {
        const errors = validateProfileCompletionFields({
            firstName: '',
            lastName: '',
            phone: 'abc',
            acceptedTerms: false,
            bio: 'short',
            website: 'not-a-url'
        });
        expect(errors.firstName).toBe('required');
        expect(errors.lastName).toBe('required');
        expect(errors.phone).toBe('format');
        expect(errors.terms).toBe('required');
        expect(errors.bio).toBe('min');
        expect(errors.website).toBe('url');
    });
});

// ─── computeDisplayName ───────────────────────────────────────────────────────

describe('computeDisplayName', () => {
    it('derives display name from first + last when override is empty', () => {
        const result = computeDisplayName({
            firstName: 'Maria',
            lastName: 'Fernanda',
            override: ''
        });
        expect(result).toBe('Maria Fernanda');
    });

    it('trims both names before concatenating', () => {
        const result = computeDisplayName({
            firstName: '  Maria  ',
            lastName: '  Fernanda  ',
            override: ''
        });
        expect(result).toBe('Maria Fernanda');
    });

    it('uses the override when it is non-empty', () => {
        const result = computeDisplayName({
            firstName: 'Maria',
            lastName: 'Fernanda',
            override: 'MaFer'
        });
        expect(result).toBe('MaFer');
    });

    it('trims the override before using it', () => {
        const result = computeDisplayName({
            firstName: 'Maria',
            lastName: 'Fernanda',
            override: '  MaFer  '
        });
        expect(result).toBe('MaFer');
    });

    it('falls back to auto-derived when override is whitespace-only', () => {
        const result = computeDisplayName({
            firstName: 'Maria',
            lastName: 'Fernanda',
            override: '   '
        });
        expect(result).toBe('Maria Fernanda');
    });

    it('handles empty firstName (only lastName provided)', () => {
        const result = computeDisplayName({
            firstName: '',
            lastName: 'Fernanda',
            override: ''
        });
        expect(result).toBe('Fernanda');
    });

    it('handles empty lastName (only firstName provided)', () => {
        const result = computeDisplayName({
            firstName: 'Maria',
            lastName: '',
            override: ''
        });
        expect(result).toBe('Maria');
    });
});

// ─── computeInitialDisplayNameOverride ──────────────────────────────────────────

describe('computeInitialDisplayNameOverride', () => {
    it('seeds the override with the display name when no firstName is present', () => {
        expect(
            computeInitialDisplayNameOverride({
                initialDisplayName: 'Juan Pérez',
                initialFirstName: ''
            })
        ).toBe('Juan Pérez');
    });

    it('returns empty when a firstName is present so the name auto-derives (B1 keystone)', () => {
        // Regression for B1: a Google sign-up now passes initialFirstName, which
        // MUST leave the override empty — otherwise the display name freezes to
        // the raw session name instead of tracking first/last name edits.
        expect(
            computeInitialDisplayNameOverride({
                initialDisplayName: 'Juan Pérez',
                initialFirstName: 'Juan'
            })
        ).toBe('');
    });

    it('returns empty when both inputs are empty', () => {
        expect(
            computeInitialDisplayNameOverride({ initialDisplayName: '', initialFirstName: '' })
        ).toBe('');
    });
});

// ─── splitFullName ────────────────────────────────────────────────────────────

describe('splitFullName', () => {
    // Regression for B1: a Google sign-up landed on an empty completion form
    // because user.name was never split into the firstName/lastName inputs.
    it('splits a two-token name into first + last', () => {
        expect(splitFullName({ fullName: 'Juan Pérez' })).toEqual({
            firstName: 'Juan',
            lastName: 'Pérez'
        });
    });

    it('puts every token after the first into lastName (compound names)', () => {
        expect(splitFullName({ fullName: 'María José García López' })).toEqual({
            firstName: 'María',
            lastName: 'José García López'
        });
    });

    it('returns the single token as firstName with empty lastName', () => {
        expect(splitFullName({ fullName: 'Cher' })).toEqual({
            firstName: 'Cher',
            lastName: ''
        });
    });

    it('collapses internal and surrounding whitespace before splitting', () => {
        expect(splitFullName({ fullName: '  Juan   Carlos  Pérez  ' })).toEqual({
            firstName: 'Juan',
            lastName: 'Carlos Pérez'
        });
    });

    it('returns empty strings for an empty name', () => {
        expect(splitFullName({ fullName: '' })).toEqual({ firstName: '', lastName: '' });
    });

    it('returns empty strings for a whitespace-only name', () => {
        expect(splitFullName({ fullName: '   ' })).toEqual({ firstName: '', lastName: '' });
    });

    it('returns empty strings when fullName is undefined', () => {
        expect(splitFullName({})).toEqual({ firstName: '', lastName: '' });
    });
});

// ─── COUNTRY_CODES ────────────────────────────────────────────────────────────

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

// ─── LOCATION_COUNTRIES ───────────────────────────────────────────────────────

describe('LOCATION_COUNTRIES', () => {
    it('lists Argentina first', () => {
        expect(LOCATION_COUNTRIES[0]?.code).toBe('AR');
    });

    it('includes OTHER as last entry for unlisted countries', () => {
        const last = LOCATION_COUNTRIES[LOCATION_COUNTRIES.length - 1];
        expect(last?.code).toBe('OTHER');
    });

    it('includes all primary region countries', () => {
        const codes = LOCATION_COUNTRIES.map((c) => c.code);
        expect(codes).toContain('AR');
        expect(codes).toContain('UY');
        expect(codes).toContain('BR');
        expect(codes).toContain('CL');
        expect(codes).toContain('PY');
    });
});

// ─── SOCIAL_PLATFORMS ─────────────────────────────────────────────────────────

describe('SOCIAL_PLATFORMS', () => {
    it('contains exactly 6 platforms', () => {
        expect(SOCIAL_PLATFORMS).toHaveLength(6);
    });

    it('includes all expected platform keys', () => {
        const keys = SOCIAL_PLATFORMS.map((p) => p.key);
        expect(keys).toContain('facebook');
        expect(keys).toContain('instagram');
        expect(keys).toContain('twitter');
        expect(keys).toContain('linkedIn');
        expect(keys).toContain('tiktok');
        expect(keys).toContain('youtube');
    });

    it('each platform has a non-empty label and placeholder', () => {
        for (const platform of SOCIAL_PLATFORMS) {
            expect(platform.label.length).toBeGreaterThan(0);
            expect(platform.placeholder.length).toBeGreaterThan(0);
        }
    });

    it('each placeholder is a valid URL pattern', () => {
        for (const platform of SOCIAL_PLATFORMS) {
            expect(platform.placeholder).toMatch(/^https:\/\//);
        }
    });
});
