import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    AccommodationImportDraftSchema,
    AccommodationImportRequestSchema,
    AccommodationImportResponseSchema,
    FieldSourceSchema,
    ImportSourceSchema,
    importedField
} from '../../../src/entities/accommodation/accommodation-import.schema';

/**
 * Test suite for the SPEC-222 accommodation import schemas.
 *
 * Covers: ImportSourceSchema, FieldSourceSchema, and the importedField factory.
 */
describe('ImportSourceSchema', () => {
    it('accepts each valid import source', () => {
        const validSources = ['mercadolibre', 'google', 'booking', 'airbnb', 'generic', 'none'];
        for (const src of validSources) {
            expect(ImportSourceSchema.safeParse(src).success).toBe(true);
        }
    });

    it('rejects an unknown string', () => {
        expect(ImportSourceSchema.safeParse('tripadvisor').success).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(ImportSourceSchema.safeParse('').success).toBe(false);
    });

    it('rejects a non-string value', () => {
        expect(ImportSourceSchema.safeParse(42).success).toBe(false);
    });
});

describe('FieldSourceSchema', () => {
    it('accepts each valid field source', () => {
        const validSources = ['official_api', 'jsonld', 'opengraph', 'meta', 'text', 'ai'];
        for (const src of validSources) {
            expect(FieldSourceSchema.safeParse(src).success).toBe(true);
        }
    });

    it('rejects an unknown extraction method', () => {
        expect(FieldSourceSchema.safeParse('scrape').success).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(FieldSourceSchema.safeParse('').success).toBe(false);
    });

    it('rejects a non-string value', () => {
        expect(FieldSourceSchema.safeParse(null).success).toBe(false);
    });
});

describe('importedField', () => {
    describe('with z.string() value schema', () => {
        const schema = importedField(z.string());

        it('accepts a valid object', () => {
            const result = schema.safeParse({
                value: 'x',
                confidence: 50,
                source: 'jsonld'
            });
            expect(result.success).toBe(true);
        });

        it('accepts confidence at boundary 0', () => {
            expect(schema.safeParse({ value: 'x', confidence: 0, source: 'text' }).success).toBe(
                true
            );
        });

        it('accepts confidence at boundary 100', () => {
            expect(schema.safeParse({ value: 'x', confidence: 100, source: 'ai' }).success).toBe(
                true
            );
        });

        it('rejects confidence below 0', () => {
            expect(schema.safeParse({ value: 'x', confidence: -1, source: 'jsonld' }).success).toBe(
                false
            );
        });

        it('rejects confidence above 100', () => {
            expect(
                schema.safeParse({ value: 'x', confidence: 101, source: 'jsonld' }).success
            ).toBe(false);
        });

        it('rejects an invalid source', () => {
            expect(
                schema.safeParse({ value: 'x', confidence: 80, source: 'scraped' }).success
            ).toBe(false);
        });

        it('rejects a number value when z.string() is expected', () => {
            expect(schema.safeParse({ value: 42, confidence: 80, source: 'text' }).success).toBe(
                false
            );
        });

        it('rejects missing required fields', () => {
            expect(schema.safeParse({ value: 'x' }).success).toBe(false);
            expect(schema.safeParse({ confidence: 50, source: 'text' }).success).toBe(false);
        });
    });

    describe('with z.number() value schema', () => {
        const schema = importedField(z.number());

        it('accepts a valid numeric value', () => {
            expect(
                schema.safeParse({ value: 150, confidence: 75, source: 'official_api' }).success
            ).toBe(true);
        });

        it('rejects a string value when z.number() is expected', () => {
            expect(
                schema.safeParse({ value: 'one-fifty', confidence: 75, source: 'official_api' })
                    .success
            ).toBe(false);
        });
    });

    describe('with z.boolean() value schema', () => {
        const schema = importedField(z.boolean());

        it('accepts a boolean value', () => {
            expect(
                schema.safeParse({ value: true, confidence: 95, source: 'opengraph' }).success
            ).toBe(true);
        });

        it('rejects a string value when z.boolean() is expected', () => {
            expect(
                schema.safeParse({ value: 'true', confidence: 95, source: 'opengraph' }).success
            ).toBe(false);
        });
    });
});

