/**
 * @file ListingMapFavoriteButton.test.tsx
 * @description Integration test for SPEC-098 T-044: FavoriteButton in the
 * AccommodationPopupContent of ListingMap.
 *
 * HOS-95 changed the accommodation popup from an eager Leaflet `<Popup>`
 * child of the `<Marker>` into a floating card (`AccommodationCardPopup`)
 * that only mounts after the marker (or its privacy Circle) is clicked, is
 * measured via `useLayoutEffect` + `ResizeObserver`, and is rendered through
 * `createPortal` into the map container's parent element. This test mocks
 * `react-leaflet` closely enough to reproduce that flow: `Marker` forwards
 * its `eventHandlers.click` to a real DOM click, `useMap()` returns a fake
 * map object with the projection/sizing methods `AccommodationCardPopup`
 * needs, and a polyfilled `ResizeObserver` keeps the layout effect from
 * throwing in jsdom.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom has no ResizeObserver; AccommodationCardPopup's useLayoutEffect
// creates one to re-measure the card on container resize (HOS-95).
globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

// createPortal needs a real, attached DOM node to portal into — `useMap()`'s
// `getContainer()` must return an element whose `.parentElement` exists, so
// AccommodationCardPopup can portal into it (mirrors `map.getContainer().parentElement`).
const fakeMapRoot = document.createElement('div');
document.body.appendChild(fakeMapRoot);
const fakeMapContainer = document.createElement('div');
fakeMapRoot.appendChild(fakeMapContainer);

// A single stable object reference — AccommodationCardPopup's
// `useLayoutEffect(..., [map, item])` re-runs whenever `map` changes identity,
// so `useMap()` must return the SAME object every call, not a fresh literal
// per render (that would re-trigger the effect -> setPos -> re-render loop
// forever and blow React's "Maximum update depth exceeded" guard).
const fakeMap = {
    latLngToContainerPoint: () => ({ x: 100, y: 100 }),
    getSize: () => ({ x: 800, y: 600 }),
    getContainer: () => fakeMapContainer
};

// Override Circle to render children so popup content is reachable in tests.
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
        eventHandlers
    }: {
        children: React.ReactNode;
        position: number[];
        eventHandlers?: { click?: () => void };
    }) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: test mock of react-leaflet's Marker — forwards eventHandlers.click so fireEvent.click can trigger it, same as a real Leaflet marker's non-keyboard click handler.
        // biome-ignore lint/a11y/useKeyWithClickEvents: test mock, not a real interactive UI element.
        <div
            data-testid="marker"
            data-pos={position.join(',')}
            onClick={eventHandlers?.click}
        >
            {children}
        </div>
    ),
    Popup: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="popup">{children}</div>
    ),
    // Render children so the Popup (and its FavoriteButton) is reachable in the DOM.
    Circle: ({
        children,
        center,
        radius
    }: {
        children: React.ReactNode;
        center: number[];
        radius: number;
    }) => (
        <div
            data-testid="circle"
            data-center={center.join(',')}
            data-radius={radius}
        >
            {children}
        </div>
    ),
    useMap: () => fakeMap,
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

// Stub the API endpoint used by FavoriteButton's single-check hydration.
vi.mock('@/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        checkStatus: vi.fn().mockResolvedValue({ ok: false, error: { status: 401 } }),
        toggle: vi.fn().mockResolvedValue({ ok: false, error: { status: 401 } })
    }
}));

// Stub icons package to avoid ESM issues in test env.
vi.mock('@repo/icons', () => ({
    FavoriteIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="favorite-icon"
            data-size={size}
        />
    )
}));

// Stub toast store to avoid side effects.
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

import { fireEvent, render, screen } from '@testing-library/react';
import { ListingMap } from '../../../src/components/maps/ListingMap.client';

// Pre-warm the lazy inner chunk (React.lazy, SPEC-269) so it resolves within the
// default findBy timeout even on a cold module graph when this file runs alone.
beforeAll(async () => {
    await import('../../../src/components/maps/ListingMapInner.client');
});

const i18n = {
    attribution: '© OSM',
    approximateDisclaimer: 'Ubicación aproximada.',
    viewDetails: 'Ver más'
};

const baseItem = {
    id: 'acc-uuid-1',
    slug: 'cabana-test',
    name: 'Cabaña Test',
    thumbnailUrl: 'https://example.com/img.jpg',
    approximateLocation: { lat: -30, lng: -58, radiusMeters: 150 }
};

describe('ListingMap — FavoriteButton in popup (T-044)', () => {
    it('renders FavoriteButton inside the accommodation popup', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[-30, -58]}
                items={[baseItem]}
                ariaLabel="map"
                i18nStrings={i18n}
                isAuthenticated={false}
                locale="es"
            />
        );

        // HOS-95: the accommodation popup no longer renders eagerly — it's a
        // floating card opened by clicking the marker. Await the lazy inner
        // map's marker, click it to open the card, then assert on its content.
        const [marker] = await screen.findAllByTestId('marker');
        fireEvent.click(marker);

        // The FavoriteButton renders an icon stack (commit 35b93bca1): one
        // visible icon plus one hidden fill icon for the CSS hover preview.
        // Use getAllByTestId and assert at least one icon is present.
        expect((await screen.findAllByTestId('favorite-icon')).length).toBeGreaterThanOrEqual(1);
    });

    it('uses compact icon size (18) for FavoriteButton in popup', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[-30, -58]}
                items={[baseItem]}
                ariaLabel="map"
                i18nStrings={i18n}
                isAuthenticated={false}
                locale="es"
            />
        );

        // HOS-95: open the floating card by clicking the marker before the
        // FavoriteButton (rendered inside it) is reachable.
        const [marker] = await screen.findAllByTestId('marker');
        fireEvent.click(marker);

        // Both icons in the stack use the compact size (18) — check the first one.
        const icons = await screen.findAllByTestId('favorite-icon');
        expect(icons[0]).toHaveAttribute('data-size', '18');
    });

    it('FavoriteButton is not rendered for destination-list mode', async () => {
        render(
            <ListingMap
                mode="destination-list"
                initialCenter={[-30, -58]}
                items={[
                    {
                        id: 'dest-1',
                        slug: 'dest',
                        name: 'Destino',
                        coordinates: { lat: -30, lng: -58 }
                    }
                ]}
                ariaLabel="map"
                i18nStrings={i18n}
                isAuthenticated={false}
                locale="es"
            />
        );

        // Await the lazy inner map (a marker renders in destination mode) so the
        // absence assertion runs after the chunk has actually mounted.
        await screen.findByTestId('marker');
        // Destination popups do not have a FavoriteButton.
        expect(screen.queryByTestId('favorite-icon')).not.toBeInTheDocument();
    });

    it('renders FavoriteButton with aria-pressed=false when item is not favorited', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[-30, -58]}
                items={[{ ...baseItem, isFavorited: false }]}
                ariaLabel="map"
                i18nStrings={i18n}
                isAuthenticated={true}
                locale="es"
            />
        );

        // HOS-95: open the floating card by clicking the marker before the
        // FavoriteButton (rendered inside it) is reachable.
        const [marker] = await screen.findAllByTestId('marker');
        fireEvent.click(marker);

        const btn = await screen.findByRole('button', { name: /favorito/i });
        expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders FavoriteButton with aria-pressed=true when item is pre-hydrated as favorited', async () => {
        render(
            <ListingMap
                mode="accommodation-list"
                initialCenter={[-30, -58]}
                items={[{ ...baseItem, isFavorited: true, favoriteBookmarkId: 'bk-99' }]}
                ariaLabel="map"
                i18nStrings={i18n}
                isAuthenticated={true}
                locale="es"
            />
        );

        // HOS-95: open the floating card by clicking the marker before the
        // FavoriteButton (rendered inside it) is reachable.
        const [marker] = await screen.findAllByTestId('marker');
        fireEvent.click(marker);

        const btn = await screen.findByRole('button', { name: /favorito/i });
        expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
});
