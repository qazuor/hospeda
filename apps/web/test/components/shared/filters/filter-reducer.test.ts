/**
 * @file filter-reducer.test.ts
 * @description Unit tests for the pure FilterSidebar reducer.
 *
 * Coverage focus: the `CLEAR_GROUP` action with the optional `extraToggleKeys`
 * field, which the FilterSidebar uses to wipe the independent boolean toggles
 * emitted by `icon-chips` priority chips (`hasWifi`, `hasPool`, …) when the
 * user hits the per-group "× reset" button.
 *
 * Other reducer branches are covered indirectly via FilterSidebar.test.tsx;
 * this file zooms in on the wiring that is easy to silently regress.
 */

import { filterReducer } from '@/components/shared/filters/filter-reducer';
import type { FilterState } from '@/components/shared/filters/filter-types/filter.types';
import { describe, expect, it } from 'vitest';

function makeState(overrides: Partial<FilterState> = {}): FilterState {
    return {
        selections: {},
        ranges: {},
        steppers: {},
        toggles: {},
        dates: {},
        search: '',
        sort: '',
        ...overrides
    };
}

describe('filterReducer — CLEAR_GROUP with extraToggleKeys', () => {
    it('resets each key in extraToggleKeys to false', () => {
        // Arrange — simulate `?hasWifi=true&hasPool=true` already hydrated
        // into the toggles map, plus a selection on the icon-chips group.
        const state = makeState({
            toggles: { hasWifi: true, hasPool: true, hasParking: false },
            selections: { amenities: ['desayuno', 'aire-acondicionado'] }
        });

        // Act
        const next = filterReducer(state, {
            type: 'CLEAR_GROUP',
            groupId: 'amenities',
            extraToggleKeys: ['hasWifi', 'hasPool', 'hasParking', 'allowsPets']
        });

        // Assert — every key listed in extraToggleKeys is flipped to false
        // (even keys that were missing from the previous state, like
        // `allowsPets`, which is the path taken when the user clicks reset
        // without ever having toggled that chip on).
        expect(next.toggles.hasWifi).toBe(false);
        expect(next.toggles.hasPool).toBe(false);
        expect(next.toggles.hasParking).toBe(false);
        expect(next.toggles.allowsPets).toBe(false);
    });

    it('also clears the group selections and the group-scoped toggles', () => {
        // Arrange — icon-chips group with two regular selections and the
        // standard group-scoped toggles (`<groupId>_includeNull`, ...). The
        // reset must wipe ALL of these in one go.
        const state = makeState({
            toggles: {
                hasWifi: true,
                amenities_includeNull: true,
                amenities_isFree: true,
                amenities_includeUnpriced: false
            },
            selections: { amenities: ['desayuno'] }
        });

        // Act
        const next = filterReducer(state, {
            type: 'CLEAR_GROUP',
            groupId: 'amenities',
            extraToggleKeys: ['hasWifi']
        });

        // Assert
        expect(next.selections.amenities).toEqual([]);
        expect(next.toggles.hasWifi).toBe(false);
        expect(next.toggles.amenities_includeNull).toBe(false);
        expect(next.toggles.amenities_isFree).toBe(false);
        // includeUnpriced resets to the server default of `true` so the URL
        // can drop the param entirely.
        expect(next.toggles.amenities_includeUnpriced).toBe(true);
    });

    it('does not touch unrelated toggles outside extraToggleKeys', () => {
        // Arrange — a sibling toggle from another group must survive the
        // reset (the per-group "× reset" only clears this group + its
        // declared priority shortcuts).
        const state = makeState({
            toggles: { hasWifi: true, featured: true }
        });

        // Act
        const next = filterReducer(state, {
            type: 'CLEAR_GROUP',
            groupId: 'amenities',
            extraToggleKeys: ['hasWifi']
        });

        // Assert — the unrelated `featured` toggle is preserved.
        expect(next.toggles.featured).toBe(true);
        expect(next.toggles.hasWifi).toBe(false);
    });

    it('clears ranges and dates owned by the group', () => {
        // Arrange — a group can also hold range + date state; both must
        // be removed (not just zeroed) so the URL drops their params.
        const state = makeState({
            ranges: { price: { min: '5000', max: '20000' }, other: { min: '1', max: '2' } },
            dates: { stay: { from: '2026-01-01', to: '2026-01-05' } }
        });

        // Act
        const cleared = filterReducer(state, {
            type: 'CLEAR_GROUP',
            groupId: 'price'
        });

        // Assert — the `price` range is gone, sibling range stays, dates
        // for the same id are dropped.
        expect(cleared.ranges.price).toBeUndefined();
        expect(cleared.ranges.other).toEqual({ min: '1', max: '2' });
        expect(cleared.dates.stay).toEqual({ from: '2026-01-01', to: '2026-01-05' });
    });

    it('is a no-op for keys not provided when extraToggleKeys is omitted', () => {
        // Arrange — when the consumer calls CLEAR_GROUP without
        // `extraToggleKeys` (the common case for groups without priority
        // chips), only the standard group-scoped toggles flip; priority-
        // shortcut toggles are left as-is.
        const state = makeState({
            toggles: { hasWifi: true, hasPool: true },
            selections: { type: ['hotel'] }
        });

        // Act — clear the `type` group (no priority chips).
        const next = filterReducer(state, {
            type: 'CLEAR_GROUP',
            groupId: 'type'
        });

        // Assert
        expect(next.toggles.hasWifi).toBe(true);
        expect(next.toggles.hasPool).toBe(true);
        expect(next.selections.type).toEqual([]);
    });
});
