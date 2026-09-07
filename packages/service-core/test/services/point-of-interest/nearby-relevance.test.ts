/**
 * @file nearby-relevance.test.ts
 * @description Unit tests for the HOS-327 "what's nearby" relevance policy
 * (`point-of-interest.nearby-relevance.ts`): the per-POI elastic radius, the
 * gravity-style score, and the ranking that composes them.
 *
 * Every expected number below was computed FROM the formula and then written
 * out, not recalled — see the `documents the exact-tie the brief's example
 * lands on` case, which is a genuine tie the brief assumed was a strict
 * ordering.
 */

import { describe, expect, it } from 'vitest';
import {
    computeElasticRadiusKm,
    computeRelevanceScore,
    NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM,
    NEARBY_POI_BASE_RADIUS_KM,
    NEARBY_POI_CANDIDATE_LIMIT,
    NEARBY_POI_DEFAULT_LIMIT,
    NEARBY_POI_FEATURED_RADIUS_MULTIPLIER,
    NEARBY_POI_MAX_RADIUS_KM,
    NEARBY_POI_MIN_RADIUS_KM,
    NEARBY_POI_REFERENCE_DISPLAY_WEIGHT,
    rankNearbyPois
} from '../../../src/services/point-of-interest/point-of-interest.nearby-relevance';

/** Minimal POI shape the ranker reads. */
type TestPoi = {
    readonly slug: string;
    readonly displayWeight?: number | null;
    readonly isFeatured?: boolean | null;
    readonly distanceKm: number;
};

const poi = (overrides: Partial<TestPoi> & { readonly slug: string }): TestPoi => ({
    displayWeight: NEARBY_POI_REFERENCE_DISPLAY_WEIGHT,
    isFeatured: false,
    distanceKm: 1,
    ...overrides
});

describe('nearby-relevance constants (calibration freeze)', () => {
    it('holds the values calibrated against the 842-POI production catalogue', () => {
        // Changing any of these changes which POIs a listing shows. They are
        // frozen here so a recalibration is a deliberate, visible edit rather
        // than a silent drift.
        expect(NEARBY_POI_BASE_RADIUS_KM).toBe(5);
        expect(NEARBY_POI_REFERENCE_DISPLAY_WEIGHT).toBe(50);
        expect(NEARBY_POI_MIN_RADIUS_KM).toBe(2);
        expect(NEARBY_POI_MAX_RADIUS_KM).toBe(15);
        expect(NEARBY_POI_FEATURED_RADIUS_MULTIPLIER).toBe(1.3);
        expect(NEARBY_POI_DEFAULT_LIMIT).toBe(8);
    });

    it('derives the absolute ceiling from the clamp and the featured multiplier', () => {
        expect(NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM).toBeCloseTo(19.5, 10);
        // Must stay under the 20km bound the public query schema enforces,
        // otherwise the service could ask for a radius the HTTP layer rejects.
        expect(NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM).toBeLessThanOrEqual(20);
    });

    it('keeps the candidate guard above the entire production catalogue', () => {
        // 842 ACTIVE POIs in production — the guard must not be able to bind
        // and silently truncate the candidate set.
        expect(NEARBY_POI_CANDIDATE_LIMIT).toBeGreaterThan(842);
    });
});

describe('computeElasticRadiusKm', () => {
    it('scales linearly with displayWeight at the catalogue weights', () => {
        // 5km x weight / 50, clamped to [2, 15].
        expect(computeElasticRadiusKm({ displayWeight: 25 })).toBeCloseTo(2.5, 10);
        expect(computeElasticRadiusKm({ displayWeight: 50 })).toBeCloseTo(5, 10);
        expect(computeElasticRadiusKm({ displayWeight: 70 })).toBeCloseTo(7, 10);
        expect(computeElasticRadiusKm({ displayWeight: 85 })).toBeCloseTo(8.5, 10);
        expect(computeElasticRadiusKm({ displayWeight: 100 })).toBeCloseTo(10, 10);
    });

    it('widens a featured POI by the multiplier (weight 100 reaches 13km)', () => {
        expect(computeElasticRadiusKm({ displayWeight: 100, isFeatured: true })).toBeCloseTo(
            13,
            10
        );
        expect(computeElasticRadiusKm({ displayWeight: 25, isFeatured: true })).toBeCloseTo(
            3.25,
            10
        );
    });

    it('clamps at the lower bound for weak POIs', () => {
        // weight 20 is exactly the pivot: 5 * 20 / 50 = 2 = the minimum.
        expect(computeElasticRadiusKm({ displayWeight: 20 })).toBeCloseTo(2, 10);
        expect(computeElasticRadiusKm({ displayWeight: 10 })).toBeCloseTo(2, 10);
        expect(computeElasticRadiusKm({ displayWeight: 0 })).toBeCloseTo(2, 10);
    });

    it('clamps at the upper bound BEFORE applying the featured multiplier', () => {
        // 5 * 200 / 50 = 20 -> clamped to 15, then x1.3 = 19.5 (the ceiling).
        expect(computeElasticRadiusKm({ displayWeight: 200 })).toBeCloseTo(15, 10);
        expect(computeElasticRadiusKm({ displayWeight: 200, isFeatured: true })).toBeCloseTo(
            NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM,
            10
        );
    });

    it('treats a nullish displayWeight as the reference weight, not as zero', () => {
        // `display_weight` is NOT NULL DEFAULT 50 — the nullish branch is
        // defensive and must degrade to the pre-HOS-327 5km, not to the 2km floor.
        expect(computeElasticRadiusKm({ displayWeight: null })).toBeCloseTo(5, 10);
        expect(computeElasticRadiusKm({})).toBeCloseTo(5, 10);
    });

    it('lets radiusCapKm narrow but never widen the elastic radius', () => {
        expect(computeElasticRadiusKm({ displayWeight: 100, radiusCapKm: 3 })).toBeCloseTo(3, 10);
        // A cap wider than the POI's own radius leaves the POI's own radius intact.
        expect(computeElasticRadiusKm({ displayWeight: 25, radiusCapKm: 20 })).toBeCloseTo(2.5, 10);
    });
});

