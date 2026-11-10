// @vitest-environment jsdom
/**
 * @file venue.columns.test.ts
 * Unit tests for the venue column factory (SPEC-239 T-059).
 *
 * Covers:
 *  - Column IDs produced by the factory
 *  - Column count
 *  - `name` column is sortable and links to view page
 *  - `type` column uses BADGE renderer
 *  - `priceRange` column uses BADGE renderer
 *  - `createdAt` column uses TIME_AGO type
 *  - `actions` column includes a widget renderer
 *  - Badge options for type include all VenueTypeEnum values
 *  - Badge options for priceRange include all PriceRangeEnum values
 */

import { PublicationStatusEnum, VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ColumnType } from '@/components/table/DataTable';
import { createVenueColumns } from '../config/venue.columns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createVenueColumns — structure', () => {
    it('should return at least 7 columns', () => {
        const columns = createVenueColumns(t);
        expect(columns.length).toBeGreaterThanOrEqual(7);
    });

    it('should include a "name" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'name')).toBeDefined();
    });

    it('should include a "type" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'type')).toBeDefined();
    });

    it('should include a "priceRange" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'priceRange')).toBeDefined();
    });

    it('should include a "destination" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'destination')).toBeDefined();
    });

    it('should NOT include an "isFeatured" column (column dropped, HOS-1419)', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'isFeatured')).toBeUndefined();
    });

    it('should include a read-only "featuredByEntitlement" column (the only featuring source)', () => {
        const columns = createVenueColumns(t);
        const featured = columns.find((c) => c.id === 'featuredByEntitlement');
        expect(featured?.accessorKey).toBe('featuredByEntitlement');
    });

    it('should include a "createdAt" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'createdAt')).toBeDefined();
    });

    it('should include an "actions" column', () => {
        const columns = createVenueColumns(t);
        expect(columns.find((c) => c.id === 'actions')).toBeDefined();
    });
});

describe('createVenueColumns — column details', () => {
    it('name column should be sortable', () => {
        const columns = createVenueColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.enableSorting).toBe(true);
    });

    it('name column should have a linkHandler', () => {
        const columns = createVenueColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.linkHandler).toBeDefined();
    });

    it('name linkHandler should resolve to venues/$id', () => {
        const columns = createVenueColumns(t);
        const name = columns.find((c) => c.id === 'name');
        const link = name?.linkHandler?.({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Test',
            type: VenueTypeEnum.RESTAURANT,
            destinationId: 'dest-1',
            ownerId: 'owner-1',
            featuredByEntitlement: false,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            createdAt: new Date()
        });
        expect(link).toMatchObject({
            to: '/venues/$id',
            params: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
        });
    });

    it('type column should use BADGE columnType', () => {
        const columns = createVenueColumns(t);
        const type = columns.find((c) => c.id === 'type');
        expect(type?.columnType).toBe(ColumnType.BADGE);
    });

    it('priceRange column should use BADGE columnType', () => {
        const columns = createVenueColumns(t);
        const priceRange = columns.find((c) => c.id === 'priceRange');
        expect(priceRange?.columnType).toBe(ColumnType.BADGE);
    });

    it('createdAt column should use TIME_AGO type', () => {
        const columns = createVenueColumns(t);
        const createdAt = columns.find((c) => c.id === 'createdAt');
        expect(createdAt?.columnType).toBe(ColumnType.TIME_AGO);
    });

    it('actions column should have a widgetRenderer', () => {
        const columns = createVenueColumns(t);
        const actions = columns.find((c) => c.id === 'actions');
        expect(actions?.widgetRenderer).toBeDefined();
    });

    it('type column badge options should include all VenueTypeEnum values', () => {
        const columns = createVenueColumns(t);
        const type = columns.find((c) => c.id === 'type');
        const values = (type?.badgeOptions ?? []).map((o) => o.value);
        const expected = Object.values(VenueTypeEnum);
        expect(values).toHaveLength(expected.length);
        expect(new Set(values)).toEqual(new Set(expected));
    });

    it('priceRange column badge options should include all PriceRangeEnum values', () => {
        const columns = createVenueColumns(t);
        const priceRange = columns.find((c) => c.id === 'priceRange');
        const values = (priceRange?.badgeOptions ?? []).map((o) => o.value);
        expect(values).toContain('BUDGET');
        expect(values).toContain('MID');
        expect(values).toContain('HIGH');
        expect(values).toContain('PREMIUM');
    });
});

describe('createVenueColumns — business lines (HOS-1873)', () => {
    it('includes a businessLines WIDGET column after type', () => {
        const columns = createVenueColumns(t);
        const ids = columns.map((c) => c.id);
        expect(ids).toContain('businessLines');
        expect(ids.indexOf('businessLines')).toBe(ids.indexOf('type') + 1);

        const column = columns.find((c) => c.id === 'businessLines');
        expect(column?.columnType).toBe(ColumnType.WIDGET);
    });

    it('renders the line labels separated by a comma', () => {
        const columns = createVenueColumns(t);
        const column = columns.find((c) => c.id === 'businessLines');
        const rendered = column?.widgetRenderer?.({
            businessLines: ['food', 'nightlife']
        } as never);

        expect(rendered).toBe(
            'venue.owner.businessLines.food.label, venue.owner.businessLines.nightlife.label'
        );
    });
});
