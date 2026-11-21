/**
 * @file dashboard-stat-state.test.ts
 * @description Regression tests for HOS-2424: a stat whose read failed must say
 * "not available", never a fabricated 0.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    markStatsUnavailable,
    resolveHostStatValues,
    STAT_LOADING_CLASS,
    STAT_UNAVAILABLE_CLASS,
    setStatValue
} from '../../src/lib/dashboard-stat-state';

function mountStat(id: string): HTMLElement {
    const el = document.createElement('p');
    el.id = id;
    el.className = `account__stat-value ${STAT_LOADING_CLASS}`;
    el.setAttribute('data-label-unavailable', 'No disponible');
    el.textContent = '—';
    document.body.appendChild(el);
    return el;
}

describe('dashboard stat DOM state (HOS-2424)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('shows "not available" instead of 0 when a stat fails', () => {
        const el = mountStat('stat-properties');
        markStatsUnavailable({ ids: ['stat-properties'] });
        expect(el.textContent).toBe('No disponible');
        expect(el.textContent).not.toBe('0');
        expect(el.classList.contains(STAT_UNAVAILABLE_CLASS)).toBe(true);
        expect(el.classList.contains(STAT_LOADING_CLASS)).toBe(false);
    });

    it('keeps a real value that arrived when onlyIfLoading is set', () => {
        const el = mountStat('stat-favorites');
        setStatValue({ id: 'stat-favorites', value: '3' });
        markStatsUnavailable({ ids: ['stat-favorites'], onlyIfLoading: true });
        expect(el.textContent).toBe('3');
    });

    it('renders a genuine 0 as 0 (a real zero is not "unavailable")', () => {
        const el = mountStat('stat-listings');
        setStatValue({ id: 'stat-listings', value: '0' });
        expect(el.textContent).toBe('0');
        expect(el.classList.contains(STAT_UNAVAILABLE_CLASS)).toBe(false);
    });

    it('ignores ids that are not in the DOM', () => {
        expect(() => markStatsUnavailable({ ids: ['nope'] })).not.toThrow();
    });
});

describe('resolveHostStatValues (HOS-2424)', () => {
    it('returns the real numbers, including a published listing', () => {
        expect(
            resolveHostStatValues({
                data: { properties: { total: 1 }, unreadConversations: 2, unavailable: [] }
            })
        ).toEqual({ properties: 1, messages: 2 });
    });

    it('returns null for sections the API flagged as a failure fallback', () => {
        expect(
            resolveHostStatValues({
                data: {
                    properties: { total: 0 },
                    unreadConversations: 0,
                    unavailable: ['properties']
                }
            })
        ).toEqual({ properties: null, messages: 0 });
    });

    it('returns null for values missing from the payload instead of defaulting to 0', () => {
        expect(resolveHostStatValues({ data: undefined })).toEqual({
            properties: null,
            messages: null
        });
    });
});

describe('dashboard page wiring (HOS-2424)', () => {
    const src = readFileSync(
        resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro'),
        'utf8'
    );

    it('no longer defaults host counters to 0 with `?? 0`', () => {
        expect(src).not.toContain('?.total ?? 0');
        expect(src).not.toContain('unreadConversations ?? 0');
    });

    it('marks failed stats unavailable instead of only clearing the shimmer', () => {
        expect(src).not.toContain('clearLoadingState');
        expect(src).toContain('markStatsUnavailable');
    });
});
