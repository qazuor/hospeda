/**
 * @file DestinationPOIMap.test.tsx
 * @description Unit tests for `DestinationPOIMap` (HOS-146, HOS-147, HOS-181).
 * Mocks `LocationMap` (covered end-to-end by `LocationMap.test.tsx`) so this
 * suite can focus on: filtering POIs without coordinates, the LAZY NEARBY fetch
 * (HOS-181 — only on "ver alrededores", never on mount), merging the fetched
 * NEARBY set with the PRIMARY set, the initial vs. surroundings bbox, the
 * thematic category filter (HOS-147), and the render-nothing guard.
 *
 * The NEARBY fetch is mocked at the `endpoints` boundary — the component must
 * never call `fetch()` itself (apps/web/CLAUDE.md).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationPOIMap } from '../../../src/components/destination/DestinationPOIMap.client';
import type { LocationMapProps } from '../../../src/components/maps/LocationMap.client';
import type { DestinationPointOfInterestItem } from '../../../src/lib/api/transforms';
import { POI_CATEGORY_FILTER_EVENT } from '../../../src/lib/filters/poi-category-filter-event';

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
        categories: [],
        ...overrides
    };
}

function lastMultiProps() {
    const last = receivedProps.at(-1);
    if (last?.mode !== 'multi') {
        throw new Error('Expected the last LocationMap render to be mode "multi"');
    }
    return last;
}

/**
 * Simulate the visitor activating the "ver alrededores" toggle — the real
 * trigger lives inside MultiMarkerMapInner and calls `onShowSurroundings`; here
 * we invoke the prop the map handed to LocationMap. This is what arms the lazy
 * NEARBY fetch (HOS-181).
 */
function activateSurroundings() {
    const cb = lastMultiProps().onShowSurroundings;
    act(() => cb?.());
}

