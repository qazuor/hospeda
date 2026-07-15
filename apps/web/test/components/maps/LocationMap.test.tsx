import { beforeAll, describe, expect, it, vi } from 'vitest';

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
    Marker: ({
        children,
        position,
        title
    }: {
        children: React.ReactNode;
        position: number[];
        title?: string;
    }) => (
        <div
            data-testid="marker"
            data-pos={position.join(',')}
            // Leaflet forwards `title` onto the marker's focusable element; the
            // mock mirrors that so the accessible-name assertion is meaningful.
            title={title}
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
    useMap: () => ({
        setView: vi.fn(),
        invalidateSize: vi.fn(),
        fitBounds: vi.fn(),
        scrollWheelZoom: { enable: vi.fn(), disable: vi.fn() }
    })
}));

vi.mock('leaflet', () => ({
    default: {
        Icon: { Default: { mergeOptions: vi.fn() } },
        divIcon: vi.fn(() => ({}))
    }
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon-retina.png' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

import { fireEvent, render, screen } from '@testing-library/react';
import { LocationMap } from '../../../src/components/maps/LocationMap.client';

// Pre-warm the lazy inner chunks (React.lazy, SPEC-269) so they resolve within
// the default findBy timeout even on a cold module graph when this file runs
// alone. There is one chunk PER MODE (HOS-146 review): the multi-marker POI map
// is split out so its react-dom/server + icon-table cost never reaches the
// approximate/exact maps.
beforeAll(async () => {
    await import('../../../src/components/maps/LocationMapInner.client');
    await import('../../../src/components/maps/MultiMarkerMapInner.client');
});

const approximateI18n = {
    attribution: '© OSM',
    approximateDisclaimer: 'Ubicación aproximada.'
};

const exactI18n = {
    attribution: '© OSM',
    markerLabel: 'Ubicación'
};

describe('LocationMap', () => {
    it('renders a Circle in approximate mode and shows the disclaimer', async () => {
        render(
            <LocationMap
                mode="approximate"
                lat={-30.7521}
                lng={-58.0429}
                radiusMeters={150}
                ariaLabel="aprox map"
                i18nStrings={approximateI18n}
            />
        );

        // Inner map is lazy-loaded (React.lazy + Suspense, SPEC-269): await the
        // first query so the chunk resolves before the sync assertions run.
        expect(await screen.findByTestId('circle')).toBeInTheDocument();
        expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
        expect(screen.getByTestId('circle').dataset.radius).toBe('150');
        expect(screen.getByText('Ubicación aproximada.')).toBeInTheDocument();
    });

    it('renders a Marker in exact mode and does not show disclaimer', async () => {
        render(
            <LocationMap
                mode="exact"
                lat={-30.7521}
                lng={-58.0429}
                ariaLabel="exact map"
                markerLabel="Chajarí"
                i18nStrings={exactI18n}
            />
        );

        expect(await screen.findByTestId('marker')).toBeInTheDocument();
        expect(screen.queryByTestId('circle')).not.toBeInTheDocument();
        expect(screen.queryByText('Ubicación aproximada.')).not.toBeInTheDocument();
        expect(screen.getByText('Chajarí')).toBeInTheDocument();
    });

    it('falls back to i18n markerLabel when markerLabel prop is omitted in exact mode', async () => {
        render(
            <LocationMap
                mode="exact"
                lat={0}
                lng={0}
                ariaLabel="exact map"
                i18nStrings={exactI18n}
            />
        );

        expect(await screen.findByText('Ubicación')).toBeInTheDocument();
    });

    it('exposes ariaLabel to the wrapper element', async () => {
        const { container } = render(
            <LocationMap
                mode="approximate"
                lat={0}
                lng={0}
                radiusMeters={150}
                ariaLabel="my-label"
                i18nStrings={approximateI18n}
            />
        );

        // Wait for the lazy inner map to mount before reading the wrapper.
        await screen.findByTestId('circle');
        // SPEC-308: the wrapper role moved from img → group (a role="img" that
        // contains focusable Leaflet controls is nested-interactive under axe).
        const root = container.querySelector('[role="group"]');
        expect(root?.getAttribute('aria-label')).toBe('my-label');
    });
});

// ─── mode: 'multi' (HOS-146 — destination POI map) ──────────────────────────
describe('LocationMap — mode: multi', () => {
    const multiI18n = {
        attribution: '© OSM',
        showSurroundingsLabel: 'Ver alrededores',
        hideSurroundingsLabel: 'Volver a la ciudad'
    };
    const primaryMarker = {
        id: 'poi-primary-1',
        lat: -32.4766,
        long: -58.2372,
        type: 'BEACH',
        relation: 'PRIMARY' as const,
        label: 'Playa Ita Pirú',
        typeLabel: 'Playa'
    };
    const nearbyMarker = {
        id: 'poi-nearby-1',
        lat: -32.7,
        long: -58.5,
        type: 'NATURAL',
        relation: 'NEARBY' as const,
        label: 'Reserva lejana',
        typeLabel: 'Espacio natural'
    };

    it('renders one Marker per marker in the list', async () => {
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker, nearbyMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        const markers = await screen.findAllByTestId('marker');
        expect(markers).toHaveLength(2);
    });

    it('renders a Popup with the marker label and type label', async () => {
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        await screen.findByTestId('marker');
        expect(screen.getByText('Playa Ita Pirú')).toBeInTheDocument();
        expect(screen.getByText('Playa')).toBeInTheDocument();
    });

    it('does not render the "ver alrededores" toggle when surroundingsBounds is omitted', async () => {
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        await screen.findByTestId('marker');
        expect(screen.queryByText('Ver alrededores')).not.toBeInTheDocument();
    });

    it('gives every marker an accessible name via title (WCAG 2.1 A — 4.1.2)', async () => {
        // Leaflet renders each marker as a focusable role="button". Without a
        // name that is a tab stop announced as just "button" — ~97 of them on a
        // real destination. `alt` does NOT work here: Leaflet only applies it
        // when the icon is an <img>, and a DivIcon never is.
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker, nearbyMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        const markers = await screen.findAllByTestId('marker');
        expect(markers.map((m) => m.getAttribute('title'))).toEqual([
            'Playa Ita Pirú',
            'Reserva lejana'
        ]);
    });

    it('renders the "ver alrededores" toggle when surroundingsBounds is provided, and toggles its label on click', async () => {
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker, nearbyMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                surroundingsBounds={[
                    [-32.71, -58.51],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        await screen.findAllByTestId('marker');
        const toggle = screen.getByText('Ver alrededores');
        expect(toggle).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(await screen.findByText('Volver a la ciudad')).toBeInTheDocument();
    });

    it('does not set aria-pressed on the surroundings toggle (its NAME changes instead)', async () => {
        // WAI-ARIA APG: a toggle either keeps a stable name and exposes state via
        // aria-pressed, or changes its name and exposes no pressed state. Doing
        // both announces "Volver a la ciudad, pressed" — the opposite reading.
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker, nearbyMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                surroundingsBounds={[
                    [-32.71, -58.51],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={multiI18n}
            />
        );

        await screen.findAllByTestId('marker');
        const toggle = screen.getByRole('button', { name: 'Ver alrededores' });
        expect(toggle).not.toHaveAttribute('aria-pressed');

        fireEvent.click(toggle);
        const expanded = await screen.findByRole('button', { name: 'Volver a la ciudad' });
        expect(expanded).not.toHaveAttribute('aria-pressed');
    });

    it('exposes ariaLabel on the wrapper element', async () => {
        const { container } = render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map aria"
                i18nStrings={multiI18n}
            />
        );

        await screen.findByTestId('marker');
        const root = container.querySelector('[role="group"]');
        expect(root?.getAttribute('aria-label')).toBe('poi map aria');
    });

    // ── Activation must not cost a click (HOS-146 review R2-2) ──────────────
    // approximate/exact activate scroll-zoom via a full-bleed overlay that
    // RECEIVES the click. Free there (0-1 markers); here it means two clicks to
    // open any of ~97 pins. Multi activates from a capture-phase pointerdown on
    // the root instead, so one gesture does both.
    it('activates on the first pointerdown on a marker, without the hint intercepting it', async () => {
        render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker, nearbyMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={{ ...multiI18n, interactionHint: 'Activá el zoom' }}
            />
        );

        const markers = await screen.findAllByTestId('marker');
        // Inactive: the hint is showing and scroll-wheel zoom is off.
        expect(screen.getByText('Activá el zoom')).toBeInTheDocument();

        // A pointerdown that ORIGINATES on a marker (i.e. the pin, not the
        // overlay, is the target — which is only possible because the hint is
        // click-through) still activates the map.
        fireEvent.pointerDown(markers[0] as HTMLElement);

        expect(screen.queryByText('Activá el zoom')).not.toBeInTheDocument();
    });

    it('activates on a pointerdown anywhere else on the map too', async () => {
        const { container } = render(
            <LocationMap
                mode="multi"
                markers={[primaryMarker]}
                initialBounds={[
                    [-32.48, -58.24],
                    [-32.47, -58.23]
                ]}
                ariaLabel="poi map"
                i18nStrings={{ ...multiI18n, interactionHint: 'Activá el zoom' }}
            />
        );

        await screen.findByTestId('marker');
        expect(screen.getByText('Activá el zoom')).toBeInTheDocument();

        fireEvent.pointerDown(screen.getByTestId('map-container'));

        expect(screen.queryByText('Activá el zoom')).not.toBeInTheDocument();
        expect(container.querySelector('[role="group"]')).toBeInTheDocument();
    });
});
