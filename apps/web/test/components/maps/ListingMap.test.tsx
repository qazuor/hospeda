import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const { useMap } = vi.hoisted(() => ({ useMap: vi.fn() }));

vi.mock('react-leaflet', () => ({
    useMap,
    MapContainer: ({ children, ...rest }: { children: React.ReactNode }) => (
        <div
            data-testid="map-container"
            {...rest}
        >
            {children}
        </div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({
        children,
        position,
        eventHandlers
    }: {
        children: React.ReactNode;
        position: number[];
        eventHandlers?: { click?: (event: { target: { getElement: () => HTMLElement } }) => void };
    }) => (
        <button
            type="button"
            onClick={({ currentTarget }) => {
                eventHandlers?.click?.({ target: { getElement: () => currentTarget } });
            }}
            data-testid="marker"
            data-pos={position.join(',')}
        >
            {children}
        </button>
    ),
    Popup: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="popup">{children}</div>
    ),
    Circle: ({ center, radius }: { center: number[]; radius: number }) => (
        <div
            data-testid="circle"
            data-center={center.join(',')}
            data-radius={radius}
        />
    ),
    useMapEvents: () => ({
        getBounds: () => ({
            getNorth: () => 0,
            getSouth: () => 0,
            getEast: () => 0,
            getWest: () => 0
        })
    })
}));

vi.mock('react-leaflet-cluster', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="cluster-group">{children}</div>
    )
}));

