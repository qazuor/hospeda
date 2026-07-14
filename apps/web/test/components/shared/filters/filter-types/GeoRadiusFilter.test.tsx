/**
 * @file GeoRadiusFilter.test.tsx
 * @description Unit tests for the GeoRadiusFilter component's HOS-142 G-6
 * addition: the `poi` mode (proximity search around a point of interest).
 *
 * Covers:
 * - The `poi` radio only renders when `config.poiModeLabel` is set (backward
 *   compatibility for any other `geo-radius` consumer that doesn't opt in).
 * - Selecting a POI from the (mocked) autocomplete emits
 *   `{ mode: 'poi', poiId, radius }` — never raw lat/long (AC-6).
 * - Clicking a radius preset while a POI is already selected re-applies the
 *   same POI with the new radius.
 * - `loadPoiItems` (passed to the autocomplete as `loadItems`) calls
 *   `pointOfInterestApi.list` with `isFeatured: true` when the query is
 *   empty (OQ-1: featured/high-priority first) and with `q` + displayWeight
 *   sort when the user has typed something.
 * - Hydrating an existing `poiId` selection (e.g. from a URL param) resolves
 *   its display label via `pointOfInterestApi.getById`.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    GeoRadiusFilterConfig,
    GeoRadiusState
} from '@/components/shared/filters/filter-types/filter.types';
import { GeoRadiusFilter } from '@/components/shared/filters/filter-types/GeoRadiusFilter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPoiList = vi.fn();
const mockPoiGetById = vi.fn();
const mockPoiGetBySlug = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    pointOfInterestApi: {
        list: (...args: unknown[]) => mockPoiList(...args),
        getById: (...args: unknown[]) => mockPoiGetById(...args),
        getBySlug: (...args: unknown[]) => mockPoiGetBySlug(...args)
    }
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

/** Captures the props the real SearchableSelect would have received, so the
 * `loadItems`/`value` wiring can be asserted directly without rendering the
 * full combobox (mirrors `CreatePropertyMiniForm.test.tsx`'s mock pattern). */
let lastSearchableSelectProps: Record<string, unknown> | undefined;

vi.mock('@/components/form/SearchableSelect.client', () => ({
    SearchableSelect: (props: Record<string, unknown>) => {
        lastSearchableSelectProps = props;
        const onChange = props.onChange as (item: { id: string; label: string } | null) => void;
        return (
            <button
                type="button"
                data-testid="mock-poi-picker"
                onClick={() => onChange({ id: 'poi-uuid-1', label: 'Plaza San Martín' })}
            >
                {(props.value as { label: string } | null)?.label ?? props.placeholder}
            </button>
        );
    }
}));

