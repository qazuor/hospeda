import { describe, expect, it } from 'vitest';
import { DestinationUpdateInputSchema } from '../../../src/entities/destination/destination.crud.schema.js';
import {
    ClimateMonthEnum,
    ClimateSeasonEnum,
    DestinationBestMonthsSchema,
    DestinationClimateSchema,
    DestinationSeasonClimateSchema
} from '../../../src/entities/destination/subtypes/destination.climate.schema.js';

/**
 * Tests for the SPEC-215 destination climate schema: seasonal averages, the
 * season enum, optional fields, and integer/range boundaries.
 */
describe('DestinationClimateSchema', () => {
    it('accepts a full valid climate object', () => {
        const result = DestinationClimateSchema.safeParse({
            bestSeason: 'spring',
            bestMonths: { from: 'oct', to: 'mar' },
            seasons: {
                spring: { avgTempMinC: 12, avgTempMaxC: 24, rainfallMm: 90 },
                winter: { avgTempMinC: 4, avgTempMaxC: 14 }
            },
            note: { es: 'Templado', en: 'Mild', pt: 'Ameno' }
        });
        expect(result.success).toBe(true);
    });

    it('accepts a minimal climate object (only bestSeason + empty seasons)', () => {
        const result = DestinationClimateSchema.safeParse({
            bestSeason: 'summer',
            seasons: {}
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid season enum value', () => {
        const result = DestinationClimateSchema.safeParse({
            bestSeason: 'monsoon',
            seasons: {}
        });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer temperatures', () => {
        const result = DestinationSeasonClimateSchema.safeParse({
            avgTempMinC: 12.5,
            avgTempMaxC: 24
        });
        expect(result.success).toBe(false);
    });

    it('rejects out-of-range temperatures and negative rainfall', () => {
        expect(
            DestinationSeasonClimateSchema.safeParse({ avgTempMinC: -80, avgTempMaxC: 10 }).success
        ).toBe(false);
        expect(
            DestinationSeasonClimateSchema.safeParse({
                avgTempMinC: 1,
                avgTempMaxC: 10,
                rainfallMm: -5
            }).success
        ).toBe(false);
    });

    it('exposes exactly the four seasons in the enum', () => {
        expect(ClimateSeasonEnum.options).toEqual(['spring', 'summer', 'autumn', 'winter']);
    });

    it('accepts a structured bestMonths range and rejects the legacy free-text form', () => {
        expect(
            DestinationClimateSchema.safeParse({
                bestSeason: 'spring',
                bestMonths: { from: 'sep', to: 'nov' },
                seasons: {}
            }).success
        ).toBe(true);
        // The old free-text label ("Sep–Nov") must no longer validate.
        expect(
            DestinationClimateSchema.safeParse({
                bestSeason: 'spring',
                bestMonths: 'Sep–Nov',
                seasons: {}
            }).success
        ).toBe(false);
    });
});

describe('DestinationBestMonthsSchema (SPEC-215 i18n month range)', () => {
    it('exposes the twelve calendar months as enum keys', () => {
        expect(ClimateMonthEnum.options).toEqual([
            'jan',
            'feb',
            'mar',
            'apr',
            'may',
            'jun',
            'jul',
            'aug',
            'sep',
            'oct',
            'nov',
            'dec'
        ]);
    });

    it('accepts a year-wrapping range and rejects unknown month keys', () => {
        expect(DestinationBestMonthsSchema.safeParse({ from: 'oct', to: 'mar' }).success).toBe(
            true
        );
        expect(DestinationBestMonthsSchema.safeParse({ from: 'sep', to: 'foo' }).success).toBe(
            false
        );
        expect(DestinationBestMonthsSchema.safeParse({ from: 'sep' }).success).toBe(false);
    });
});

describe('destination CRUD accepts climate (SPEC-215 T-006)', () => {
    const validClimate = {
        bestSeason: 'spring' as const,
        seasons: { spring: { avgTempMinC: 13, avgTempMaxC: 24, rainfallMm: 220 } }
    };

    it('update input accepts a climate object', () => {
        const result = DestinationUpdateInputSchema.safeParse({ climate: validClimate });
        expect(result.success).toBe(true);
    });

    it('update input rejects an invalid climate object', () => {
        const result = DestinationUpdateInputSchema.safeParse({
            climate: { bestSeason: 'monsoon', seasons: {} }
        });
        expect(result.success).toBe(false);
    });
});
