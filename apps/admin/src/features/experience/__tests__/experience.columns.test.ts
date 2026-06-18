// @vitest-environment jsdom
/**
 * @file experience.columns.test.ts
 * Unit tests for the experience column factory (SPEC-240 T-031).
 *
 * Covers:
 *  - Column IDs produced by the factory
 *  - Column count
 *  - `name` column is sortable and links to view page
 *  - `type` column uses BADGE renderer
 *  - `createdAt` column uses TIME_AGO type
 *  - `actions` column includes a widget renderer
 *  - Badge options for type include all ExperienceTypeEnum values
 */

import { ColumnType } from '@/components/table/DataTable';
import { ExperienceTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createExperienceColumns } from '../config/experience.columns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createExperienceColumns — structure', () => {
    it('should return at least 6 columns', () => {
        const columns = createExperienceColumns(t);
        expect(columns.length).toBeGreaterThanOrEqual(6);
    });

    it('should include a "name" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'name')).toBeDefined();
    });

    it('should include a "type" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'type')).toBeDefined();
    });

    it('should include a "destination" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'destination')).toBeDefined();
    });

    it('should include a "isFeatured" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'isFeatured')).toBeDefined();
    });

    it('should include a "createdAt" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'createdAt')).toBeDefined();
    });

    it('should include an "actions" column', () => {
        const columns = createExperienceColumns(t);
        expect(columns.find((c) => c.id === 'actions')).toBeDefined();
    });
});

describe('createExperienceColumns — column details', () => {
    it('name column should be sortable', () => {
        const columns = createExperienceColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.enableSorting).toBe(true);
    });

    it('name column should have a linkHandler', () => {
        const columns = createExperienceColumns(t);
        const name = columns.find((c) => c.id === 'name');
        expect(name?.linkHandler).toBeDefined();
    });

    it('name linkHandler should resolve to experiences/$id', () => {
        const columns = createExperienceColumns(t);
        const name = columns.find((c) => c.id === 'name');
        const link = name?.linkHandler?.({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Paseo en kayak',
            type: ExperienceTypeEnum.KAYAK_RENTAL,
            destinationId: 'dest-1',
            isFeatured: false,
            ownerId: 'owner-1',
            createdAt: new Date()
        });
        expect(link).toMatchObject({
            to: '/experiences/$id',
            params: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
        });
    });

    it('name linkHandler should return undefined when id is missing', () => {
        const columns = createExperienceColumns(t);
        const name = columns.find((c) => c.id === 'name');
        const link = name?.linkHandler?.({
            id: undefined as unknown as string,
            name: 'No ID',
            type: ExperienceTypeEnum.OTHER,
            destinationId: 'dest-1',
            isFeatured: false,
            ownerId: null as unknown as string,
            createdAt: new Date()
        });
        expect(link).toBeUndefined();
    });

    it('type column should use BADGE columnType', () => {
        const columns = createExperienceColumns(t);
        const type = columns.find((c) => c.id === 'type');
        expect(type?.columnType).toBe(ColumnType.BADGE);
    });

    it('createdAt column should use TIME_AGO type', () => {
        const columns = createExperienceColumns(t);
        const createdAt = columns.find((c) => c.id === 'createdAt');
        expect(createdAt?.columnType).toBe(ColumnType.TIME_AGO);
    });

    it('actions column should have a widgetRenderer', () => {
        const columns = createExperienceColumns(t);
        const actions = columns.find((c) => c.id === 'actions');
        expect(actions?.widgetRenderer).toBeDefined();
    });

    it('type column badge options should include all ExperienceTypeEnum values', () => {
        const columns = createExperienceColumns(t);
        const type = columns.find((c) => c.id === 'type');
        const values = (type?.badgeOptions ?? []).map((o) => o.value);
        const EXPECTED = Object.values(ExperienceTypeEnum);
        for (const v of EXPECTED) {
            expect(values).toContain(v);
        }
    });
});
