/**
 * @file tourist-attraction-jsonld.test.ts
 * @description `buildTouristAttractionJsonLd` (HOS-2579 §6.6, AC-23, owner
 * decision D-2) and its wiring on the experience detail page.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildTouristAttractionJsonLd,
    type TouristAttractionJsonLdInput
} from '../../../src/lib/seo/tourist-attraction-jsonld';

const BASE: TouristAttractionJsonLdInput = {
    name: 'Kayak al atardecer',
    url: 'https://hospeda.com.ar/es/experiencias/kayak-al-atardecer/'
};

/** The AC-23 fixture: coordinates, 5 reviews averaging 4.4, priceFrom = 850000. */
const AC23: TouristAttractionJsonLdInput = {
    ...BASE,
    latitude: -32.4825,
    longitude: -58.2372,
    ratingValue: 4.4,
    reviewCount: 5,
    priceFrom: 850000,
    isPriceOnRequest: false,
    destinationName: 'Concepción del Uruguay'
};

describe('buildTouristAttractionJsonLd (HOS-2579 AC-23)', () => {
    it('emits the full multi-typed object for the AC-23 experience', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd(AC23);

        // Assert
        expect(data).toStrictEqual({
            '@context': 'https://schema.org',
            '@type': ['TouristAttraction', 'TouristTrip'],
            name: 'Kayak al atardecer',
            url: 'https://hospeda.com.ar/es/experiencias/kayak-al-atardecer/',
            geo: { '@type': 'GeoCoordinates', latitude: -32.4825, longitude: -58.2372 },
            aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.4, reviewCount: 5 },
            containedInPlace: { '@type': 'City', name: 'Concepción del Uruguay' },
            isAccessibleForFree: false,
            offers: { '@type': 'Offer', price: 8500, priceCurrency: 'ARS' }
        });
    });

    it('emits no offers and a single TouristAttraction type when the price is on request', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({
            ...AC23,
            priceFrom: null,
            isPriceOnRequest: true
        });

        // Assert
        expect(data['@type']).toBe('TouristAttraction');
        expect(data).not.toHaveProperty('offers');
        expect(data).not.toHaveProperty('isAccessibleForFree');
    });

    it('ignores a stored price when isPriceOnRequest is true', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({ ...AC23, isPriceOnRequest: true });

        // Assert
        expect(data).not.toHaveProperty('offers');
    });

    it('emits no aggregateRating with 0 reviews', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({ ...AC23, ratingValue: 0, reviewCount: 0 });

        // Assert
        expect(data).not.toHaveProperty('aggregateRating');
    });

    it('emits no aggregateRating when the count is stale and the rating is 0', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({ ...AC23, ratingValue: 0, reviewCount: 3 });

        // Assert
        expect(data).not.toHaveProperty('aggregateRating');
    });

    it('emits no geo when the meeting point is not pinned', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({ ...AC23, latitude: null, longitude: -58 });

        // Assert
        expect(data).not.toHaveProperty('geo');
    });

    it('emits only the base fields for a bare experience', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd(BASE);

        // Assert
        expect(data).toStrictEqual({
            '@context': 'https://schema.org',
            '@type': 'TouristAttraction',
            name: BASE.name,
            url: BASE.url
        });
    });

    it('keeps description, image and telephone when present', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({
            ...BASE,
            description: 'Paseo guiado',
            image: 'https://img.example/kayak.jpg',
            telephone: '+5493442000000'
        });

        // Assert
        expect(data).toMatchObject({
            description: 'Paseo guiado',
            image: 'https://img.example/kayak.jpg',
            telephone: '+5493442000000'
        });
    });

    it('converts centavos with decimals', () => {
        // Act
        const { data } = buildTouristAttractionJsonLd({ ...BASE, priceFrom: 12345 });

        // Assert
        expect(data.offers).toStrictEqual({
            '@type': 'Offer',
            price: 123.45,
            priceCurrency: 'ARS'
        });
    });
});

describe('experience detail page passes the enrichment data (HOS-2579 AC-23)', () => {
    const src = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/experiencias/[slug].astro'),
        'utf8'
    );

    it.each([
        'latitude={experience.meetingPointLat}',
        'longitude={experience.meetingPointLong}',
        'ratingValue={experience.averageRating}',
        'reviewCount={experience.reviewsCount}',
        'priceFrom={experience.priceFrom}',
        'isPriceOnRequest={experience.isPriceOnRequest}',
        'destinationName={experience.destinationName}'
    ])('passes %s to TouristAttractionJsonLd', (prop) => {
        const block = src.match(/<TouristAttractionJsonLd[\s\S]*?\/>/)?.[0] ?? '';
        expect(block).toContain('slot="head-extra"');
        expect(block).toContain(prop);
    });
});
