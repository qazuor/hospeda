/**
 * @file poi-map-bounds.test.ts
 * @description Unit tests for the POI map bbox helpers (HOS-146).
 */
import { describe, expect, it } from 'vitest';
import {
    computeBounds,
    computeBoundsAround,
    computeFrameRadiusKm,
    computeSurroundingsBounds,
    haversineKm
} from '../../src/lib/poi-map-bounds';

describe('computeBounds', () => {
    it('returns null for an empty points list', () => {
        // Arrange
        const points: Array<{ lat: number; long: number }> = [];

        // Act
        const result = computeBounds({ points });

        // Assert
        expect(result).toBeNull();
    });

    it('degenerates to a zero-size box for a single point', () => {
        // Arrange
        const points = [{ lat: -32.5, long: -58.2 }];

        // Act
        const result = computeBounds({ points });

        // Assert
        expect(result).toEqual([
            [-32.5, -58.2],
            [-32.5, -58.2]
        ]);
    });

    it('computes the smallest bounding box containing every point', () => {
        // Arrange
        const points = [
            { lat: -32.4, long: -58.1 },
            { lat: -32.5, long: -58.3 },
            { lat: -32.45, long: -58.05 },
            { lat: -32.55, long: -58.2 }
        ];

        // Act
        const result = computeBounds({ points });

        // Assert — south/west take the mins, north/east take the maxes.
        expect(result).toEqual([
            [-32.55, -58.3],
            [-32.4, -58.05]
        ]);
    });

    it('handles points with positive and negative coordinates mixed', () => {
        // Arrange
        const points = [
            { lat: 10, long: 20 },
            { lat: -10, long: -20 }
        ];

        // Act
        const result = computeBounds({ points });

        // Assert
        expect(result).toEqual([
            [-10, -20],
            [10, 20]
        ]);
    });

    // ── Non-finite input (HOS-146 review) ───────────────────────────────────
    // A NaN reaching Leaflet's fitBounds throws `Invalid LatLng object` inside
    // a client:only island with no error boundary — a blank map, not an error.
    it('discards NaN points instead of poisoning the bbox', () => {
        // Arrange
        const points = [
            { lat: -32.4, long: -58.1 },
            { lat: Number.NaN, long: Number.NaN }
        ];

        // Act
        const result = computeBounds({ points });

        // Assert — the finite point still frames; no NaN in the output.
        expect(result).toEqual([
            [-32.4, -58.1],
            [-32.4, -58.1]
        ]);
    });

    it('discards Infinity points instead of stretching the bbox to infinity', () => {
        // Arrange
        const points = [
            { lat: -32.4, long: -58.1 },
            { lat: Number.POSITIVE_INFINITY, long: Number.NEGATIVE_INFINITY }
        ];

        // Act
        const result = computeBounds({ points });

        // Assert
        expect(result).toEqual([
            [-32.4, -58.1],
            [-32.4, -58.1]
        ]);
    });

    it('returns null when every point is non-finite', () => {
        // Arrange
        const points = [
            { lat: Number.NaN, long: 0 },
            { lat: 0, long: Number.NaN }
        ];

        // Act
        const result = computeBounds({ points });

        // Assert
        expect(result).toBeNull();
    });
});

describe('haversineKm', () => {
    it('returns zero for identical points', () => {
        // Arrange
        const point = { lat: -32.217, long: -58.133 };

        // Act
        const result = haversineKm({ from: point, to: point });

        // Assert
        expect(result).toBe(0);
    });

    it('measures a known real-world distance', () => {
        // Arrange — Colón's centre and a POI the HOS-141 pipeline marks as its
        // PRIMARY despite sitting ~31km away (`centro_cultural_linares_cardozo`).
        const colon = { lat: -32.217, long: -58.133 };
        const outlier = { lat: -32.4964048, long: -58.2522957 };

        // Act
        const result = haversineKm({ from: colon, to: outlier });

        // Assert
        expect(result).toBeGreaterThan(30);
        expect(result).toBeLessThan(35);
    });
});

