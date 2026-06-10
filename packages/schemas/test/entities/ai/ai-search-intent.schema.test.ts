/**
 * Unit tests for AI NL search intent Zod schemas (SPEC-199, T-001 + T-002).
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
 * SearchIntentSchema (T-002):
 *   - narrows kind to 'search' literal; rejects 'chat'
 *   - typed entities validated against SearchIntentEntitiesSchema
 *   - valid full SearchIntent accepted
 *
 * SearchIntentOutputSchema (T-002):
 *   - defaults confidence to 0 when absent
 *   - rejects confidence > 1
 *   - rejects confidence < 0
 *   - accepts confidence at boundary values 0 and 1
 *   - strips unknown model keys from entities (NOT strict)
 *
 * AiSearchIntentResponseDataSchema (T-002):
 *   - validates full valid envelope
 *   - rejects missing required fields
 *   - rejects confidence out of [0, 1] range
 *   - accepts fallbackToKeyword = true / false
 *   - mappedParams accepts arbitrary string-keyed values
 *
 * @module test/entities/ai/ai-search-intent.schema.test
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    AiSearchIntentRequestSchema,
    AiSearchIntentResponseDataSchema,
    SearchIntentEntitiesSchema,
    SearchIntentOutputSchema,
    SearchIntentSchema
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
            checkIn: '2026-12-20',
            checkOut: '2026-12-27'
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
            expect(result.data.checkIn).toBe('2026-12-20');
            expect(result.data.checkOut).toBe('2026-12-27');
        }
    });

    it('accepts a valid ISO date string for checkIn and returns it as a string', () => {
        // Arrange: checkIn is now z.string() — returned as-is, not coerced to Date.
        const input = { checkIn: '2026-12-20' };
        // Act
        const result = SearchIntentEntitiesSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.checkIn).toBe('2026-12-20');
        }
    });

    it('rejects a non-string checkIn value (format is not enforced at schema level)', () => {
        // z.string() rejects non-strings; format guidance lives in the AI prompt,
        // and the mapper normalises with .substring(0, 10).
        const result = SearchIntentEntitiesSchema.safeParse({ checkIn: 20261220 });
        expect(result.success).toBe(false);
    });
});

// ─── SearchIntentSchema (T-002) ───────────────────────────────────────────────

describe('SearchIntentSchema', () => {
    /** Minimal valid AiIntent base shape with kind narrowed to 'search'. */
    const VALID_SEARCH_INTENT = {
        kind: 'search',
        confidence: 0.9,
        entities: {},
        rawQuery: 'cabaña con pileta'
    };

    it('accepts a valid SearchIntent with kind "search"', () => {
        // Arrange + Act
        const result = SearchIntentSchema.safeParse(VALID_SEARCH_INTENT);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.kind).toBe('search');
        }
    });

    it('rejects kind "chat" (wrong literal)', () => {
        // Arrange
        const input = { ...VALID_SEARCH_INTENT, kind: 'chat' };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('kind'))).toBe(true);
        }
    });

    it('rejects an empty kind string (kind must be "search")', () => {
        // Arrange
        const input = { ...VALID_SEARCH_INTENT, kind: '' };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });

    it('types entities via SearchIntentEntitiesSchema — rejects invalid accommodationType', () => {
        // Arrange
        const input = {
            ...VALID_SEARCH_INTENT,
            entities: { accommodationType: 'TREEHOUSE' }
        };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('accommodationType'))).toBe(
                true
            );
        }
    });

    it('accepts entities with valid typed slots', () => {
        // Arrange
        const input = {
            ...VALID_SEARCH_INTENT,
            entities: {
                accommodationType: 'CABIN',
                minGuests: 2,
                hasPool: true,
                amenitySlugs: ['pool']
            }
        };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.entities.accommodationType).toBe('CABIN');
            expect(result.data.entities.minGuests).toBe(2);
            expect(result.data.entities.hasPool).toBe(true);
        }
    });

    it('strips extra unknown entity keys (NOT strict)', () => {
        // Arrange: model may return internal fields alongside entities
        const input = {
            ...VALID_SEARCH_INTENT,
            entities: { minGuests: 3, _internalModelDebug: 'value' }
        };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect('_internalModelDebug' in result.data.entities).toBe(false);
            expect(result.data.entities.minGuests).toBe(3);
        }
    });

    it('requires rawQuery to be at least 1 character', () => {
        // Arrange
        const input = { ...VALID_SEARCH_INTENT, rawQuery: '' };
        // Act
        const result = SearchIntentSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('rawQuery'))).toBe(true);
        }
    });
});

// ─── SearchIntentOutputSchema (T-002) ─────────────────────────────────────────