describe('computeRelevanceScore', () => {
    it('decays weight with distance as weight / (1 + km)', () => {
        expect(computeRelevanceScore({ displayWeight: 100, distanceKm: 0 })).toBeCloseTo(100, 10);
        expect(computeRelevanceScore({ displayWeight: 100, distanceKm: 1 })).toBeCloseTo(50, 10);
        expect(computeRelevanceScore({ displayWeight: 100, distanceKm: 9 })).toBeCloseTo(10, 10);
        expect(computeRelevanceScore({ displayWeight: 50, distanceKm: 1 })).toBeCloseTo(25, 10);
    });

    it('ranks a heavy far POI above a light near one when the weight gap earns it', () => {
        const landmark = computeRelevanceScore({ displayWeight: 100, distanceKm: 2 });
        const cornerShop = computeRelevanceScore({ displayWeight: 50, distanceKm: 1 });
        expect(landmark).toBeGreaterThan(cornerShop);
    });

    it('documents the exact tie the brief assumed was a strict ordering', () => {
        // The HOS-327 brief expected "weight 100 at 2km ranks before weight 50
        // at 500m". Run through the approved formula those two score
        // IDENTICALLY: 100/3 === 50/1.5. It is a tie, not an ordering, and the
        // tie-break (nearest first) therefore puts the 500m POI on top.
        const heavyFar = computeRelevanceScore({ displayWeight: 100, distanceKm: 2 });
        const lightNear = computeRelevanceScore({ displayWeight: 50, distanceKm: 0.5 });
        expect(heavyFar).toBe(lightNear);
    });
});

describe('rankNearbyPois — eligibility', () => {
    it('drops a weight-25 POI at 3km (its elastic radius is only 2.5km)', () => {
        const result = rankNearbyPois({
            pois: [poi({ slug: 'weak-far', displayWeight: 25, distanceKm: 3 })],
            limit: 8
        });

        expect(result).toHaveLength(0);
    });

    it('keeps a weight-100 POI at 9km (its elastic radius is 10km)', () => {
        const result = rankNearbyPois({
            pois: [poi({ slug: 'landmark', displayWeight: 100, distanceKm: 9 })],
            limit: 8
        });

        expect(result.map((p) => p.slug)).toEqual(['landmark']);
    });

    it('keeps a weight-25 POI at 3km once it is featured (2.5km x 1.3 = 3.25km)', () => {
        const notFeatured = rankNearbyPois({
            pois: [poi({ slug: 'weak-far', displayWeight: 25, distanceKm: 3, isFeatured: false })],
            limit: 8
        });
        const featured = rankNearbyPois({
            pois: [poi({ slug: 'weak-far', displayWeight: 25, distanceKm: 3, isFeatured: true })],
            limit: 8
        });

        expect(notFeatured).toHaveLength(0);
        expect(featured.map((p) => p.slug)).toEqual(['weak-far']);
    });

    it('keeps a weight-100 POI exactly ON its 10km boundary, drops it just past', () => {
        const onBoundary = rankNearbyPois({
            pois: [poi({ slug: 'edge', displayWeight: 100, distanceKm: 10 })],
            limit: 8
        });
        const pastBoundary = rankNearbyPois({
            pois: [poi({ slug: 'edge', displayWeight: 100, distanceKm: 10.0001 })],
            limit: 8
        });

        expect(onBoundary).toHaveLength(1);
        expect(pastBoundary).toHaveLength(0);
    });

    it('applies the lower clamp: a weight-0 POI is still eligible within 2km', () => {
        const inside = rankNearbyPois({
            pois: [poi({ slug: 'floor-in', displayWeight: 0, distanceKm: 1.9 })],
            limit: 8
        });
        const outside = rankNearbyPois({
            pois: [poi({ slug: 'floor-out', displayWeight: 0, distanceKm: 2.1 })],
            limit: 8
        });

        expect(inside).toHaveLength(1);
        expect(outside).toHaveLength(0);
    });

    it('honours radiusCapKm as a ceiling on every POI', () => {
        const pois = [
            poi({ slug: 'landmark', displayWeight: 100, distanceKm: 9 }),
            poi({ slug: 'near', displayWeight: 100, distanceKm: 1 })
        ];

        expect(rankNearbyPois({ pois, limit: 8 }).map((p) => p.slug)).toEqual(['near', 'landmark']);
        expect(rankNearbyPois({ pois, limit: 8, radiusCapKm: 5 }).map((p) => p.slug)).toEqual([
            'near'
        ]);
    });
});

