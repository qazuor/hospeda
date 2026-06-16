/**
 * Tests for the RawExtraction → AccommodationImportDraft mapper (SPEC-222 T-011)
 *
 * Covers:
 * - CONFIDENCE_BY_SOURCE exhaustiveness and band values
 * - Happy-path mapping with valid name (jsonld) + coordinates
 * - Coercions: numeric lat/long → string, string capacity → integer
 * - Validation failures drop the field without throwing
 * - methodsUsed reflects distinct sources present
 * - AI-sourced field gets confidence 30
 * - Empty RawExtraction → empty draft, empty methodsUsed, no throw
 */
import { describe, expect, it } from 'vitest';

import type { RawExtraction } from '../../../src/services/accommodation-import/adapter.types.js';
import {
    CONFIDENCE_BY_SOURCE,
    mapRawToDraft
} from '../../../src/services/accommodation-import/mapping.js';

// ---------------------------------------------------------------------------
// CONFIDENCE_BY_SOURCE
// ---------------------------------------------------------------------------

describe('CONFIDENCE_BY_SOURCE', () => {
    it('should have an entry for every FieldSource value', () => {
        // Arrange — the full set of FieldSource values as declared in the schema
        const expectedSources = [
            'official_api',
            'jsonld',
            'opengraph',
            'meta',
            'text',
            'ai'
        ] as const;

        // Act + Assert — every source must be present
        for (const source of expectedSources) {
            expect(CONFIDENCE_BY_SOURCE).toHaveProperty(source);
        }

        // No extra keys either — the object must be exactly as long as the union
        expect(Object.keys(CONFIDENCE_BY_SOURCE)).toHaveLength(expectedSources.length);
    });

    it('should assign confidence values within the documented bands', () => {
        // Arrange — documented bands from the JSDoc
        const bands: Array<{
            source: keyof typeof CONFIDENCE_BY_SOURCE;
            min: number;
            max: number;
        }> = [
            { source: 'official_api', min: 90, max: 100 },
            { source: 'jsonld', min: 85, max: 95 },
            { source: 'opengraph', min: 60, max: 80 },
            { source: 'meta', min: 55, max: 75 },
            { source: 'text', min: 40, max: 60 },
            { source: 'ai', min: 20, max: 40 }
        ];

        // Act + Assert
        for (const { source, min, max } of bands) {
            const value = CONFIDENCE_BY_SOURCE[source];
            expect(
                value,
                `${source} confidence ${value} not within [${min}, ${max}]`
            ).toBeGreaterThanOrEqual(min);
            expect(
                value,
                `${source} confidence ${value} not within [${min}, ${max}]`
            ).toBeLessThanOrEqual(max);
        }
    });

    it('should assign ai a lower confidence than text', () => {
        expect(CONFIDENCE_BY_SOURCE.ai).toBeLessThan(CONFIDENCE_BY_SOURCE.text);
    });

    it('should assign official_api the highest confidence', () => {
        const max = Math.max(...Object.values(CONFIDENCE_BY_SOURCE));
        expect(CONFIDENCE_BY_SOURCE.official_api).toBe(max);
    });
});

// ---------------------------------------------------------------------------
// mapRawToDraft — happy path
// ---------------------------------------------------------------------------