describe('SearchIntentOutputSchema', () => {
    it('defaults confidence to 0 when absent', () => {
        // Arrange: model omits confidence field entirely
        const input = { entities: {} };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(0);
        }
    });

    it('accepts confidence at lower boundary (0)', () => {
        // Arrange + Act
        const result = SearchIntentOutputSchema.safeParse({ confidence: 0, entities: {} });
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(0);
        }
    });

    it('accepts confidence at upper boundary (1)', () => {
        // Arrange + Act
        const result = SearchIntentOutputSchema.safeParse({ confidence: 1, entities: {} });
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(1);
        }
    });

    it('rejects confidence > 1', () => {
        // Arrange
        const input = { confidence: 1.001, entities: {} };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('confidence'))).toBe(true);
        }
    });

    it('rejects confidence < 0', () => {
        // Arrange
        const input = { confidence: -0.001, entities: {} };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('confidence'))).toBe(true);
        }
    });

    it('accepts a realistic model output with entities', () => {
        // Arrange: typical model response
        const input = {
            confidence: 0.87,
            entities: {
                accommodationType: 'CABIN',
                minGuests: 2,
                maxGuests: 4,
                hasPool: true,
                maxPrice: 200,
                currency: 'ARS'
            }
        };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(0.87);
            expect(result.data.entities.accommodationType).toBe('CABIN');
            expect(result.data.entities.hasPool).toBe(true);
        }
    });

    it('strips unknown model keys from entities (NOT strict)', () => {
        // Arrange: model may return extra internal fields inside entities
        const input = {
            confidence: 0.5,
            entities: { minGuests: 2, _modelDebugInfo: 'internal' }
        };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect('_modelDebugInfo' in result.data.entities).toBe(false);
            expect(result.data.entities.minGuests).toBe(2);
        }
    });

    it('rejects invalid entities field (e.g. accommodationType out of enum)', () => {
        // Arrange
        const input = {
            confidence: 0.7,
            entities: { accommodationType: 'VILLA' }
        };
        // Act
        const result = SearchIntentOutputSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });
});

// ─── AiSearchIntentResponseDataSchema (T-002) ─────────────────────────────────

describe('AiSearchIntentResponseDataSchema', () => {
    /** Minimal valid AiIntent envelope for use in response data. */
    const VALID_INTENT = {
        kind: 'search',
        confidence: 0.85,
        entities: { accommodationType: 'CABIN' },
        rawQuery: 'cabaña con pileta para 4 personas'
    };

    /** Minimal valid response data envelope. */
    const VALID_RESPONSE_DATA = {
        intent: VALID_INTENT,
        mappedParams: { type: 'CABIN', minGuests: '4', hasPool: 'true' },
        confidence: 0.85,
        fallbackToKeyword: false
    };

    it('accepts a valid response data envelope', () => {
        // Arrange + Act
        const result = AiSearchIntentResponseDataSchema.safeParse(VALID_RESPONSE_DATA);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.confidence).toBe(0.85);
            expect(result.data.fallbackToKeyword).toBe(false);
        }
    });

    it('accepts fallbackToKeyword = true (low-confidence case)', () => {
        // Arrange
        const input = { ...VALID_RESPONSE_DATA, confidence: 0.3, fallbackToKeyword: true };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.fallbackToKeyword).toBe(true);
            expect(result.data.confidence).toBe(0.3);
        }
    });

    it('rejects missing intent field', () => {
        // Arrange
        const { intent: _unused, ...inputWithoutIntent } = VALID_RESPONSE_DATA;
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(inputWithoutIntent);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('intent'))).toBe(true);
        }
    });

    it('rejects missing fallbackToKeyword field', () => {
        // Arrange
        const { fallbackToKeyword: _unused, ...inputWithout } = VALID_RESPONSE_DATA;
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(inputWithout);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('fallbackToKeyword'))).toBe(
                true
            );
        }
    });

    it('rejects confidence > 1', () => {
        // Arrange
        const input = { ...VALID_RESPONSE_DATA, confidence: 1.1 };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('confidence'))).toBe(true);
        }
    });

    it('rejects confidence < 0', () => {
        // Arrange
        const input = { ...VALID_RESPONSE_DATA, confidence: -0.1 };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('confidence'))).toBe(true);
        }
    });

    it('accepts confidence at exact boundaries (0 and 1)', () => {
        expect(
            AiSearchIntentResponseDataSchema.safeParse({ ...VALID_RESPONSE_DATA, confidence: 0 })
                .success
        ).toBe(true);
        expect(
            AiSearchIntentResponseDataSchema.safeParse({ ...VALID_RESPONSE_DATA, confidence: 1 })
                .success
        ).toBe(true);
    });

    it('accepts mappedParams with arbitrary string-keyed values (open record)', () => {
        // Arrange: various serialized URL param types
        const input = {
            ...VALID_RESPONSE_DATA,
            mappedParams: {
                type: 'CABIN',
                minGuests: '2',
                hasPool: 'true',
                amenities: ['uuid-1', 'uuid-2'],
                checkIn: '2026-12-20',
                checkOut: '2026-12-27'
            }
        };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts an empty mappedParams object (no slots extracted)', () => {
        // Arrange: low-confidence extraction produces empty mapped params
        const input = {
            ...VALID_RESPONSE_DATA,
            mappedParams: {},
            confidence: 0.1,
            fallbackToKeyword: true
        };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mappedParams).toEqual({});
            expect(result.data.fallbackToKeyword).toBe(true);
        }
    });

    it('validates the intent field against AiIntentSchema — rejects empty rawQuery', () => {
        // Arrange: intent with invalid rawQuery
        const input = {
            ...VALID_RESPONSE_DATA,
            intent: { ...VALID_INTENT, rawQuery: '' }
        };
        // Act
        const result = AiSearchIntentResponseDataSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('rawQuery'))).toBe(true);
        }
    });
});

