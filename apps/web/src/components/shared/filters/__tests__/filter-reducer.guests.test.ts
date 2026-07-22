/**
 * @file filter-reducer.guests.test.ts
 * @description Regression tests for the sidebar guest-count leak (BETA-161
 * round 2). The `adults`/`children` steppers use `emitWhenAtDefault: true`
 * so a genuinely-set value survives across unrelated filter changes — but a
 * pristine load (no `adults`/`children` in the incoming URL, per the
 * listing/type/map pages' conditional `initialParams` seeding) must NOT
 * have those steppers pre-populated in reducer state, otherwise the first
 * unrelated action (sort, toggle, ...) re-emits `adults`/`children` into the
 * URL as an unasserted filter.
 */

import { describe, expect, it } from 'vitest';
import { buildParamsFromState, filterReducer, initStateFromParams } from '../filter-reducer';
import type { FilterGroup } from '../filter-types/filter.types';

/** Minimal fixture mirroring the accommodations sidebar's guest steppers. */
const filters: readonly FilterGroup[] = [
    { id: 'isFeatured', label: 'Featured', type: 'toggle' },
    {
        id: 'adults',
        label: 'Adultos',
        type: 'stepper',
        min: 1,
        max: 10,
        defaultValue: 1,
        emitWhenAtDefault: true
    },
    {
        id: 'children',
        label: 'Niños',
        type: 'stepper',
        min: 0,
        max: 6,
        defaultValue: 0,
        emitWhenAtDefault: true
    }
];

describe('filter-reducer — guest stepper pristine-load leak (BETA-161)', () => {
    it('does not emit adults/children after an unrelated action on a pristine load', () => {
        // Mirrors index.astro's initialParams for a URL with no adults/children —
        // the conditional seeding means those keys are simply absent here.
        const initialState = initStateFromParams({
            filters,
            defaultSort: 'relevance',
            params: { sortBy: 'relevance' }
        });

        expect(initialState.steppers.adults).toBeUndefined();
        expect(initialState.steppers.children).toBeUndefined();

        // A non-guest action — toggling an unrelated filter.
        const nextState = filterReducer(initialState, {
            type: 'SET_TOGGLE',
            groupId: 'isFeatured',
            value: true
        });

        const params = buildParamsFromState({ state: nextState, filters });

        expect(params.has('adults')).toBe(false);
        expect(params.has('children')).toBe(false);
    });

    it('preserves an adults value that was genuinely seeded from a URL param', () => {
        // Mirrors index.astro's initialParams when the URL DID carry ?adults=3.
        const initialState = initStateFromParams({
            filters,
            defaultSort: 'relevance',
            params: { sortBy: 'relevance', adults: '3' }
        });

        expect(initialState.steppers.adults).toBe(3);

        const nextState = filterReducer(initialState, {
            type: 'SET_TOGGLE',
            groupId: 'isFeatured',
            value: true
        });

        const params = buildParamsFromState({ state: nextState, filters });

        expect(params.get('adults')).toBe('3');
    });
});