vi.mock('leaflet', () => ({
    default: {
        // `Icon.Default.prototype._getIconUrl` must exist because ListingMapInner
        // does `delete L.Icon.Default.prototype._getIconUrl` at module load (HOS-95
        // marker-icon-path fix); without a prototype object the delete throws.
        Icon: { Default: { mergeOptions: vi.fn(), prototype: { _getIconUrl: vi.fn() } } },
        // divIcon was added in commit 9690b6a25 ("show Airbnb-style pill on each
        // map accommodation") — the mock must include it so the component can
        // call L.divIcon() without throwing.
        divIcon: vi.fn().mockReturnValue({})
    }
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon-retina.png' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

// Short-circuit the FavoriteButton dependency chain (Auth, endpoints-protected,
// billing-limit-error, toast-store) so the lazy pre-warm in beforeAll resolves
// quickly on cold CI runners instead of timing out in 10 s.
vi.mock('@/components/shared/favorite/FavoriteButton.client', () => ({
    FavoriteButton: () => null
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ListingMap } from '../../../src/components/maps/ListingMap.client';
import { FitListingBounds } from '../../../src/components/maps/map-controls.client';

// Pre-warm the lazy inner chunk (React.lazy, SPEC-269) so it resolves within the
// default findBy timeout even on a cold module graph when this file runs alone.
// The explicit 30s hookTimeout (default is 10s) prevents this beforeAll from
// timing out on saturated CI runners where the dynamic import alone can take
// >10s (observed collect/environment times of 140s+).
beforeAll(async () => {
    await import('../../../src/components/maps/ListingMapInner.client');
}, 30_000);

const i18n = {
    attribution: '© OSM',
    approximateDisclaimer: 'Ubicación aproximada.',
    viewDetails: 'Ver más',
    priceConsult: 'Precio a consultar',
    consultAvailability: 'Consultar disponibilidad'
};

describe('ListingMap', () => {
    it('reserves clearance for isolated stacked accommodation pills on a 360px canvas', async () => {
        const canvas = document.createElement('div');
        Object.defineProperties(canvas, {
            clientWidth: { value: 360 },
            clientHeight: { value: 480 }
        });
        const fitBounds = vi.fn();
        useMap.mockReturnValue({ getContainer: () => canvas, fitBounds, invalidateSize: vi.fn() });
        let measure: (() => void) | undefined;
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    measure = callback;
                }
                observe() {}
                disconnect() {}
            }
        );
        const bounds: [[number, number], [number, number]] = [
            [-34, -59],
            [-30, -57]
        ];

        try {
            render(
                <ListingMap
                    mode="accommodation-list"
                    initialCenter={[-32, -58]}
                    initialBounds={bounds}
                    items={[
                        {
                            id: 'north-east',
                            slug: 'north-east',
                            name: 'Long accommodation label at the northern and eastern edge',
                            priceLabel: '$50,000',
                            approximateLocation: { lat: -30, lng: -57, radiusMeters: 150 }
                        },
                        {
                            id: 'south-west',
                            slug: 'south-west',
                            name: 'Long accommodation label at the western edge',
                            priceLabel: '$40,000',
                            approximateLocation: { lat: -34, lng: -59, radiusMeters: 150 }
                        }
                    ]}
                    ariaLabel="map"
                    i18nStrings={i18n}
                />
            );
            await screen.findAllByTestId('marker');
            measure?.();

            expect(fitBounds).toHaveBeenCalledExactlyOnceWith(bounds, {
                padding: [120, 56], // Leaflet Point: horizontal, then vertical.
                maxZoom: expect.any(Number),
                animate: false
            });
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('fits measured bounds and stops refitting after map interaction', () => {
        const canvas = document.createElement('div');
        Object.defineProperties(canvas, {
            clientWidth: { value: 360 },
            clientHeight: { value: 480 }
        });
        const fitBounds = vi.fn();
        const invalidateSize = vi.fn();
        const disconnect = vi.fn();
        let measure: (() => void) | undefined;
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    measure = callback;
                }
                observe = vi.fn();
                disconnect = disconnect;
            }
        );
        useMap.mockReturnValue({ getContainer: () => canvas, fitBounds, invalidateSize });
        const bounds: [[number, number], [number, number]] = [
            [-34, -59],
            [-30, -57]
        ];

        try {
            const { unmount } = render(
                <FitListingBounds
                    bounds={bounds}
                    maxZoom={8}
                />
            );
            measure?.();
            expect(fitBounds).toHaveBeenCalledWith(bounds, {
                padding: [40, 52],
                maxZoom: 8,
                animate: false
            });
            fireEvent.pointerDown(canvas);
            measure?.();

            expect(invalidateSize).toHaveBeenCalledTimes(2);
            expect(fitBounds).toHaveBeenCalledTimes(1);
            unmount();
            expect(disconnect).toHaveBeenCalledOnce();
        } finally {
            vi.unstubAllGlobals();
        }
    });
    it('renders a Circle per accommodation in accommodation-list mode', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[-30, -58]}
                items={[
                    {
                        id: '1',
                        slug: 'a',
                        name: 'A',
                        approximateLocation: { lat: -30, lng: -58, radiusMeters: 150 }
                    },
                    {
                        id: '2',
                        slug: 'b',
                        name: 'B',
                        approximateLocation: { lat: -31, lng: -59, radiusMeters: 150 }
                    }
                ]}
                ariaLabel="map"
                i18nStrings={i18n}
            />
        );

        // Since commit 9690b6a25 ("show Airbnb-style pill on each map accommodation")
        // each accommodation renders BOTH a Circle (approximate location blurred area)
        // AND a Marker carrying a divIcon pill. Both are expected in accommodation mode.
        // The inner map is lazy-loaded (React.lazy + Suspense, SPEC-269), so the
        // first query must await the chunk resolving before the rest run sync.
        expect(await screen.findAllByTestId('circle')).toHaveLength(2);
        expect(screen.getAllByTestId('marker')).toHaveLength(2);
        expect(screen.getByText('Ubicación aproximada.')).toBeInTheDocument();
    });

    it('focuses the named destination card and restores focus to its invoking marker on dismissal', async () => {
        render(
            <ListingMap
                mode="destination-list"
                initialCenter={[-30, -58]}
                items={[
                    {
                        id: '1',
                        slug: 'chajari',
                        name: 'Chajarí',
                        coordinates: { lat: -30.75, lng: -57.98 },
                        detailHref: '/es/destinos/chajari/'
                    },
                    {
                        id: '2',
                        slug: 'federacion',
                        name: 'Federación',
                        coordinates: { lat: -30.98, lng: -57.92 },
                        detailHref: '/es/destinos/federacion/'
                    }
                ]}
                ariaLabel="map"
                i18nStrings={i18n}
            />
        );

        const [, marker] = await screen.findAllByTestId('marker');
        marker.focus();
        fireEvent.click(marker);

        const card = screen.getByRole('region', { name: 'Federación' });
        expect(card).toHaveAttribute('tabindex', '-1');
        expect(card).toHaveFocus();
        expect(screen.getByTestId('map-container')).not.toContainElement(card);
        const detailsLink = within(card).getByRole('link', { name: 'Ver más' });
        expect(detailsLink).toHaveAttribute('href', '/es/destinos/federacion/');
        expect(detailsLink).toHaveClass('detailsLink');
        expect(screen.queryByTestId('circle')).not.toBeInTheDocument();
        expect(screen.queryByText('Ubicación aproximada.')).not.toBeInTheDocument();
        const close = screen.getByRole('button', { name: 'Cerrar' });
        expect(close).toHaveClass('close');
        close.focus();
        fireEvent.click(close);
        expect(card).not.toBeInTheDocument();
        expect(marker).toHaveFocus();
    });

    it('gives the destination close control at least a 44 by 44 pixel target', () => {
        // jsdom does not evaluate responsive layout; check the control's CSS rule.
        const css = readFileSync(
            resolve(__dirname, '../../../src/components/maps/DestinationMapCard.module.css'),
            'utf8'
        );
        const [, rule] = css.match(/\.close\s*\{([^}]*)\}/) ?? [];

        for (const axis of ['width', 'height']) {
            const [, pixels] = rule?.match(new RegExp(`\\b${axis}:\\s*(\\d+)px`)) ?? [];
            expect(Number(pixels), axis).toBeGreaterThanOrEqual(44);
        }
    });

    it('gives the destination details link a minimum block size of 44 pixels', () => {
        // jsdom does not evaluate layout, so check the rule for the rendered link's class.
        const css = readFileSync(
            resolve(__dirname, '../../../src/components/maps/DestinationMapCard.module.css'),
            'utf8'
        );

        const [, pixels] = css.match(/\.detailsLink\s*\{[^}]*min-block-size:\s*(\d+)px/) ?? [];

        expect(Number(pixels)).toBeGreaterThanOrEqual(44);
    });

    it('forwards items into a cluster group wrapper', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[0, 0]}
                items={[
                    {
                        id: '1',
                        slug: 'a',
                        name: 'A',
                        approximateLocation: { lat: 0, lng: 0, radiusMeters: 150 }
                    }
                ]}
                ariaLabel="map"
                i18nStrings={i18n}
            />
        );

        expect(await screen.findByTestId('cluster-group')).toBeInTheDocument();
    });
});