// ─── Model-facing schema: no regex pattern constraints (REGRESSION GUARD) ────
//
// Purpose: prevent re-introducing `.regex()` on `checkIn`/`checkOut` in
// `SearchIntentEntitiesSchema` or `SearchIntentOutputSchema`. When `generateObject`
// converts a Zod schema to JSON Schema, `.regex()` emits a `"pattern"` field.
// Ollama's llama.cpp grammar compiler CRASHES on `pattern` constraints (produces
// "model runner has unexpectedly stopped" ~265ms pre-inference). This guard
// fails CI the moment a regex is re-added to any date field in the model-facing
// schema, catching the regression before it reaches staging.
//
// The check works by constructing the JSON Schema representation (via `z.toJSONSchema`)
// and asserting that no property in the emitted schema carries a `pattern` key
// for `checkIn` or `checkOut`. An alternative approach (used as a fallback) is
// verifying that arbitrary non-date strings are accepted, proving the regex is absent.

describe('Model-facing schema has no regex pattern constraints (Ollama crash regression guard)', () => {
    it('SearchIntentEntitiesSchema: checkIn accepts an arbitrary non-date string (no regex)', () => {
        // If `.regex(/^\d{4}-\d{2}-\d{2}$/)` is re-added, these will fail because
        // "not-a-date" and "2026/12/20" do not match the YYYY-MM-DD pattern.
        // Failing these tests is the early-warning signal before an Ollama deploy.
        const arbitrary = SearchIntentEntitiesSchema.safeParse({ checkIn: 'not-a-date' });
        expect(arbitrary.success).toBe(true);

        const slashed = SearchIntentEntitiesSchema.safeParse({ checkIn: '2026/12/20' });
        expect(slashed.success).toBe(true);

        const nextWeekend = SearchIntentEntitiesSchema.safeParse({ checkIn: 'next weekend' });
        expect(nextWeekend.success).toBe(true);
    });

    it('SearchIntentEntitiesSchema: checkOut accepts an arbitrary non-date string (no regex)', () => {
        const arbitrary = SearchIntentEntitiesSchema.safeParse({ checkOut: 'tomorrow' });
        expect(arbitrary.success).toBe(true);

        const malformed = SearchIntentEntitiesSchema.safeParse({ checkOut: '2026-13-45' });
        expect(malformed.success).toBe(true);
    });

    it('SearchIntentOutputSchema entities.checkIn accepts an arbitrary non-date string (no regex)', () => {
        const result = SearchIntentOutputSchema.safeParse({
            confidence: 0.8,
            entities: { checkIn: 'next Friday', checkOut: 'next Sunday' }
        });
        expect(result.success).toBe(true);
    });

    it('SearchIntentEntitiesSchema: checkIn and checkOut have no "pattern" in JSON Schema output', () => {
        // z.toJSONSchema is available from zod@4 (the version used in this package).
        // If the function is not available in the installed version, fall back to
        // the "accepts arbitrary string" proof above (which is the primary guard).
        if (typeof z.toJSONSchema !== 'function') {
            // Fallback: schema already proven by the "accepts arbitrary string" tests.
            return;
        }
        // biome-ignore lint/suspicious/noExplicitAny: z.toJSONSchema is a runtime API not in all type stubs
        const jsonSchema = (
            z as unknown as { toJSONSchema: (schema: unknown) => unknown }
        ).toJSONSchema(SearchIntentEntitiesSchema) as {
            properties?: Record<string, { pattern?: string }>;
        };

        const props = jsonSchema.properties ?? {};
        expect('pattern' in (props.checkIn ?? {})).toBe(false);
        expect('pattern' in (props.checkOut ?? {})).toBe(false);
    });
});
