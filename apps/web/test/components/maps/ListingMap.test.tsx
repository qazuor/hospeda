import { describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
    MapContainer: ({ children, ...rest }: { children: React.ReactNode }) => (
        <div
            data-testid="map-container"
            {...rest}
        >
            {children}
        </div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children, position }: { children: React.ReactNode; position: number[] }) => (
        <div
            data-testid="marker"
            data-pos={position.join(',')}
        >
            {children}
        </div>
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
        Icon: { Default: { mergeOptions: vi.fn() } },
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

import { render, screen } from '@testing-library/react';
import { ListingMap } from '../../../src/components/maps/ListingMap.client';

const i18n = {
    attribution: '© OSM',
    approximateDisclaimer: 'Ubicación aproximada.'
};

describe('ListingMap', () => {
    it('renders a Circle per accommodation in accommodation-list mode', () => {
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
        expect(screen.getAllByTestId('circle')).toHaveLength(2);
        expect(screen.getAllByTestId('marker')).toHaveLength(2);
        expect(screen.getByText('Ubicación aproximada.')).toBeInTheDocument();
    });

    it('renders a Marker per destination in destination-list mode', () => {
        render(
            <ListingMap
                mode="destination-list"
                initialCenter={[-30, -58]}
                items={[
                    {
                        id: '1',
                        slug: 'chajari',
                        name: 'Chajarí',
                        coordinates: { lat: -30.75, lng: -57.98 }
                    }
                ]}
                ariaLabel="map"
                i18nStrings={i18n}
            />
        );

        expect(screen.getByTestId('marker')).toBeInTheDocument();
        expect(screen.queryByTestId('circle')).not.toBeInTheDocument();
        expect(screen.queryByText('Ubicación aproximada.')).not.toBeInTheDocument();
    });

    it('forwards items into a cluster group wrapper', () => {
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

        expect(screen.getByTestId('cluster-group')).toBeInTheDocument();
    });
});
