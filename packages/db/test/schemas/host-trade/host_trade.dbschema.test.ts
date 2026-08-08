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
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { hostTrades } from '../../../src/schemas/host-trade/host_trade.dbschema.ts';

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(hostTrades);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
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
        expect(fk?.reference().foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
        expect(fk?.onDelete).toBe('set null');
    });
});
