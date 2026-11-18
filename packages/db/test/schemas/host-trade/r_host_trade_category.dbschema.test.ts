/**
 * HOS-919 T-005 — `r_host_trade_category` join table schema tests.
 *
 * In-process schema tests (no PostgreSQL needed): they inspect Drizzle
 * metadata via `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertRHostTradeCategory,
    rHostTradeCategory,
    type SelectRHostTradeCategory
} from '../../../src/schemas/host-trade/r_host_trade_category.dbschema.ts';
import * as schemasBarrel from '../../../src/schemas/index.ts';

function getColumn(sqlName: string) {
    return getTableConfig(rHostTradeCategory).columns.find((c) => c.name === sqlName);
}

function fkFor(columnName: string) {
    return getTableConfig(rHostTradeCategory).foreignKeys.find((f) =>
        f.reference().columns.some((c) => c.name === columnName)
    );
}

describe('r_host_trade_category table', () => {
    it('has the correct SQL table name', () => {
        expect(getTableConfig(rHostTradeCategory).name).toBe('r_host_trade_category');
    });

    it('has exactly two columns (no isPrimary, unlike r_poi_category)', () => {
        const names = getTableConfig(rHostTradeCategory).columns.map((c) => c.name);
        expect(names.sort()).toEqual(['category_id', 'host_trade_id']);
    });

    it('both columns are NOT NULL', () => {
        expect(getColumn('host_trade_id')?.notNull).toBe(true);
        expect(getColumn('category_id')?.notNull).toBe(true);
    });
});

describe('r_host_trade_category foreign keys', () => {
    it('host_trade_id references host_trades with onDelete cascade', () => {
        const fk = fkFor('host_trade_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
        const target = fk?.reference().foreignTable;
        expect(target && getTableConfig(target).name).toBe('host_trades');
    });

    it('category_id references host_trade_categories with onDelete restrict', () => {
        const fk = fkFor('category_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('restrict');
        const target = fk?.reference().foreignTable;
        expect(target && getTableConfig(target).name).toBe('host_trade_categories');
    });
});

describe('r_host_trade_category keys and indexes', () => {
    it('has one composite primary key over (host_trade_id, category_id)', () => {
        const { primaryKeys } = getTableConfig(rHostTradeCategory);
        expect(primaryKeys).toHaveLength(1);
        const names = primaryKeys[0]?.columns.map((c) => c.name);
        expect(names).toEqual(['host_trade_id', 'category_id']);
    });

    it('has a reverse index on category_id alone', () => {
        const { indexes } = getTableConfig(rHostTradeCategory);
        const idx = indexes.find((i) => i.config.name === 'r_host_trade_category_categoryId_idx');
        expect(idx).toBeDefined();
        const cols = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(cols).toEqual(['category_id']);
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has exactly one explicit index (the PK already covers host_trade_id lookups)', () => {
        expect(getTableConfig(rHostTradeCategory).indexes).toHaveLength(1);
    });
});

describe('r_host_trade_category barrel and types', () => {
    it('is exported from the schemas barrel', () => {
        expect(schemasBarrel.rHostTradeCategory).toBe(rHostTradeCategory);
    });

    it('insert requires both ids; select exposes them as strings', () => {
        const insert: InsertRHostTradeCategory = {
            hostTradeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            categoryId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        };
        const check = (row: SelectRHostTradeCategory): void => {
            const _a: string = row.hostTradeId;
            const _b: string = row.categoryId;
            void [_a, _b];
        };
        expect(insert.hostTradeId).toBeDefined();
        expect(typeof check).toBe('function');
    });
});
