/**
 * @file alojamientos-empty-state.test.ts
 * @description Source-read regression tests for the accommodations listing empty states.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro'),
    'utf8'
);

describe('alojamientos/index.astro empty states', () => {
    it('derives whether the listing is filtered before choosing the empty-state variant', () => {
        expect(src).toContain('hasActiveAccommodationEmptyStateFilters');
        expect(src).toContain('const hasActiveFilters = hasActiveAccommodationEmptyStateFilters({');
    });

    it('renders the no-results state only when filters are active', () => {
        expect(src).toContain('{!hasError && cards.length === 0 && hasActiveFilters && (');
        expect(src).toContain('variant="no-results"');
        expect(src).toContain('activeFilters={activeFilterChips}');
        expect(src).toContain('suggestions={emptyStateSuggestions}');
    });

    it('renders a distinct empty-catalog state when there are no active filters', () => {
        expect(src).toContain('{!hasError && cards.length === 0 && !hasActiveFilters && (');
        expect(src).toContain('variant="empty"');
        expect(src).toContain('accommodations.emptyMessage');
    });
});
