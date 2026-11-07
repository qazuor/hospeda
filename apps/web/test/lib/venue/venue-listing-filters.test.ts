/**
 * @file venue-listing-filters.test.ts
 * @description Unit tests for the shared venue sidebar/chip builders
 * (HOS-1787 leaf 6.10). They also own the group-shape and label assertions
 * that used to read the general listing page as text; keeping them here means
 * the two pages and every collection share one definition.
 */

import type { AmenityPublic, FeaturePublic } from '@repo/schemas';
import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { TranslationFn } from '@/lib/i18n';
import {
    buildVenueFilterGroups,
    buildVenueTypeChips,
    narrowVenueFilterCatalog
} from '@/lib/venue/venue-listing-filters';
import { VENUE_TYPE_OPTIONS } from '@/lib/venue/venue-type-options';

const AMENITY_A = '11111111-1111-4111-8111-111111111111';
const AMENITY_B = '22222222-2222-4222-8222-222222222222';
const FEATURE_1 = '33333333-3333-4333-8333-333333333333';
const FEATURE_2 = '44444444-4444-4444-8444-444444444444';

function amenity({ id, slug }: { readonly id: string; readonly slug: string }): AmenityPublic {
    return {
        id,
        slug,
        description: null,
        icon: null,
        applicableVerticals: ['venue'],
        type: 'ENTERTAINMENT',
        isFeatured: false,
        displayWeight: 100,
        lifecycleState: 'ACTIVE'
    } as unknown as AmenityPublic;
}

function feature({ id, slug }: { readonly id: string; readonly slug: string }): FeaturePublic {
    return {
        id,
        slug,
        description: null,
        icon: 'StarIcon',
        applicableVerticals: ['venue'],
        category: null,
        isFeatured: false,
        isBuiltin: false,
        displayWeight: 100,
        lifecycleState: 'ACTIVE'
    } as unknown as FeaturePublic;
}

const amenityA = amenity({ id: AMENITY_A, slug: 'amenity-a' });
const amenityB = amenity({ id: AMENITY_B, slug: 'amenity-b' });
const feature1 = feature({ id: FEATURE_1, slug: 'feature-1' });
const feature2 = feature({ id: FEATURE_2, slug: 'feature-2' });

/** Fake `t` that returns the key, so assertions can name the namespace used. */
const t: TranslationFn = (fullKey) => fullKey;

describe('VENUE_TYPE_OPTIONS', () => {
    // Moved from comer-y-salir-index.test.ts: the page no longer derives the
    // chips inline; the enum order is the helper's contract.
    it('mirrors every venue enum value in canonical order', () => {
        expect(VENUE_TYPE_OPTIONS).toHaveLength(Object.values(VenueTypeEnum).length);
        expect([...VENUE_TYPE_OPTIONS].sort()).toEqual([...Object.values(VenueTypeEnum)].sort());
    });
});

describe('narrowVenueFilterCatalog', () => {
    it('keeps only the values offered by the filter options, in stable order', () => {
        const { types, amenities, features } = narrowVenueFilterCatalog({
            filterOptions: {
                types: [VenueTypeEnum.BOLICHE, VenueTypeEnum.BAR],
                amenityIds: [AMENITY_A],
                featureIds: [FEATURE_1]
            },
            amenities: [amenityA, amenityB],
            features: [feature1, feature2],
            active: { amenityIds: [], featureIds: [] }
        });

        expect(types).toEqual([VenueTypeEnum.BAR, VenueTypeEnum.BOLICHE]);
        expect(amenities.map((entry) => entry.id)).toEqual([AMENITY_A]);
        expect(features.map((entry) => entry.id)).toEqual([FEATURE_1]);
    });

    it('always keeps an active value even when no listing carries it', () => {
        const { features } = narrowVenueFilterCatalog({
            filterOptions: {
                types: [],
                amenityIds: [],
                featureIds: [FEATURE_1]
            },
            amenities: [amenityA, amenityB],
            features: [feature1, feature2],
            active: { featureIds: [FEATURE_2] }
        });

        expect(features.map((entry) => entry.id)).toEqual([FEATURE_1, FEATURE_2]);
    });

    it('fails closed to the active values when the options fetch failed', () => {
        const { types, amenities, features } = narrowVenueFilterCatalog({
            filterOptions: null,
            amenities: [amenityA, amenityB],
            features: [feature1, feature2],
            active: {
                type: VenueTypeEnum.BOLICHE,
                amenityIds: [AMENITY_A],
                featureIds: [FEATURE_2]
            }
        });

        expect(types).toEqual([VenueTypeEnum.BOLICHE]);
        expect(amenities.map((entry) => entry.id)).toEqual([AMENITY_A]);
        expect(features.map((entry) => entry.id)).toEqual([FEATURE_2]);
    });
});

