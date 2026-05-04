/**
 * @file SearchBar.test.tsx
 * @description Unit tests for the hero SearchBar URL builder. Covers the
 * pure `buildSearchUrl` helper in isolation: it must include only the params
 * that have a meaningful value, and skip the ones at default state.
 */

import { describe, expect, it } from 'vitest';
import { buildSearchUrl } from '../../../src/components/sections/SearchBar.client';

const BASE = '/es/alojamientos/';

const DEFAULTS = {
    baseUrl: BASE,
    destinationId: null,
    types: new Set<never>(),
    adults: 2,
    children: 0
} as const;

describe('buildSearchUrl', () => {
    it('emits only adults at default state (others suppressed)', () => {
        // Adults is always emitted to keep the sidebar in sync with the hero.
        // Everything else stays out when at default.
        const url = buildSearchUrl({ ...DEFAULTS });
        expect(url).toBe(`${BASE}?adults=2`);
    });

    it('emits destinationIds when a destination is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            destinationId: '11111111-2222-3333-4444-555555555555'
        });
        expect(url).toContain('destinationIds=11111111-2222-3333-4444-555555555555');
    });

    it('emits types as comma-separated when a strict subset is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(['HOTEL', 'CABIN']) as ReadonlySet<'HOTEL' | 'CABIN'>
        });
        expect(url).toContain('types=HOTEL%2CCABIN');
    });

    it('omits types when ALL accommodation types are selected (no filter intent)', () => {
        // Picking every type is equivalent to no filter — keep the URL clean.
        const ALL = [
            'HOTEL',
            'APARTMENT',
            'HOUSE',
            'COUNTRY_HOUSE',
            'CABIN',
            'HOSTEL',
            'CAMPING',
            'ROOM',
            'MOTEL',
            'RESORT'
        ] as const;
        const url = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(ALL) as ReadonlySet<(typeof ALL)[number]>
        });
        // adults still emitted (always) but no `types`
        expect(url).not.toContain('types=');
    });

    it('emits checkIn/checkOut as local YYYY-MM-DD (no timezone shift)', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            checkIn: new Date(2026, 5, 1), // June 1 local time
            checkOut: new Date(2026, 5, 7)
        });
        expect(url).toContain('checkIn=2026-06-01');
        expect(url).toContain('checkOut=2026-06-07');
    });

    it('always emits adults so the listing sidebar shows the same number the user saw in the hero', () => {
        // Even at the default (2), `adults` is emitted because the sidebar's
        // stepper minimum is 1 — without this, the sidebar would default-render
        // 1 adult and silently disagree with the hero.
        const url = buildSearchUrl({ ...DEFAULTS, adults: 2, children: 0 });
        expect(url).toContain('adults=2');
        // Children stays out when 0 (its natural absence; sidebar default is 0 too).
        expect(url).not.toContain('children=');
    });

    it('emits children only when greater than 0', () => {
        const url = buildSearchUrl({ ...DEFAULTS, adults: 4, children: 2 });
        expect(url).toContain('adults=4');
        expect(url).toContain('children=2');
    });

    it('still suppresses children when the user did not touch it', () => {
        const url = buildSearchUrl({ ...DEFAULTS, adults: 5, children: 0 });
        expect(url).toContain('adults=5');
        expect(url).not.toContain('children=');
    });

    it('combines every param when all are set', () => {
        const url = buildSearchUrl({
            baseUrl: BASE,
            destinationId: 'dest-1',
            types: new Set(['HOTEL']) as ReadonlySet<'HOTEL'>,
            checkIn: new Date(2026, 0, 15),
            checkOut: new Date(2026, 0, 20),
            adults: 3,
            children: 1
        });
        expect(url).toContain('destinationIds=dest-1');
        expect(url).toContain('types=HOTEL');
        expect(url).toContain('checkIn=2026-01-15');
        expect(url).toContain('checkOut=2026-01-20');
        expect(url).toContain('adults=3');
        expect(url).toContain('children=1');
    });
});
