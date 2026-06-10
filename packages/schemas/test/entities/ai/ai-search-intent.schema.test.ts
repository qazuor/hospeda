/**
 * Unit tests for AI NL search intent Zod schemas (SPEC-199, T-001).
 *
 * Coverage (§8.1):
 *
 * AiSearchIntentRequestSchema:
 *   - empty query rejected (min(1))
 *   - query >500 chars rejected (max(500))
 *   - valid query without locale accepted
 *   - valid query + locale accepted
 *   - invalid locale string rejected
 *   - .strict(): extra unknown keys rejected
 *
 * SearchIntentEntitiesSchema:
 *   - empty object valid (all slots optional)
 *   - invalid accommodationType rejected
 *   - latitude out of [-90, 90] rejected
 *   - longitude out of [-180, 180] rejected
 *   - minBedrooms/maxBedrooms: integer ≥0, max 50; out-of-range rejected
 *   - minBathrooms/maxBathrooms: integer ≥0, max 50; out-of-range rejected
 *   - maxRating 0–5: valid boundaries accepted; out-of-range rejected
 *   - amenitySlugs: accepts string array; rejects non-string elements
 *   - featureSlugs: accepts string array; rejects non-string elements
 *   - extra unknown keys are stripped (NOT strict)
 *   - full valid payload with all slots
 *
 * @module test/entities/ai/ai-search-intent.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiSearchIntentRequestSchema,
    SearchIntentEntitiesSchema
} from '../../../src/entities/ai/ai-search-intent.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_QUERY = 'cabaña cerca del río para 4 personas con pileta';

// ─── AiSearchIntentRequestSchema ──────────────────────────────────────────────

describe('AiSearchIntentRequestSchema', () => {
    it('rejects an empty query string (min 1)', () => {
        // Arrange
        const input = { query: '' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('query'))).toBe(true);
        }
    });

    it('rejects a query longer than 500 characters (max 500)', () => {
        // Arrange
        const input = { query: 'a'.repeat(501) };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('query'))).toBe(true);
        }
    });

    it('accepts a query at exactly 500 characters (boundary)', () => {
        // Arrange
        const input = { query: 'a'.repeat(500) };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a valid query without locale', () => {
        // Arrange
        const input = { query: VALID_QUERY };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.query).toBe(VALID_QUERY);
            expect(result.data.locale).toBeUndefined();
        }
    });

    it('accepts a valid query with locale "es"', () => {
        // Arrange
        const input = { query: VALID_QUERY, locale: 'es' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.locale).toBe('es');
        }
    });

    it('accepts a valid query with locale "en"', () => {
        // Arrange
        const input = { query: 'cabin near the river for 4 people', locale: 'en' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.locale).toBe('en');
        }
    });

    it('accepts a valid query with locale "pt"', () => {
        // Arrange
        const input = { query: 'casa perto do rio', locale: 'pt' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects an invalid locale string', () => {
        // Arrange
        const input = { query: VALID_QUERY, locale: 'fr' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('locale'))).toBe(true);
        }
    });

    it('rejects unknown extra keys (.strict())', () => {
        // Arrange
        const input = { query: VALID_QUERY, unknownKey: 'surprise' };
        // Act
        const result = AiSearchIntentRequestSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });
});

// ─── SearchIntentEntitiesSchema ───────────────────────────────────────────────

describe('SearchIntentEntitiesSchema', () => {
    it('accepts an empty object (all slots optional)', () => {
        // Arrange + Act
        const result = SearchIntentEntitiesSchema.safeParse({});
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({});
        }
    });

    it('rejects an invalid accommodationType', () => {
        // Arrange
        const input = { accommodationType: 'TREEHOUSE' };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('accommodationType'))).toBe(
                true
            );
        }
    });

    it('accepts a valid accommodationType value "CABIN"', () => {
        // Arrange
        const input = { accommodationType: 'CABIN' };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects latitude below -90', () => {
        // Arrange
        const input = { latitude: -90.001 };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('latitude'))).toBe(true);
        }
    });

    it('rejects latitude above 90', () => {
        // Arrange
        const input = { latitude: 90.001 };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts latitude at boundary values -90 and 90', () => {
        expect(SearchIntentEntitiesSchema.safeParse({ latitude: -90 }).success).toBe(true);
        expect(SearchIntentEntitiesSchema.safeParse({ latitude: 90 }).success).toBe(true);
    });

    it('rejects longitude below -180', () => {
        // Arrange
        const input = { longitude: -180.001 };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });

    it('rejects longitude above 180', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ longitude: 180.001 });
        expect(result.success).toBe(false);
    });

    it('accepts longitude at boundary values -180 and 180', () => {
        expect(SearchIntentEntitiesSchema.safeParse({ longitude: -180 }).success).toBe(true);
        expect(SearchIntentEntitiesSchema.safeParse({ longitude: 180 }).success).toBe(true);
    });

    // ── minBedrooms / maxBedrooms ─────────────────────────────────────────────

    it('accepts minBedrooms at 0 (boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minBedrooms: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts maxBedrooms at 50 (boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxBedrooms: 50 });
        expect(result.success).toBe(true);
    });

    it('rejects minBedrooms below 0', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minBedrooms: -1 });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('minBedrooms'))).toBe(true);
        }
    });

    it('rejects maxBedrooms above 50', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxBedrooms: 51 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer minBedrooms (float)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minBedrooms: 2.5 });
        expect(result.success).toBe(false);
    });

    // ── minBathrooms / maxBathrooms ───────────────────────────────────────────

    it('accepts minBathrooms at 0 (boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minBathrooms: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts maxBathrooms at 50 (boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxBathrooms: 50 });
        expect(result.success).toBe(true);
    });

    it('rejects minBathrooms below 0', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minBathrooms: -1 });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('minBathrooms'))).toBe(true);
        }
    });

    it('rejects maxBathrooms above 50', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxBathrooms: 51 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer maxBathrooms (float)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxBathrooms: 1.5 });
        expect(result.success).toBe(false);
    });

    // ── maxRating ─────────────────────────────────────────────────────────────

    it('accepts maxRating at 0 (lower boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxRating: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts maxRating at 5 (upper boundary)', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxRating: 5 });
        expect(result.success).toBe(true);
    });

    it('rejects maxRating below 0', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxRating: -0.1 });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('maxRating'))).toBe(true);
        }
    });

    it('rejects maxRating above 5', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ maxRating: 5.1 });
        expect(result.success).toBe(false);
    });

    it('accepts minRating = 0, maxRating = 5 together', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ minRating: 0, maxRating: 5 });
        expect(result.success).toBe(true);
    });

    // ── amenitySlugs ─────────────────────────────────────────────────────────

    it('accepts amenitySlugs as an array of strings', () => {
        const result = SearchIntentEntitiesSchema.safeParse({
            amenitySlugs: ['pool', 'wifi', 'bbq']
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.amenitySlugs).toEqual(['pool', 'wifi', 'bbq']);
        }
    });

    it('accepts an empty amenitySlugs array', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ amenitySlugs: [] });
        expect(result.success).toBe(true);
    });

    it('rejects amenitySlugs containing non-string elements', () => {
        const result = SearchIntentEntitiesSchema.safeParse({
            amenitySlugs: ['pool', 42]
        });
        expect(result.success).toBe(false);
    });

    // ── featureSlugs ─────────────────────────────────────────────────────────

    it('accepts featureSlugs as an array of strings', () => {
        const result = SearchIntentEntitiesSchema.safeParse({
            featureSlugs: ['river_front', 'quiet_zone', 'family_suitable']
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.featureSlugs).toEqual([
                'river_front',
                'quiet_zone',
                'family_suitable'
            ]);
        }
    });

    it('accepts an empty featureSlugs array', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ featureSlugs: [] });
        expect(result.success).toBe(true);
    });

    it('rejects featureSlugs containing non-string elements', () => {
        const result = SearchIntentEntitiesSchema.safeParse({
            featureSlugs: ['river_front', null]
        });
        expect(result.success).toBe(false);
    });

    // ── NOT strict — extra keys stripped ─────────────────────────────────────

    it('strips extra unknown keys (entities schema is NOT strict)', () => {
        // Arrange: model may return extra internal fields
        const input = {
            minGuests: 2,
            unknownModelKey: 'some_value',
            anotherExtraKey: 123
        };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert: parse succeeds and unknown keys are dropped
        expect(result.success).toBe(true);
        if (result.success) {
            expect('unknownModelKey' in result.data).toBe(false);
            expect('anotherExtraKey' in result.data).toBe(false);
            expect(result.data.minGuests).toBe(2);
        }
    });

    // ── Full valid payload ────────────────────────────────────────────────────

    it('accepts a full valid payload with all populated slots', () => {
        // Arrange
        const checkIn = new Date('2026-12-20');
        const checkOut = new Date('2026-12-27');
        const input = {
            locationType: 'city',
            city: 'Concepción del Uruguay',
            latitude: -32.4825,
            longitude: -58.2375,
            radius: 25,
            accommodationType: 'CABIN',
            minGuests: 2,
            maxGuests: 6,
            minBedrooms: 1,
            maxBedrooms: 4,
            minBathrooms: 1,
            maxBathrooms: 3,
            minPrice: 100,
            maxPrice: 300,
            currency: 'ARS',
            minRating: 4,
            maxRating: 5,
            hasPool: true,
            hasWifi: true,
            allowsPets: false,
            hasParking: true,
            amenitySlugs: ['pool', 'wifi'],
            featureSlugs: ['river_front', 'quiet_zone'],
            checkIn,
            checkOut
        };

        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.city).toBe('Concepción del Uruguay');
            expect(result.data.accommodationType).toBe('CABIN');
            expect(result.data.minBedrooms).toBe(1);
            expect(result.data.maxBedrooms).toBe(4);
            expect(result.data.minBathrooms).toBe(1);
            expect(result.data.maxBathrooms).toBe(3);
            expect(result.data.maxRating).toBe(5);
            expect(result.data.amenitySlugs).toEqual(['pool', 'wifi']);
            expect(result.data.featureSlugs).toEqual(['river_front', 'quiet_zone']);
            expect(result.data.checkIn).toEqual(checkIn);
            expect(result.data.checkOut).toEqual(checkOut);
        }
    });

    it('coerces checkIn ISO date string to a Date object', () => {
        // Arrange
        const input = { checkIn: '2026-12-20' };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.checkIn).toBeInstanceOf(Date);
        }
    });

    it('rejects an invalid checkIn date string', () => {
        const result = SearchIntentEntitiesSchema.safeParse({ checkIn: 'not-a-date' });
        expect(result.success).toBe(false);
    });
});