describe('computeFrameRadiusKm', () => {
    const colon = { lat: -32.217, long: -58.133 };

    it('falls back to the minimum radius when there are no points', () => {
        // Act
        const result = computeFrameRadiusKm({ center: colon, points: [] });

        // Assert
        expect(result).toBe(1.5);
    });

    it('clamps to the minimum radius when every point is very close', () => {
        // Arrange — a handful of POIs within a few hundred metres.
        const points = [
            { lat: -32.2172, long: -58.1332 },
            { lat: -32.2175, long: -58.1335 },
            { lat: -32.2168, long: -58.1328 }
        ];

        // Act
        const result = computeFrameRadiusKm({ center: colon, points });

        // Assert
        expect(result).toBe(1.5);
    });

    it('clamps to the maximum radius when points are systematically dispersed', () => {
        // Arrange — mirrors `ceibas`, whose PRIMARY POIs are genuinely spread
        // over ~100km (not a removable outlier), so the frame must cap out.
        const points = Array.from({ length: 10 }, (_, i) => ({
            lat: colon.lat + i * 0.3,
            long: colon.long + i * 0.3
        }));

        // Act
        const result = computeFrameRadiusKm({ center: colon, points });

        // Assert
        expect(result).toBe(8);
    });

    it('ignores a single far outlier instead of stretching the frame', () => {
        // Arrange — this is the regression that broke the map on 20 of 22
        // destinations: nine POIs inside ~2km plus one 31km away. A min/max
        // bbox would frame ~31km; the p90 radius must stay near the cluster.
        const cluster = Array.from({ length: 9 }, (_, i) => ({
            lat: colon.lat + i * 0.002,
            long: colon.long + i * 0.002
        }));
        const outlier = { lat: -32.4964048, long: -58.2522957 };

        // Act
        const result = computeFrameRadiusKm({ center: colon, points: [...cluster, outlier] });

        // Assert
        expect(result).toBeLessThan(8);
        expect(result).toBeLessThan(haversineKm({ from: colon, to: outlier }));
    });

    it('degenerates to the farthest point (not a percentile) for small samples — documented limit', () => {
        // Arrange — with n <= 6, Math.round((n - 1) * 0.9) === n - 1, so the
        // "p90" index IS the maximum. This test pins that documented behavior
        // so a future reader does not trust the outlier resistance at any n.
        const cluster = Array.from({ length: 5 }, (_, i) => ({
            lat: colon.lat + i * 0.002,
            long: colon.long + i * 0.002
        }));
        const outlier = { lat: colon.lat + 0.03, long: colon.long };

        // Act
        const result = computeFrameRadiusKm({ center: colon, points: [...cluster, outlier] });

        // Assert — the frame is the outlier's distance, clamped into range.
        const outlierKm = haversineKm({ from: colon, to: outlier });
        expect(result).toBeCloseTo(Math.min(8, Math.max(1.5, outlierKm)), 6);
    });

    // ── Non-finite input (HOS-146 review) ───────────────────────────────────
    it('ignores non-finite points rather than returning NaN (clamp does not sanitize)', () => {
        // Arrange — Math.min(8, Math.max(1.5, NaN)) === NaN, so the clamp alone
        // would have propagated it straight into computeBoundsAround.
        const points = [
            { lat: -32.2172, long: -58.1332 },
            { lat: Number.NaN, long: Number.NaN }
        ];

        // Act
        const result = computeFrameRadiusKm({ center: colon, points });

        // Assert
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBe(1.5);
    });

    it('falls back to the minimum radius when every point is non-finite', () => {
        // Act
        const result = computeFrameRadiusKm({
            center: colon,
            points: [{ lat: Number.NaN, long: Number.NaN }]
        });

        // Assert
        expect(result).toBe(1.5);
    });

    it('falls back to the minimum radius when the centre itself is non-finite', () => {
        // Act
        const result = computeFrameRadiusKm({
            center: { lat: Number.NaN, long: Number.NaN },
            points: [{ lat: -32.2172, long: -58.1332 }]
        });

        // Assert
        expect(result).toBe(1.5);
    });
});

describe('computeBoundsAround', () => {
    /** Unwraps the nullable result for the happy-path cases below. */
    function boundsAround(center: { lat: number; long: number }, radiusKm: number) {
        const bounds = computeBoundsAround({ center, radiusKm });
        if (!bounds) throw new Error('Expected finite bounds for a finite centre/radius');
        return bounds;
    }

    it('builds a box centred on the given point', () => {
        // Arrange
        const center = { lat: -32.217, long: -58.133 };

        // Act
        const [[south, west], [north, east]] = boundsAround(center, 3);

        // Assert — the centre sits exactly in the middle of the box.
        expect((south + north) / 2).toBeCloseTo(center.lat, 6);
        expect((west + east) / 2).toBeCloseTo(center.long, 6);
        expect(north).toBeGreaterThan(south);
        expect(east).toBeGreaterThan(west);
    });

    it('widens longitude relative to latitude away from the equator', () => {
        // Arrange — at ~32° south, a degree of longitude covers ~85% of the
        // ground a degree of latitude does, so the box must be wider in degrees
        // to stay square on the ground.
        const center = { lat: -32.217, long: -58.133 };

        // Act
        const [[south, west], [north, east]] = boundsAround(center, 5);

        // Assert
        expect(east - west).toBeGreaterThan(north - south);
    });

    it('scales the box with the radius', () => {
        // Arrange
        const center = { lat: -32.217, long: -58.133 };

        // Act
        const small = boundsAround(center, 2);
        const large = boundsAround(center, 8);

        // Assert
        const smallHeight = small[1][0] - small[0][0];
        const largeHeight = large[1][0] - large[0][0];
        expect(largeHeight / smallHeight).toBeCloseTo(4, 5);
    });

    // ── Non-finite input (HOS-146 review) ───────────────────────────────────
    it('returns null for a NaN radius instead of emitting NaN bounds', () => {
        // Act
        const result = computeBoundsAround({
            center: { lat: -32.217, long: -58.133 },
            radiusKm: Number.NaN
        });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null for a NaN centre instead of emitting NaN bounds', () => {
        // Act
        const result = computeBoundsAround({
            center: { lat: Number.NaN, long: -58.133 },
            radiusKm: 3
        });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null for an Infinite radius', () => {
        // Act
        const result = computeBoundsAround({
            center: { lat: -32.217, long: -58.133 },
            radiusKm: Number.POSITIVE_INFINITY
        });

        // Assert
        expect(result).toBeNull();
    });
});

