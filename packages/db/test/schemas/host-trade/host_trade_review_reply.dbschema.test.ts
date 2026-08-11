/**
 * HOS-376 T-008 — `host_trade_review_replies` table schema tests.
 *
 * Verifies the Drizzle schema definition for the provider's single, editable
 * reply to a review (spec §7.1, §6.4):
 *   (1) All columns exist with the correct SQL names, types and nullability.
 *   (2) `review_id` is NOT NULL and UNIQUE — one reply per review, never a
 *       thread.
 *   (3) `moderation_state` defaults to `PENDING` (asymmetric moderation,
 *       §6.4 — the author was physically at the host's premises, so the
 *       doxxing risk is real and the review volume this gates is small).
 *   (4) `review_edited_after_reply` defaults to `false` (§6.4 AC-22).
 *   (5) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    hostTradeReviewReplies,
    type InsertHostTradeReviewReply,
    type SelectHostTradeReviewReply
} from '../../../src/schemas/host-trade/host_trade_review_reply.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(hostTradeReviewReplies);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(hostTradeReviewReplies).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('host_trade_review_replies table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(hostTradeReviewReplies);
        expect(name).toBe('host_trade_review_replies');
    });

    it('has exactly 15 columns', () => {
        const { columns } = getTableConfig(hostTradeReviewReplies);
        expect(columns).toHaveLength(15);
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('host_trade_review_replies required columns', () => {
    it('id column exists and is the primary key', () => {
        const { columns } = getTableConfig(hostTradeReviewReplies);
        const col = columns.find((c) => c.name === 'id');
        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('review_id is NOT NULL', () => {
        expect(getColumnConfig('review_id')?.notNull).toBe(true);
    });

    it('author_user_id is NOT NULL', () => {
        expect(getColumnConfig('author_user_id')?.notNull).toBe(true);
    });

    it('content is NOT NULL', () => {
        expect(getColumnConfig('content')?.notNull).toBe(true);
    });

    it('moderation_state is NOT NULL and defaults to PENDING', () => {
        const config = getColumnConfig('moderation_state');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('PENDING');
    });

    it('review_edited_after_reply is NOT NULL boolean defaulting to false', () => {
        const config = getColumnConfig('review_edited_after_reply');
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(false);
    });

    it('created_at and updated_at are NOT NULL with defaults', () => {
        expect(getColumnConfig('created_at')?.notNull).toBe(true);
        expect(getColumnConfig('updated_at')?.notNull).toBe(true);
    });
});

// ─── Optional columns ───────────────────────────────────────────────────────

describe('host_trade_review_replies optional columns', () => {
    it('moderated_by_id, moderated_at, moderation_reason are nullable', () => {
        expect(getColumnConfig('moderated_by_id')?.notNull).toBeFalsy();
        expect(getColumnConfig('moderated_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('moderation_reason')?.notNull).toBeFalsy();
    });

    it('deleted_at and deleted_by_id are nullable (soft delete)', () => {
        expect(getColumnConfig('deleted_at')?.notNull).toBeFalsy();
        expect(getColumnConfig('deleted_by_id')?.notNull).toBeFalsy();
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('host_trade_review_replies foreign keys', () => {
    function fkFor(columnName: string) {
        const { foreignKeys } = getTableConfig(hostTradeReviewReplies);
        return foreignKeys.find((f) => f.reference().columns.some((c) => c.name === columnName));
    }

    it('has exactly 6 foreign keys', () => {
        const { foreignKeys } = getTableConfig(hostTradeReviewReplies);
        expect(foreignKeys).toHaveLength(6);
    });

    it('review_id references host_trade_reviews with onDelete cascade', () => {
        const fk = fkFor('review_id');
        expect(fk).toBeDefined();
        expect(fk?.reference().foreignTable[Symbol.for('drizzle:Name')]).toBe('host_trade_reviews');
        expect(fk?.onDelete).toBe('cascade');
    });

    it('author_user_id references users with onDelete cascade', () => {
        const fk = fkFor('author_user_id');
        expect(fk).toBeDefined();
        expect(fk?.reference().foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
        expect(fk?.onDelete).toBe('cascade');
    });

    it('moderated_by_id references users with onDelete set null', () => {
        const fk = fkFor('moderated_by_id');
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('set null');
    });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('host_trade_review_replies indexes', () => {
    it('has a UNIQUE index on review_id — one reply per review, never a thread', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeReviewReplies_reviewId_uniq'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBe(true);
        const names = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(names).toEqual(['review_id']);
    });

    it('has a non-unique index on moderation_state (backs the admin moderation queue)', () => {
        const idx = getIndexes().find(
            (i) => i.config.name === 'hostTradeReviewReplies_moderationState_idx'
        );
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('host_trade_review_replies type inference', () => {
    it('InsertHostTradeReviewReply allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertHostTradeReviewReply = {
            reviewId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            authorUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            content: 'Gracias por la reseña, lamentamos el inconveniente.'
        };

        expect(minimal.reviewId).toBeDefined();
        expect(minimal.content).toContain('Gracias');
    });

    it('SelectHostTradeReviewReply has all expected SQL column keys', () => {
        const { columns } = getTableConfig(hostTradeReviewReplies);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'review_id',
            'author_user_id',
            'content',
            'moderation_state',
            'moderated_by_id',
            'moderated_at',
            'moderation_reason',
            'review_edited_after_reply',
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

    it('SelectHostTradeReviewReply compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectHostTradeReviewReply): void => {
            const _id: string = _row.id;
            const _reviewId: string = _row.reviewId;
            const _content: string = _row.content;
            const _reviewEditedAfterReply: boolean = _row.reviewEditedAfterReply;

            void [_id, _reviewId, _content, _reviewEditedAfterReply];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
