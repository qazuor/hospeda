/**
 * HOS-139 T-002 — `r_poi_category` join table schema tests.
 *
 * Verifies the Drizzle schema definition for the POI-to-category join table
 * (M2M, HOS-139 §6.2):
 *   (1) Exactly 3 columns exist (`point_of_interest_id`, `category_id`,
 *       `is_primary`).
 *   (2) All columns are NOT NULL; `is_primary` defaults to `false`.
 *   (3) Both FK columns carry references with CASCADE on delete.
 *   (4) A composite primary key exists covering both FK columns.
 *   (5) A composite index and a reverse `category_id` index exist.
 *   (6) A partial unique index on `point_of_interest_id` (WHERE
 *       `is_primary = true`) enforces the single-primary-per-POI invariant.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 *
 * Reference: HOS-139 spec.md §6.2, §9 AC-1.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertRPoiCategory,
    rPoiCategory,
    type SelectRPoiCategory
} from '../../../src/schemas/destination/r_poi_category.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(rPoiCategory);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('r_poi_category table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(rPoiCategory);
        expect(name).toBe('r_poi_category');
    });

    it('has exactly 3 columns', () => {
        const { columns } = getTableConfig(rPoiCategory);
        expect(columns).toHaveLength(3);
        const sqlNames = columns.map((c) => c.name);
        expect(sqlNames).toContain('point_of_interest_id');
        expect(sqlNames).toContain('category_id');
        expect(sqlNames).toContain('is_primary');
    });
});

// ─── Column constraints ──────────────────────────────────────────────────────

describe('r_poi_category column constraints', () => {
    it('point_of_interest_id is NOT NULL', () => {
        const config = getColumnConfig('point_of_interest_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('category_id is NOT NULL', () => {
        const config = getColumnConfig('category_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('is_primary is NOT NULL boolean defaulting to false', () => {
        const config = getColumnConfig('is_primary');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(false);
    });
});

// ─── Foreign keys with CASCADE ───────────────────────────────────────────────

describe('r_poi_category foreign keys', () => {
    it('point_of_interest_id FK uses onDelete: cascade', () => {
        const { foreignKeys } = getTableConfig(rPoiCategory);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'point_of_interest_id')
        );
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });

    it('category_id FK uses onDelete: cascade', () => {
        const { foreignKeys } = getTableConfig(rPoiCategory);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'category_id')
        );
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });
});

// ─── Composite primary key ───────────────────────────────────────────────────

describe('r_poi_category composite primary key', () => {
    it('has exactly one composite PK constraint', () => {
        const { primaryKeys } = getTableConfig(rPoiCategory);
        expect(primaryKeys).toHaveLength(1);
    });

    it('composite PK covers point_of_interest_id and category_id', () => {
        const { primaryKeys } = getTableConfig(rPoiCategory);
        const [pk] = primaryKeys;
        const pkColumnNames = pk?.columns.map((c) => c.name) ?? [];
        expect(pkColumnNames).toContain('point_of_interest_id');
        expect(pkColumnNames).toContain('category_id');
        expect(pkColumnNames).toHaveLength(2);
    });
});

// ─── Indexes ────────────────────────────────────────────────────────────────

describe('r_poi_category indexes', () => {
    it('has a composite index on (point_of_interest_id, category_id)', () => {
        const { indexes } = getTableConfig(rPoiCategory);
        const idx = indexes.find((i) => i.config.name === 'pointOfInterestId_categoryId_idx');
        expect(idx).toBeDefined();
        const colNames = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(colNames).toContain('point_of_interest_id');
        expect(colNames).toContain('category_id');
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a reverse index on category_id alone', () => {
        const { indexes } = getTableConfig(rPoiCategory);
        const idx = indexes.find((i) => i.config.name === 'r_poi_category_categoryId_idx');
        expect(idx).toBeDefined();
        const colNames = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(colNames).toEqual(['category_id']);
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a partial unique index enforcing at most one primary per POI', () => {
        const { indexes } = getTableConfig(rPoiCategory);
        const idx = indexes.find((i) => i.config.name === 'r_poi_category_primary_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBe(true);

        const colNames = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(colNames).toEqual(['point_of_interest_id']);

        // The partial predicate must exist and reference is_primary.
        expect(idx?.config.where).toBeDefined();
        const whereSql = JSON.stringify(idx?.config.where);
        expect(whereSql).toContain('is_primary');
    });

    it('has exactly 3 named indexes', () => {
        const { indexes } = getTableConfig(rPoiCategory);
        expect(indexes).toHaveLength(3);
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('r_poi_category type inference', () => {
    it('InsertRPoiCategory requires pointOfInterestId and categoryId; isPrimary optional', () => {
        const minimal: InsertRPoiCategory = {
            pointOfInterestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            categoryId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        };

        expect(minimal.pointOfInterestId).toBeDefined();
        expect(minimal.categoryId).toBeDefined();

        const withPrimary: InsertRPoiCategory = {
            ...minimal,
            isPrimary: true
        };
        expect(withPrimary.isPrimary).toBe(true);
    });

    it('SelectRPoiCategory has pointOfInterestId, categoryId and isPrimary properties', () => {
        const _typeCheck = (_row: SelectRPoiCategory): void => {
            const _pointOfInterestId: string = _row.pointOfInterestId;
            const _categoryId: string = _row.categoryId;
            const _isPrimary: boolean = _row.isPrimary;

            void [_pointOfInterestId, _categoryId, _isPrimary];
        };

        expect(typeof _typeCheck).toBe('function');
    });

    it('SelectRPoiCategory SQL column names match schema column definitions', () => {
        const { columns } = getTableConfig(rPoiCategory);
        const sqlNames = new Set(columns.map((c) => c.name));

        expect(sqlNames.has('point_of_interest_id')).toBe(true);
        expect(sqlNames.has('category_id')).toBe(true);
        expect(sqlNames.has('is_primary')).toBe(true);
    });
});
