/**
 * Entity provisioning on `QrCodeService` (HOS-981 PR 4).
 *
 * These three methods are what turn a provider's listing into a printable code
 * and keep that code pointing somewhere real. What they have in common, and
 * what the tests below are actually about, is that they run for a caller who
 * holds NO QR permission at all — a provider fetching their own sticker — and
 * that they are reached from a `GET`, so two of them can be in flight at once.
 *
 * @module test/services/qr-code/qr-code.entity-provisioning
 */

import type { QrCodeModel, QrCodeScanModel } from '@repo/db';
import { EntityTypeEnum, QrCodeSourceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const HOST_TRADE_ID = '33333333-3333-4333-8333-333333333333';
const QR_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_QR_ID = '44444444-4444-4444-8444-444444444444';

const USAGE_URL =
    'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-centro/registrar-uso';

const RENDER_OPTIONS = {
    errorCorrectionLevel: 'M',
    format: 'SVG',
    margin: 4,
    size: null,
    foregroundColor: '#000000',
    backgroundColor: '#ffffff'
};

/** The code a provider's listing already has. */
const existingCode = {
    id: QR_ID,
    slug: 'k7Qm2XbT',
    targetUrl: USAGE_URL,
    label: 'Host trade usage QR — Plomero Centro (plomero-centro)',
    description: null,
    source: QrCodeSourceEnum.GENERATED,
    entityType: EntityTypeEnum.HOST_TRADE,
    entityId: HOST_TRADE_ID,
    renderOptions: RENDER_OPTIONS,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

/**
 * A wrapped unique violation shaped like the real thing.
 *
 * Drizzle does NOT copy the SQLSTATE onto its own wrapper — it lives on the pg
 * driver error at `.cause` — so an error carrying a top-level `code` would test
 * a shape production never produces.
 */
function uniqueViolation(): Error {
    const driverError = Object.assign(new Error('duplicate key value'), {
        code: '23505',
        constraint: 'qrCodes_slug_unique',
        table: 'qr_codes'
    });
    return Object.assign(new Error('Failed query: insert into "qr_codes"'), {
        cause: driverError
    });
}

describe('QrCodeService — entity provisioning', () => {
    let service: QrCodeService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    /** A provider: authenticated, and holding not one QR permission. */
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createModelMock(['findOne', 'findAll', 'create', 'update']);
        loggerMock = createLoggerMock();
        service = new QrCodeService(
            { logger: loggerMock },
            modelMock as unknown as QrCodeModel,
            createModelMock(['create']) as unknown as QrCodeScanModel
        );
        actor = createActor({ permissions: [] });
    });

    describe('getOrCreateForEntity', () => {
        it('returns the existing code and writes nothing on a second call', async () => {
            modelMock.findAll.mockResolvedValue({ items: [existingCode], total: 1 });

            const first = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });
            const second = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });

            expect(first.error).toBeUndefined();
            expect(second.error).toBeUndefined();
            expect(first.data?.id).toBe(QR_ID);
            expect(second.data?.id).toBe(QR_ID);
            expect(first.data?.slug).toBe(second.data?.slug);
            // Idempotence is only worth anything if the second call did not
            // mint a second permanent slug.
            expect(modelMock.create).not.toHaveBeenCalled();
        });

        it('creates a GENERATED code carrying the entity, the target and a minted slug', async () => {
            modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...existingCode,
                ...data,
                id: QR_ID
            }));

            const result = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });

            expect(result.error).toBeUndefined();
            expect(modelMock.create).toHaveBeenCalledTimes(1);

            // Read field by field rather than with `objectContaining`, which is
            // blind to a field that was never written at all.
            const written = modelMock.create.mock.calls[0][0] as Record<string, unknown>;
            expect(written.source).toBe(QrCodeSourceEnum.GENERATED);
            expect(written.entityType).toBe(EntityTypeEnum.HOST_TRADE);
            expect(written.entityId).toBe(HOST_TRADE_ID);
            expect(written.targetUrl).toBe(USAGE_URL);
            expect(written.isActive).toBe(true);
            expect(written.renderOptions).toEqual(RENDER_OPTIONS);

            // The slug follows the admin panel's convention exactly: the bare
            // `generateShortId` alphabet, no separator, no semantic prefix.
            expect(written.slug).toMatch(
                /^[23456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz]{8}$/
            );
        });

        it('re-reads and returns the winner when a concurrent insert took the slug', async () => {
            // First lookup: nothing yet, so both requests proceed to insert.
            // Second lookup (after the violation): the winner's row is there.
            modelMock.findAll
                .mockResolvedValueOnce({ items: [], total: 0 })
                .mockResolvedValueOnce({ items: [existingCode], total: 1 });
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockRejectedValue(uniqueViolation());

            const result = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });

            // The loser of the race answers with the winner's code, not a 500.
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(QR_ID);
            expect(result.data?.slug).toBe('k7Qm2XbT');
        });

        it('does not swallow a unique violation that left no code behind', async () => {
            // A slug collision against a DIFFERENT entity: recovering would hand
            // the caller a success with no code in it.
            modelMock.findAll.mockResolvedValue({ items: [], total: 0 });
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockRejectedValue(uniqueViolation());

            const result = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
        });

        it('ignores a soft-deleted code and provisions a fresh one', async () => {
            modelMock.findAll.mockResolvedValue({
                items: [{ ...existingCode, deletedAt: new Date('2026-02-01T00:00:00.000Z') }],
                total: 1
            });
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...existingCode,
                ...data,
                id: SECOND_QR_ID
            }));

            const result = await service.getOrCreateForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL,
                label: 'Host trade usage QR — Plomero Centro (plomero-centro)'
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(SECOND_QR_ID);
            expect(modelMock.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('findLiveCodeForEntity', () => {
        /**
         * The table cannot yet enforce one live code per entity, so a lookup
         * that found two must answer the same one every time — otherwise the
         * repointing hook would chase whichever row the database happened to
         * return first.
         */
        it('picks the oldest live row when the entity carries more than one', async () => {
            modelMock.findAll.mockResolvedValue({
                items: [
                    {
                        ...existingCode,
                        id: SECOND_QR_ID,
                        slug: 'Zx9Wp2Qm',
                        createdAt: new Date('2026-03-01T00:00:00.000Z')
                    },
                    existingCode
                ],
                total: 2
            });

            const result = await service.findLiveCodeForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(QR_ID);
        });

        it('answers null when the entity has no code', async () => {
            modelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            const result = await service.findLiveCodeForEntity({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID
            });

            expect(result.error).toBeUndefined();
            expect(result.data).toBeNull();
        });
    });

    describe('setEntityTargetUrl', () => {
        const RENAMED_URL =
            'https://hospeda.com.ar/mi-cuenta/directorio-proveedores/plomero-del-centro/registrar-uso';

        it('repoints the existing code without touching its slug', async () => {
            modelMock.findAll.mockResolvedValue({ items: [existingCode], total: 1 });
            modelMock.update.mockResolvedValue({ ...existingCode, targetUrl: RENAMED_URL });

            const result = await service.setEntityTargetUrl({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: RENAMED_URL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.updated).toBe(true);

            const [where, patch] = modelMock.update.mock.calls[0] as [
                Record<string, unknown>,
                Record<string, unknown>
            ];
            expect(where).toEqual({ id: QR_ID });
            expect(patch.targetUrl).toBe(RENAMED_URL);
            // The printed half must never move.
            expect(Object.hasOwn(patch, 'slug')).toBe(false);
        });

        it('writes nothing when the stored target already agrees', async () => {
            modelMock.findAll.mockResolvedValue({ items: [existingCode], total: 1 });

            const result = await service.setEntityTargetUrl({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: USAGE_URL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.updated).toBe(false);
            expect(modelMock.update).not.toHaveBeenCalled();
        });

        it('is a silent no-op when the entity has no code yet', async () => {
            modelMock.findAll.mockResolvedValue({ items: [], total: 0 });

            const result = await service.setEntityTargetUrl({
                actor,
                entityType: EntityTypeEnum.HOST_TRADE,
                entityId: HOST_TRADE_ID,
                targetUrl: RENAMED_URL
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.updated).toBe(false);
            // Provisioning here would burn a permanent slug during an edit.
            expect(modelMock.create).not.toHaveBeenCalled();
            expect(modelMock.update).not.toHaveBeenCalled();
        });
    });
});
