/**
 * @file events-filter-groups.test.ts
 * @description Unit tests for `buildEventsFilterGroups`'s date-preset wiring
 * (BETA-115): the `date` filter group must carry a `presets` array whose
 * bounds are resolved from the same `now` the caller passes in.
 */

import { describe, expect, it } from 'vitest';
import type { DateRangeFilterConfig } from '../../../src/components/shared/filters/filter-types/DateRangeFilter';
import { buildEventsFilterGroups } from '../../../src/lib/filters/events-filter-groups';

const t = (_key: string, fallback?: string) => fallback ?? _key;

// Wednesday 2026-07-15 — arbitrary but fixed reference instant.
const NOW = new Date(2026, 6, 15, 12, 0, 0);

/** Narrows the `date` group out of the built `FilterGroup[]`, asserting its shape. */
function getDateGroup(groups: ReturnType<typeof buildEventsFilterGroups>): DateRangeFilterConfig {
    const group = groups.find((g) => g.id === 'date');
    if (group?.type !== 'date-range') {
        throw new Error('Expected a `date-range` group with id "date"');
    }
    return group;
}

describe('buildEventsFilterGroups — date presets', () => {
    it('attaches a presets array to the `date` group', () => {
        const groups = buildEventsFilterGroups({ t, destinations: [], now: NOW });
        const dateGroup = getDateGroup(groups);

        expect(Array.isArray(dateGroup.presets)).toBe(true);
        expect(dateGroup.presets).toHaveLength(6);
    });

    it('resolves each preset value to the bounds computed from the given `now`', () => {
        const groups = buildEventsFilterGroups({ t, destinations: [], now: NOW });
        const presets = getDateGroup(groups).presets ?? [];

        expect(presets.map((p) => p.value)).toEqual([
            'all',
            'today',
            'week',
            'month',
            'next60',
            'past'
        ]);

        const today = presets.find((p) => p.value === 'today');
        expect(today).toEqual({
            value: 'today',
            label: 'Hoy',
            from: '2026-07-15',
            to: '2026-07-15'
        });

        const week = presets.find((p) => p.value === 'week');
        expect(week).toEqual({
            value: 'week',
            label: 'Esta semana',
            from: '2026-07-15',
            to: '2026-07-22'
        });

        const past = presets.find((p) => p.value === 'past');
        expect(past).toEqual({ value: 'past', label: 'Pasados', from: '', to: '2026-07-14' });

        const all = presets.find((p) => p.value === 'all');
        expect(all).toEqual({ value: 'all', label: 'Todos', from: '', to: '' });
    });

    it('defaults `now` to the real clock when omitted (still produces 6 presets)', () => {
        const groups = buildEventsFilterGroups({ t, destinations: [] });
        const presets = getDateGroup(groups).presets ?? [];

        expect(presets).toHaveLength(6);
    });

    it('still excludes the category group when excludeCategory is true', () => {
        const groups = buildEventsFilterGroups({
            t,
            destinations: [],
            excludeCategory: true,
            now: NOW
        });

        expect(groups.find((g) => g.id === 'category')).toBeUndefined();
        expect(groups.find((g) => g.id === 'date')).toBeDefined();
    });
});
