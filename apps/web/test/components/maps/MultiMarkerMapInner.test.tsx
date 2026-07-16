/**
 * @file MultiMarkerMapInner.test.tsx
 * @description Direct unit coverage for `getPoiDivIcon` (HOS-182) — the POI
 * marker icon/color resolution and its process-lifetime cache. Complements
 * `LocationMap.test.tsx`'s component-level coverage (which exercises the
 * multi-marker map's DOM behavior with `L.divIcon` stubbed to `{}`) by
 * asserting on the ACTUAL `L.divIcon()` call arguments: which icon/color get
 * resolved for a categorized vs. uncategorized POI, that PRIMARY/NEARBY stay
 * structurally distinguished regardless of category, and that the cache is
 * actually being hit rather than rebuilding on every call.
 *
 * `@repo/icons` is NOT mocked — this is real end-to-end resolution through
 * `getPoiCategoryIcon`/`getPoiCategoryColorScheme`, the same functions
 * `DestinationPOISection.astro` and `WhatsNearbySection.astro` use, so a pin
 * and its matching grid card can never silently drift apart.
 */
import { getPoiCategoryColorScheme } from '@repo/icons';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDivIcon } = vi.hoisted(() => ({
    mockDivIcon: vi.fn((opts: { html: string; iconSize: [number, number] }) => opts)
}));

vi.mock('leaflet', () => ({
    default: {
        Icon: { Default: { mergeOptions: vi.fn() } },
        divIcon: mockDivIcon
    }
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'icon-retina.png' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

vi.mock('react-leaflet', () => ({
    MapContainer: () => null,
    TileLayer: () => null,
    Marker: () => null,
    Popup: () => null,
    useMap: () => ({ invalidateSize: vi.fn(), fitBounds: vi.fn() })
}));

const { getPoiDivIcon } = await import('../../../src/components/maps/MultiMarkerMapInner.client');

/** Reads the `html`/`iconSize` args of the most recent `L.divIcon()` call. */
function lastDivIconCall(): { html: string; iconSize: [number, number] } {
    const call = mockDivIcon.mock.calls.at(-1);
    if (!call) throw new Error('L.divIcon was not called');
    return call[0] as { html: string; iconSize: [number, number] };
}

describe('getPoiDivIcon (HOS-182 — category icon/color resolution)', () => {
    beforeEach(() => {
        mockDivIcon.mockClear();
    });

    it('resolves the category bucket hue as a solid fill for a PRIMARY marker', () => {
        // 'beach' → water bucket.
        const { fill, onFill } = getPoiCategoryColorScheme({ slug: 'beach' });

        getPoiDivIcon({ type: 'OTHER', relation: 'PRIMARY', categorySlug: 'beach' });

        const { html, iconSize } = lastDivIconCall();
        expect(html).toContain(`background-color: ${fill};`);
        expect(html).toContain(onFill);
        expect(html).not.toContain('var(--brand-primary)');
        expect(html).toContain('poiPinPrimary');
        expect(iconSize).toEqual([34, 34]);
    });

    it('resolves the category bucket hue as an outline for a NEARBY marker', () => {
        // 'museum' → culture bucket.
        const { fill } = getPoiCategoryColorScheme({ slug: 'museum' });

        getPoiDivIcon({ type: 'MUSEUM', relation: 'NEARBY', categorySlug: 'museum' });

        const { html, iconSize } = lastDivIconCall();
        expect(html).toContain(`border-color: ${fill};`);
        expect(html).toContain(fill); // glyph also uses `fill` for NEARBY
        expect(html).not.toContain('var(--brand-primary)');
        expect(html).toContain('poiPinNearby');
        expect(iconSize).toEqual([24, 24]);
    });

    it('falls back to the legacy type icon + --brand-primary for an uncategorized PRIMARY marker (absent slug)', () => {
        getPoiDivIcon({ type: 'BEACH', relation: 'PRIMARY', categorySlug: undefined });

        const { html } = lastDivIconCall();
        expect(html).toContain('background-color: var(--brand-primary);');
        expect(html).toContain('var(--primary-foreground)');
    });

    it('falls back to the legacy type icon + --brand-primary for an uncategorized NEARBY marker (null slug)', () => {
        getPoiDivIcon({ type: 'PARK', relation: 'NEARBY', categorySlug: null });

        const { html } = lastDivIconCall();
        expect(html).toContain('border-color: var(--brand-primary);');
        expect(html).toContain('var(--brand-primary)');
    });

    it('never resolves the "services" bucket hue for a nullish category slug', () => {
        // Guards the accessibility/data-integrity rule: `getPoiCategoryColorScheme`
        // resolves a nullish slug to the `services` bucket (a REAL category
        // meaning — transport/health/government). Painting an uncategorized POI
        // with it would falsely claim "this is a service" — the fallback path
        // must use the literal --brand-primary token instead, never that call.
        const { fill: servicesFill } = getPoiCategoryColorScheme({ slug: undefined });

        getPoiDivIcon({ type: 'OTHER', relation: 'PRIMARY', categorySlug: undefined });

        const { html } = lastDivIconCall();
        expect(html).not.toContain(servicesFill);
    });

    it('caches the built icon per categorySlug/relation pair — a repeat call does not rebuild it', () => {
        getPoiDivIcon({
            type: 'GOVERNMENT',
            relation: 'PRIMARY',
            categorySlug: 'government-cache-test'
        });
        getPoiDivIcon({
            type: 'OTHER',
            relation: 'PRIMARY',
            categorySlug: 'government-cache-test'
        });

        // Same categorySlug + relation → same cache key regardless of `type`.
        expect(mockDivIcon).toHaveBeenCalledTimes(1);
    });

    it('does not collapse two different category slugs into the same cache entry', () => {
        // 'winery' and 'casino' share the `food` bucket but are different icons.
        getPoiDivIcon({ type: 'OTHER', relation: 'PRIMARY', categorySlug: 'winery-cache-test' });
        getPoiDivIcon({ type: 'OTHER', relation: 'PRIMARY', categorySlug: 'casino-cache-test' });

        expect(mockDivIcon).toHaveBeenCalledTimes(2);
    });

    it('caches the type-based fallback icon separately from the category icon for the same key text', () => {
        // A type value and a category slug never collide (UPPER_CASE vs
        // snake_case), but this locks in that the fallback path still caches.
        getPoiDivIcon({
            type: 'FALLBACK-CACHE-TEST',
            relation: 'PRIMARY',
            categorySlug: undefined
        });
        getPoiDivIcon({
            type: 'FALLBACK-CACHE-TEST',
            relation: 'PRIMARY',
            categorySlug: undefined
        });

        expect(mockDivIcon).toHaveBeenCalledTimes(1);
    });

    it('treats PRIMARY and NEARBY as separate cache entries for the same category', () => {
        getPoiDivIcon({ type: 'OTHER', relation: 'PRIMARY', categorySlug: 'relation-cache-test' });
        getPoiDivIcon({ type: 'OTHER', relation: 'NEARBY', categorySlug: 'relation-cache-test' });

        expect(mockDivIcon).toHaveBeenCalledTimes(2);
    });
});
