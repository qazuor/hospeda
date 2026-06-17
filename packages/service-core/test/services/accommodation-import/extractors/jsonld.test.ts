/**
 * Unit tests for the JSON-LD extractor (SPEC-222 T-010)
 *
 * Verifies that:
 * - A Hotel JSON-LD block with name/address/geo/image is correctly extracted.
 * - Rating and review fields (aggregateRating, review, ratingValue, reviewCount, etc.)
 *   are NEVER present in the result — this is the SPEC-222 hard rule.
 * - @graph wrappers are unwrapped correctly.
 * - Arrays of JSON-LD objects are searched for the lodging-relevant node.
 * - Malformed JSON blocks are silently skipped; valid blocks on the same page
 *   are still parsed.
 * - Pages with no lodging JSON-LD return an empty result without throwing.
 */

import { describe, expect, it } from 'vitest';

import { extractJsonLd } from '../../../../src/services/accommodation-import/extractors/jsonld.js';

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

/**
 * Wraps a JSON value in a <script type="application/ld+json"> block.
 */
function scriptBlock(content: unknown): string {
    return `<script type="application/ld+json">${JSON.stringify(content)}</script>`;
}

/**
 * A complete Hotel JSON-LD node with all optional fields and rating/review data
 * that MUST be stripped.
 */
