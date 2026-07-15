/**
 * @file DestinationPOIMap.test.tsx
 * @description Unit tests for `DestinationPOIMap` (HOS-146). Mocks
 * `LocationMap` (already covered end-to-end by `LocationMap.test.tsx`) so
 * this suite can focus on: filtering POIs without coordinates, merging the
 * fetched NEARBY set with the PRIMARY set from props, splitting them for the
 * initial vs. surroundings bbox, and the render-nothing guard when no POI has
 * coordinates.
 *
 * The NEARBY fetch is mocked at the `endpoints` boundary — the component must
 * never call `fetch()` itself (apps/web/CLAUDE.md).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationPOIMap } from '../../../src/components/destination/DestinationPOIMap.client';
import type { LocationMapProps } from '../../../src/components/maps/LocationMap.client';
import type { DestinationPointOfInterestItem } from '../../../src/lib/api/transforms';

const receivedProps: LocationMapProps[] = [];
const mockGetPointsOfInterest = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    destinationsApi: {
        getPointsOfInterest: (...args: unknown[]) => mockGetPointsOfInterest(...args)
    }
}));

vi.mock('../../../src/components/maps/LocationMap.client', () => ({
    LocationMap: (props: LocationMapProps) => {
        receivedProps.push(props);
        return <div data-testid="location-map" />;
    }
}));

const DEST_ID = '550e8400-e29b-41d4-a716-446655440000';

function poi(overrides: Partial<DestinationPointOfInterestItem>): DestinationPointOfInterestItem {
    return {
        id: 'poi-1',
        slug: 'poi-1',
        type: 'BEACH',
        lat: -32.48,
        long: -58.24,
        relation: 'PRIMARY',
        description: null,
        descriptionI18n: null,
        nameI18n: { es: 'Playa', en: null, pt: null },
        isFeatured: false,
        displayWeight: 0,
        ...overrides
    };
}

describe('DestinationPOIMap', () => {
    beforeEach(() => {
        receivedProps.length = 0;
        mockGetPointsOfInterest.mockReset();
        // Default: the destination has no NEARBY POIs.
        mockGetPointsOfInterest.mockResolvedValue({ ok: true, data: [] });
    });

    it('renders nothing when no POI has coordinates', async () => {
        // Arrange
        const pointsOfInterest = [poi({ id: 'a', lat: null, long: null })];

        // Act
        const { container } = render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByTestId('location-map')).not.toBeInTheDocument();
    });

    it('renders nothing when pointsOfInterest is empty', () => {
        // Act
        const { container } = render(
            <DestinationPOIMap
                pointsOfInterest={[]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        expect(container).toBeEmptyDOMElement();
    });

    it('filters out POIs with null lat/long before building markers', () => {
        // Arrange
        const pointsOfInterest = [
            poi({ id: 'has-coords', lat: -32.48, long: -58.24 }),
            poi({ id: 'no-coords', lat: null, long: null })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        const props = lastMultiProps();
        expect(props.markers).toHaveLength(1);
        expect(props.markers[0]?.id).toBe('has-coords');
    });

    // ── NEARBY enrichment fetch (HOS-146 review) ────────────────────────────
    // The destination detail payload is PRIMARY-only; NEARBY POIs are pulled
    // from the public endpoint on mount so they never inflate that payload.

    it('requests only the NEARBY relation for this destination, once', async () => {
        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalledTimes(1));
        expect(mockGetPointsOfInterest).toHaveBeenCalledWith({
            id: DEST_ID,
            relation: 'NEARBY'
        });
    });

    it('merges the fetched NEARBY POIs into the marker set', async () => {
        // Arrange — raw API rows, as the endpoint returns them.
        mockGetPointsOfInterest.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 'n1',
                    slug: 'reserva-lejana',
                    type: 'NATURAL',
                    lat: -32.9,
                    long: -58.6,
                    relation: 'NEARBY',
                    nameI18n: { es: 'Reserva lejana', en: null, pt: null }
                }
            ]
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));
        const props = lastMultiProps();
        expect(props.markers.find((m) => m.id === 'p1')?.relation).toBe('PRIMARY');
        expect(props.markers.find((m) => m.id === 'n1')?.relation).toBe('NEARBY');
    });

    it('labels fetched rows NEARBY even if the payload omits `relation` (the request already filtered on it)', async () => {
        // Arrange — `relation` is `.optional()` in the schema, and the shared
        // transform defaults anything that is not 'NEARBY' (including absent) to
        // 'PRIMARY'. Trusting the payload here would silently relabel all 57 of
        // Colón's NEARBY POIs as PRIMARY the day the API stops emitting the
        // field: hasSurroundings goes false, the "ver alrededores" toggle
        // disappears, and nothing throws. The component re-asserts it instead.
        mockGetPointsOfInterest.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 'n1',
                    slug: 'reserva-lejana',
                    type: 'NATURAL',
                    lat: -32.9,
                    long: -58.6,
                    // relation deliberately absent
                    nameI18n: { es: 'Reserva lejana', en: null, pt: null }
                }
            ]
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));
        const props = lastMultiProps();
        expect(props.markers.find((m) => m.id === 'n1')?.relation).toBe('NEARBY');
        // ...and the toggle it feeds still shows up.
        expect(props.surroundingsBounds).toBeDefined();
    });

    it('still renders the PRIMARY pins when the NEARBY fetch fails (graceful degradation)', async () => {
        // Arrange — an enrichment failure must never break the map.
        mockGetPointsOfInterest.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalled());
        expect(screen.getByTestId('location-map')).toBeInTheDocument();
        const props = lastMultiProps();
        expect(props.markers.map((m) => m.id)).toEqual(['p1']);
        // Nothing extra to reveal → no toggle.
        expect(props.surroundingsBounds).toBeUndefined();
    });

    it('renders the PRIMARY pins immediately, before the NEARBY fetch resolves', () => {
        // Arrange — a fetch that never settles.
        mockGetPointsOfInterest.mockReturnValue(new Promise(() => {}));

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert — the map does not wait on enrichment to paint.
        expect(screen.getByTestId('location-map')).toBeInTheDocument();
        expect(lastMultiProps().markers.map((m) => m.id)).toEqual(['p1']);
    });

    it('passes mode "multi" with the full marker list to LocationMap', async () => {
        // Arrange
        mockGetPointsOfInterest.mockResolvedValue({
            ok: true,
            data: [
                { id: 'p2', slug: 'p2', type: 'BEACH', lat: -32.9, long: -58.6, relation: 'NEARBY' }
            ]
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));
        const props = lastMultiProps();
        expect(props.mode).toBe('multi');
        expect(props.markers.map((m) => m.id).sort()).toEqual(['p1', 'p2']);
    });

    it('frames initialBounds to the PRIMARY set only, excluding the NEARBY markers', async () => {
        // Arrange
        mockGetPointsOfInterest.mockResolvedValue({
            ok: true,
            data: [
                { id: 'p2', slug: 'p2', type: 'BEACH', lat: -32.9, long: -58.6, relation: 'NEARBY' }
            ]
        });

        // Act — no `center`, so the map falls back to a plain POI bbox fit.
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert — the far-out NEARBY point must NOT be inside initialBounds.
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));
        expect(lastMultiProps().initialBounds).toEqual([
            [-32.4, -58.1],
            [-32.4, -58.1]
        ]);
    });

    it('frames initialBounds around the destination centre when one is given', () => {
        // Arrange — Colón's real coordinates plus two of its PRIMARY POIs.
        const center = { lat: -32.217, long: -58.133 };
        const pointsOfInterest = [
            poi({ id: 'p1', relation: 'PRIMARY', lat: -32.2172, long: -58.1332 }),
            poi({ id: 'p2', relation: 'PRIMARY', lat: -32.2185, long: -58.1345 })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                center={center}
                locale="es"
            />
        );

        // Assert — the destination sits at the centre of the frame, not the POIs.
        const bounds = lastMultiProps().initialBounds;
        const [[south, west], [north, east]] = bounds;
        expect((south + north) / 2).toBeCloseTo(center.lat, 6);
        expect((west + east) / 2).toBeCloseTo(center.long, 6);
    });

    it('does not let a mis-geocoded PRIMARY outlier stretch the initial frame', () => {
        // Arrange — the real HOS-146 regression, at Colón's real scale: ~40
        // PRIMARY POIs inside the city core plus `centro_cultural_linares_cardozo`,
        // which the HOS-141 pipeline placed ~31km away in Villa Elisa. A min/max
        // bbox fit framed ~33km of map and pushed the destination off-centre.
        // The p90 radius only tolerates outliers when the sample is big enough
        // to have a 90th percentile below the top — which every real
        // destination is (24-71 PRIMARY), so the test mirrors that.
        const center = { lat: -32.217, long: -58.133 };
        const core = Array.from({ length: 40 }, (_, i) =>
            poi({
                id: `core-${i}`,
                relation: 'PRIMARY',
                lat: -32.217 + (i % 8) * 0.004,
                long: -58.133 + Math.floor(i / 8) * 0.004
            })
        );
        const outlier = poi({
            id: 'centro_cultural_linares_cardozo',
            relation: 'PRIMARY',
            lat: -32.4964,
            long: -58.2523
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[...core, outlier]}
                destinationId={DEST_ID}
                center={center}
                locale="es"
            />
        );

        // Assert — the frame stays a city view (~3km radius), nowhere near the
        // ~0.28° of latitude the outlier alone would have forced.
        const [[south, west], [north, east]] = lastMultiProps().initialBounds;
        expect(north - south).toBeLessThan(0.06);
        expect(east - west).toBeLessThan(0.07);
        // And the outlier is outside it — revealed by "ver alrededores" instead.
        expect(south).toBeGreaterThan(-32.4964);
    });

    it('provides surroundingsBounds covering PRIMARY + NEARBY once the fetch lands', async () => {
        // Arrange
        mockGetPointsOfInterest.mockResolvedValue({
            ok: true,
            data: [
                { id: 'p2', slug: 'p2', type: 'BEACH', lat: -32.9, long: -58.6, relation: 'NEARBY' }
            ]
        });

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() =>
            expect(lastMultiProps().surroundingsBounds).toEqual([
                [-32.9, -58.6],
                [-32.4, -58.1]
            ])
        );
    });

    it('omits surroundingsBounds when the destination has no NEARBY POIs (nothing extra to reveal)', async () => {
        // Arrange — default mock: the fetch succeeds with an empty list.
        const pointsOfInterest = [
            poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 }),
            poi({ id: 'p2', relation: 'PRIMARY', lat: -32.41, long: -58.11 })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalled());
        expect(lastMultiProps().surroundingsBounds).toBeUndefined();
    });

    it('resolves marker label/typeLabel via the shared poi-labels helpers', () => {
        // Arrange
        const pointsOfInterest = [
            poi({
                id: 'p1',
                type: 'BEACH',
                nameI18n: { es: 'Playa Ita Pirú', en: null, pt: null }
            })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        const props = lastMultiProps();
        expect(props.markers[0]?.label).toBe('Playa Ita Pirú');
        expect(props.markers[0]?.typeLabel).toBeTruthy();
    });
});

function lastMultiProps() {
    const last = receivedProps.at(-1);
    if (last?.mode !== 'multi') {
        throw new Error('Expected the last LocationMap render to be mode "multi"');
    }
    return last;
}
