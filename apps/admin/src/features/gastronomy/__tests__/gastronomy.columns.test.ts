// @vitest-environment jsdom
/**
 * @file gastronomy.columns.test.ts
 * Unit tests for the gastronomy column factory (SPEC-239 T-059).
 *
 * Covers:
 *  - Column IDs produced by the factory
 *  - Column count
 *  - `name` column is sortable and links to view page
 *  - `type` column uses BADGE renderer
 *  - `priceRange` column uses BADGE renderer
 *  - `createdAt` column uses TIME_AGO type
 *  - `actions` column includes a widget renderer
 *  - Badge options for type include all GastronomyTypeEnum values
 *  - Badge options for priceRange include all PriceRangeEnum values
 */

import { ColumnType } from '@/components/table/DataTable';
import { GastronomyTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createGastronomyColumns } from '../config/gastronomy.columns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGastronomyColumns — structure', () => {
    it('should return at least 7 columns', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.length).toBeGreaterThanOrEqual(7);
    });

    it('should include a "name" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'name')).toBeDefined();
    });

    it('should include a "type" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'type')).toBeDefined();
    });

    it('should include a "priceRange" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'priceRange')).toBeDefined();
    });

    it('should include a "destination" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'destination')).toBeDefined();
    });

    it('should include a "isFeatured" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'isFeatured')).toBeDefined();
    });

    it('should include a "createdAt" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'createdAt')).toBeDefined();
    });

    it('should include an "actions" column', () => {
        const columns = createGastronomyColumns(t);
        expect(columns.find((c) => c.id === 'actions')).toBeDefined();
    });
});

describe('createGastronomyColumns — column details', () => {
    it('name column should be sortable', () => {
        const columns = createGastronomyColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.enableSorting).toBe(true);
    });

    it('name column should have a linkHandler', () => {
        const columns = createGastronomyColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.linkHandler).toBeDefined();
    });

    it('name linkHandler should resolve to gastronomies/$id', () => {
        const columns = createGastronomyColumns(t);
        const name = columns.find((c) => c.id === 'name');
        const link = name?.linkHandler?.({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Test',
            type: GastronomyTypeEnum.RESTAURANT,
            destinationId: 'dest-1',
            isFeatured: false,
            ownerId: 'owner-1',
            createdAt: new Date()
        });
        expect(link).toMatchObject({
            to: '/gastronomies/$id',
            params: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
        });
    });

    it('type column should use BADGE columnType', () => {
        const columns = createGastronomyColumns(t);
        const type = columns.find((c) => c.id === 'type');
        expect(type?.columnType).toBe(ColumnType.BADGE);
    });

    it('priceRange column should use BADGE columnType', () => {
        const columns = createGastronomyColumns(t);
        const priceRange = columns.find((c) => c.id === 'priceRange');
        expect(priceRange?.columnType).toBe(ColumnType.BADGE);
    });

    it('createdAt column should use TIME_AGO type', () => {
        const columns = createGastronomyColumns(t);
        const createdAt = columns.find((c) => c.id === 'createdAt');
        expect(createdAt?.columnType).toBe(ColumnType.TIME_AGO);
    });

    it('actions column should have a widgetRenderer', () => {
        const columns = createGastronomyColumns(t);
        const actions = columns.find((c) => c.id === 'actions');
        expect(actions?.widgetRenderer).toBeDefined();
    });

    it('type column badge options should include all GastronomyTypeEnum values', () => {
        const columns = createGastronomyColumns(t);
        const type = columns.find((c) => c.id === 'type');
        const values = (type?.badgeOptions ?? []).map((o) => o.value);
        const EXPECTED = [
            'RESTAURANT',
            'BAR',
            'CAFE',
            'PARRILLA',
            'CERVECERIA',
            'HELADERIA',
            'PANADERIA',
            'ROTISERIA',
            'FOOD_TRUCK'
        ];
        for (const v of EXPECTED) {
            expect(values).toContain(v);
        }
    });

    it('priceRange column badge options should include all PriceRangeEnum values', () => {
        const columns = createGastronomyColumns(t);
        const priceRange = columns.find((c) => c.id === 'priceRange');
        const values = (priceRange?.badgeOptions ?? []).map((o) => o.value);
        expect(values).toContain('BUDGET');
        expect(values).toContain('MID');
        expect(values).toContain('HIGH');
        expect(values).toContain('PREMIUM');
    });
});