describe('buildVenueFilterGroups', () => {
    const destinations = [
        { id: 'dest-1', name: 'Destino Uno', isFeatured: true },
        { id: 'dest-2', name: 'Destino Dos', isFeatured: false }
    ];

    it('emits the groups with their ids and control types', () => {
        const groups = buildVenueFilterGroups({
            t,
            destinations,
            types: [VenueTypeEnum.BAR, VenueTypeEnum.BOLICHE],
            amenities: [amenityA],
            features: [feature1]
        });

        expect(groups.map((group) => group.id)).toEqual([
            'q',
            'destinationId',
            'type',
            'priceRange',
            'isFeatured',
            'amenities',
            'features',
            'minRating'
        ]);

        const byId = new Map(groups.map((group) => [group.id, group]));
        expect(byId.get('q')?.type).toBe('search');
        expect(byId.get('destinationId')?.type).toBe('select-search');
        expect(byId.get('type')?.type).toBe('checkbox');
        expect(byId.get('priceRange')?.type).toBe('checkbox');
        expect(byId.get('isFeatured')?.type).toBe('toggle');
        expect(byId.get('amenities')?.type).toBe('icon-chips');
        expect(byId.get('features')?.type).toBe('icon-chips');
        expect(byId.get('minRating')?.type).toBe('stars');
    });

    it('carries the received amenity and feature options with slug-based labels', () => {
        const groups = buildVenueFilterGroups({
            t,
            destinations,
            types: [VenueTypeEnum.BAR],
            amenities: [amenityA, amenityB],
            features: [feature1, feature2]
        });

        const amenitiesGroup = groups.find((group) => group.id === 'amenities');
        const featuresGroup = groups.find((group) => group.id === 'features');

        expect(amenitiesGroup?.label).toBe('venue.listing.amenities');
        expect(featuresGroup?.label).toBe('venue.listing.features');

        if (amenitiesGroup?.type !== 'icon-chips') throw new Error('missing amenities group');
        if (featuresGroup?.type !== 'icon-chips') throw new Error('missing features group');

        expect(amenitiesGroup.options.map((option) => option.value)).toEqual([
            AMENITY_A,
            AMENITY_B
        ]);
        expect(amenitiesGroup.options.map((option) => option.label)).toEqual([
            'accommodations.amenityNames.amenity-a',
            'accommodations.amenityNames.amenity-b'
        ]);
        expect(featuresGroup.options.map((option) => option.value)).toEqual([FEATURE_1, FEATURE_2]);
        expect(featuresGroup.options.map((option) => option.label)).toEqual([
            'accommodations.featureNames.feature-1',
            'accommodations.featureNames.feature-2'
        ]);
    });

    it('omits an empty type, amenities or features group', () => {
        const groups = buildVenueFilterGroups({
            t,
            destinations,
            types: [],
            amenities: [],
            features: []
        });

        expect(groups.map((group) => group.id)).toEqual([
            'q',
            'destinationId',
            'priceRange',
            'isFeatured',
            'minRating'
        ]);
    });

    it('resolves the venue type and price labels through the venue namespace', () => {
        const groups = buildVenueFilterGroups({
            t,
            destinations,
            types: [VenueTypeEnum.BAR],
            amenities: [],
            features: []
        });

        const typeGroup = groups.find((group) => group.id === 'type');
        const priceGroup = groups.find((group) => group.id === 'priceRange');

        if (typeGroup?.type !== 'checkbox') throw new Error('missing type group');
        if (priceGroup?.type !== 'checkbox') throw new Error('missing price group');

        expect(typeGroup.options[0]?.label).toBe('venue.types.BAR');
        expect(priceGroup.options.map((option) => option.label)).toEqual([
            'venue.card.priceRange.BUDGET',
            'venue.card.priceRange.MID',
            'venue.card.priceRange.HIGH',
            'venue.card.priceRange.PREMIUM'
        ]);
    });
});

describe('buildVenueTypeChips', () => {
    const baseUrl = '/es/comer-y-salir/rubro/coleccion/';

    it('emits one chip per received type, with the active one flagged', () => {
        const chips = buildVenueTypeChips({
            t,
            types: [VenueTypeEnum.BAR, VenueTypeEnum.BOLICHE],
            baseUrl,
            searchParams: new URLSearchParams(),
            activeType: VenueTypeEnum.BOLICHE
        });

        expect(chips).toHaveLength(2);
        expect(chips.map((chip) => chip.label)).toEqual(['venue.types.BAR', 'venue.types.BOLICHE']);
        expect(chips.map((chip) => chip.active)).toEqual([false, true]);
    });

    it('builds the href on ?type= and clears it for the active chip', () => {
        const chips = buildVenueTypeChips({
            t,
            types: [VenueTypeEnum.BAR, VenueTypeEnum.BOLICHE],
            baseUrl,
            searchParams: new URLSearchParams('q=algo'),
            activeType: VenueTypeEnum.BOLICHE
        });

        const inactive = chips.find((chip) => !chip.active);
        const active = chips.find((chip) => chip.active);

        expect(inactive?.href).toContain('type=BAR');
        expect(inactive?.href).toContain('q=algo');
        expect(active?.href).not.toContain('type=');
    });
});
