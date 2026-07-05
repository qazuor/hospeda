/**
 * @file event-date-presets.test.ts
 * @description Unit tests for the pure `when` → date-bounds helpers
 * (BETA-115). Pins a fixed `now` so every case is deterministic.
 */

import { describe, expect, it } from 'vitest';
import {
    computeEventDatePresetRange,
    computeWhenQueryBounds,
    EVENT_DATE_FILTER_VALUES,
    EVENT_DATE_PRESET_DEFS,
    resolveWhenAliasParams
} from '../../../src/lib/filters/event-date-presets';

// Wednesday 2026-07-15, mid-afternoon — arbitrary but fixed reference instant.
const NOW = new Date(2026, 6, 15, 14, 30, 0);

describe('computeWhenQueryBounds', () => {
    it('returns full-day ISO bounds for "today"', () => {
        const bounds = computeWhenQueryBounds({ when: 'today', now: NOW });

        expect(bounds.startDateAfter).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).toISOString());
        expect(bounds.startDateBefore).toBe(new Date(2026, 6, 15, 23, 59, 59, 999).toISOString());
    });

    it('returns [today, +7 days end-of-day] for "week"', () => {
        const bounds = computeWhenQueryBounds({ when: 'week', now: NOW });

        expect(bounds.startDateAfter).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).toISOString());
        expect(bounds.startDateBefore).toBe(new Date(2026, 6, 22, 23, 59, 59, 999).toISOString());
    });

    it('returns [today, +30 days end-of-day] for "month"', () => {
        const bounds = computeWhenQueryBounds({ when: 'month', now: NOW });

        expect(bounds.startDateAfter).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).toISOString());
        expect(bounds.startDateBefore).toBe(new Date(2026, 7, 14, 23, 59, 59, 999).toISOString());
    });

    it('returns [today, +60 days end-of-day] for "next60"', () => {
        const bounds = computeWhenQueryBounds({ when: 'next60', now: NOW });

        expect(bounds.startDateAfter).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).toISOString());
        expect(bounds.startDateBefore).toBe(new Date(2026, 8, 13, 23, 59, 59, 999).toISOString());
    });

    it('returns only an upper bound (start of today) for "past", no lower bound', () => {
        const bounds = computeWhenQueryBounds({ when: 'past', now: NOW });

        expect(bounds.startDateAfter).toBeUndefined();
        expect(bounds.startDateBefore).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).toISOString());
    });

    it('returns no bounds at all for "all"', () => {
        const bounds = computeWhenQueryBounds({ when: 'all', now: NOW });

        expect(bounds.startDateAfter).toBeUndefined();
        expect(bounds.startDateBefore).toBeUndefined();
    });

    it('defaults `now` to the real clock when omitted', () => {
        const bounds = computeWhenQueryBounds({ when: 'all' });

        expect(bounds.startDateAfter).toBeUndefined();
        expect(bounds.startDateBefore).toBeUndefined();
    });
});

describe('computeEventDatePresetRange', () => {
    it('resolves "today" to a same-day [from, to] pair', () => {
        const range = computeEventDatePresetRange({ when: 'today', now: NOW });

        expect(range).toEqual({ from: '2026-07-15', to: '2026-07-15' });
    });

    it('resolves "week" to [today, today+7 days]', () => {
        const range = computeEventDatePresetRange({ when: 'week', now: NOW });

        expect(range).toEqual({ from: '2026-07-15', to: '2026-07-22' });
    });

    it('resolves "month" to [today, today+30 days]', () => {
        const range = computeEventDatePresetRange({ when: 'month', now: NOW });

        expect(range).toEqual({ from: '2026-07-15', to: '2026-08-14' });
    });

    it('resolves "next60" to [today, today+60 days]', () => {
        const range = computeEventDatePresetRange({ when: 'next60', now: NOW });

        expect(range).toEqual({ from: '2026-07-15', to: '2026-09-13' });
    });

    it('resolves "past" to [empty, yesterday] — only an upper bound', () => {
        const range = computeEventDatePresetRange({ when: 'past', now: NOW });

        expect(range).toEqual({ from: '', to: '2026-07-14' });
    });

    it('resolves "all" to fully empty bounds (clears the filter)', () => {
        const range = computeEventDatePresetRange({ when: 'all', now: NOW });

        expect(range).toEqual({ from: '', to: '' });
    });

    it('rolls over month/year boundaries correctly (Dec 30 + 7 days)', () => {
        const yearEnd = new Date(2026, 11, 30, 9, 0, 0);
        const range = computeEventDatePresetRange({ when: 'week', now: yearEnd });

        expect(range).toEqual({ from: '2026-12-30', to: '2027-01-06' });
    });

    it('rolls "past" back across a month boundary (day 1 → last day of prior month)', () => {
        const firstOfMonth = new Date(2026, 6, 1, 9, 0, 0);
        const range = computeEventDatePresetRange({ when: 'past', now: firstOfMonth });

        expect(range).toEqual({ from: '', to: '2026-06-30' });
    });
});

