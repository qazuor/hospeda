/**
 * Unit tests for the import-from-url AI helper (SPEC-222 T-020).
 *
 * Covers the pure Strategy-B pieces in isolation:
 *   - `buildImportAiPrompt` embeds the page text and the no-reviews guardrail.
 *   - `mapAiOutputToRawExtraction` tags every field `source: 'ai'`, groups
 *     nested fields correctly, mirrors the structured coordinates shape, omits
 *     absent fields, and never emits review/rating data.
 *
 * The full endpoint behaviour (rate limit, quota, legal recheck) is covered by
 * the integration test in T-021.
 */

import type { AccommodationImportResponse } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type AccommodationImportAiOutput,
    type AiGateState,
    MSG_AI_ENTITLEMENT,
    MSG_AI_QUOTA,
    applyAiGateNotice,
    buildImportAiPrompt,
    mapAiOutputToRawExtraction
} from '../../../../src/routes/accommodation/protected/import-from-url.ai';

describe('buildImportAiPrompt', () => {
    it('embeds the page text and forbids reviews/ratings', () => {
        // Arrange
        const text = 'Cabaña frente al río con dos dormitorios.';

        // Act
        const prompt = buildImportAiPrompt(text);

        // Assert
        expect(prompt).toContain(text);
        expect(prompt).toContain('PAGE TEXT:');
        expect(prompt.toLowerCase()).toContain('never include guest reviews');
    });
});

describe('mapAiOutputToRawExtraction', () => {
    it('tags scalar fields with source "ai" and platform "generic"', () => {
        // Arrange
        const out: AccommodationImportAiOutput = {
            name: 'Casa del Sol',
            summary: 'Linda casa',
            description: 'Descripción larga',
            type: 'HOUSE'
        };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.sourcePlatform).toBe('generic');
        expect(raw.name).toEqual({ value: 'Casa del Sol', source: 'ai' });
        expect(raw.summary).toEqual({ value: 'Linda casa', source: 'ai' });
        expect(raw.description).toEqual({ value: 'Descripción larga', source: 'ai' });
        expect(raw.type).toEqual({ value: 'HOUSE', source: 'ai' });
    });

    it('builds coordinates mirroring the structured { lat, long } shape', () => {
        // Arrange
        const out: AccommodationImportAiOutput = { latitude: -32.48, longitude: -58.23 };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.location?.coordinates).toEqual({
            value: { lat: -32.48, long: -58.23 },
            source: 'ai'
        });
    });

    it('omits coordinates when only one of lat/long is present', () => {
        // Arrange
        const out: AccommodationImportAiOutput = { latitude: -32.48 };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.location).toBeUndefined();
    });

    it('groups nested price, contact, extraInfo and seo fields', () => {
        // Arrange
        const out: AccommodationImportAiOutput = {
            price: 15000,
            currency: 'ARS',
            phone: '+543442000000',
            website: 'https://example.com',
            capacity: 4,
            bedrooms: 2,
            beds: 3,
            bathrooms: 1,
            seoTitle: 'Title',
            seoDescription: 'Desc'
        };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.price).toEqual({
            price: { value: 15000, source: 'ai' },
            currency: { value: 'ARS', source: 'ai' }
        });
        expect(raw.contactInfo?.mobilePhone).toEqual({ value: '+543442000000', source: 'ai' });
        expect(raw.contactInfo?.website).toEqual({ value: 'https://example.com', source: 'ai' });
        expect(raw.extraInfo?.capacity).toEqual({ value: 4, source: 'ai' });
        expect(raw.extraInfo?.bathrooms).toEqual({ value: 1, source: 'ai' });
        expect(raw.seo?.title).toEqual({ value: 'Title', source: 'ai' });
    });

    it('forwards advisory amenityNames, locality and country verbatim', () => {
        // Arrange
        const out: AccommodationImportAiOutput = {
            amenityNames: ['wifi', 'pileta'],
            locality: 'Concepción del Uruguay',
            country: 'Argentina'
        };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.amenityNames).toEqual(['wifi', 'pileta']);
        expect(raw.scrapedLocality).toBe('Concepción del Uruguay');
        expect(raw.scrapedCountry).toBe('Argentina');
    });

    it('omits empty groups and absent fields entirely', () => {
        // Arrange
        const out: AccommodationImportAiOutput = { name: 'Solo nombre', amenityNames: [] };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        expect(raw.name).toEqual({ value: 'Solo nombre', source: 'ai' });
        expect(raw.location).toBeUndefined();
        expect(raw.price).toBeUndefined();
        expect(raw.contactInfo).toBeUndefined();
        expect(raw.extraInfo).toBeUndefined();
        expect(raw.seo).toBeUndefined();
        // Empty amenity arrays are dropped, not forwarded.
        expect(raw.amenityNames).toBeUndefined();
    });

    it('never emits review or rating shaped fields', () => {
        // Arrange: the output type cannot carry reviews, but assert defensively
        // that the mapped object exposes no such keys.
        const out: AccommodationImportAiOutput = { name: 'X', description: 'Y' };

        // Act
        const raw = mapAiOutputToRawExtraction(out);

        // Assert
        const keys = Object.keys(raw);
        for (const banned of ['rating', 'ratings', 'review', 'reviews', 'aggregateRating']) {
            expect(keys).not.toContain(banned);
        }
    });
});

describe('applyAiGateNotice', () => {
    const baseResponse = (overrides: Partial<AccommodationImportResponse> = {}) =>
        ({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: true,
            ...overrides
        }) as AccommodationImportResponse;

    it('returns the response unchanged when no AI block occurred', () => {
        // Arrange
        const response = baseResponse({ message: 'original' });
        const gate: AiGateState = { blockedReason: null };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result).toBe(response);
    });

    it('appends the entitlement notice when blocked by plan', () => {
        // Arrange
        const response = baseResponse();
        const gate: AiGateState = { blockedReason: 'entitlement' };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result.message).toBe(MSG_AI_ENTITLEMENT);
    });

    it('appends the quota notice when the monthly quota is spent', () => {
        // Arrange
        const response = baseResponse();
        const gate: AiGateState = { blockedReason: 'quota' };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result.message).toBe(MSG_AI_QUOTA);
    });

    it('concatenates the notice after an existing message', () => {
        // Arrange
        const response = baseResponse({ message: 'No pudimos extraer todo.' });
        const gate: AiGateState = { blockedReason: 'quota' };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result.message).toBe(`No pudimos extraer todo. ${MSG_AI_QUOTA}`);
    });

    it('appends the notice even when the draft is not partial (AI was needed and blocked)', () => {
        // Arrange: complete-enough draft (partial:false) but AI enrichment was blocked.
        const response = baseResponse({ partial: false });
        const gate: AiGateState = { blockedReason: 'entitlement' };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result.message).toBe(MSG_AI_ENTITLEMENT);
    });

    it('does not attach a message when the response carries a failureCode (SPEC-258 C.1)', () => {
        // Arrange: generic adapter classified the failure (e.g. nothing_found) AND the
        // AI port was invoked then plan-blocked. The classified failure owns the message
        // contract (message stays undefined), so the gate notice must not overwrite it.
        const response = baseResponse({ source: 'none', failureCode: 'nothing_found' });
        const gate: AiGateState = { blockedReason: 'quota' };

        // Act
        const result = applyAiGateNotice(response, gate);

        // Assert
        expect(result).toBe(response);
        expect(result.message).toBeUndefined();
    });
});
