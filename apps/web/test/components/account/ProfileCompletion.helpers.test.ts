/**
 * @file ProfileCompletion.helpers.test.ts
 * @description Unit tests for the pure computation helpers extracted from
 * `ProfileCompletion.client.tsx` (SPEC-113 T-113-09 — updated for polish round).
 *
 * HOS-190 slice 3: `validateProfileCompletionFields` (and its dedicated test
 * suite that used to live here) was removed — submit-time validation is now
 * `CompleteProfileBodySchema.safeParse()` via the shared `useZodForm`
 * primitive, exercised in `ProfileCompletion.client.test.tsx`.
 */

import { describe, expect, it } from 'vitest';
import {
    COUNTRY_CODES,
    computeDisplayName,
    computeInitialDisplayNameOverride,
    LOCATION_COUNTRIES,
    SOCIAL_PLATFORMS,
    splitFullName
} from '../../../src/components/account/ProfileCompletion.helpers';

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
