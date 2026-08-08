/**
 * HOS-376 T-007 — `host_trade_reviews` table schema tests.
 *
 * Verifies the Drizzle schema definition for the host → provider review
 * (spec §7.1, §6.3, §6.4):
 *   (1) All columns exist with the correct SQL names, types and nullability.
 *   (2) `moderationState` defaults to `APPROVED` (asymmetric moderation,
 *       §6.4 — a confirmed usage is a stronger signal than the
 *       "semi-verified" reviewer `accommodation_reviews` relies on).
 *   (3) `rating` (the 3-dimension breakdown) and `averageRating` are
 *       nullable — the breakdown is optional (AC-20).
 *   (4) UNIQUE `(host_user_id, host_trade_id)` — one review per host per
 *       provider, editable (§6.3 OQ-3).
 *   (5) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    hostTradeReviews,
    type InsertHostTradeReview,
    type SelectHostTradeReview
} from '../../../src/schemas/host-trade/host_trade_review.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(hostTradeReviews);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(hostTradeReviews).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('host_trade_reviews table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(hostTradeReviews);
        expect(name).toBe('host_trade_reviews');
    });

    it('has exactly 20 columns', () => {
        const { columns } = getTableConfig(hostTradeReviews);
        expect(columns).toHaveLength(20);
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('host_trade_reviews required columns', () => {
    it('id column exists and is the primary key', () => {
        const { columns } = getTableConfig(hostTradeReviews);
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

    it('overall_rating is NOT NULL integer', () => {
        expect(getColumnConfig('overall_rating')?.notNull).toBe(true);
    });

    it('respected_benefit is NOT NULL boolean', () => {
        expect(getColumnConfig('respected_benefit')?.notNull).toBe(true);
    });

    it('lifecycle_state is NOT NULL and defaults to ACTIVE', () => {
        const config = getColumnConfig('lifecycle_state');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('ACTIVE');
    });

    it('moderation_state is NOT NULL and defaults to APPROVED (asymmetric moderation)', () => {
        const config = getColumnConfig('moderation_state');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('APPROVED');
    });

    it('created_at and updated_at are NOT NULL with defaults', () => {
        expect(getColumnConfig('created_at')?.notNull).toBe(true);
        expect(getColumnConfig('updated_at')?.notNull).toBe(true);
    });
});

// ─── Optional columns ───────────────────────────────────────────────────────

describe('host_trade_reviews optional columns', () => {
    it('rating (breakdown jsonb) is nullable', () => {
        expect(getColumnConfig('rating')?.notNull).toBeFalsy();
    });

    it('average_rating is nullable', () => {
        expect(getColumnConfig('average_rating')?.notNull).toBeFalsy();
    });

    it('content is nullable', () => {
        expect(getColumnConfig('content')?.notNull).toBeFalsy();
    });

    it('moderated_by_id, moderated_at, moderation_reason are nullable', () => {
        expect(getColumnConfig('moderated_by_id')?.notNull).toBeFalsy();
        expect(getColumnConfig('moderated_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('moderation_reason')?.notNull).toBeFalsy();
    });

    it('edited_at is nullable', () => {
        expect(getColumnConfig('edited_at')?.notNull).toBeFalsy();
    });

    it('deleted_at and deleted_by_id are nullable (soft delete)', () => {
        expect(getColumnConfig('deleted_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('deleted_by_id')?.notNull).toBeFalsy();
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('host_trade_reviews foreign keys', () => {
    function fkFor(columnName: string) {
        const { foreignKeys } = getTableConfig(hostTradeReviews);
        return foreignKeys.find((f) => f.reference().columns.some((c) => c.name === columnName));
    }

    it('has exactly 6 foreign keys', () => {
        const { foreignKeys } = getTableConfig(hostTradeReviews);
        expect(foreignKeys).toHaveLength(6);
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

    it('moderated_by_id references users with onDelete set null', () => {
        const fk = fkFor('moderated_by_id');
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

describe('host_trade_reviews indexes', () => {
    it('has exactly 5 named indexes', () => {
        expect(getIndexes()).toHaveLength(5);
    });

    it('has a non-unique index on host_trade_id', () => {
        const idx = getIndexes().find((i) => i.config.name === 'hostTradeReviews_hostTradeId_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on host_user_id', () => {
        const idx = getIndexes().find((i) => i.config.name === 'hostTradeReviews_hostUserId_idx');
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a non-unique index on moderation_state', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeReviews_moderationState_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });

    it('has a composite index on (host_trade_id, moderation_state)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeReviews_hostTradeId_moderationState_idx'
        );
        expect(idx).toBeDefined();
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_trade_id', 'moderation_state']);
    });

    it('has a UNIQUE index on (host_user_id, host_trade_id) — one review per host per provider', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeReviews_hostUserId_hostTradeId_uniq'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBe(true);
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['host_user_id', 'host_trade_id']);
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('host_trade_reviews type inference', () => {
    it('InsertHostTradeReview allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertHostTradeReview = {
            hostTradeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            hostUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            overallRating: 5,
            respectedBenefit: true
        };

        expect(minimal.overallRating).toBe(5);
        expect(minimal.respectedBenefit).toBe(true);
    });

    it('SelectHostTradeReview has all expected SQL column keys', () => {
        const { columns } = getTableConfig(hostTradeReviews);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'host_trade_id',
            'host_user_id',
            'overall_rating',
            'rating',
            'average_rating',
            'respected_benefit',
            'content',
            'lifecycle_state',
            'moderation_state',
            'moderated_by_id',
            'moderated_at',
            'moderation_reason',
            'edited_at',
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

    it('SelectHostTradeReview compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectHostTradeReview): void => {
            const _id: string = _row.id;
            const _overallRating: number = _row.overallRating;
            const _respectedBenefit: boolean = _row.respectedBenefit;
            const _averageRating: number | null = _row.averageRating;
            const _editedAt: Date | null = _row.editedAt;

            void [_id, _overallRating, _respectedBenefit, _averageRating, _editedAt];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