describe('resolveWhenAliasParams', () => {
    it('resolves "today" to a same-day startDateAfter/startDateBefore pair', () => {
        const alias = resolveWhenAliasParams({ when: 'today', now: NOW, hasExplicitBounds: false });

        expect(alias).toEqual({ startDateAfter: '2026-07-15', startDateBefore: '2026-07-15' });
    });

    it('resolves "week" to [today, today+7 days]', () => {
        const alias = resolveWhenAliasParams({ when: 'week', now: NOW, hasExplicitBounds: false });

        expect(alias).toEqual({ startDateAfter: '2026-07-15', startDateBefore: '2026-07-22' });
    });

    it('resolves "month" to [today, today+30 days]', () => {
        const alias = resolveWhenAliasParams({ when: 'month', now: NOW, hasExplicitBounds: false });

        expect(alias).toEqual({ startDateAfter: '2026-07-15', startDateBefore: '2026-08-14' });
    });

    it('resolves "next60" to [today, today+60 days]', () => {
        const alias = resolveWhenAliasParams({
            when: 'next60',
            now: NOW,
            hasExplicitBounds: false
        });

        expect(alias).toEqual({ startDateAfter: '2026-07-15', startDateBefore: '2026-09-13' });
    });

    it('resolves "past" to only an upper bound (yesterday), no startDateAfter key at all', () => {
        const alias = resolveWhenAliasParams({ when: 'past', now: NOW, hasExplicitBounds: false });

        expect(alias).toEqual({ startDateBefore: '2026-07-14' });
        expect(alias).not.toHaveProperty('startDateAfter');
    });

    it('returns an empty object for "all" even when there are no explicit bounds', () => {
        const alias = resolveWhenAliasParams({ when: 'all', now: NOW, hasExplicitBounds: false });

        expect(alias).toEqual({});
    });

    it('returns an empty object (no override) when the sidebar already has explicit bounds', () => {
        const alias = resolveWhenAliasParams({ when: 'today', now: NOW, hasExplicitBounds: true });

        expect(alias).toEqual({});
    });

    it('returns an empty object when both "all" and hasExplicitBounds=true apply together', () => {
        const alias = resolveWhenAliasParams({ when: 'all', now: NOW, hasExplicitBounds: true });

        expect(alias).toEqual({});
    });

    it('defaults `now` to the real clock when omitted', () => {
        const alias = resolveWhenAliasParams({ when: 'all', hasExplicitBounds: false });

        expect(alias).toEqual({});
    });
});

describe('EVENT_DATE_FILTER_VALUES', () => {
    it('lists exactly the 5 non-default `when` values (excludes "all")', () => {
        expect(EVENT_DATE_FILTER_VALUES).toEqual(['today', 'week', 'month', 'next60', 'past']);
    });
});

describe('EVENT_DATE_PRESET_DEFS', () => {
    it('is ordered Todos, Hoy, Esta semana, Este mes, Próximos 60 días, Pasados', () => {
        expect(EVENT_DATE_PRESET_DEFS.map((d) => d.value)).toEqual([
            'all',
            'today',
            'week',
            'month',
            'next60',
            'past'
        ]);
    });

    it('reuses the same i18n keys the retired EventDateFilterChips chip row used', () => {
        expect(EVENT_DATE_PRESET_DEFS.map((d) => d.i18nKey)).toEqual([
            'events.dateFilters.all',
            'events.dateFilters.today',
            'events.dateFilters.week',
            'events.dateFilters.month',
            'events.dateFilters.next60',
            'events.dateFilters.past'
        ]);
    });
});
