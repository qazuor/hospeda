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
    useMap: () => ({ setView: vi.fn() })
}));

vi.mock('leaflet', () => ({
    default: { Icon: { Default: { mergeOptions: vi.fn() } } }
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon-retina.png' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

import { render, screen } from '@testing-library/react';
import { LocationMap } from '../../../src/components/maps/LocationMap.client';

const i18n = {
    attribution: '© OSM',
    approximateDisclaimer: 'Ubicación aproximada.',
    markerLabel: 'Ubicación'
};

describe('LocationMap', () => {
    it('renders a Circle in approximate mode and shows the disclaimer', () => {
        render(
            <LocationMap
                mode="approximate"
                lat={-30.7521}
                lng={-58.0429}
                radiusMeters={150}
                ariaLabel="aprox map"
                i18nStrings={i18n}
            />
        );

        expect(screen.getByTestId('circle')).toBeInTheDocument();
        expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
        expect(screen.getByTestId('circle').dataset.radius).toBe('150');
        expect(screen.getByText('Ubicación aproximada.')).toBeInTheDocument();
    });

    it('renders a Marker in exact mode and does not show disclaimer', () => {
        render(
            <LocationMap
                mode="exact"
                lat={-30.7521}
                lng={-58.0429}
                ariaLabel="exact map"
                markerLabel="Chajarí"
                i18nStrings={i18n}
            />
        );

        expect(screen.getByTestId('marker')).toBeInTheDocument();
        expect(screen.queryByTestId('circle')).not.toBeInTheDocument();
        expect(screen.queryByText('Ubicación aproximada.')).not.toBeInTheDocument();
        expect(screen.getByText('Chajarí')).toBeInTheDocument();
    });

    it('falls back to i18n markerLabel when markerLabel prop is omitted in exact mode', () => {
        render(
            <LocationMap
                mode="exact"
                lat={0}
                lng={0}
                ariaLabel="exact map"
                i18nStrings={i18n}
            />
        );

        expect(screen.getByText('Ubicación')).toBeInTheDocument();
    });

    it('exposes ariaLabel to the wrapper element', () => {
        const { container } = render(
            <LocationMap
                mode="approximate"
                lat={0}
                lng={0}
                radiusMeters={150}
                ariaLabel="my-label"
                i18nStrings={i18n}
            />
        );

        const root = container.querySelector('[role="img"]');
        expect(root?.getAttribute('aria-label')).toBe('my-label');
    });
});
