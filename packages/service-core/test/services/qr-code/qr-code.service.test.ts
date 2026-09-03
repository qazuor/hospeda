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
        /**
         * Deliberately omits `isActive`, which carries `.default(true)` on the
         * create schema — creating a code without saying so must produce a live
         * one. The cast is the repo's standard boundary for this (see
         * `host-trade.service.test.ts`): `create()` is typed
         * `data: z.infer<TCreateSchema>`, the schema's OUTPUT type, so every
         * defaulted field reads as required at the call site even though Zod
         * fills it at runtime. `defaults isActive to true` below asserts that
         * the default really does fire, so the cast hides nothing.
         */
        const input = {
            targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
            label: 'Cartelera plaza Ramirez',
            source: QrCodeSourceEnum.MANUAL
        } as Parameters<typeof service.create>[1];

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

        /**
         * The create default is the counterpart of the stripped update default:
         * creating without `isActive` yields a live code, while an empty PATCH
         * yields nothing at all (so it cannot revive a retired one). This pins
         * the create half; `QrCodeUpdateInputSchema` pins the update half.
         */
        it('defaults isActive to true when the caller omits it', async () => {
            modelMock.findOne.mockResolvedValue(null);
            modelMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
                ...liveQrCode,
                ...data
            }));

            await service.create(actor, input);

            expect((modelMock.create.mock.calls[0]?.[0] as { isActive: boolean }).isActive).toBe(
                true
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

    /**
     * HOS-981 PR 3 — the update path.
     *
     * Every assertion here is on WHAT REACHES THE MODEL, never on what the
     * mocked model hands back. A test that asserted on the returned row would
     * be asserting on its own fixture: the mock echoes whatever it is given, so
     * a service that dropped a field entirely would still "return" it.
     */
    describe('update', () => {
        /**
         * A code stored RED, so a patch that silently reverts a colour has
         * something to revert it from. The whole point of the fixture.
         */
        const redQrCode = {
            ...liveQrCode,
            renderOptions: {
                errorCorrectionLevel: 'M',
                format: 'SVG',
                margin: 4,
                size: null,
                foregroundColor: '#ff0000',
                backgroundColor: '#ffffff'
            }
        };

        beforeEach(() => {
            modelMock = createModelMock(['findOne', 'findById', 'create', 'update']);
            service = new QrCodeService(
                { logger: loggerMock },
                modelMock as unknown as QrCodeModel,
                scanModelMock as unknown as QrCodeScanModel
            );
            modelMock.findById.mockResolvedValue(redQrCode);
            modelMock.update.mockImplementation(async (_where, data) => ({
                ...redQrCode,
                ...(data as Record<string, unknown>)
            }));
        });

        /** The retarget. This single call is the reason the entity exists. */
        it('writes the new target URL', async () => {
            const result = await service.update(actor, QR_ID, {
                targetUrl: 'https://hospeda.com.ar/es/destinos/colon/'
            });

            expect(result.error).toBeUndefined();
            expect(modelMock.update).toHaveBeenCalledTimes(1);
            const [where, patch] = modelMock.update.mock.calls[0] as [
                Record<string, unknown>,
                Record<string, unknown>
            ];
            expect(where).toEqual({ id: QR_ID });
            expect(patch.targetUrl).toBe('https://hospeda.com.ar/es/destinos/colon/');
        });

        /** Whitespace around a URL pasted out of a browser bar must not persist. */
        it('trims the new target URL without otherwise rewriting it', async () => {
            await service.update(actor, QR_ID, {
                targetUrl: '  https://hospeda.com.ar/es/destinos/colon/  '
            });

            const patch = modelMock.update.mock.calls[0]?.[1] as Record<string, unknown>;
            // Trailing slash intact, path untouched: a redirect target is copied
            // by a human and canonicalising it would move where a printed code
            // sends people.
            expect(patch.targetUrl).toBe('https://hospeda.com.ar/es/destinos/colon/');
        });

        /**
         * THE PATCH-MERGE ASSERTION.
         *
         * `toStrictEqual` on the whole `renderOptions` object, not
         * `objectContaining` — which is blind to a field being present that
         * should not be, and it is exactly the extra fields that do the damage
         * here. If `QrCodeUpdateInputSchema` stops declaring the sub-object
         * `.partial()`, Zod completes this patch with all five defaults,
         * `foregroundColor: '#000000'` among them, and the red is written away.
         */
        it('sends ONLY the render option the caller changed, so the stored colour survives', async () => {
            const result = await service.update(actor, QR_ID, { renderOptions: { margin: 8 } });

            expect(result.error).toBeUndefined();
            const patch = modelMock.update.mock.calls[0]?.[1] as {
                renderOptions: Record<string, unknown>;
            };

            expect(patch.renderOptions).toStrictEqual({ margin: 8 });
            // Stated twice, on purpose: the line above is the general rule, and
            // this one names the field whose loss is silent and permanent.
            expect(patch.renderOptions).not.toHaveProperty('foregroundColor');
        });

        /**
         * The slug is already printed on a sticker. `.strict()` on the update
         * schema is what refuses it — asserting the model was never touched is
         * what proves the refusal happened BEFORE the write rather than being
         * quietly dropped from it.
         */
        it('refuses an update that carries a slug', async () => {
            const result = await service.update(actor, QR_ID, {
                slug: 'Rena2ed4'
            } as unknown as Parameters<typeof service.update>[2]);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(modelMock.update).not.toHaveBeenCalled();
        });

        it('refuses an unknown render option', async () => {
            const result = await service.update(actor, QR_ID, {
                renderOptions: { logoUrl: 'https://example.com/logo.png' }
            } as unknown as Parameters<typeof service.update>[2]);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(modelMock.update).not.toHaveBeenCalled();
        });

        it('refuses an actor without SETTINGS_MANAGE', async () => {
            const result = await service.update(createActor({ permissions: [] }), QR_ID, {
                targetUrl: 'https://hospeda.com.ar/es/'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.update).not.toHaveBeenCalled();
        });
    });

    /**
     * The free-text columns the admin list searches over.
     *
     * Pinned as an exact list rather than a containment check: the base class
     * defaults to `['name']`, a column `qr_codes` does not have, and
     * `buildSearchCondition` DROPS unknown columns silently before returning
     * `undefined` for an empty list. A regression to the default therefore
     * attaches no filter at all and answers `?search=plaza` with the whole
     * table — a bug that looks, from the panel, like a search that matched
     * everything rather than one that ran nothing.
     */
    describe('getSearchableColumns', () => {
        it('searches label, slug and targetUrl — and nothing that does not exist', () => {
            const columns = (
                service as unknown as { getSearchableColumns: () => string[] }
            ).getSearchableColumns();

            expect(columns).toStrictEqual(['label', 'slug', 'targetUrl']);
            expect(columns).not.toContain('name');
        });
    });
});
