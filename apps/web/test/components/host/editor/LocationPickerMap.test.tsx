/**
 * @file LocationPickerMap.test.tsx
 * @description Light smoke test for LocationPickerMap (BETA-132).
 *
 * jsdom has no layout engine, so a real Leaflet tile-loading assertion isn't
 * meaningful here. This test mocks the `leaflet` module and asserts the
 * BETA-132 fix's *mechanics* instead: the map is remeasured
 * (`invalidateSize`) right after setup, and a `ResizeObserver` is created and
 * attached to the container so later container resizes also remeasure it
 * (mirroring the pattern already used in ListingMapInner.client.tsx).
 */
import { render, waitFor } from '@testing-library/react';
import * as L from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import { LocationPickerMap } from '@/components/host/editor/LocationPickerMap.client';

vi.mock('@/components/host/editor/LocationPicker.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon2x.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

const { mockMap, mockMarker } = vi.hoisted(() => {
    const map = {
        invalidateSize: vi.fn(),
        on: vi.fn(),
        remove: vi.fn(),
        flyTo: vi.fn()
    };
    const marker = {
        addTo: vi.fn(),
        on: vi.fn(),
        setLatLng: vi.fn(),
        setOpacity: vi.fn(),
        getLatLng: vi.fn(() => ({ lat: 0, lng: 0 }))
    };
    return { mockMap: map, mockMarker: marker };
});

vi.mock('leaflet', () => {
    const L = {
        map: vi.fn(() => mockMap),
        tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
        marker: vi.fn(() => mockMarker),
        Icon: { Default: { mergeOptions: vi.fn(), prototype: { _getIconUrl: vi.fn() } } }
    };
    // Mock both the named-export shape and the default-export shape: the
    // real `leaflet` package is CJS/UMD, and depending on bundler interop
    // `import('leaflet')` may resolve either way.
    return { ...L, default: L };
});

const DEFAULT_PROPS = {
    center: { lat: -32.48, lng: -58.23 },
    markerPosition: null,
    disabled: false,
    onMove: vi.fn()
};

describe('LocationPickerMap (BETA-132)', () => {
    it('mounts without throwing and remeasures the map size after setup', async () => {
        expect(() => render(<LocationPickerMap {...DEFAULT_PROPS} />)).not.toThrow();

        await waitFor(() => {
            expect(mockMap.invalidateSize).toHaveBeenCalled();
        });
    });

    it('observes the container with a ResizeObserver for later resizes', async () => {
        const observeSpy = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');

        render(<LocationPickerMap {...DEFAULT_PROPS} />);

        await waitFor(() => {
            expect(observeSpy).toHaveBeenCalled();
        });

        observeSpy.mockRestore();
    });
});

describe('LocationPickerMap — unplaced pin (HOS-1767)', () => {
    const PLACED_POSITION = { lat: -32.4825, lng: -58.2372 };

    it('TEST:1767:15 — creates the marker semi-transparent until it is placed', async () => {
        const { unmount } = render(<LocationPickerMap {...DEFAULT_PROPS} />);

        await waitFor(() => {
            expect(L.marker).toHaveBeenCalled();
        });

        const unplacedOptions = vi.mocked(L.marker).mock.calls.at(-1)?.[1];
        expect(unplacedOptions).toMatchObject({ opacity: 0.5 });

        unmount();
        vi.clearAllMocks();

        render(
            <LocationPickerMap
                {...DEFAULT_PROPS}
                markerPosition={PLACED_POSITION}
            />
        );

        await waitFor(() => {
            expect(L.marker).toHaveBeenCalled();
        });

        const placedOptions = vi.mocked(L.marker).mock.calls.at(-1)?.[1];
        expect(placedOptions).toMatchObject({ opacity: 1 });
    });

    it('TEST:1767:16 — restores full opacity once a position arrives', async () => {
        const { rerender } = render(<LocationPickerMap {...DEFAULT_PROPS} />);

        await waitFor(() => {
            expect(L.marker).toHaveBeenCalled();
        });

        rerender(
            <LocationPickerMap
                {...DEFAULT_PROPS}
                markerPosition={PLACED_POSITION}
            />
        );

        await waitFor(() => {
            expect(mockMarker.setOpacity).toHaveBeenCalledWith(1);
        });
    });
});
