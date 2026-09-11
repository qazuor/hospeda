/**
 * @file transforms-commerce-catalog.test.ts
 * @description HOS-1072 — the gastronomy/experience detail transforms turn the
 * API's catalog-joined `amenities` / `features` into the item shape
 * `AmenitiesGrid.astro` and `FeaturesGrid.astro` render.
 *
 * These assertions run the REAL transform, not a source read: the whole point
 * of this layer is the two coercions the grids depend on and neither the schema
 * nor the `.astro` file can prove. `name` must carry the SLUG (the grids feed it
 * straight to `t('accommodations.amenityNames.' + name)`, so a wrong value shows
 * an untranslated key or nothing), and `additionalCost` must be `null` (a number
 * makes `AmenitiesGrid` print "(costo adicional)" on a commerce listing whose
 * junction table has no such column to have set it).
 */
import { describe, expect, it } from 'vitest';
import {
    toExperienceDetailPageProps,
    toGastronomyDetailPageProps
} from '../../../src/lib/api/transforms';

const AMENITY_ID = '3f1a6b2c-1111-4d3e-8a90-2b7c4d5e6f70';
const FEATURE_ID = '9c8b7a65-2222-4f1e-9b03-1a2b3c4d5e6f';

/** Minimal public gastronomy payload; only the catalog arrays vary per test. */
const gastronomyPayload = (overrides: Record<string, unknown> = {}) => ({
    id: 'gastro-1',
    slug: 'parrilla-el-fogon',
    name: 'Parrilla El Fogón',
    type: 'PARRILLA',
    summary: 'Parrilla de barrio.',
    description: 'Una parrilla de barrio en Concepción del Uruguay.',
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 12,
    ...overrides
});

/** Minimal public experience payload; only the catalog arrays vary per test. */
const experiencePayload = (overrides: Record<string, unknown> = {}) => ({
    id: 'exp-1',
    slug: 'excursion-a-colon',
    name: 'Excursión a Colón',
    type: 'EXCURSION',
    summary: 'Excursión con guía.',
    description: 'Una excursión completa a la ciudad de Colón.',
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 12,
    ...overrides
});

describe('toGastronomyDetailPageProps — amenities (HOS-1072)', () => {
    it('puts the catalog SLUG in `name`, which is the grid i18n key', () => {
        // Arrange
        const raw = gastronomyPayload({
            amenities: [{ amenityId: AMENITY_ID, slug: 'accepts_cards', icon: 'credit-card' }]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities).toEqual([
            {
                amenityId: AMENITY_ID,
                name: 'accepts_cards',
                icon: 'credit-card',
                isOptional: false,
                additionalCost: null,
                displayWeight: 50
            }
        ]);
    });

    it('never claims an additional cost the commerce junction cannot store', () => {
        // Arrange: even if a stray value arrived, the grid must not print
        // "(costo adicional)" for a column `r_gastronomy_amenity` does not have.
        const raw = gastronomyPayload({
            amenities: [
                { amenityId: AMENITY_ID, slug: 'parking', icon: null, additionalCost: 5000 }
            ]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities[0]?.additionalCost).toBeNull();
    });

    it('preserves the API order instead of re-sorting on the flat weight', () => {
        // Arrange: the API already ordered by the catalog's displayWeight.
        const raw = gastronomyPayload({
            amenities: [
                { amenityId: AMENITY_ID, slug: 'delivery', icon: null },
                { amenityId: FEATURE_ID, slug: 'takeaway', icon: null }
            ]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities.map((amenity) => amenity.name)).toEqual(['delivery', 'takeaway']);
    });

    it('drops a row with no slug rather than rendering an empty label', () => {
        // Arrange
        const raw = gastronomyPayload({
            amenities: [
                { amenityId: AMENITY_ID, icon: 'wifi' },
                { amenityId: FEATURE_ID, slug: 'wifi', icon: 'wifi' }
            ]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities.map((amenity) => amenity.name)).toEqual(['wifi']);
    });

    it('returns an empty array when the payload carries no amenities key', () => {
        // Arrange
        const raw = gastronomyPayload();

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities).toEqual([]);
        expect(result.features).toEqual([]);
    });
});

describe('toGastronomyDetailPageProps — features (HOS-1072)', () => {
    it('reads the owner-authored relabel and comment straight through', () => {
        // Arrange
        const raw = gastronomyPayload({
            features: [
                {
                    featureId: FEATURE_ID,
                    slug: 'private_events',
                    icon: 'users',
                    hostReWriteName: 'Salón para cumpleaños',
                    comments: 'Hasta 40 personas'
                }
            ]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.features).toEqual([
            {
                featureId: FEATURE_ID,
                name: 'private_events',
                icon: 'users',
                hostReWriteName: 'Salón para cumpleaños',
                comments: 'Hasta 40 personas',
                displayWeight: 50
            }
        ]);
    });

    it('nulls an absent relabel so the grid falls back to the i18n label', () => {
        // Arrange
        const raw = gastronomyPayload({
            features: [{ featureId: FEATURE_ID, slug: 'live_music', icon: null }]
        });

        // Act
        const result = toGastronomyDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.features[0]?.hostReWriteName).toBeNull();
        expect(result.features[0]?.comments).toBeNull();
    });
});

describe('toExperienceDetailPageProps — "qué incluye" (HOS-1072)', () => {
    it('maps the *_included amenities the provider ticked', () => {
        // Arrange
        const raw = experiencePayload({
            amenities: [
                { amenityId: AMENITY_ID, slug: 'transport_included', icon: 'bus' },
                { amenityId: FEATURE_ID, slug: 'guide_included', icon: null }
            ]
        });

        // Act
        const result = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities.map((amenity) => amenity.name)).toEqual([
            'transport_included',
            'guide_included'
        ]);
        expect(result.amenities[1]?.icon).toBeNull();
    });

    it('maps features with their owner-authored columns', () => {
        // Arrange
        const raw = experiencePayload({
            features: [
                {
                    featureId: FEATURE_ID,
                    slug: 'english_spoken',
                    icon: 'globe',
                    hostReWriteName: null,
                    comments: 'Guía bilingüe los fines de semana'
                }
            ]
        });

        // Act
        const result = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.features[0]?.name).toBe('english_spoken');
        expect(result.features[0]?.comments).toBe('Guía bilingüe los fines de semana');
    });

    it('returns empty arrays when the payload carries neither key', () => {
        // Arrange
        const raw = experiencePayload();

        // Act
        const result = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities).toEqual([]);
        expect(result.features).toEqual([]);
    });

    it('ignores a non-array value instead of throwing', () => {
        // Arrange: a malformed payload must degrade to "nothing to show".
        const raw = experiencePayload({ amenities: 'accepts_cards', features: null });

        // Act
        const result = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert
        expect(result.amenities).toEqual([]);
        expect(result.features).toEqual([]);
    });
});
