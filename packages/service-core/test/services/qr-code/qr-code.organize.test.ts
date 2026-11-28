/**
 * HOS-2679 — the admin QR list's organisation filters and the campaign
 * dropdown, on the pure helpers and through `QrCodeService.adminList`.
 */
import type { QrCodeModel, QrCodeScanModel, RQrCodeQrCodeTagModel } from '@repo/db';
import { PermissionEnum, QrCodeSourceEnum, ServiceErrorCode } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    buildQrCodeOrganizeConditions,
    decodeDistinctCampaigns,
    encodedCampaignSpellings
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

describe('encodedCampaignSpellings', () => {
    it('covers percent, plus and raw spellings, de-duplicated', () => {
        expect(encodedCampaignSpellings({ value: 'verano 2026' })).toStrictEqual([
            'verano%202026',
            'verano+2026',
            'verano 2026'
        ]);
        expect(encodedCampaignSpellings({ value: 'verano-2026' })).toStrictEqual(['verano-2026']);
    });
});

describe('decodeDistinctCampaigns', () => {
    it('decodes, folds spellings of one campaign, drops blanks and sorts', () => {
        expect(
            decodeDistinctCampaigns({
                raw: ['verano%202026', 'verano+2026', '', 'Costanera', 'a%C3%B1o']
            })
        ).toStrictEqual(['año', 'Costanera', 'verano 2026']);
    });
});

describe('buildQrCodeOrganizeConditions', () => {
    it('emits nothing without filters, and nothing for an empty tag list', () => {
        expect(buildQrCodeOrganizeConditions({})).toStrictEqual([]);
        expect(buildQrCodeOrganizeConditions({ tagIds: [] })).toStrictEqual([]);
    });

    it('binds every encoded spelling of the campaign', () => {
        const [condition] = buildQrCodeOrganizeConditions({ utmCampaign: 'verano 2026' });
        const { params } = dialect.sqlToQuery(condition as Parameters<PgDialect['sqlToQuery']>[0]);
        expect(params).toStrictEqual(['verano%202026', 'verano+2026', 'verano 2026']);
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
        expect(rendered[0]).toContain('utm_campaign');
        expect(rendered[1]).toContain('exists (select 1 from "r_qr_code_qr_code_tag"');
    });

    it('passes no extra condition when neither filter is given', async () => {
        await service.adminList(admin, {});

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