vi.mock('@/components/shared/filters/filter-types/GeoRadiusFilter.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

beforeEach(() => {
    // Default resolved value for the poiId/poiSlug label-hydration effect,
    // which fires on every mount where `value.mode === 'poi'` (several tests
    // below pass such a `value` for reasons unrelated to hydration itself) —
    // individual tests override this when they specifically assert on it.
    mockPoiGetById.mockResolvedValue({ ok: true, data: null });
    mockPoiGetBySlug.mockResolvedValue({ ok: true, data: null });
});

afterEach(() => {
    vi.clearAllMocks();
    lastSearchableSelectProps = undefined;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: GeoRadiusFilterConfig = {
    id: 'location',
    label: 'Ubicación',
    type: 'geo-radius',
    destinationOptions: [
        { value: 'cdu', label: 'Concepción del Uruguay', lat: -32.48, long: -58.23 }
    ],
    radiusPresets: [5, 10, 25],
    destinationModeLabel: 'Un destino',
    browserModeLabel: 'Mi ubicación',
    destinationPlaceholder: 'Elegí un destino',
    browserCtaLabel: 'Usar mi ubicación',
    browserPendingLabel: 'Detectando…',
    browserErrorLabel: 'Error',
    radiusUnitLabel: 'km'
};

const poiConfig: GeoRadiusFilterConfig = {
    ...baseConfig,
    poiModeLabel: 'Un lugar de interés',
    poiPlaceholder: 'Buscá un lugar...',
    poiSearchingLabel: 'Buscando...',
    poiNoResultsLabel: 'Sin resultados'
};

describe('GeoRadiusFilter — poi mode (HOS-142 G-6)', () => {
    it('does not render the poi radio when poiModeLabel is not configured (backward compatibility)', () => {
        render(
            <GeoRadiusFilter
                config={baseConfig}
                value={undefined}
                onChange={vi.fn()}
                locale="es"
            />
        );
        expect(screen.queryByText('Un lugar de interés')).not.toBeInTheDocument();
    });

    it('renders the poi radio when poiModeLabel is configured', () => {
        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={undefined}
                onChange={vi.fn()}
                locale="es"
            />
        );
        expect(screen.getByText('Un lugar de interés')).toBeInTheDocument();
    });

    it('AC-6: selecting a POI from the autocomplete emits { mode: "poi", poiId, radius } — no lat/long', async () => {
        mockPoiList.mockResolvedValue({ ok: true, data: { items: [], pagination: {} } });
        const onChange = vi.fn();

        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={undefined}
                onChange={onChange}
                locale="es"
            />
        );

        // Switch into poi mode.
        fireEvent.click(screen.getByRole('radio', { name: 'Un lugar de interés' }));

        // The mocked autocomplete's button simulates picking a POI.
        fireEvent.click(await screen.findByTestId('mock-poi-picker'));

        expect(onChange).toHaveBeenCalledWith({
            mode: 'poi',
            poiId: 'poi-uuid-1',
            radius: 5 // first preset, since no prior value/radius was set
        });
        const emitted = onChange.mock.calls.at(-1)?.[0] as GeoRadiusState;
        expect(emitted).not.toHaveProperty('lat');
        expect(emitted).not.toHaveProperty('long');
    });

    it('clicking a radius preset while a poi is already selected re-applies the same poi with the new radius', () => {
        mockPoiList.mockResolvedValue({ ok: true, data: { items: [], pagination: {} } });
        const onChange = vi.fn();
        const value: GeoRadiusState = { mode: 'poi', poiId: 'poi-uuid-1', radius: 5 };

        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={value}
                onChange={onChange}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: '25km' }));

        expect(onChange).toHaveBeenCalledWith({ mode: 'poi', poiId: 'poi-uuid-1', radius: 25 });
    });

    it('does not emit anything when a radius preset is clicked in poi mode with nothing selected yet', () => {
        const onChange = vi.fn();
        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={undefined}
                onChange={onChange}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Un lugar de interés' }));
        onChange.mockClear();
        fireEvent.click(screen.getByRole('button', { name: '10km' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('loadPoiItems (OQ-1): fetches isFeatured=true, sorted by displayWeight desc, when the query is empty', async () => {
        mockPoiList.mockResolvedValue({ ok: true, data: { items: [], pagination: {} } });
        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={undefined}
                onChange={vi.fn()}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('radio', { name: 'Un lugar de interés' }));

        const loadItems = lastSearchableSelectProps?.loadItems as (q: string) => Promise<unknown>;
        await loadItems('');

        expect(mockPoiList).toHaveBeenCalledWith({
            q: undefined,
            isFeatured: true,
            pageSize: 20,
            sortBy: 'displayWeight',
            sortOrder: 'desc'
        });
    });

    it('loadPoiItems (OQ-1): fetches by `q` (no isFeatured filter) when the user has typed a query, still sorted by displayWeight desc', async () => {
        mockPoiList.mockResolvedValue({ ok: true, data: { items: [], pagination: {} } });
        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={undefined}
                onChange={vi.fn()}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('radio', { name: 'Un lugar de interés' }));

        const loadItems = lastSearchableSelectProps?.loadItems as (q: string) => Promise<unknown>;
        await loadItems('plaza');

        expect(mockPoiList).toHaveBeenCalledWith({
            q: 'plaza',
            isFeatured: undefined,
            pageSize: 20,
            sortBy: 'displayWeight',
            sortOrder: 'desc'
        });
    });

    it('resolves the display label of an already-selected poiId via getById on mount (URL hydration)', async () => {
        mockPoiGetById.mockResolvedValue({
            ok: true,
            data: {
                id: 'poi-uuid-1',
                slug: 'plaza-san-martin',
                nameI18n: { es: 'Plaza San Martín', en: null, pt: null },
                isFeatured: true
            }
        });

        render(
            <GeoRadiusFilter
                config={poiConfig}
                value={{ mode: 'poi', poiId: 'poi-uuid-1', radius: 10 }}
                onChange={vi.fn()}
                locale="es"
            />
        );

        await waitFor(() => expect(mockPoiGetById).toHaveBeenCalledWith({ id: 'poi-uuid-1' }));
        await waitFor(() =>
            expect(screen.getByTestId('mock-poi-picker')).toHaveTextContent('Plaza San Martín')
        );
    });
});