describe('DestinationPOIMap', () => {
    beforeEach(() => {
        receivedProps.length = 0;
        mockGetPointsOfInterest.mockReset();
        // Default: the destination has no NEARBY POIs.
        mockGetPointsOfInterest.mockResolvedValue({ ok: true, data: [] });
    });

    it('renders nothing when no POI has coordinates', () => {
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

        // Assert — no markers, no map, and (lazy) no enrichment request either.
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByTestId('location-map')).not.toBeInTheDocument();
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();
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

    // ── Lazy NEARBY enrichment (HOS-181, AC-5 / AC-6) ───────────────────────────
    // The default destination-page view must ship ZERO NEARBY request; the fetch
    // fires only when the visitor activates "ver alrededores".

    it('does NOT fetch NEARBY on mount — the default view ships no enrichment request (AC-5)', async () => {
        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );
        // Flush mount effects so a would-be eager fetch would have fired by now.
        await act(async () => {});

        // Assert — the map painted its PRIMARY pins, but nothing was fetched.
        expect(screen.getByTestId('location-map')).toBeInTheDocument();
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();
    });

    it('fetches NEARBY once, only after the surroundings toggle is activated (AC-6)', async () => {
        // Arrange
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();

        // Act — the visitor steps out to the surroundings.
        activateSurroundings();

        // Assert — exactly one request, for the NEARBY relation of this destination.
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalledTimes(1));
        expect(mockGetPointsOfInterest).toHaveBeenCalledWith({
            id: DEST_ID,
            relation: 'NEARBY'
        });
    });

    it('merges the fetched NEARBY POIs into the marker set after activation (AC-6)', async () => {
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
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Act
        activateSurroundings();

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
        // Colón's NEARBY POIs as PRIMARY the day the API stops emitting the field.
        // The component re-asserts it instead.
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
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Act
        activateSurroundings();

        // Assert
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));
        expect(lastMultiProps().markers.find((m) => m.id === 'n1')?.relation).toBe('NEARBY');
    });

    it('still renders the PRIMARY pins when the NEARBY fetch fails (graceful degradation)', async () => {
        // Arrange — an enrichment failure must never break the map.
        mockGetPointsOfInterest.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Act
        activateSurroundings();

        // Assert — the map keeps its PRIMARY pin; the failed fetch adds nothing.
        await waitFor(() => expect(mockGetPointsOfInterest).toHaveBeenCalled());
        expect(screen.getByTestId('location-map')).toBeInTheDocument();
        expect(lastMultiProps().markers.map((m) => m.id)).toEqual(['p1']);
    });

    it('renders the PRIMARY pins immediately, without any enrichment fetch', () => {
        // Arrange — a fetch that never settles would hang the map IF it fired.
        mockGetPointsOfInterest.mockReturnValue(new Promise(() => {}));

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1' })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert — the map paints from props alone; nothing was fetched.
        expect(screen.getByTestId('location-map')).toBeInTheDocument();
        expect(lastMultiProps().markers.map((m) => m.id)).toEqual(['p1']);
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();
    });

    it('passes mode "multi" with the PRIMARY marker list to LocationMap', () => {
        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert
        const props = lastMultiProps();
        expect(props.mode).toBe('multi');
        expect(props.markers.map((m) => m.id)).toEqual(['p1']);
    });

    it('offers the surroundings toggle for the lazy load even before NEARBY is fetched (HOS-181)', () => {
        // With the lazy fetch we can't know pre-fetch whether the destination has
        // NEARBY, so the toggle is offered whenever there's a frame to widen to —
        // activating it is what triggers the fetch. So `surroundingsBounds` is
        // present and `onShowSurroundings` is wired from the first render.
        render(
            <DestinationPOIMap
                pointsOfInterest={[poi({ id: 'p1', relation: 'PRIMARY', lat: -32.4, long: -58.1 })]}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        const props = lastMultiProps();
        expect(props.surroundingsBounds).toBeDefined();
        expect(props.onShowSurroundings).toBeTypeOf('function');
        // ...and it has not fetched yet.
        expect(mockGetPointsOfInterest).not.toHaveBeenCalled();
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
        activateSurroundings();

        // Assert — even once NEARBY loads, the far-out point must NOT be inside
        // initialBounds (it frames the PRIMARY set).
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
        // which the HOS-141 pipeline placed ~31km away in Villa Elisa.
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

        // Assert — the frame stays a city view (~3km radius).
        const [[south, west], [north, east]] = lastMultiProps().initialBounds;
        expect(north - south).toBeLessThan(0.06);
        expect(east - west).toBeLessThan(0.07);
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
        activateSurroundings();

        // Assert — after NEARBY loads, the surroundings frame grows to include it.
        await waitFor(() =>
            expect(lastMultiProps().surroundingsBounds).toEqual([
                [-32.9, -58.6],
                [-32.4, -58.1]
            ])
        );
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

    // ── HOS-147: thematic category filter (client-side, in sync with the grid) ──

    it('filters the displayed markers when a category filter event fires', async () => {
        // Arrange — two PRIMARY POIs in different categories.
        const pointsOfInterest = [
            poi({ id: 'p-termas', lat: -32.4, long: -58.1, categories: [{ slug: 'termas' }] }),
            poi({ id: 'p-museos', lat: -32.41, long: -58.11, categories: [{ slug: 'museos' }] })
        ];
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );
        await waitFor(() => expect(lastMultiProps().markers).toHaveLength(2));

        // Act — the filter island broadcasts "termas".
        act(() => {
            window.dispatchEvent(
                new CustomEvent(POI_CATEGORY_FILTER_EVENT, { detail: { categories: ['termas'] } })
            );
        });

        // Assert — only the termas marker is displayed; the museos one is dropped.
        expect(lastMultiProps().markers.map((m) => m.id)).toEqual(['p-termas']);
    });

    it('honors a deep-link category filter from the URL on mount', () => {
        // Arrange
        window.history.pushState({}, '', '/es/destinos/colon/?categories=museos');
        const pointsOfInterest = [
            poi({ id: 'p-termas', lat: -32.4, long: -58.1, categories: [{ slug: 'termas' }] }),
            poi({ id: 'p-museos', lat: -32.41, long: -58.11, categories: [{ slug: 'museos' }] })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
            />
        );

        // Assert — only the deep-linked category's marker shows.
        expect(lastMultiProps().markers.map((m) => m.id)).toEqual(['p-museos']);

        // Cleanup URL for the rest of the suite.
        window.history.pushState({}, '', '/');
    });

    it('ignores the URL filter when filterEnabled is false (no chip UI → no desync)', () => {
        // Arrange — a stale deep link, but the page did NOT mount the filter
        // island (fewer than 2 present categories), so filterEnabled=false.
        window.history.pushState({}, '', '/es/destinos/colon/?categories=museos');
        const pointsOfInterest = [
            poi({ id: 'p-termas', lat: -32.4, long: -58.1, categories: [{ slug: 'termas' }] }),
            poi({ id: 'p-museos', lat: -32.41, long: -58.11, categories: [{ slug: 'museos' }] })
        ];

        // Act
        render(
            <DestinationPOIMap
                pointsOfInterest={pointsOfInterest}
                destinationId={DEST_ID}
                locale="es"
                filterEnabled={false}
            />
        );

        // Assert — the map shows ALL markers (the grid has no filter UI, so the
        // map must not filter either).
        expect(
            lastMultiProps()
                .markers.map((m) => m.id)
                .sort()
        ).toEqual(['p-museos', 'p-termas']);

        window.history.pushState({}, '', '/');
    });
});
