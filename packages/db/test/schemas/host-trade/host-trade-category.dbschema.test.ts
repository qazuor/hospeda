/**
 * HOS-919 T-004 — `host_trade_categories` table schema tests.
 *
 * In-process schema tests (no PostgreSQL needed): they inspect Drizzle
 * metadata via `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    hostTradeCategories,
    type InsertHostTradeCategory,
    type SelectHostTradeCategory
} from '../../../src/schemas/host-trade/host-trade-category.dbschema.ts';
import * as schemasBarrel from '../../../src/schemas/index.ts';

function getColumn(sqlName: string) {
    return getTableConfig(hostTradeCategories).columns.find((c) => c.name === sqlName);
}

describe('host_trade_categories table', () => {
    it('has the correct SQL table name', () => {
        expect(getTableConfig(hostTradeCategories).name).toBe('host_trade_categories');
    });

    it('has every expected column', () => {
        const names = getTableConfig(hostTradeCategories).columns.map((c) => c.name);
        for (const expected of [
            'id',
            'slug',
            'group_id',
            'name_i18n',
            'keywords_i18n',
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

    it('slug is a NOT NULL unique text column', () => {
        const slug = getColumn('slug');
        expect(slug?.notNull).toBe(true);
        expect(slug?.isUnique).toBe(true);
    });

    it('group_id is NOT NULL uuid', () => {
        const col = getColumn('group_id');
        expect(col?.notNull).toBe(true);
        expect(col?.columnType).toBe('PgUUID');
    });

    it('group_id FK targets host_trade_category_groups with onDelete restrict', () => {
        const { foreignKeys } = getTableConfig(hostTradeCategories);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'group_id')
        );
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('restrict');
        const target = fk?.reference().foreignTable;
        expect(target && getTableConfig(target).name).toBe('host_trade_category_groups');
    });

    it('name_i18n is NOT NULL jsonb', () => {
        const col = getColumn('name_i18n');
        expect(col?.notNull).toBe(true);
        expect(col?.columnType).toBe('PgJsonb');
    });

    it('keywords_i18n is jsonb defaulting to {}', () => {
        const col = getColumn('keywords_i18n');
        expect(col?.columnType).toBe('PgJsonb');
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

    it('soft-delete and audit columns are nullable', () => {
        for (const name of [
            'translation_meta',
            'admin_info',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ]) {
            expect(getColumn(name)?.notNull, name).toBe(false);
        }
    });

    it('has non-unique indexes on group_id and lifecycle_state', () => {
        const { indexes } = getTableConfig(hostTradeCategories);
        const names = indexes.map((i) => i.config.name);
        expect(names).toContain('hostTradeCategories_groupId_idx');
        expect(names).toContain('hostTradeCategories_lifecycleState_idx');
        for (const i of indexes) {
            expect(i.config.unique).toBeFalsy();
        }
    });
});

describe('host_trade_categories barrel and types', () => {
    it('exports both tables from the schemas barrel', () => {
        expect(schemasBarrel.hostTradeCategories).toBe(hostTradeCategories);
        expect(schemasBarrel.hostTradeCategoryGroups).toBeDefined();
    });

    it('accepts a minimal insert (slug, groupId, nameI18n)', () => {
        const minimal = {
            slug: 'plomeria',
            groupId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            nameI18n: { es: 'Plomeria', en: 'Plumbing', pt: 'Encanamento' }
        } satisfies Pick<InsertHostTradeCategory, 'slug' | 'groupId' | 'nameI18n'>;
        expect(minimal.slug).toBe('plomeria');
    });

    it('select type exposes typed fields', () => {
        const check = (row: SelectHostTradeCategory): void => {
            const _group: string = row.groupId;
            const _kw = row.keywordsI18n;
            void [_group, _kw];
        };
        expect(typeof check).toBe('function');
    });
});
