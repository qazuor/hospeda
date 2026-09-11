/**
 * @file commerce-catalog.schema.test.ts
 * @description HOS-1072 — the amenity/feature projections a commerce listing
 * publishes, asserted THROUGH the two access schemas that gate them.
 *
 * Asserting the item schemas alone would be vacuous for the bug this covers.
 * The failure was never that the item shape was wrong: it was that
 * `GastronomyPublicSchema` and `ExperiencePublicSchema` did not DECLARE the
 * fields, so `stripWithSchema` dropped everything the route attached and the
 * owner's ticked amenities never left the API. So every assertion below runs a
 * full public-tier parse and reads the result — remove the `amenities` /
 * `features` lines from either access schema and these fail.
 */
import { describe, expect, it } from 'vitest';
import { ExperiencePublicSchema } from '../../entities/experience/experience.access.schema.js';
import { GastronomyPublicSchema } from '../../entities/gastronomy/gastronomy.access.schema.js';
import { GastronomyTypeEnum } from '../../enums/gastronomy-type.enum.js';
import { ExperiencePriceUnitEnum, ExperienceTypeEnum } from '../../enums/index.js';

const ENTITY_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const AMENITY_UUID = '3f1a6b2c-1111-4d3e-8a90-2b7c4d5e6f70';
const FEATURE_UUID = '9c8b7a65-2222-4f1e-9b03-1a2b3c4d5e6f';

/** One catalog-joined amenity row, exactly as the public route emits it. */
const AMENITY_ROW = {
    amenityId: AMENITY_UUID,
    slug: 'accepts_cards',
    icon: 'credit-card'
} as const;

/** One catalog-joined feature row, carrying both owner-authored columns. */
const FEATURE_ROW = {
    featureId: FEATURE_UUID,
    slug: 'transport_included',
    icon: 'bus',
    hostReWriteName: 'Combi desde el hotel',
    comments: 'Salida 8:00 desde el centro'
} as const;

const buildGastronomy = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: ENTITY_UUID,
    slug: 'parrilla-el-fogon',
    name: 'Parrilla El Fogón',
    type: GastronomyTypeEnum.PARRILLA,
    summary: 'Parrilla de barrio con mesas en la vereda y carta corta.',
    description:
        'Una parrilla de barrio en Concepción del Uruguay, con achuras, tira y una carta corta que cambia por semana.',
    isFeatured: false,
    destinationId: ENTITY_UUID,
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 12,
    createdAt: new Date('2024-01-01'),
    ...overrides
});

const buildExperience = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: ENTITY_UUID,
    slug: 'excursion-a-colon',
    name: 'Excursión a Colón',
    type: ExperienceTypeEnum.EXCURSION,
    summary: 'Visitá la ciudad vecina de Colón con guía incluido.',
    description:
        'Una excursión completa a la ciudad de Colón, con visita a las termas y el parque nacional.',
    priceFrom: 1500000,
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    hasActiveSubscription: true,
    isFeatured: false,
    destinationId: ENTITY_UUID,
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 12,
    createdAt: new Date('2024-01-01'),
    createdById: null,
    updatedById: null,
    ...overrides
});

describe('GastronomyPublicSchema — amenities/features reach the public tier (HOS-1072)', () => {
    it('keeps a catalog-joined amenity through the public parse', () => {
        // Arrange
        const raw = buildGastronomy({ amenities: [AMENITY_ROW] });

        // Act
        const result = GastronomyPublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.amenities).toEqual([AMENITY_ROW]);
    });

    it('keeps a feature with its owner-authored relabel and comment', () => {
        // Arrange
        const raw = buildGastronomy({ features: [FEATURE_ROW] });

        // Act
        const result = GastronomyPublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.features).toEqual([FEATURE_ROW]);
    });

    it('leaves both keys ABSENT — not empty arrays — when the payload omits them', () => {
        // Arrange: a list payload, which never runs the catalog join.
        const raw = buildGastronomy();

        // Act
        const result = GastronomyPublicSchema.safeParse(raw);

        // Assert: "not loaded" must stay distinguishable from "has none".
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect('amenities' in result.data).toBe(false);
        expect('features' in result.data).toBe(false);
    });

    it('strips catalog columns that are NOT part of the published projection', () => {
        // Arrange: `isBuiltin` and `adminInfo` exist on the catalog row and must
        // not ride along just because the join could reach them.
        const raw = buildGastronomy({
            amenities: [{ ...AMENITY_ROW, isBuiltin: true, adminInfo: { notes: 'interno' } }]
        });

        // Act
        const result = GastronomyPublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.amenities?.[0]).toEqual(AMENITY_ROW);
    });

    it('rejects an amenity row whose catalog join produced no slug', () => {
        // Arrange: the slug IS the i18n key — a row without one renders nothing.
        const raw = buildGastronomy({ amenities: [{ amenityId: AMENITY_UUID, icon: null }] });

        // Act
        const result = GastronomyPublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('ExperiencePublicSchema — amenities/features reach the public tier (HOS-1072)', () => {
    it('keeps the "qué incluye" amenities the provider ticked', () => {
        // Arrange
        const raw = buildExperience({
            amenities: [
                { amenityId: AMENITY_UUID, slug: 'transport_included', icon: 'bus' },
                { amenityId: FEATURE_UUID, slug: 'guide_included', icon: null }
            ]
        });

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.amenities?.map((amenity) => amenity.slug)).toEqual([
            'transport_included',
            'guide_included'
        ]);
    });

    it('preserves the order the API sent, without re-sorting', () => {
        // Arrange: the route orders by the catalog's displayWeight, and that
        // ordering is the only one the client gets — the item shape carries no
        // weight to re-sort by.
        const raw = buildExperience({
            amenities: [
                { amenityId: AMENITY_UUID, slug: 'zzz_last', icon: null },
                { amenityId: FEATURE_UUID, slug: 'aaa_first', icon: null }
            ]
        });

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.amenities?.map((amenity) => amenity.slug)).toEqual([
            'zzz_last',
            'aaa_first'
        ]);
    });

    it('keeps a feature with its owner-authored relabel and comment', () => {
        // Arrange
        const raw = buildExperience({ features: [FEATURE_ROW] });

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.features).toEqual([FEATURE_ROW]);
    });

    it('leaves both keys ABSENT — not empty arrays — when the payload omits them', () => {
        // Arrange
        const raw = buildExperience();

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect('amenities' in result.data).toBe(false);
        expect('features' in result.data).toBe(false);
    });
});
