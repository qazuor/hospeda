/**
 * HOS-919 T-004 — `host_trade_category_groups` table schema tests.
 *
 * In-process schema tests (no PostgreSQL needed): they inspect Drizzle
 * metadata via `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    hostTradeCategoryGroups,
    type InsertHostTradeCategoryGroup,
    type SelectHostTradeCategoryGroup
} from '../../../src/schemas/host-trade/host-trade-category-group.dbschema.ts';

function getColumn(sqlName: string) {
    return getTableConfig(hostTradeCategoryGroups).columns.find((c) => c.name === sqlName);
}

describe('host_trade_category_groups table', () => {
    it('has the correct SQL table name', () => {
        expect(getTableConfig(hostTradeCategoryGroups).name).toBe('host_trade_category_groups');
    });

    it('has every expected column', () => {
        const names = getTableConfig(hostTradeCategoryGroups).columns.map((c) => c.name);
        for (const expected of [
            'id',
            'slug',
            'name_i18n',
            'translation_meta',
            'display_weight',
            'lifecycle_state',
            'admin_info',
            'created_at',
            'updated_at',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ]) {
            expect(names, `column ${expected}`).toContain(expected);
        }
    });

    it('has no name column (data-driven name_i18n instead)', () => {
        const names = getTableConfig(hostTradeCategoryGroups).columns.map((c) => c.name);
        expect(names).not.toContain('name');
    });

    it('id is the primary key', () => {
        expect(getColumn('id')?.primary).toBe(true);
    });

    it('slug is a NOT NULL unique text column', () => {
        const slug = getColumn('slug');
        expect(slug?.notNull).toBe(true);
        expect(slug?.dataType).toBe('string');
        expect(slug?.isUnique).toBe(true);
    });

    it('name_i18n is NOT NULL jsonb', () => {
        const col = getColumn('name_i18n');
        expect(col?.notNull).toBe(true);
        expect(col?.columnType).toBe('PgJsonb');
    });

    it('translation_meta is nullable jsonb defaulting to {}', () => {
        const col = getColumn('translation_meta');
        expect(col?.notNull).toBe(false);
        expect(col?.default).toEqual({});
    });

    it('display_weight is NOT NULL integer defaulting to 50', () => {
        const col = getColumn('display_weight');
        expect(col?.notNull).toBe(true);
        expect(col?.default).toBe(50);
    });

    it('lifecycle_state is NOT NULL defaulting to ACTIVE', () => {
        const col = getColumn('lifecycle_state');
        expect(col?.notNull).toBe(true);
        expect(col?.default).toBe('ACTIVE');
    });

    it('audit and soft-delete columns are nullable except created_at/updated_at', () => {
        for (const name of [
            'admin_info',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ]) {
            expect(getColumn(name)?.notNull, name).toBe(false);
        }
        expect(getColumn('created_at')?.notNull).toBe(true);
        expect(getColumn('updated_at')?.notNull).toBe(true);
    });

    it('has a non-unique index on lifecycle_state', () => {
        const { indexes } = getTableConfig(hostTradeCategoryGroups);
        const lifecycle = indexes.find(
            (i) => i.config.name === 'hostTradeCategoryGroups_lifecycleState_idx'
        );
        expect(lifecycle).toBeDefined();
        expect(lifecycle?.config.unique).toBeFalsy();
    });

    it('has no partial predicate on the slug uniqueness (soft-deleted rows keep their slug)', () => {
        const { indexes } = getTableConfig(hostTradeCategoryGroups);
        const partialSlugIdx = indexes.filter((i) => i.config.where !== undefined);
        expect(partialSlugIdx).toHaveLength(0);
        expect(getColumn('slug')?.isUnique).toBe(true);
    });
});

describe('host_trade_category_groups type inference', () => {
    it('accepts a minimal insert (slug + nameI18n)', () => {
        const minimal = {
            slug: 'home-maintenance',
            nameI18n: { es: 'Mantenimiento', en: 'Maintenance', pt: 'Manutencao' }
        } satisfies Pick<InsertHostTradeCategoryGroup, 'slug' | 'nameI18n'>;
        expect(minimal.slug).toBe('home-maintenance');
    });

    it('select type exposes typed fields', () => {
        const check = (row: SelectHostTradeCategoryGroup): void => {
            const _id: string = row.id;
            const _weight: number = row.displayWeight;
            const _deletedAt: Date | null = row.deletedAt;
            void [_id, _weight, _deletedAt];
        };
        expect(typeof check).toBe('function');
    });
});
