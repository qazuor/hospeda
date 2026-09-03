/**
 * Tests for QrCodeService (HOS-981).
 *
 * The two methods that carry real logic here are the ones PR 2's public
 * redirect will consume: `resolveBySlug` and `registerScan`.
 *
 * @module test/services/qr-code/qr-code.service
 */

import type { QrCodeModel, QrCodeScanModel } from '@repo/db';
import { PermissionEnum, QrCodeSourceEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const QR_ID = '11111111-1111-4111-8111-111111111111';
const SCAN_ID = '22222222-2222-4222-8222-222222222222';

/** A live code: not deleted, active. */
const liveQrCode = {
    id: QR_ID,
    slug: 'k7Qm2XbT',
    targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
    label: 'Cartelera plaza Ramirez',
    description: null,
    source: QrCodeSourceEnum.MANUAL,
    entityType: null,
    entityId: null,
    renderOptions: {
        errorCorrectionLevel: 'M',
        format: 'SVG',
        margin: 4,
        size: null,
        foregroundColor: '#000000',
        backgroundColor: '#ffffff'
    },
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

describe('QrCodeService', () => {
    let service: QrCodeService;
    let modelMock: ReturnType<typeof createModelMock>;
    let scanModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock(['findOne', 'create', 'count', 'findAll']);
        scanModelMock = createModelMock(['create']);
        loggerMock = createLoggerMock();
        service = new QrCodeService(
            { logger: loggerMock },
            modelMock as unknown as QrCodeModel,
            scanModelMock as unknown as QrCodeScanModel
        );
        actor = createActor({ permissions: [PermissionEnum.SETTINGS_MANAGE] });
    });

    describe('resolveBySlug', () => {
        it('returns the code for a live slug', async () => {
            modelMock.findOne.mockResolvedValue(liveQrCode);

            const result = await service.resolveBySlug({ actor, slug: 'k7Qm2XbT' });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(QR_ID);
            expect(result.data?.targetUrl).toBe('https://hospeda.com.ar/alojamientos/foo');
            expect(modelMock.findOne).toHaveBeenCalledWith({ slug: 'k7Qm2XbT' });
        });

        it('returns null for a slug that does not exist', async () => {
            modelMock.findOne.mockResolvedValue(null);

            const result = await service.resolveBySlug({ actor, slug: 'nOtHere1' });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();
        });

        /**
         * A retired code stops redirecting. Same shape as "does not exist" on
         * purpose: the redirect endpoint is unauthenticated, and distinguishing
         * the two enumerates the table.
         */
        it('returns null for a retired (isActive = false) code', async () => {
            modelMock.findOne.mockResolvedValue({ ...liveQrCode, isActive: false });

            const result = await service.resolveBySlug({ actor, slug: 'k7Qm2XbT' });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();
        });

        it('returns null for a soft-deleted code', async () => {
            modelMock.findOne.mockResolvedValue({
                ...liveQrCode,
                deletedAt: new Date('2026-02-01T00:00:00.000Z')
            });

            const result = await service.resolveBySlug({ actor, slug: 'k7Qm2XbT' });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();
        });

        /**
         * A soft-deleted code that is ALSO still flagged active must not
         * resolve. Pinned separately because the two guards are independent
         * conditions and a single combined check would pass the cases above
         * while letting this one through.
         */
        it('returns null for a soft-deleted code that is still flagged active', async () => {
            modelMock.findOne.mockResolvedValue({
                ...liveQrCode,
                isActive: true,
                deletedAt: new Date('2026-02-01T00:00:00.000Z')
            });

            const result = await service.resolveBySlug({ actor, slug: 'k7Qm2XbT' });

            expect(result.data).toBeNull();
        });

        /** The caller is whoever scanned a sticker — no permission is required. */
        it('serves an actor holding no permission at all', async () => {
            modelMock.findOne.mockResolvedValue(liveQrCode);

            const result = await service.resolveBySlug({
                actor: createActor({ permissions: [] }),
                slug: 'k7Qm2XbT'
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(QR_ID);
        });

        it('surfaces an INTERNAL_ERROR when the model throws', async () => {
            modelMock.findOne.mockRejectedValue(new Error('DB error'));

            const result = await service.resolveBySlug({ actor, slug: 'k7Qm2XbT' });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.data).toBeUndefined();
        });
    });

    describe('registerScan', () => {
        it('inserts a scan row for the code', async () => {
            scanModelMock.create.mockResolvedValue({
                id: SCAN_ID,
                qrCodeId: QR_ID,
                scannedAt: new Date('2026-09-02T12:00:00.000Z')
            });

            const result = await service.registerScan({ actor, qrCodeId: QR_ID });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(SCAN_ID);
            expect(result.data?.qrCodeId).toBe(QR_ID);
        });

        /**
         * The insert must carry the code id and NOTHING else — no IP, no
         * user-agent. `toStrictEqual` rather than `objectContaining`, which
         * would be blind to an extra field being added later.
         */
        it('writes exactly one field: the code id', async () => {
            scanModelMock.create.mockResolvedValue({
                id: SCAN_ID,
                qrCodeId: QR_ID,
                scannedAt: new Date()
            });

            await service.registerScan({ actor, qrCodeId: QR_ID });

            expect(scanModelMock.create).toHaveBeenCalledTimes(1);
            expect(scanModelMock.create.mock.calls[0]?.[0]).toStrictEqual({ qrCodeId: QR_ID });
        });

        it('rejects a qrCodeId that is not a UUID', async () => {
            const result = await service.registerScan({ actor, qrCodeId: 'not-a-uuid' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(scanModelMock.create).not.toHaveBeenCalled();
        });

        it('surfaces an INTERNAL_ERROR when the insert throws', async () => {
            scanModelMock.create.mockRejectedValue(new Error('DB error'));

            const result = await service.registerScan({ actor, qrCodeId: QR_ID });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    describe('create', () => {
        const input = {
            targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
            label: 'Cartelera plaza Ramirez',
            source: QrCodeSourceEnum.MANUAL
        };

        it('mints a slug when the caller supplies none', async () => {
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...liveQrCode,
                ...data
            }));

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            const written = modelMock.create.mock.calls[0]?.[0] as { slug: string };
            expect(written.slug).toMatch(
                /^[23456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz]{8}$/
            );
        });

        it('keeps an explicitly supplied slug', async () => {
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...liveQrCode,
                ...data
            }));

            await service.create(actor, { ...input, slug: 'MyPr2ntD' });

            expect((modelMock.create.mock.calls[0]?.[0] as { slug: string }).slug).toBe('MyPr2ntD');
        });

        /** An absent `renderOptions` must be stored as a complete document. */
        it('materialises the render defaults', async () => {
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...liveQrCode,
                ...data
            }));

            await service.create(actor, input);

            expect(
                (modelMock.create.mock.calls[0]?.[0] as { renderOptions: unknown }).renderOptions
            ).toStrictEqual({
                errorCorrectionLevel: 'M',
                format: 'SVG',
                margin: 4,
                size: null,
                foregroundColor: '#000000',
                backgroundColor: '#ffffff'
            });
        });

        it('refuses an actor without SETTINGS_MANAGE', async () => {
            const result = await service.create(createActor({ permissions: [] }), input);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.create).not.toHaveBeenCalled();
        });
    });
});
