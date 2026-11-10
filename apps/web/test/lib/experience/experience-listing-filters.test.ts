/**
 * @file experience-listing-filters.test.ts
 * @description Unit tests for the experiences listing amenity/feature helpers (HOS-2085).
 */

import type { AmenityPublic, FeaturePublic } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildExperienceCatalogFilterGroups,
    narrowExperienceCatalog
} from '@/lib/experience/experience-listing-filters';
import type { TranslationFn } from '@/lib/i18n';

const AMENITY_A = '11111111-1111-4111-8111-111111111111';
const AMENITY_B = '22222222-2222-4222-8222-222222222222';
const FEATURE_1 = '33333333-3333-4333-8333-333333333333';
const FEATURE_2 = '44444444-4444-4444-8444-444444444444';

const amenity = (id: string, slug: string) =>
    ({
        id,
        slug,
        icon: null,
        type: 'ENTERTAINMENT',
        applicableVerticals: ['experience'],
        displayWeight: 100
    }) as unknown as AmenityPublic;
const feature = (id: string, slug: string) =>
    ({
        id,
        slug,
        icon: 'StarIcon',
        category: null,
        applicableVerticals: ['experience'],
        displayWeight: 100
    }) as unknown as FeaturePublic;

const amenities = [amenity(AMENITY_A, 'amenity-a'), amenity(AMENITY_B, 'amenity-b')];
const features = [feature(FEATURE_1, 'feature-1'), feature(FEATURE_2, 'feature-2')];

/** Fake `t` that returns the key, so assertions can name the namespace used. */
const t: TranslationFn = (fullKey) => fullKey;

describe('narrowExperienceCatalog', () => {
    it('keeps only the items held by a published experience, in catalog order', () => {
        const narrowed = narrowExperienceCatalog({
            filterOptions: { amenityIds: [AMENITY_B], featureIds: [FEATURE_2] },
            amenities,
            features,
            active: {}
        });
        expect(narrowed.amenities.map((a) => a.id)).toEqual([AMENITY_B]);
        expect(narrowed.features.map((f) => f.id)).toEqual([FEATURE_2]);
    });

    it('keeps an active selection even when no listing carries it', () => {
        const narrowed = narrowExperienceCatalog({
            filterOptions: { amenityIds: [], featureIds: [] },
            amenities,
            features,
            active: { amenityIds: [AMENITY_A], featureIds: [FEATURE_1] }
        });
        expect(narrowed.amenities.map((a) => a.id)).toEqual([AMENITY_A]);
        expect(narrowed.features.map((f) => f.id)).toEqual([FEATURE_1]);
    });

    it('fails closed when the options fetch failed: only active values survive', () => {
        const none = narrowExperienceCatalog({
            filterOptions: null,
            amenities,
            features,
            active: {}
        });
        expect(none.amenities).toEqual([]);
        expect(none.features).toEqual([]);

        const active = narrowExperienceCatalog({
            filterOptions: null,
            amenities,
            features,
            active: { featureIds: [FEATURE_2] }
        });
        expect(active.features.map((f) => f.id)).toEqual([FEATURE_2]);
    });
});

describe('buildExperienceCatalogFilterGroups', () => {
    it('emits icon-chips groups with category groups for the dialog', () => {
        const groups = buildExperienceCatalogFilterGroups({ t, amenities, features });
        expect(groups.map((g) => g.id)).toEqual(['amenities', 'features']);
        for (const group of groups) {
            expect(group.type).toBe('icon-chips');
            expect(Object.keys(group.categories ?? {}).length).toBeGreaterThan(0);
        }
    });

    it('labels by slug through the shared catalog keys and the experience headings', () => {
        const [amenitiesGroup, featuresGroup] = buildExperienceCatalogFilterGroups({
            t,
            amenities,
            features
        });
        expect(amenitiesGroup?.label).toBe('experience.listing.amenities');
        expect(featuresGroup?.label).toBe('experience.listing.features');
        expect(amenitiesGroup?.options?.[0]?.label).toBe('accommodations.amenityNames.amenity-a');
        expect(featuresGroup?.options?.[0]?.label).toBe('accommodations.featureNames.feature-1');
        expect(amenitiesGroup?.options?.[0]?.value).toBe(AMENITY_A);
    });

    it('omits a group with no options', () => {
        expect(buildExperienceCatalogFilterGroups({ t, amenities: [], features: [] })).toEqual([]);
        expect(
            buildExperienceCatalogFilterGroups({ t, amenities, features: [] }).map((g) => g.id)
        ).toEqual(['amenities']);
    });
});