const HOTEL_NODE_WITH_RATINGS = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Hotel Sol del Sur',
    description: 'Un hermoso hotel frente al río.',
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'Av. Costanera 123',
        addressLocality: 'Concepción del Uruguay',
        addressCountry: 'AR'
    },
    geo: {
        '@type': 'GeoCoordinates',
        latitude: -32.484,
        longitude: -58.232
    },
    image: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    telephone: '+54 3442 123456',
    url: 'https://hotelsolsur.com',
    priceRange: '$$$',
    // Fields that MUST be stripped per SPEC-222
    aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.7,
        reviewCount: 312
    },
    review: [{ '@type': 'Review', reviewBody: 'Excelente lugar!' }],
    ratingValue: 4.7,
    reviewCount: 312
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractJsonLd', () => {
    describe('given a Hotel JSON-LD block with name / address / geo / image', () => {
        it('should extract name', () => {
            // Arrange
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);

            // Act
            const result = extractJsonLd({ html });

            // Assert
            expect(result.name).toBe('Hotel Sol del Sur');
        });

        it('should extract description', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.description).toBe('Un hermoso hotel frente al río.');
        });

        it('should extract address fields', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });

            expect(result.address).toBeDefined();
            expect(result.address?.streetAddress).toBe('Av. Costanera 123');
            expect(result.address?.addressLocality).toBe('Concepción del Uruguay');
            expect(result.address?.addressCountry).toBe('AR');
        });

        it('should promote addressLocality to scrapedLocality', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
        });

        it('should promote addressCountry to scrapedCountry', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.scrapedCountry).toBe('AR');
        });

        it('should extract geo coordinates as strings', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });

            expect(result.geo).toBeDefined();
            expect(result.geo?.latitude).toBe('-32.484');
            expect(result.geo?.longitude).toBe('-58.232');
        });

        it('should extract all image URLs', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });

            expect(result.imageUrls).toBeDefined();
            expect(result.imageUrls).toEqual([
                'https://example.com/img1.jpg',
                'https://example.com/img2.jpg'
            ]);
        });

        it('should extract telephone', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.telephone).toBe('+54 3442 123456');
        });

        it('should extract url', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.url).toBe('https://hotelsolsur.com');
        });

        it('should extract priceRange', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result.priceRange).toBe('$$$');
        });
    });

    describe('SPEC-222 hard rule — rating and review fields must be absent', () => {
        it('should NOT include aggregateRating', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('aggregateRating');
        });

        it('should NOT include review', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('review');
        });

        it('should NOT include ratingValue', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('ratingValue');
        });

        it('should NOT include reviewCount', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('reviewCount');
        });

        it('should NOT include bestRating', () => {
            const node = {
                ...HOTEL_NODE_WITH_RATINGS,
                bestRating: 5,
                worstRating: 1
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('bestRating');
            expect(result).not.toHaveProperty('worstRating');
        });

        it('should NOT include starRating', () => {
            const node = {
                ...HOTEL_NODE_WITH_RATINGS,
                starRating: { '@type': 'Rating', ratingValue: 5 }
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('starRating');
        });

        it('should still extract non-rating fields when ratings are present', () => {
            const html = scriptBlock(HOTEL_NODE_WITH_RATINGS);
            const result = extractJsonLd({ html });
            // Name must be present even though rating was stripped.
            expect(result.name).toBe('Hotel Sol del Sur');
        });
    });

    describe('given a @graph wrapper with a LodgingBusiness node', () => {
        it('should unwrap @graph and extract the lodging node', () => {
            // Arrange
            const graphNode = {
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'WebPage',
                        name: 'Página del hotel'
                    },
                    {
                        '@type': 'LodgingBusiness',
                        name: 'Hospedaje Los Pinos',
                        description: 'Rodeado de naturaleza.',
                        address: {
                            '@type': 'PostalAddress',
                            addressLocality: 'Federación',
                            addressCountry: 'Argentina'
                        }
                    }
                ]
            };
            const html = scriptBlock(graphNode);

            // Act
            const result = extractJsonLd({ html });

            // Assert
            expect(result.name).toBe('Hospedaje Los Pinos');
            expect(result.description).toBe('Rodeado de naturaleza.');
            expect(result.address?.addressLocality).toBe('Federación');
            expect(result.scrapedLocality).toBe('Federación');
        });

        it('should NOT include rating fields from within @graph nodes', () => {
            const graphNode = {
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'Hotel',
                        name: 'Hotel Federación',
                        aggregateRating: { ratingValue: 4.2, reviewCount: 50 }
                    }
                ]
            };
            const html = scriptBlock(graphNode);
            const result = extractJsonLd({ html });
            expect(result).not.toHaveProperty('aggregateRating');
        });
    });

    describe('given an array of JSON-LD objects', () => {
        it('should pick the lodging-relevant node and ignore the others', () => {
            // Arrange — array with a WebSite node first and a VacationRental node second
            const array = [
                {
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    name: 'Mi sitio web'
                },
                {
                    '@context': 'https://schema.org',
                    '@type': 'VacationRental',
                    name: 'Cabaña del Río',
                    description: 'Junto al Río Uruguay.'
                }
            ];
            const html = scriptBlock(array);

            // Act
            const result = extractJsonLd({ html });

            // Assert
            expect(result.name).toBe('Cabaña del Río');
            expect(result.description).toBe('Junto al Río Uruguay.');
        });

        it('should return empty result when no lodging node is in the array', () => {
            const array = [
                { '@type': 'WebSite', name: 'Sitio' },
                { '@type': 'BreadcrumbList', name: 'Navegación' }
            ];
            const html = scriptBlock(array);
            const result = extractJsonLd({ html });
            expect(result).toEqual({});
        });
    });

    describe('given a malformed JSON-LD block', () => {
        it('should skip the malformed block and not throw', () => {
            // Arrange — two blocks: first malformed, second valid Hotel
            const html = `<script type="application/ld+json">{ this is: not json }</script>${scriptBlock({ '@type': 'Hotel', name: 'Hotel Válido' })}`;

            // Act — must not throw
            let result!: ReturnType<typeof extractJsonLd>;
            expect(() => {
                result = extractJsonLd({ html });
            }).not.toThrow();

            // Assert — valid block after the malformed one is still parsed
            expect(result.name).toBe('Hotel Válido');
        });

        it('should return an empty result when the only block is malformed', () => {
            const html = `<script type="application/ld+json">{{{{ invalid }</script>`;
            const result = extractJsonLd({ html });
            expect(result).toEqual({});
        });
    });

    describe('image field variations', () => {
        it('should normalise a single string image to an array', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel Foto',
                image: 'https://example.com/single.jpg'
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.imageUrls).toEqual(['https://example.com/single.jpg']);
        });

        it('should extract URL from an ImageObject', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel Foto',
                image: { '@type': 'ImageObject', url: 'https://example.com/obj.jpg' }
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.imageUrls).toEqual(['https://example.com/obj.jpg']);
        });

        it('should handle a mixed array of strings and ImageObjects', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel Foto',
                image: [
                    'https://example.com/a.jpg',
                    { '@type': 'ImageObject', url: 'https://example.com/b.jpg' }
                ]
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.imageUrls).toEqual([
                'https://example.com/a.jpg',
                'https://example.com/b.jpg'
            ]);
        });
    });

    describe('geo coordinate edge cases', () => {
        it('should accept string latitude/longitude values', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel Geo',
                geo: { latitude: '-32.484', longitude: '-58.232' }
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.geo?.latitude).toBe('-32.484');
            expect(result.geo?.longitude).toBe('-58.232');
        });

        it('should return no geo when latitude is missing', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel NoGeo',
                geo: { longitude: '-58.232' }
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.geo).toBeUndefined();
        });

        it('should return no geo when coordinates are non-numeric', () => {
            const node = {
                '@type': 'Hotel',
                name: 'Hotel BadGeo',
                geo: { latitude: 'not-a-number', longitude: '-58.232' }
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result.geo).toBeUndefined();
        });
    });

    describe('given a page with no JSON-LD blocks', () => {
        it('should return an empty object without throwing', () => {
            const html = '<html><head><title>No scripts here</title></head><body></body></html>';
            const result = extractJsonLd({ html });
            expect(result).toEqual({});
        });
    });

    describe('given a page with JSON-LD of non-lodging types only', () => {
        it('should return an empty object', () => {
            const node = {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Acme Corp'
            };
            const html = scriptBlock(node);
            const result = extractJsonLd({ html });
            expect(result).toEqual({});
        });
    });

    describe('multiple JSON-LD blocks on the same page', () => {
        it('should use the first lodging-relevant block', () => {
            // Arrange — two blocks: first non-lodging, second Hotel
            const html =
                scriptBlock({ '@type': 'BreadcrumbList', name: 'Nav' }) +
                scriptBlock({ '@type': 'Hotel', name: 'Hotel Primero' });

            const result = extractJsonLd({ html });
            expect(result.name).toBe('Hotel Primero');
        });
    });

    describe('all supported lodging @type values', () => {
        const types = [
            'LodgingBusiness',
            'Hotel',
            'Motel',
            'Hostel',
            'BedAndBreakfast',
            'Resort',
            'Apartment',
            'House',
            'VacationRental',
            'Campground',
            'Place',
            'LocalBusiness'
        ];

        for (const type of types) {
            it(`should extract name for @type="${type}"`, () => {
                const node = { '@type': type, name: `${type} Name` };
                const html = scriptBlock(node);
                const result = extractJsonLd({ html });
                expect(result.name).toBe(`${type} Name`);
            });
        }
    });
});