describe('rankNearbyPois — ordering', () => {
    it('orders by score, so a heavier POI farther away outranks a lighter nearer one', () => {
        // 100/(1+2) = 33.33 vs 50/(1+1) = 25.
        const result = rankNearbyPois({
            pois: [
                poi({ slug: 'light-near', displayWeight: 50, distanceKm: 1 }),
                poi({ slug: 'heavy-far', displayWeight: 100, distanceKm: 2 })
            ],
            limit: 8
        });

        expect(result.map((p) => p.slug)).toEqual(['heavy-far', 'light-near']);
    });

    it('is NOT plain distance order', () => {
        const result = rankNearbyPois({
            pois: [
                poi({ slug: 'pharmacy', displayWeight: 25, distanceKm: 0.3 }),
                poi({ slug: 'palace', displayWeight: 100, distanceKm: 1 })
            ],
            limit: 8
        });

        // Distance order would be pharmacy first (0.3km < 1km).
        // Score order: 25/1.3 = 19.2 vs 100/2 = 50.
        expect(result.map((p) => p.slug)).toEqual(['palace', 'pharmacy']);
    });

    it('is NOT plain displayWeight order', () => {
        const result = rankNearbyPois({
            pois: [
                poi({ slug: 'far-landmark', displayWeight: 100, distanceKm: 9 }),
                poi({ slug: 'near-midweight', displayWeight: 70, distanceKm: 0.2 })
            ],
            limit: 8
        });

        // Weight order would be far-landmark first.
        // Score order: 100/10 = 10 vs 70/1.2 = 58.3.
        expect(result.map((p) => p.slug)).toEqual(['near-midweight', 'far-landmark']);
    });

    it('breaks an exact score tie by ascending distance', () => {
        // The brief's own example: both score 100/3 === 50/1.5.
        const result = rankNearbyPois({
            pois: [
                poi({ slug: 'heavy-at-2km', displayWeight: 100, distanceKm: 2 }),
                poi({ slug: 'light-at-500m', displayWeight: 50, distanceKm: 0.5 })
            ],
            limit: 8
        });

        expect(result.map((p) => p.slug)).toEqual(['light-at-500m', 'heavy-at-2km']);
    });

    it('breaks a full tie deterministically by slug', () => {
        const pois = [
            poi({ slug: 'zulu', displayWeight: 70, distanceKm: 1 }),
            poi({ slug: 'alpha', displayWeight: 70, distanceKm: 1 })
        ];

        expect(rankNearbyPois({ pois, limit: 8 }).map((p) => p.slug)).toEqual(['alpha', 'zulu']);
        // Same answer whichever order the database happened to hand them over in.
        expect(rankNearbyPois({ pois: [...pois].reverse(), limit: 8 }).map((p) => p.slug)).toEqual([
            'alpha',
            'zulu'
        ]);
    });
});

describe('rankNearbyPois — limit', () => {
    it('slices to `limit` AFTER ranking, keeping the most relevant', () => {
        const result = rankNearbyPois({
            pois: [
                poi({ slug: 'a', displayWeight: 100, distanceKm: 0.1 }),
                poi({ slug: 'b', displayWeight: 100, distanceKm: 0.2 }),
                poi({ slug: 'c', displayWeight: 25, distanceKm: 0.3 })
            ],
            limit: 2
        });

        expect(result.map((p) => p.slug)).toEqual(['a', 'b']);
    });

    it('returns an empty array for a non-positive limit and never mutates the input', () => {
        const pois = [poi({ slug: 'a', displayWeight: 100, distanceKm: 1 })];
        const snapshot = [...pois];

        expect(rankNearbyPois({ pois, limit: 0 })).toEqual([]);
        expect(pois).toEqual(snapshot);
    });
});
