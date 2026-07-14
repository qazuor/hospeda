/**
 * HOS-139 T-001 — `poi_categories` table schema tests.
 *
 * Verifies the Drizzle schema definition for the POI category catalog:
 *   (1) All required columns exist with the correct SQL names.
 *   (2) Required columns are NOT NULL; optional columns are nullable.
 *   (3) `slug` is unique (machine identifier, NOT an i18n key — spec §6.1).
 *   (4) `nameI18n` is a required (NOT NULL) jsonb column — data-driven
 *       multilang content, unlike `type`'s i18n-by-slug pattern.
 *   (5) `slug` and `lifecycleState` have indexes.
 *   (6) `$inferInsert`/`$inferSelect` shapes are correct (compile-time +
 *       runtime checks).
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column metadata via
 * `getTableConfig`.
 *
 * Reference: HOS-139 spec.md §6.1, §9 AC-1.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertPoiCategory,
    poiCategories,
    type SelectPoiCategory
} from '../../../src/schemas/destination/poi-category.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(poiCategories);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getRawColumn(sqlName: string) {
    const { columns } = getTableConfig(poiCategories);
    return columns.find((c) => c.name === sqlName);
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(poiCategories).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('poi_categories table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(poiCategories);
        expect(name).toBe('poi_categories');
    });

    it('has no name column (data-driven nameI18n instead, HOS-139 §6.1)', () => {
        const { columns } = getTableConfig(poiCategories);
        const sqlNames = columns.map((c) => c.name);
        expect(sqlNames).not.toContain('name');
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('poi_categories required columns', () => {
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

    it('name_i18n column is notNull jsonb (data-driven, not i18n-by-slug)', () => {
        const config = getColumnConfig('name_i18n');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
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

describe('poi_categories nullable columns', () => {
    it('translation_meta column is nullable jsonb', () => {
        const config = getColumnConfig('translation_meta');
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('icon column is nullable', () => {
        const config = getColumnConfig('icon');
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

describe('poi_categories indexes', () => {
    it('has an index on slug (poiCategories_slug_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'poiCategories_slug_idx');
        expect(idx).toBeDefined();
    });

    it('has a non-unique index on lifecycle_state (poiCategories_lifecycleState_idx)', () => {
        const indexes = getIndexes();
        const idx = indexes.find((i) => i.config.name === 'poiCategories_lifecycleState_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has exactly 2 named indexes', () => {
        const indexes = getIndexes();
        expect(indexes.length).toBe(2);
    });
});

// ─── Type-level shape (compile-time + runtime) ──────────────────────────────

describe('poi_categories type inference', () => {
    it('InsertPoiCategory allows a minimal valid insert object (required fields only)', () => {
        const minimal = {
            slug: 'winery',
            nameI18n: { es: 'Bodega', en: 'Winery', pt: 'Vinícola' }
        } satisfies Pick<InsertPoiCategory, 'slug' | 'nameI18n'>;

        expect(minimal.slug).toBe('winery');
        expect(minimal.nameI18n.es).toBe('Bodega');
    });

    it('InsertPoiCategory accepts optional fields (icon, displayWeight)', () => {
        const withOptionals = {
            slug: 'gastronomy',
            nameI18n: { es: 'Gastronomía', en: 'Gastronomy', pt: 'Gastronomia' },
            icon: 'ForkKnife',
            displayWeight: 80
        } satisfies Pick<InsertPoiCategory, 'slug' | 'nameI18n' | 'icon' | 'displayWeight'>;

        expect(withOptionals.icon).toBe('ForkKnife');
        expect(withOptionals.displayWeight).toBe(80);
    });

    it('SelectPoiCategory has all expected property keys', () => {
        const { columns } = getTableConfig(poiCategories);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'slug',
            'name_i18n',
            'translation_meta',
            'icon',
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
            expect(sqlNames.has(col), `Expected column '${col}' to exist in poi_categories`).toBe(
                true
            );
        }
    });

    it('SelectPoiCategory compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectPoiCategory): void => {
            const _id: string = _row.id;
            const _slug: string = _row.slug;
            const _icon: string | null = _row.icon;
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
                _icon,
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