describe('mapRawToDraft', () => {
    describe('when given a valid name (jsonld) and coordinates', () => {
        it('should map name with confidence 90 and source jsonld', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                name: { value: 'Cabaña del Río', source: 'jsonld' }
            };

            // Act
            const { draft, methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(draft.name).toBeDefined();
            expect(draft.name?.value).toBe('Cabaña del Río');
            expect(draft.name?.confidence).toBe(90);
            expect(draft.name?.source).toBe('jsonld');
            expect(methodsUsed).toContain('jsonld');
        });

        it('should map location.coordinates when provided as object with numeric lat/long', () => {
            // Arrange — numeric lat/long must become strings in the draft
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                location: {
                    coordinates: {
                        value: { lat: -32.484, long: -58.234 },
                        source: 'jsonld'
                    }
                }
            };

            // Act
            const { draft, methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(draft.location?.coordinates).toBeDefined();
            expect(draft.location?.coordinates?.value.lat).toBe('-32.484');
            expect(draft.location?.coordinates?.value.long).toBe('-58.234');
            expect(draft.location?.coordinates?.confidence).toBe(90);
            expect(draft.location?.coordinates?.source).toBe('jsonld');
            expect(methodsUsed).toContain('jsonld');
        });

        it('should map name and coordinates together, collecting their sources', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'booking',
                name: { value: 'Hotel Sol', source: 'jsonld' },
                location: {
                    coordinates: {
                        value: { lat: -32.0, long: -58.0 },
                        source: 'opengraph'
                    }
                }
            };

            // Act
            const { draft, methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(draft.name?.value).toBe('Hotel Sol');
            expect(draft.location?.coordinates?.value.lat).toBe('-32');
            expect(methodsUsed).toContain('jsonld');
            expect(methodsUsed).toContain('opengraph');
            expect(methodsUsed).toHaveLength(2);
        });
    });

    // -----------------------------------------------------------------------
    // Coercion tests
    // -----------------------------------------------------------------------

    describe('coercion', () => {
        it('should coerce a numeric lat/long to string in the draft', () => {
            // Arrange — raw value has numbers, draft must have strings
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                location: {
                    coordinates: {
                        value: { lat: 10.5, long: -75.3 },
                        source: 'jsonld'
                    }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(typeof draft.location?.coordinates?.value.lat).toBe('string');
            expect(typeof draft.location?.coordinates?.value.long).toBe('string');
            expect(draft.location?.coordinates?.value.lat).toBe('10.5');
            expect(draft.location?.coordinates?.value.long).toBe('-75.3');
        });

        it('should coerce a string "4" capacity to integer 4', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                extraInfo: {
                    capacity: { value: '4', source: 'text' }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.extraInfo?.capacity?.value).toBe(4);
            expect(typeof draft.extraInfo?.capacity?.value).toBe('number');
        });

        it('should coerce a numeric capacity to a non-negative integer', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                extraInfo: {
                    capacity: { value: 6, source: 'jsonld' }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.extraInfo?.capacity?.value).toBe(6);
        });

        it('should truncate fractional capacity to integer', () => {
            // Arrange — 5.7 should become 5
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                extraInfo: {
                    capacity: { value: 5.7, source: 'text' }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.extraInfo?.capacity?.value).toBe(5);
        });

        it('should coerce string price to a number', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'mercadolibre',
                price: {
                    price: { value: '5000', source: 'text' }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.price?.price?.value).toBe(5000);
        });

        it('should trim whitespace from string fields', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: '  Hotel Sol  ', source: 'meta' }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.name?.value).toBe('Hotel Sol');
        });

        it('should accept coordinates provided as [lat, long] array', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                location: {
                    coordinates: {
                        value: [-32.48, -58.23],
                        source: 'jsonld'
                    }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.location?.coordinates?.value.lat).toBe('-32.48');
            expect(draft.location?.coordinates?.value.long).toBe('-58.23');
        });

        it('should accept coordinates with lng alias for long', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                location: {
                    coordinates: {
                        value: { lat: -32.48, lng: -58.23 },
                        source: 'jsonld'
                    }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.location?.coordinates?.value.lat).toBe('-32.48');
            expect(draft.location?.coordinates?.value.long).toBe('-58.23');
        });
    });

    // -----------------------------------------------------------------------
    // Validation failure → drop, not throw
    // -----------------------------------------------------------------------

    describe('when a field fails validation', () => {
        it('should drop a name that is too short (empty string) and keep other fields', () => {
            // Arrange — empty string fails min(1) on name
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                name: { value: '', source: 'jsonld' },
                summary: { value: 'A great place to stay', source: 'opengraph' }
            };

            // Act
            const { draft, methodsUsed } = mapRawToDraft({ raw });

            // Assert — name dropped, summary kept
            expect(draft.name).toBeUndefined();
            expect(draft.summary?.value).toBe('A great place to stay');
            expect(methodsUsed).not.toContain('jsonld');
            expect(methodsUsed).toContain('opengraph');
        });

        it('should drop a capacity of -1 and not throw', () => {
            // Arrange — negative capacity fails nonnegative constraint
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                extraInfo: {
                    capacity: { value: -1, source: 'text' }
                }
            };

            // Act + Assert — must not throw
            let draft: ReturnType<typeof mapRawToDraft>['draft'] | undefined;
            expect(() => {
                ({ draft } = mapRawToDraft({ raw }));
            }).not.toThrow();

            expect(draft?.extraInfo?.capacity).toBeUndefined();
        });

        it('should drop an invalid accommodation type and not throw', () => {
            // Arrange — "CASTLE" is not in AccommodationTypeEnum
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                type: { value: 'CASTLE', source: 'text' }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.type).toBeUndefined();
        });

        it('should accept a valid accommodation type (CABIN)', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                type: { value: 'CABIN', source: 'jsonld' }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.type?.value).toBe('CABIN');
        });

        it('should drop a field that cannot be coerced to string (object value for name)', () => {
            // Arrange — an object value cannot be coerced to a string
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: { nested: true }, source: 'text' }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.name).toBeUndefined();
        });

        it('should drop capacity when value is a non-numeric string', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                extraInfo: {
                    capacity: { value: 'many', source: 'text' }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.extraInfo?.capacity).toBeUndefined();
        });

        it('should drop coordinates when object is missing lat', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                location: {
                    coordinates: {
                        value: { long: -58.23 },
                        source: 'text'
                    }
                }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.location?.coordinates).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // methodsUsed
    // -----------------------------------------------------------------------

    describe('methodsUsed', () => {
        it('should list distinct sources for fields that were successfully mapped', () => {
            // Arrange — three fields, two distinct sources
            const raw: RawExtraction = {
                sourcePlatform: 'booking',
                name: { value: 'Hotel Sol', source: 'jsonld' },
                summary: { value: 'A lovely hotel', source: 'jsonld' },
                extraInfo: {
                    capacity: { value: 4, source: 'text' }
                }
            };

            // Act
            const { methodsUsed } = mapRawToDraft({ raw });

            // Assert — jsonld and text, each only once
            expect(methodsUsed).toContain('jsonld');
            expect(methodsUsed).toContain('text');
            expect(methodsUsed).toHaveLength(2);
        });

        it('should not include a source whose only field was dropped', () => {
            // Arrange — only a too-short name from jsonld
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                name: { value: '', source: 'jsonld' }
            };

            // Act
            const { methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(methodsUsed).not.toContain('jsonld');
            expect(methodsUsed).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // AI confidence
    // -----------------------------------------------------------------------

    describe('when a field is sourced from ai', () => {
        it('should assign confidence 30', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                description: { value: 'A cozy place with great views', source: 'ai' }
            };

            // Act
            const { draft } = mapRawToDraft({ raw });

            // Assert
            expect(draft.description?.confidence).toBe(30);
            expect(draft.description?.source).toBe('ai');
        });

        it('should add "ai" to methodsUsed when an ai-sourced field maps successfully', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                summary: { value: 'Comfortable and modern', source: 'ai' }
            };

            // Act
            const { methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(methodsUsed).toContain('ai');
        });
    });

    // -----------------------------------------------------------------------
    // Empty input
    // -----------------------------------------------------------------------

    describe('when given an empty RawExtraction', () => {
        it('should return an empty draft without throwing', () => {
            // Arrange
            const raw: RawExtraction = { sourcePlatform: 'generic' };

            // Act + Assert — must not throw
            let result: ReturnType<typeof mapRawToDraft> | undefined;
            expect(() => {
                result = mapRawToDraft({ raw });
            }).not.toThrow();

            expect(result).toBeDefined();
            expect(result?.draft).toEqual({});
        });

        it('should return an empty methodsUsed array', () => {
            // Arrange
            const raw: RawExtraction = { sourcePlatform: 'none' };

            // Act
            const { methodsUsed } = mapRawToDraft({ raw });

            // Assert
            expect(methodsUsed).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Full multi-field extraction
    // -----------------------------------------------------------------------

    describe('when given a rich RawExtraction with many fields', () => {
        it('should map all valid fields and collect all distinct sources', () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'airbnb',
                name: { value: 'Cabaña del Río', source: 'jsonld' },
                summary: { value: 'A cozy cabin by the river', source: 'opengraph' },
                description: { value: 'Fully equipped cabin with river views.', source: 'ai' },
                type: { value: 'CABIN', source: 'text' },
                extraInfo: {
                    capacity: { value: 6, source: 'text' },
                    bedrooms: { value: 3, source: 'text' },
                    bathrooms: { value: '2', source: 'text' }
                },
                location: {
                    coordinates: { value: { lat: -32.48, long: -58.23 }, source: 'jsonld' },
                    street: { value: 'Calle Principal', source: 'meta' }
                },
                price: {
                    price: { value: 5000, source: 'text' },
                    currency: { value: 'ARS', source: 'text' }
                },
                contactInfo: {
                    website: { value: 'https://example.com', source: 'opengraph' }
                },
                seo: {
                    title: { value: 'Cabaña del Río - Concepción del Uruguay', source: 'meta' }
                }
            };

            // Act
            const { draft, methodsUsed } = mapRawToDraft({ raw });

            // Assert — spot-check several fields
            expect(draft.name?.value).toBe('Cabaña del Río');
            expect(draft.summary?.value).toBe('A cozy cabin by the river');
            expect(draft.description?.confidence).toBe(30);
            expect(draft.type?.value).toBe('CABIN');
            expect(draft.extraInfo?.capacity?.value).toBe(6);
            expect(draft.extraInfo?.bedrooms?.value).toBe(3);
            expect(draft.extraInfo?.bathrooms?.value).toBe(2);
            expect(draft.location?.coordinates?.value.lat).toBe('-32.48');
            expect(draft.location?.street?.value).toBe('Calle Principal');
            expect(draft.price?.price?.value).toBe(5000);
            expect(draft.price?.currency?.value).toBe('ARS');
            expect(draft.contactInfo?.website?.value).toBe('https://example.com');
            expect(draft.seo?.title?.value).toBe('Cabaña del Río - Concepción del Uruguay');

            // Assert methodsUsed — four distinct sources
            const expectedSources = new Set(['jsonld', 'opengraph', 'ai', 'text', 'meta']);
            for (const src of expectedSources) {
                expect(methodsUsed).toContain(src);
            }
            expect(new Set(methodsUsed).size).toBe(methodsUsed.length); // no duplicates
        });
    });
});
