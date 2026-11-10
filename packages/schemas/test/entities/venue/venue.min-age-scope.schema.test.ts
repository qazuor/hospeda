/**
 * Validation of the venue minimum-age scope (HOS-2098), stored as
 * `policies.minAgeScope`: all day, from a time, or one sector or activity.
 */

import { describe, expect, it } from 'vitest';
import { LISTING_SECTIONS } from '../../../src/catalog/listing-sections.js';
import {
    resolveVenueMinAgeScope,
    VENUE_MIN_AGE_SCOPE_AREA_MAX,
    VenueMinAgeScopeSchema,
    VenuePoliciesSchema
} from '../../../src/entities/venue/subtypes/venue.policies.schema.js';

/** The first issue message of a failed parse. */
function firstMessage(value: unknown): string | undefined {
    const result = VenueMinAgeScopeSchema.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
}

describe('VenueMinAgeScopeSchema', () => {
    it.each([
        { kind: 'all_day' },
        { kind: 'from_time', from: '00:00' },
        { kind: 'from_time', from: '23:59' },
        { kind: 'area', area: { es: 'la pista', en: '', pt: '' } },
        { kind: 'area', area: { es: '', en: 'the show', pt: '' } }
    ])('accepts %j', (value) => {
        // Act
        const result = VenueMinAgeScopeSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(true);
    });

    it.each([
        '24:00',
        '7:05',
        '07:5',
        '12:60',
        '',
        'midnight'
    ])('rejects the time %j with the from.invalid key', (from) => {
        expect(firstMessage({ kind: 'from_time', from })).toBe(
            'zodError.venue.minAgeScope.from.invalid'
        );
    });

    it('rejects an area blank in every locale', () => {
        expect(firstMessage({ kind: 'area', area: { es: ' ', en: '', pt: '' } })).toBe(
            'zodError.venue.minAgeScope.area.required'
        );
    });

    it(`rejects an area over ${VENUE_MIN_AGE_SCOPE_AREA_MAX} characters`, () => {
        const long = 'a'.repeat(VENUE_MIN_AGE_SCOPE_AREA_MAX + 1);
        expect(firstMessage({ kind: 'area', area: { es: long, en: '', pt: '' } })).toBe(
            'zodError.venue.minAgeScope.area.tooLong'
        );
    });

    it('accepts an area of exactly the maximum length', () => {
        const max = 'a'.repeat(VENUE_MIN_AGE_SCOPE_AREA_MAX);
        expect(firstMessage({ kind: 'area', area: { es: max, en: max, pt: max } })).toBeUndefined();
    });

    it('rejects an unknown kind and a kind missing its value', () => {
        expect(VenueMinAgeScopeSchema.safeParse({ kind: 'tonight' }).success).toBe(false);
        expect(VenueMinAgeScopeSchema.safeParse({ kind: 'from_time' }).success).toBe(false);
        expect(VenueMinAgeScopeSchema.safeParse({ kind: 'area' }).success).toBe(false);
    });
});

describe('VenuePoliciesSchema.minAgeScope', () => {
    it('is optional: existing venues without a scope stay valid (unset means all day)', () => {
        expect(VenuePoliciesSchema.safeParse({ minAge: 18 }).success).toBe(true);
    });

    it('accepts null, which a PATCH sends to delete the key', () => {
        expect(VenuePoliciesSchema.safeParse({ minAge: 18, minAgeScope: null }).success).toBe(true);
    });

    it('validates the scope inside policies', () => {
        const result = VenuePoliciesSchema.safeParse({
            minAge: 18,
            minAgeScope: { kind: 'from_time', from: '25:00' }
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toEqual(['minAgeScope', 'from']);
    });

    it('is claimed by the nightInfo section, so it is gated with the age', () => {
        const nightInfo = LISTING_SECTIONS.venue.find((section) => section.id === 'nightInfo');
        expect(nightInfo && 'policyKeys' in nightInfo ? nightInfo.policyKeys : []).toContain(
            'minAgeScope'
        );
    });
});

describe('area normalization on write (HOS-2098 review)', () => {
    it('trims every locale, so whitespace never reaches a reader', () => {
        const parsed = VenueMinAgeScopeSchema.parse({
            kind: 'area',
            area: { es: '  la pista ', en: '   ', pt: '\ta pista\n' }
        });
        expect(parsed).toEqual({ kind: 'area', area: { es: 'la pista', en: '', pt: 'a pista' } });
    });

    it('rejects an area that is whitespace in every locale', () => {
        const result = VenueMinAgeScopeSchema.safeParse({
            kind: 'area',
            area: { es: '  ', en: '\t', pt: '' }
        });
        expect(result.success).toBe(false);
    });
});

describe('resolveVenueMinAgeScope — the one reader of the ficha and the chat', () => {
    it.each([
        ['es', { es: '  la pista  ', en: '', pt: '' }, 'la pista'],
        ['en', { es: 'el show', en: '   ', pt: '' }, 'el show'],
        ['es', { es: '', en: '', pt: 'a pista' }, 'a pista'],
        ['es', { es: ' ', en: 'the floor', pt: 'a pista' }, 'the floor'],
        ['pt', { es: 'la pista', en: 'the floor', pt: '' }, 'la pista']
    ] as const)('in %s, %j resolves to %s (locale, then es, en, pt)', (locale, area, expected) => {
        expect(resolveVenueMinAgeScope({ value: { kind: 'area', area }, locale })).toEqual({
            kind: 'area',
            area: expected
        });
    });

    it('resolves a from-time scope as is', () => {
        expect(
            resolveVenueMinAgeScope({ value: { kind: 'from_time', from: '20:00' }, locale: 'es' })
        ).toEqual({ kind: 'from_time', from: '20:00' });
    });

    it.each([
        undefined,
        null,
        { kind: 'all_day' },
        { kind: 'from_time', from: '24:00' },
        { kind: 'area', area: { es: ' ', en: '', pt: '' } },
        { kind: 'tonight' },
        'from 0h'
    ])('reads %j as all day, never a narrower scope', (value) => {
        expect(resolveVenueMinAgeScope({ value, locale: 'es' })).toEqual({ kind: 'all_day' });
    });
});
