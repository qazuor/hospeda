/**
 * HOS-377 T-003 — `partner_mentions` table schema tests.
 *
 * In-process schema tests: they inspect Drizzle table metadata via
 * `getTableConfig` and do NOT require a running PostgreSQL instance. Row-level
 * behaviour (cascade actually firing, soft-delete filtering, ordering) is
 * covered by the integration suite in T-008.
 *
 * These assertions deliberately concentrate on the decisions that are invisible
 * at the call site and destructive when wrong — FK delete actions, `batch_id`
 * having no FK, and the presence of soft-delete columns — rather than merely
 * enumerating that the columns exist.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertPartnerMention,
    partnerMentions,
    type SelectPartnerMention
} from '../../src/schemas/partner/partner_mention.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

const config = () => getTableConfig(partnerMentions);

const column = (sqlName: string) => config().columns.find((c) => c.name === sqlName);

const foreignKeyFor = (sqlName: string) =>
    config().foreignKeys.find((fk) => fk.reference().columns.some((c) => c.name === sqlName));

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('partner_mentions table meta', () => {
    it('has the correct SQL table name', () => {
        expect(config().name).toBe('partner_mentions');
    });

    it('has exactly 13 columns', () => {
        expect(config().columns).toHaveLength(13);
    });

    it('carries soft-delete and author columns, unlike social_publish_logs', () => {
        // These rows are typed in by a human who will eventually paste the wrong
        // link. The append-only convention of the system-generated dispatch log
        // would leave no way to correct that.
        for (const name of ['deleted_at', 'created_by_id', 'updated_by_id', 'deleted_by_id']) {
            expect(column(name), `expected column ${name}`).toBeDefined();
        }
    });
});

// ─── Nullability ────────────────────────────────────────────────────────────

describe('partner_mentions nullability', () => {
    it.each([
        'id',
        'partner_id',
        'channel',
        'mentioned_at',
        'created_at',
        'updated_at'
    ])('%s is NOT NULL', (name) => {
        expect(column(name)?.notNull).toBe(true);
    });

    it.each(['batch_id', 'url', 'internal_note', 'deleted_at'])('%s is nullable', (name) => {
        expect(column(name)?.notNull).toBe(false);
    });

    it('url is nullable at the DB level — the per-channel rule lives in Zod', () => {
        // A CHECK encoding "required unless WHATSAPP or OTHER" would have to be
        // rewritten every time a channel is added. `requiresMentionUrl` in
        // @repo/schemas owns the rule instead.
        expect(column('url')?.notNull).toBe(false);
    });

    it('mentioned_at is a separate column from created_at', () => {
        // When the action happened vs. when an admin logged it. The partner-facing
        // log orders by mentioned_at; collapsing them would misdate every mention
        // entered after the fact.
        expect(column('mentioned_at')).toBeDefined();
        expect(column('created_at')).toBeDefined();
        expect(column('mentioned_at')?.name).not.toBe(column('created_at')?.name);
    });
});

// ─── Channel enum ───────────────────────────────────────────────────────────

describe('partner_mentions channel column', () => {
    it('uses the partner_mention_channel_enum pg enum, not free text', () => {
        const col = column('channel');
        expect(col?.getSQLType()).toBe('partner_mention_channel_enum');
    });

    it('accepts exactly the 8 channel values', () => {
        const col = column('channel') as unknown as { enumValues?: readonly string[] };
        expect(col.enumValues).toEqual([
            'INSTAGRAM',
            'FACEBOOK',
            'TWITTER',
            'YOUTUBE',
            'TIKTOK',
            'NEWSLETTER',
            'WHATSAPP',
            'OTHER'
        ]);
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('partner_mentions foreign keys', () => {
    it('declares exactly 4 foreign keys', () => {
        // partner_id + the three audit author columns. Pinning the count is what
        // makes the batch_id assertion below hold as the table evolves.
        expect(config().foreignKeys).toHaveLength(4);
    });

    it('partner_id cascades on delete — a deleted partner takes its log with it', () => {
        expect(foreignKeyFor('partner_id')?.onDelete).toBe('cascade');
    });

    it.each([
        'created_by_id',
        'updated_by_id',
        'deleted_by_id'
    ])('%s is SET NULL on delete, never cascade', (name) => {
        // A cascade here would erase a partner's entire mention history the day
        // the staff account that logged it is removed — losing the partner's
        // proof of service as a side effect of offboarding an employee.
        expect(foreignKeyFor(name)?.onDelete).toBe('set null');
    });

    it('batch_id has NO foreign key — it groups rows, it does not reference an entity', () => {
        // There is no batch table to point at. Adding an FK here would require
        // inventing one, and the value is generated server-side per transaction.
        expect(foreignKeyFor('batch_id')).toBeUndefined();
    });
});

// ─── Indexes ────────────────────────────────────────────────────────────────

describe('partner_mentions indexes', () => {
    it('declares exactly 3 indexes', () => {
        expect(config().indexes).toHaveLength(3);
    });

    it.each([
        'partnerMentions_partnerId_mentionedAt_idx',
        'partnerMentions_batchId_idx',
        'partnerMentions_partnerId_deletedAt_idx'
    ])('has index %s', (name) => {
        expect(config().indexes.find((i) => i.config.name === name)).toBeDefined();
    });

    it('the primary index is compound on (partner_id, mentioned_at), in that order', () => {
        // Column order matters: the access pattern is always "this partner's
        // mentions, newest first", so partner_id must lead.
        const idx = config().indexes.find(
            (i) => i.config.name === 'partnerMentions_partnerId_mentionedAt_idx'
        );
        const names = idx?.config.columns.map((c) => (c as { name?: string }).name);
        expect(names).toEqual(['partner_id', 'mentioned_at']);
    });
});

// ─── Inferred types ─────────────────────────────────────────────────────────

describe('partner_mentions inferred types', () => {
    it('SelectPartnerMention exposes the nullable columns as nullable', () => {
        const row: SelectPartnerMention = {
            id: 'a3f1c2d4-0000-4000-8000-000000000001',
            partnerId: 'a3f1c2d4-0000-4000-8000-000000000002',
            channel: 'WHATSAPP',
            batchId: null,
            mentionedAt: new Date(),
            url: null,
            internalNote: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null
        };

        expect(row.batchId).toBeNull();
        expect(row.url).toBeNull();
    });

    it('InsertPartnerMention requires only partnerId, channel and mentionedAt', () => {
        // id/createdAt/updatedAt carry defaults; everything else is optional.
        const insert: InsertPartnerMention = {
            partnerId: 'a3f1c2d4-0000-4000-8000-000000000002',
            channel: 'INSTAGRAM',
            mentionedAt: new Date()
        };

        expect(insert.channel).toBe('INSTAGRAM');
    });
});
