/**
 * HOS-113 T-003 — `points_of_interest` table schema tests.
 *
 * Verifies the Drizzle schema definition for the Point of Interest catalog:
 *   (1) All required columns exist with the correct SQL names.
 *   (2) Required columns are NOT NULL; optional columns are nullable.
 *   (3) `slug` is unique (i18n key, HOS-113 OQ-2 — no `name` column).
 *   (4) `lat`/`long` are plain double-precision numeric columns (R-3).
 *   (5) `isFeatured`, `lifecycleState`, `type` have indexes.
 *   (6) `$inferInsert`/`$inferSelect` shapes are correct (compile-time +
 *       runtime checks).
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column metadata via
 * `getTableConfig`.
 *
 * Reference: HOS-113 spec.md §6.1, §9 AC-1.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertPointOfInterest,
    pointsOfInterest,
    type SelectPointOfInterest
} from '../../../src/schemas/destination/point-of-interest.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(pointsOfInterest);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getRawColumn(sqlName: string) {
    const { columns } = getTableConfig(pointsOfInterest);
    return columns.find((c) => c.name === sqlName);
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(pointsOfInterest).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('points_of_interest table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(pointsOfInterest);
        expect(name).toBe('points_of_interest');
    });

    it('has no name column (HOS-113 OQ-2 — i18n by slug)', () => {
        const { columns } = getTableConfig(pointsOfInterest);
        const sqlNames = columns.map((c) => c.name);
        expect(sqlNames).not.toContain('name');
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('points_of_interest required columns', () => {
    it('id column exists and is the primary key', () => {
        const col = getRawColumn('id');
        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('slug column is notNull text and unique', () => {
        const config = getColumnConfig('slug');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('string');
        expect(config?.isUnique).toBe(true);
    });

    it('lat column is notNull double precision (plain numeric, no JSONB/string)', () => {
        const config = getColumnConfig('lat');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('number');
        expect(config?.columnType).toBe('PgDoublePrecision');
    });

    it('long column is notNull double precision (plain numeric, no JSONB/string)', () => {
        const config = getColumnConfig('long');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('number');
        expect(config?.columnType).toBe('PgDoublePrecision');
    });

    it('type column is notNull enum', () => {
        const col = getRawColumn('type');
        expect(col).toBeDefined();
        expect(col?.config.notNull).toBe(true);
        expect(col?.enumValues).toEqual([
            'BEACH',
            'STADIUM',
            'PARK',
            'MUSEUM',
            'PLAZA',
            'MONUMENT',
            'VIEWPOINT',
            'NATURAL',
            'OTHER'
        ]);
    });

    it('is_builtin column is notNull boolean defaulting to false', () => {
        const config = getColumnConfig('is_builtin');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(false);
    });

    it('is_featured column is notNull boolean defaulting to false', () => {
        const config = getColumnConfig('is_featured');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(false);
    });

    it('display_weight column is notNull integer defaulting to 50', () => {
        const config = getColumnConfig('display_weight');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(50);
    });

    it('lifecycle_state column is notNull with default ACTIVE', () => {
        const config = getColumnConfig('lifecycle_state');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('ACTIVE');
    });

    it('created_at column is notNull timestamp', () => {
        const config = getColumnConfig('created_at');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('updated_at column is notNull timestamp', () => {
        const config = getColumnConfig('updated_at');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });
});

// ─── Optional (nullable) columns ────────────────────────────────────────────

describe('points_of_interest nullable columns', () => {
    it('icon column is nullable', () => {
        const config = getColumnConfig('icon');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('description column is nullable', () => {
        const config = getColumnConfig('description');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('created_by_id column is nullable', () => {
        const config = getColumnConfig('created_by_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('updated_by_id column is nullable', () => {
        const config = getColumnConfig('updated_by_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('deleted_at column is nullable', () => {
        const config = getColumnConfig('deleted_at');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('deleted_by_id column is nullable', () => {
        const config = getColumnConfig('deleted_by_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('admin_info column is nullable jsonb', () => {
        const config = getColumnConfig('admin_info');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });
});

// ─── Indexes ────────────────────────────────────────────────────────────────

describe('points_of_interest indexes', () => {
    it('has an index on slug (pointsOfInterest_slug_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'pointsOfInterest_slug_idx');
        expect(idx).toBeDefined();
    });

    it('has a non-unique index on is_featured (pointsOfInterest_isFeatured_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'pointsOfInterest_isFeatured_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on lifecycle_state (pointsOfInterest_lifecycleState_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'pointsOfInterest_lifecycleState_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on type (pointsOfInterest_type_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'pointsOfInterest_type_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has exactly 4 named indexes', () => {
        const indexes = getIndexes();
        expect(indexes.length).toBe(4);
    });
});

// ─── Type-level shape (compile-time + runtime) ──────────────────────────────

describe('points_of_interest type inference', () => {
    it('InsertPointOfInterest allows a minimal valid insert object (required fields only)', () => {
        const minimal = {
            slug: 'autodromo-cde-uruguay',
            lat: -32.4826,
            long: -58.2341,
            type: 'STADIUM'
        } satisfies Pick<InsertPointOfInterest, 'slug' | 'lat' | 'long' | 'type'>;

        expect(minimal.slug).toBe('autodromo-cde-uruguay');
        expect(minimal.lat).toBe(-32.4826);
        expect(minimal.long).toBe(-58.2341);
        expect(minimal.type).toBe('STADIUM');
    });

    it('InsertPointOfInterest accepts optional fields (icon, description)', () => {
        const withOptionals = {
            slug: 'playa-banco-pelay',
            lat: -32.47,
            long: -58.23,
            type: 'BEACH',
            icon: 'Waves',
            description: 'Playa sobre el río Uruguay'
        } satisfies Pick<
            InsertPointOfInterest,
            'slug' | 'lat' | 'long' | 'type' | 'icon' | 'description'
        >;

        expect(withOptionals.icon).toBe('Waves');
        expect(withOptionals.description).toBeDefined();
    });

    it('SelectPointOfInterest has all expected property keys', () => {
        const { columns } = getTableConfig(pointsOfInterest);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'slug',
            'lat',
            'long',
            'type',
            'icon',
            'description',
            'is_builtin',
            'is_featured',
            'display_weight',
            'lifecycle_state',
            'admin_info',
            'created_at',
            'updated_at',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ];

        for (const col of expectedSqlColumns) {
            expect(
                sqlNames.has(col),
                `Expected column '${col}' to exist in points_of_interest`
            ).toBe(true);
        }
    });

    it('SelectPointOfInterest compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectPointOfInterest): void => {
            const _id: string = _row.id;
            const _slug: string = _row.slug;
            const _lat: number = _row.lat;
            const _long: number = _row.long;
            const _type: string = _row.type;
            const _icon: string | null = _row.icon;
            const _description: string | null = _row.description;
            const _isBuiltin: boolean = _row.isBuiltin;
            const _isFeatured: boolean = _row.isFeatured;
            const _displayWeight: number = _row.displayWeight;
            const _lifecycleState: string = _row.lifecycleState;
            const _createdAt: Date = _row.createdAt;
            const _updatedAt: Date = _row.updatedAt;
            const _createdById: string | null = _row.createdById;
            const _updatedById: string | null = _row.updatedById;
            const _deletedAt: Date | null = _row.deletedAt;
            const _deletedById: string | null = _row.deletedById;

            void [
                _id,
                _slug,
                _lat,
                _long,
                _type,
                _icon,
                _description,
                _isBuiltin,
                _isFeatured,
                _displayWeight,
                _lifecycleState,
                _createdAt,
                _updatedAt,
                _createdById,
                _updatedById,
                _deletedAt,
                _deletedById
            ];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
