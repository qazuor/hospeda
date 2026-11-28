/**
 * HOS-2679 — QR-code tags: table shapes, the two list-filter SQL builders and
 * the batched tag read.
 *
 * In-process: no PostgreSQL. The regex inside `QR_CODE_RAW_UTM_CAMPAIGN_SQL` was
 * checked by hand against PostgreSQL 16 (first occurrence wins, key matched
 * case-insensitively, fragment ignored, `utm_campaigns` not matched); what is
 * pinned here is that the builders keep emitting that exact expression and bind
 * every value as a parameter rather than splicing it into the SQL text.
 */
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
    buildQrCodeTagFilterCondition,
    buildQrCodeUtmCampaignCondition,
    QR_CODE_RAW_UTM_CAMPAIGN_SQL
} from '../../src/models/qr-code/qrCode.filters.ts';
import { QrCodeTagModel, RQrCodeQrCodeTagModel } from '../../src/models/qr-code/qrCodeTag.model.ts';
import { qrCodeTags } from '../../src/schemas/qr-code/qr_code_tag.dbschema.ts';
import { rQrCodeQrCodeTag } from '../../src/schemas/qr-code/r_qr_code_qr_code_tag.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';

const dialect = new PgDialect();
const TAG_A = '11111111-1111-4111-8111-111111111111';
const TAG_B = '22222222-2222-4222-8222-222222222222';

describe('qr_code_tags table', () => {
    it('has the expected columns, nullable colour and audit fields', () => {
        const { name, columns } = getTableConfig(qrCodeTags);
        expect(name).toBe('qr_code_tags');
        expect(columns.map((c) => c.name).sort()).toStrictEqual(
            [
                'color',
                'created_at',
                'created_by_id',
                'deleted_at',
                'deleted_by_id',
                'id',
                'name',
                'slug',
                'updated_at',
                'updated_by_id'
            ].sort()
        );
        expect(columns.find((c) => c.name === 'color')?.notNull).toBe(false);
        expect(columns.find((c) => c.name === 'name')?.notNull).toBe(true);
        expect(columns.find((c) => c.name === 'slug')?.notNull).toBe(true);
    });

    it('makes the slug unique over LIVE rows only', () => {
        const { indexes } = getTableConfig(qrCodeTags);
        const slugIndex = indexes.find((i) => i.config.name === 'qrCodeTags_slug_live_unique');
        expect(slugIndex?.config.unique).toBe(true);
        const where = slugIndex?.config.where;
        expect(where).toBeDefined();
        expect(dialect.sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0]).sql).toBe(
            'deleted_at IS NULL'
        );
    });
});

describe('r_qr_code_qr_code_tag table', () => {
    it('is a two-column join with a composite key, cascading both ways', () => {
        const { name, columns, primaryKeys, foreignKeys } = getTableConfig(rQrCodeQrCodeTag);
        expect(name).toBe('r_qr_code_qr_code_tag');
        expect(columns.map((c) => c.name).sort()).toStrictEqual(['qr_code_id', 'qr_code_tag_id']);
        expect(columns.every((c) => c.notNull)).toBe(true);
        expect(primaryKeys[0]?.columns.map((c) => c.name).sort()).toStrictEqual([
            'qr_code_id',
            'qr_code_tag_id'
        ]);
        expect(foreignKeys).toHaveLength(2);
        for (const fk of foreignKeys) {
            expect(fk.onDelete).toBe('cascade');
        }
    });
});

describe('buildQrCodeUtmCampaignCondition', () => {
    it('compares the first raw utm_campaign against bound encoded spellings', () => {
        const { sql, params } = dialect.sqlToQuery(
            buildQrCodeUtmCampaignCondition({ encodedValues: ['verano%202026', 'verano+2026'] })
        );
        expect(sql).toBe(
            `(regexp_match(split_part("qr_codes"."target_url", '#', 1), '[?&]utm_campaign=([^&]*)', 'i'))[1] in ($1, $2)`
        );
        expect(params).toStrictEqual(['verano%202026', 'verano+2026']);
    });

    it('never splices a value into the SQL text', () => {
        const hostile = "x') or 1=1 --";
        const { sql, params } = dialect.sqlToQuery(
            buildQrCodeUtmCampaignCondition({ encodedValues: [hostile] })
        );
        expect(sql).not.toContain(hostile);
        expect(params).toStrictEqual([hostile]);
    });
});