describe('AccommodationImportDraftSchema', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = AccommodationImportDraftSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts a partial draft with only name', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            name: { value: 'Cabaña del Río', confidence: 92, source: 'jsonld' }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name?.value).toBe('Cabaña del Río');
        }
    });

    it('accepts a full draft with all supported fields', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            name: { value: 'Hotel Sol', confidence: 90, source: 'jsonld' },
            summary: { value: 'A beautiful hotel', confidence: 85, source: 'opengraph' },
            type: { value: 'HOTEL', confidence: 80, source: 'text' },
            extraInfo: {
                capacity: { value: 6, confidence: 70, source: 'text' },
                bedrooms: { value: 3, confidence: 70, source: 'text' },
                beds: { value: 4, confidence: 65, source: 'text' },
                bathrooms: { value: 2, confidence: 65, source: 'text' }
            },
            location: {
                coordinates: {
                    value: { lat: '-32.4825', long: '-58.2372' },
                    confidence: 95,
                    source: 'jsonld'
                },
                street: { value: 'San Martín', confidence: 60, source: 'text' },
                number: { value: '123', confidence: 60, source: 'text' }
            },
            price: {
                price: { value: 5000, confidence: 75, source: 'text' },
                currency: { value: 'ARS', confidence: 75, source: 'text' }
            },
            contactInfo: {
                mobilePhone: { value: '+5493442123456', confidence: 80, source: 'text' },
                website: { value: 'https://hotelsol.com.ar', confidence: 90, source: 'opengraph' }
            },
            seo: {
                title: {
                    value: 'Hotel Sol | Concepción del Uruguay',
                    confidence: 95,
                    source: 'meta'
                },
                description: {
                    value: 'Best hotel in the city',
                    confidence: 88,
                    source: 'meta'
                }
            }
        });
        expect(result.success).toBe(true);
    });

    it('accepts a valid AccommodationTypeEnum value (CABIN)', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            type: { value: 'CABIN', confidence: 80, source: 'text' }
        });
        expect(result.success).toBe(true);
    });

    it('accepts a valid AccommodationTypeEnum value (ESTANCIA)', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            type: { value: 'ESTANCIA', confidence: 75, source: 'ai' }
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid type value (NOT_A_TYPE)', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            type: { value: 'NOT_A_TYPE', confidence: 50, source: 'text' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects confidence above 100 on a field', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            name: { value: 'Some Name', confidence: 150, source: 'jsonld' }
        });
        expect(result.success).toBe(false);
    });

    it('strips unknown top-level keys', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            name: { value: 'Hotel Test', confidence: 90, source: 'text' },
            unknownField: 'should be stripped'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect('unknownField' in result.data).toBe(false);
        }
    });

    it('accepts extraInfo.capacity as a valid importedField', () => {
        const result = AccommodationImportDraftSchema.safeParse({
            extraInfo: {
                capacity: { value: 4, confidence: 90, source: 'jsonld' }
            }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.extraInfo?.capacity?.value).toBe(4);
            expect(result.data.extraInfo?.capacity?.confidence).toBe(90);
            expect(result.data.extraInfo?.capacity?.source).toBe('jsonld');
        }
    });
});

describe('AccommodationImportRequestSchema', () => {
    it('accepts a minimal valid request (url + legalConfirmed)', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'https://airbnb.com/rooms/123',
            legalConfirmed: true
        });
        expect(result.success).toBe(true);
    });

    it('accepts a request with an optional locale', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'https://booking.com/hotel/ar/sol.html',
            locale: 'es',
            legalConfirmed: true
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.locale).toBe('es');
        }
    });

    it('accepts every supported locale value', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(
                AccommodationImportRequestSchema.safeParse({
                    url: 'https://example.com',
                    locale,
                    legalConfirmed: true
                }).success
            ).toBe(true);
        }
    });

    it('rejects legalConfirmed: false', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'https://airbnb.com/rooms/123',
            legalConfirmed: false
        });
        expect(result.success).toBe(false);
    });

    it('rejects when legalConfirmed is absent', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'https://airbnb.com/rooms/123'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a url that is not a valid URL', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'not-a-url',
            legalConfirmed: true
        });
        expect(result.success).toBe(false);
    });

    it('rejects a url longer than 2048 characters', () => {
        const longUrl = `https://example.com/${'a'.repeat(2048)}`;
        const result = AccommodationImportRequestSchema.safeParse({
            url: longUrl,
            legalConfirmed: true
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unsupported locale (fr)', () => {
        const result = AccommodationImportRequestSchema.safeParse({
            url: 'https://example.com',
            locale: 'fr',
            legalConfirmed: true
        });
        expect(result.success).toBe(false);
    });
});

describe('AccommodationImportResponseSchema', () => {
    it('accepts a minimal valid response', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: true
        });
        expect(result.success).toBe(true);
    });

    it('accepts a full response with all optional fields', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {
                name: { value: 'Hotel Sol', confidence: 90, source: 'jsonld' }
            },
            source: 'booking',
            methodsUsed: ['jsonld', 'opengraph'],
            partial: false,
            message: 'Extraction successful.',
            destinationHint: {
                scrapedLocality: 'Concepción del Uruguay',
                candidates: [
                    { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Concepción del Uruguay' },
                    { id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8', name: 'Uruguay' }
                ]
            },
            unresolvedAmenities: ['BBQ area', 'private jetty'],
            mediaHints: {
                imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
            }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinationHint?.candidates).toHaveLength(2);
            expect(result.data.unresolvedAmenities).toEqual(['BBQ area', 'private jetty']);
            expect(result.data.mediaHints?.imageUrls).toHaveLength(2);
        }
    });

    it('rejects destinationHint.candidates[].id that is not a UUID', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: true,
            destinationHint: {
                candidates: [{ id: 'not-a-uuid', name: 'Somewhere' }]
            }
        });
        expect(result.success).toBe(false);
    });

    it('accepts source: none (graceful-degradation marker)', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'none',
            methodsUsed: [],
            partial: true,
            message: 'Could not detect source platform.'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.source).toBe('none');
        }
    });

    it('accepts destinationHint without scrapedLocality (optional)', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: true,
            destinationHint: {
                candidates: [{ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Test City' }]
            }
        });
        expect(result.success).toBe(true);
    });

    it('rejects an unknown source value', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'tripadvisor',
            methodsUsed: [],
            partial: false
        });
        expect(result.success).toBe(false);
    });

    it('rejects a methodsUsed entry that is not a valid FieldSource', () => {
        const result = AccommodationImportResponseSchema.safeParse({
            draft: {},
            source: 'generic',
            methodsUsed: ['jsonld', 'scrape'],
            partial: false
        });
        expect(result.success).toBe(false);
    });
});
