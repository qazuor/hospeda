/**
 * HOS-376 T-006 — `host_trade_benefit_usages` table schema tests.
 *
 * Verifies the Drizzle schema definition for the "one party declares, the
 * other confirms" benefit-usage record (spec §7.1):
 *   (1) All columns exist with the correct SQL names, types and nullability.
 *   (2) FKs use the onDelete rules the spec mandates (`hostTradeId` /
 *       `hostUserId` CASCADE, actor/audit columns SET NULL where nullable).
 *   (3) The partial unique index on `(host_trade_id, host_user_id)` WHERE
 *       `status = 'PENDING' AND deleted_at IS NULL` exists (spec §7.1,
 *       "un solo PENDING por par").
 *   (4) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    hostTradeBenefitUsages,
    type InsertHostTradeBenefitUsage,
    type SelectHostTradeBenefitUsage
} from '../../../src/schemas/host-trade/host_trade_benefit_usage.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(hostTradeBenefitUsages);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(hostTradeBenefitUsages).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('host_trade_benefit_usages table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(hostTradeBenefitUsages);
        expect(name).toBe('host_trade_benefit_usages');
    });

    it('has exactly 22 columns', () => {
        const { columns } = getTableConfig(hostTradeBenefitUsages);
        expect(columns).toHaveLength(22);
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('host_trade_benefit_usages required columns', () => {
    it('id column exists and is the primary key', () => {
        const { columns } = getTableConfig(hostTradeBenefitUsages);
        const col = columns.find((c) => c.name === 'id');
        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('host_trade_id is NOT NULL', () => {
        expect(getColumnConfig('host_trade_id')?.notNull).toBe(true);
    });

    it('host_user_id is NOT NULL', () => {
        expect(getColumnConfig('host_user_id')?.notNull).toBe(true);
    });

    it('declared_by is NOT NULL', () => {
        expect(getColumnConfig('declared_by')?.notNull).toBe(true);
    });

    it('declared_by_id is NOT NULL', () => {
        expect(getColumnConfig('declared_by_id')?.notNull).toBe(true);
    });

    it('creation_channel is NOT NULL', () => {
        expect(getColumnConfig('creation_channel')?.notNull).toBe(true);
    });

    it('status is NOT NULL and defaults to PENDING', () => {
        const config = getColumnConfig('status');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('PENDING');
    });

    it('serviced_at is NOT NULL', () => {
        expect(getColumnConfig('serviced_at')?.notNull).toBe(true);
    });

    it('expires_at is NOT NULL', () => {
        expect(getColumnConfig('expires_at')?.notNull).toBe(true);
    });

    it('created_at and updated_at are NOT NULL with defaults', () => {
        expect(getColumnConfig('created_at')?.notNull).toBe(true);
        expect(getColumnConfig('updated_at')?.notNull).toBe(true);
    });
});

// ─── Optional columns ───────────────────────────────────────────────────────

describe('host_trade_benefit_usages optional columns', () => {
    it('note is nullable', () => {
        expect(getColumnConfig('note')?.notNull).toBeFalsy();
    });

    it('reminder_sent_at is nullable', () => {
        expect(getColumnConfig('reminder_sent_at')?.notNull).toBeFalsy();
    });

    it('confirmed_at and confirmed_by_id are nullable', () => {
        expect(getColumnConfig('confirmed_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('confirmed_by_id')?.notNull).toBeFalsy();
    });

    it('rejected_at and rejected_by_id are nullable', () => {
        expect(getColumnConfig('rejected_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('rejected_by_id')?.notNull).toBeFalsy();
    });

    it('rejection_note is nullable', () => {
        expect(getColumnConfig('rejection_note')?.notNull).toBeFalsy();
    });

    it('deleted_at and deleted_by_id are nullable (soft delete)', () => {
        expect(getColumnConfig('deleted_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('deleted_by_id')?.notNull).toBeFalsy();
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('host_trade_benefit_usages foreign keys', () => {
    function fkFor(columnName: string) {
        const { foreignKeys } = getTableConfig(hostTradeBenefitUsages);
        return foreignKeys.find((f) => f.reference().columns.some((c) => c.name === columnName));
    }

    it('has exactly 8 foreign keys', () => {
        const { foreignKeys } = getTableConfig(hostTradeBenefitUsages);
        expect(foreignKeys).toHaveLength(8);
    });

    it('host_trade_id references host_trades with onDelete cascade', () => {
        const fk = fkFor('host_trade_id');
        expect(fk).toBeDefined();
        expect(fk?.reference().foreignTable[Symbol.for('drizzle:Name')]).toBe('host_trades');
        expect(fk?.onDelete).toBe('cascade');
    });

    it('host_user_id references users with onDelete cascade', () => {
        const fk = fkFor('host_user_id');
        expect(fk).toBeDefined();
        expect(fk?.reference().foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
        expect(fk?.onDelete).toBe('cascade');
    });

    it('declared_by_id references users with onDelete cascade', () => {
        const fk = fkFor('declared_by_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });

    it('confirmed_by_id references users with onDelete set null', () => {
        const fk = fkFor('confirmed_by_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('set null');
    });

    it('rejected_by_id references users with onDelete set null', () => {
        const fk = fkFor('rejected_by_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('set null');
    });

    it('deleted_by_id references users with onDelete set null', () => {
        const fk = fkFor('deleted_by_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('set null');
    });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('host_trade_benefit_usages indexes', () => {
    it('has exactly 8 named indexes', () => {
        expect(getIndexes()).toHaveLength(8);
    });

    it('has a non-unique index on host_trade_id', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_hostTradeId_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on host_user_id', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_hostUserId_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on status', () => {
        const idx = getIndexes().find((i) => i.config.name === 'hostTradeBenefitUsages_status_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a composite index on (host_trade_id, status)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_hostTradeId_status_idx'
        );
        expect(idx).toBeDefined();
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_trade_id', 'status']);
    });

    it('has a composite index on (host_user_id, status)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_hostUserId_status_idx'
        );
        expect(idx).toBeDefined();
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_user_id', 'status']);
    });

    it('has a non-unique index on expires_at (backs the expiry cron)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_expiresAt_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique composite index on (host_trade_id, host_user_id)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_hostTradeId_hostUserId_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_trade_id', 'host_user_id']);
    });

    it('has a partial unique index on (host_trade_id, host_user_id) WHERE status=PENDING AND deleted_at IS NULL', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeBenefitUsages_pendingPair_uniq'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBe(true);

        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_trade_id', 'host_user_id']);

        expect(idx?.config.where).toBeDefined();
        const whereSql = JSON.stringify(idx?.config.where);
        expect(whereSql).toContain('PENDING');
        expect(whereSql).toContain('deleted_at');
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('host_trade_benefit_usages type inference', () => {
    it('InsertHostTradeBenefitUsage allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertHostTradeBenefitUsage = {
            hostTradeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            hostUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            declaredBy: 'HOST',
            declaredById: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            creationChannel: 'QR',
            servicedAt: '2026-08-01',
            expiresAt: new Date()
        };

        expect(minimal.hostTradeId).toBeDefined();
        expect(minimal.declaredBy).toBe('HOST');
    });

    it('SelectHostTradeBenefitUsage has all expected SQL column keys', () => {
        const { columns } = getTableConfig(hostTradeBenefitUsages);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'host_trade_id',
            'host_user_id',
            'declared_by',
            'declared_by_id',
            'creation_channel',
            'status',
            'serviced_at',
            'note',
            'expires_at',
            'reminder_sent_at',
            'confirmed_at',
            'confirmed_by_id',
            'rejected_at',
            'rejected_by_id',
            'rejection_note',
            'created_at',
            'updated_at',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ];

        for (const col of expectedSqlColumns) {
            expect(sqlNames.has(col), `Expected column '${col}' to exist`).toBe(true);
        }
    });

    it('SelectHostTradeBenefitUsage compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectHostTradeBenefitUsage): void => {
            const _id: string = _row.id;
            const _hostTradeId: string = _row.hostTradeId;
            const _hostUserId: string = _row.hostUserId;
            const _status: string = _row.status;
            const _note: string | null = _row.note;
            const _confirmedAt: Date | null = _row.confirmedAt;

            void [_id, _hostTradeId, _hostUserId, _status, _note, _confirmedAt];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
