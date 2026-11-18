/**
 * HOS-376 T-009 — new denormalized-stats + declaration-suspension columns on
 * `host_trades` (spec §7.2).
 *
 * Scoped to the 8 new columns only (the pre-existing HOS-278 columns already
 * have their own coverage via the integration suite). Verifies:
 *   (1) The 5 denormalized aggregate columns are NOT NULL with a `0` default.
 *   (2) The 3 declaration-suspension columns are nullable.
 *   (3) `declaration_suspended_by_id` references `users` with onDelete set
 *       null (null = automatic suspension by the rejection-threshold cron,
 *       non-null = an admin applied/lifted it).
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 */
import { createTableRelationsHelpers, extractTablesRelationalConfig } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { hostTrades } from '../../../src/schemas/host-trade/host_trade.dbschema.ts';
import * as schemasBarrel from '../../../src/schemas/index.ts';

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(hostTrades);
    const col = columns.find((c) => c.name === sqlName);
    // `config` is protected in drizzle's Column type but readable at runtime.
    return (col as unknown as { config?: Record<string, unknown> } | undefined)?.config;
}

describe('host_trades table meta (post HOS-376 T-009)', () => {
    it('has exactly 34 columns (26 pre-existing + 8 new)', () => {
        const { columns } = getTableConfig(hostTrades);
        expect(columns).toHaveLength(34);
    });
});

describe('host_trades new denormalized aggregate columns', () => {
    it('confirmed_uses_count is NOT NULL integer defaulting to 0', () => {
        const config = getColumnConfig('confirmed_uses_count');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(0);
    });

    it('distinct_hosts_count is NOT NULL integer defaulting to 0', () => {
        const config = getColumnConfig('distinct_hosts_count');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(0);
    });

    it('reviews_count is NOT NULL integer defaulting to 0', () => {
        const config = getColumnConfig('reviews_count');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(0);
    });

    it('average_rating is NOT NULL numeric(3,2) defaulting to 0', () => {
        const config = getColumnConfig('average_rating');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(0);
    });

    it('benefit_respected_count is NOT NULL integer defaulting to 0', () => {
        const config = getColumnConfig('benefit_respected_count');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(0);
    });
});

describe('host_trades declaration-suspension columns', () => {
    it('declaration_suspended_at is nullable', () => {
        expect(getColumnConfig('declaration_suspended_at')?.notNull).toBeFalsy();
    });

    it('declaration_suspended_by_id is nullable', () => {
        expect(getColumnConfig('declaration_suspended_by_id')?.notNull).toBeFalsy();
    });

    it('declaration_suspend_reason is nullable', () => {
        expect(getColumnConfig('declaration_suspend_reason')?.notNull).toBeFalsy();
    });

    it('declaration_suspended_by_id references users with onDelete set null', () => {
        const { foreignKeys } = getTableConfig(hostTrades);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'declaration_suspended_by_id')
        );
        expect(fk).toBeDefined();
        expect(getTableConfig(fk?.reference().foreignTable as PgTable).name).toBe('users');
        expect(fk?.onDelete).toBe('set null');
    });
});

describe('host_trades.category after HOS-919 (expand step)', () => {
    it('category stays in the table but is now NULLABLE', () => {
        const config = getColumnConfig('category');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(false);
    });

    it('keeps both legacy category indexes untouched until the contract release', () => {
        const { indexes } = getTableConfig(hostTrades);
        const names = indexes.map((i) => i.config.name);
        expect(names).toContain('hostTrades_category_idx');
        expect(names).toContain('hostTrades_destinationId_category_idx');
    });

    it('exposes a categories relation through the join table', () => {
        const { tables } = extractTablesRelationalConfig(
            schemasBarrel,
            createTableRelationsHelpers
        );
        const relation = tables.hostTrades?.relations.categories;
        expect(relation).toBeDefined();
        expect(relation?.referencedTableName).toBe('r_host_trade_category');
    });
});
