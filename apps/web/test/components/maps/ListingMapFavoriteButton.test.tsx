/**
 * @file ListingMapFavoriteButton.test.tsx
 * @description Integration test for SPEC-098 T-044: FavoriteButton in the
 * AccommodationPopupContent of ListingMap.
 *
 * Uses a Circle mock that DOES render its children, allowing us to assert on
 * the popup content without needing a real Leaflet DOM environment.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

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

import { render, screen } from '@testing-library/react';
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

        // The FavoriteButton renders an icon stack (commit 35b93bca1): one
        // visible icon plus one hidden fill icon for the CSS hover preview.
        // Use getAllByTestId and assert at least one icon is present.
        // Inner map is lazy-loaded (React.lazy + Suspense, SPEC-269): await the
        // first query so the chunk (and its popup FavoriteButton) resolves.
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

        const btn = await screen.findByRole('button', { name: /favorito/i });
        expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
});