describe('computeSurroundingsBounds', () => {
    const colon = { lat: -32.217, long: -58.133 };

    /** Half the frame's height, in km — i.e. its radius on the ground. */
    const radiusKmOf = (bounds: readonly [readonly [number, number], readonly [number, number]]) =>
        ((bounds[1][0] - bounds[0][0]) / 2) * 111;

    it('returns null when there are no points', () => {
        // Act
        const result = computeSurroundingsBounds({ center: colon, points: [] });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null for a non-finite centre', () => {
        // Act
        const result = computeSurroundingsBounds({
            center: { lat: Number.NaN, long: -58.133 },
            points: [{ lat: -32.3, long: -58.2 }]
        });

        // Assert
        expect(result).toBeNull();
    });

    it('hugs the markers when they are close, rather than always opening to the cap', () => {
        // Arrange — NEARBY POIs about 10km out.
        const points = [
            { lat: colon.lat + 0.09, long: colon.long },
            { lat: colon.lat - 0.05, long: colon.long }
        ];

        // Act
        const result = computeSurroundingsBounds({ center: colon, points });

        // Assert — ~10km, nowhere near the 50km cap.
        expect(result).not.toBeNull();
        if (!result) return;
        expect(radiusKmOf(result)).toBeGreaterThan(8);
        expect(radiusKmOf(result)).toBeLessThan(13);
    });

    it('caps at 50km instead of fitting a far-flung marker', () => {
        // Arrange — mirrors ceibas/san-justo, whose NEARBY POIs reach 134km. An
        // uncapped bbox opened a 256km viewport where the destination is a dot
        // and the pins are indistinguishable (HOS-146 review).
        const points = [
            { lat: colon.lat + 0.02, long: colon.long },
            { lat: colon.lat + 1.2, long: colon.long } // ~133km away
        ];

        // Act
        const result = computeSurroundingsBounds({ center: colon, points });

        // Assert
        expect(result).not.toBeNull();
        if (!result) return;
        expect(radiusKmOf(result)).toBeCloseTo(50, 0);
    });

    it('stays centred on the destination', () => {
        // Arrange — every marker sits north-east of the destination.
        const points = [
            { lat: colon.lat + 0.2, long: colon.long + 0.2 },
            { lat: colon.lat + 0.4, long: colon.long + 0.1 }
        ];

        // Act
        const result = computeSurroundingsBounds({ center: colon, points });

        // Assert — the destination stays in the middle, never pushed to an edge.
        expect(result).not.toBeNull();
        if (!result) return;
        const [[south, west], [north, east]] = result;
        expect((south + north) / 2).toBeCloseTo(colon.lat, 6);
        expect((west + east) / 2).toBeCloseTo(colon.long, 6);
    });

    it('never collapses below the city frame, which would zoom IN instead of out', () => {
        // Arrange — a single marker practically on top of the destination.
        const points = [{ lat: colon.lat + 0.0001, long: colon.long }];

        // Act
        const result = computeSurroundingsBounds({ center: colon, points });

        // Assert
        expect(result).not.toBeNull();
        if (!result) return;
        expect(radiusKmOf(result)).toBeCloseTo(1.5, 1);
    });

    it('ignores non-finite points when sizing the frame', () => {
        // Arrange
        const points = [
            { lat: colon.lat + 0.09, long: colon.long },
            { lat: Number.NaN, long: Number.NaN }
        ];

        // Act
        const result = computeSurroundingsBounds({ center: colon, points });

        // Assert — a NaN must not poison Math.max into a NaN radius.
        expect(result).not.toBeNull();
        if (!result) return;
        expect(Number.isFinite(radiusKmOf(result))).toBe(true);
        expect(radiusKmOf(result)).toBeLessThan(13);
    });
});