describe('buildQrCodeTagFilterCondition', () => {
    it('is a correlated EXISTS over live tags with the ids bound', () => {
        const { sql, params } = dialect.sqlToQuery(
            buildQrCodeTagFilterCondition({ tagIds: [TAG_A, TAG_B] })
        );
        expect(sql).toContain('exists (select 1 from "r_qr_code_qr_code_tag"');
        expect(sql).toContain('"r_qr_code_qr_code_tag"."qr_code_id" = "qr_codes"."id"');
        expect(sql).toContain('"qr_code_tags"."deleted_at" is null');
        expect(sql).toContain('"r_qr_code_qr_code_tag"."qr_code_tag_id" in ($1, $2)');
        expect(params).toStrictEqual([TAG_A, TAG_B]);
    });
});

describe('QR_CODE_RAW_UTM_CAMPAIGN_SQL', () => {
    it('drops the fragment before matching', () => {
        expect(dialect.sqlToQuery(QR_CODE_RAW_UTM_CAMPAIGN_SQL).sql).toContain(
            `split_part("qr_codes"."target_url", '#', 1)`
        );
    });
});

describe('QrCodeTagModel', () => {
    it('maps qr_code_tags', () => {
        const model = new QrCodeTagModel();
        expect(model.entityName).toBe('qrCodeTags');
        expect(model.getTable()).toBe(qrCodeTags);
    });

    it('countLiveByIds short-circuits on an empty list without a query', async () => {
        const select = vi.fn();
        const db = { select } as unknown as DrizzleClient;
        await expect(new QrCodeTagModel().countLiveByIds([], db)).resolves.toBe(0);
        expect(select).not.toHaveBeenCalled();
    });
});

describe('RQrCodeQrCodeTagModel.findTagRefsByQrCodeIds', () => {
    it('groups the joined rows per code and strips the join key', async () => {
        // Arrange
        const rows = [
            { qrCodeId: 'qr-1', id: TAG_A, name: 'Costanera', slug: 'costanera', color: null },
            { qrCodeId: 'qr-2', id: TAG_A, name: 'Costanera', slug: 'costanera', color: null },
            { qrCodeId: 'qr-1', id: TAG_B, name: 'Verano', slug: 'verano', color: 'BLUE' }
        ];
        const orderBy = vi.fn().mockResolvedValue(rows);
        const where = vi.fn(() => ({ orderBy }));
        const innerJoin = vi.fn(() => ({ where }));
        const from = vi.fn(() => ({ innerJoin }));
        const db = { select: vi.fn(() => ({ from })) } as unknown as DrizzleClient;

        // Act
        const map = await new RQrCodeQrCodeTagModel().findTagRefsByQrCodeIds(['qr-1', 'qr-2'], db);

        // Assert
        expect(map.get('qr-1')).toStrictEqual([
            { id: TAG_A, name: 'Costanera', slug: 'costanera', color: null },
            { id: TAG_B, name: 'Verano', slug: 'verano', color: 'BLUE' }
        ]);
        expect(map.get('qr-2')).toStrictEqual([
            { id: TAG_A, name: 'Costanera', slug: 'costanera', color: null }
        ]);
        const condition = (where.mock.calls[0] as unknown[])[0] as Parameters<
            PgDialect['sqlToQuery']
        >[0];
        expect(dialect.sqlToQuery(condition).sql).toContain('"qr_code_tags"."deleted_at" is null');
    });

    it('answers an empty map for no codes, without a query', async () => {
        const select = vi.fn();
        const map = await new RQrCodeQrCodeTagModel().findTagRefsByQrCodeIds([], {
            select
        } as unknown as DrizzleClient);
        expect(map.size).toBe(0);
        expect(select).not.toHaveBeenCalled();
    });
});
