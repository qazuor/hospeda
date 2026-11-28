/**
 * HOS-2679 — the admin QR list's organisation filters and the campaign
 * dropdown, on the pure helpers and through `QrCodeService.adminList`.
 */

import { readUtmParams } from '@repo/analytics';
import type { QrCodeModel, QrCodeScanModel, RQrCodeQrCodeTagModel } from '@repo/db';
import { PermissionEnum, QrCodeSourceEnum, ServiceErrorCode } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    buildQrCodeOrganizeConditions,
    decodeDistinctCampaigns,
    decodeRawCampaign,
    rawSpellingsForCampaign
} from '../../../src/services/qr-code/qr-code.organize';
import { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

/** A model mock whose extra methods are typed as mocks too. */
type MockedModel = Record<
    'findAll' | 'getTable' | 'findDistinctRawUtmCampaigns' | 'findTagRefsByQrCodeIds',
    Mock
>;

const dialect = new PgDialect();
const TAG_A = '11111111-1111-4111-8111-111111111111';
const QR_ID = '33333333-3333-4333-8333-333333333333';

describe('decodeRawCampaign — parity with readUtmParams', () => {
    it.each([
        'verano%202026',
        'verano+2026',
        'verano 2026',
        'a%c3%b1o',
        'a%C3%B1o',
        '%20lead',
        'bad%E0%A4%A',
        '100%'
    ])('decodes %s exactly as the panel reads it', (raw) => {
        const panel = readUtmParams({ url: `https://x.test/?a=1&utm_campaign=${raw}` });
        expect(decodeRawCampaign({ raw })).toBe(panel.utm_campaign);
    });
});

describe('decodeDistinctCampaigns', () => {
    it('decodes, folds spellings of one campaign, drops blanks and sorts', () => {
        expect(
            decodeDistinctCampaigns({
                raw: ['verano%202026', 'verano+2026', '', '%20', 'Costanera', 'a%C3%B1o']
            })
        ).toStrictEqual(['año', 'Costanera', 'verano 2026']);
    });

    /** N3: a value is offered verbatim, so the filter can match what is offered. */
    it('does not trim what it offers', () => {
        expect(decodeDistinctCampaigns({ raw: ['%20lead'] })).toStrictEqual([' lead']);
    });
});

describe('rawSpellingsForCampaign', () => {
    const raw = ['verano%202026', 'verano+2026', 'verano 2026', 'verano-2025', 'verano', '%20lead'];

    it('collects every raw spelling of one decoded value, and only those', () => {
        expect(rawSpellingsForCampaign({ value: 'verano 2026', raw })).toStrictEqual([
            'verano%202026',
            'verano+2026',
            'verano 2026'
        ]);
        // Exact: `verano` never picks up `verano-2025`.
        expect(rawSpellingsForCampaign({ value: 'verano', raw })).toStrictEqual(['verano']);
    });

    /** Every value the dropdown offers must be matchable by the filter. */
    it('matches every value the dropdown offers', () => {
        for (const value of decodeDistinctCampaigns({ raw })) {
            expect(rawSpellingsForCampaign({ value, raw }).length).toBeGreaterThan(0);
        }
    });

    it('answers nothing for a campaign no code carries', () => {
        expect(rawSpellingsForCampaign({ value: 'otoño', raw })).toStrictEqual([]);
    });
});

describe('buildQrCodeOrganizeConditions', () => {
    it('emits nothing without filters, and nothing for an empty tag list', () => {
        expect(buildQrCodeOrganizeConditions({})).toStrictEqual([]);
        expect(buildQrCodeOrganizeConditions({ tagIds: [] })).toStrictEqual([]);
    });

    it('binds the raw spellings given', () => {
        const [condition] = buildQrCodeOrganizeConditions({
            utmCampaignRaws: ['verano%202026', 'verano+2026']
        });
        const { params } = dialect.sqlToQuery(condition as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(params).toStrictEqual(['verano%202026', 'verano+2026']);
    });

    it('turns a campaign with no spelling into a match-nothing condition', () => {
        const [condition] = buildQrCodeOrganizeConditions({ utmCampaignRaws: [] });
        const { sql } = dialect.sqlToQuery(condition as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(sql).toBe('false');
    });

    it('de-duplicates tag ids', () => {
        const [condition] = buildQrCodeOrganizeConditions({ tagIds: [TAG_A, TAG_A] });
        const { params } = dialect.sqlToQuery(condition as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(params).toStrictEqual([TAG_A]);
    });
});

describe('QrCodeService — admin list organisation (HOS-2679)', () => {
    let service: QrCodeService;
    let model: MockedModel;
    let linkModel: MockedModel;
    const admin = createActor({
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.QR_CODE_VIEW]
    });

    const row = { id: QR_ID, label: 'Plaza', source: QrCodeSourceEnum.MANUAL, deletedAt: null };

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock(['findDistinctRawUtmCampaigns']) as unknown as MockedModel;
        model.getTable.mockReturnValue({ createdAt: {}, deletedAt: {}, source: {} });
        model.findAll.mockResolvedValue({ items: [row], total: 1 });
        linkModel = createModelMock([
            'findTagRefsByQrCodeIds',
            'setTagsForQrCode'
        ]) as unknown as MockedModel;
        linkModel.findTagRefsByQrCodeIds.mockResolvedValue(
            new Map([[QR_ID, [{ id: TAG_A, name: 'Verano', slug: 'verano', color: null }]]])
        );
        service = new QrCodeService(
            { logger: createLoggerMock() },
            model as unknown as QrCodeModel,
            createModelMock() as unknown as QrCodeScanModel,
            linkModel as unknown as RQrCodeQrCodeTagModel
        );
    });

    it('keeps column filters in the where map and turns utmCampaign/tagIds into SQL', async () => {
        // Arrange
        model.findDistinctRawUtmCampaigns.mockResolvedValue(['verano', 'verano-2025']);

        // Act
        const result = await service.adminList(admin, {
            source: 'MANUAL',
            utmCampaign: 'verano',
            tagIds: TAG_A
        });

        // Assert
        expect(result.error).toBeUndefined();
        const [where, , conditions] = model.findAll.mock.calls[0] as [
            Record<string, unknown>,
            unknown,
            unknown[]
        ];
        expect(where).toStrictEqual({ source: 'MANUAL', deletedAt: null });
        expect(conditions).toHaveLength(2);
        const rendered = (conditions as Parameters<PgDialect['sqlToQuery']>[0][]).map(
            (c) => dialect.sqlToQuery(c).sql
        );
        expect(rendered[0]).toContain('campaign');
        const { params } = dialect.sqlToQuery(
            (conditions as Parameters<PgDialect['sqlToQuery']>[0][])[0] as Parameters<
                PgDialect['sqlToQuery']
            >[0]
        );
        expect(params).toStrictEqual(['verano']);
        expect(rendered[1]).toContain('exists (select 1 from "r_qr_code_qr_code_tag"');
    });

    it('passes no extra condition when neither filter is given', async () => {
        await service.adminList(admin, {});

        // No campaign filter, no extra read.
        expect(model.findDistinctRawUtmCampaigns).not.toHaveBeenCalled();

        const [where, , conditions] = model.findAll.mock.calls[0] as [
            Record<string, unknown>,
            unknown,
            unknown
        ];
        expect(where).toStrictEqual({ deletedAt: null });
        expect(conditions).toBeUndefined();
    });

    it('attaches each row its tags from one batched read', async () => {
        const result = await service.adminList(admin, {});

        expect(linkModel.findTagRefsByQrCodeIds).toHaveBeenCalledTimes(1);
        expect(linkModel.findTagRefsByQrCodeIds).toHaveBeenCalledWith([QR_ID], undefined);
        const items = result.data?.items as unknown as Array<{ tags: unknown[] }>;
        expect(items[0]?.tags).toStrictEqual([
            { id: TAG_A, name: 'Verano', slug: 'verano', color: null }
        ]);
    });

    it('defaults a row with no tags to an empty list', async () => {
        linkModel.findTagRefsByQrCodeIds.mockResolvedValue(new Map());

        const result = await service.adminList(admin, {});

        const items = result.data?.items as unknown as Array<{ tags: unknown[] }>;
        expect(items[0]?.tags).toStrictEqual([]);
    });

    it('rejects a malformed tag id before querying', async () => {
        const result = await service.adminList(admin, { tagIds: 'not-a-uuid' });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.findAll).not.toHaveBeenCalled();
    });

    describe('listUtmCampaigns', () => {
        it('decodes and folds the raw campaigns', async () => {
            model.findDistinctRawUtmCampaigns.mockResolvedValue(['a+b', 'a%20b', 'z']);

            const result = await service.listUtmCampaigns({ actor: admin });

            expect(result.data).toStrictEqual({ items: ['a b', 'z'] });
        });

        it('refuses an actor without QR_CODE_VIEW', async () => {
            const result = await service.listUtmCampaigns({
                actor: createActor({ permissions: [] })
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.findDistinctRawUtmCampaigns).not.toHaveBeenCalled();
        });
    });
});
