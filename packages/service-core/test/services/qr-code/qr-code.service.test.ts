/**
 * Tests for QrCodeService (HOS-981).
 *
 * The two methods that carry real logic here are the ones PR 2's public
 * redirect will consume: `resolveBySlug` and `registerScan`.
 *
 * @module test/services/qr-code/qr-code.service
 */

import type { QrCodeModel, QrCodeScanModel } from '@repo/db';
import {
    PermissionEnum,
    QrCodeSourceEnum,
    QrScanDeviceTypeEnum,
    QrScanOsEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const QR_ID = '11111111-1111-4111-8111-111111111111';
const SCAN_ID = '22222222-2222-4222-8222-222222222222';
/** A signed-in scanner, for the HOS-1141 context assertions. */
const SCANNER_USER_ID = '33333333-3333-4333-8333-333333333333';

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
        scanModelMock = createModelMock(['create', 'getScanAggregateForCode']);
        loggerMock = createLoggerMock();
        service = new QrCodeService(
            { logger: loggerMock },
            modelMock as unknown as QrCodeModel,
            scanModelMock as unknown as QrCodeScanModel
        );
        actor = createActor({
            permissions: [
                PermissionEnum.QR_CODE_VIEW,
                PermissionEnum.QR_CODE_CREATE,
                PermissionEnum.QR_CODE_UPDATE,
                PermissionEnum.QR_CODE_DELETE
            ]
        });
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
         * The insert must carry EXACTLY the seven HOS-1141 columns — still no
         * IP and still no referrer, the two the table's own comment rejects by
         * name. `toStrictEqual` rather than `objectContaining`, which would be
         * blind to an eighth field appearing later.
         *
         * The nulls are asserted rather than left absent on purpose: a key that
         * silently disappeared would reach Drizzle as `undefined`, which is not
         * the same insert as an explicit `NULL`.
         */
        it('writes exactly the seven scan columns, defaulting the context to null', async () => {
            scanModelMock.create.mockResolvedValue({
                id: SCAN_ID,
                qrCodeId: QR_ID,
                scannedAt: new Date()
            });

            await service.registerScan({ actor, qrCodeId: QR_ID });

            expect(scanModelMock.create).toHaveBeenCalledTimes(1);
            expect(scanModelMock.create.mock.calls[0]?.[0]).toStrictEqual({
                qrCodeId: QR_ID,
                userAgent: null,
                deviceType: null,
                os: null,
                browserLanguage: null,
                targetUrlAtScan: null,
                userId: null
            });
        });

        it('persists the whole scan context when the caller supplies one', async () => {
            scanModelMock.create.mockResolvedValue({
                id: SCAN_ID,
                qrCodeId: QR_ID,
                scannedAt: new Date()
            });

            await service.registerScan({
                actor,
                qrCodeId: QR_ID,
                context: {
                    userAgent: 'Mozilla/5.0 (iPhone)',
                    deviceType: QrScanDeviceTypeEnum.MOBILE,
                    os: QrScanOsEnum.IOS,
                    browserLanguage: 'pt',
                    targetUrlAtScan: 'https://hospeda.com.ar/es/gastronomia/foo/',
                    userId: SCANNER_USER_ID
                }
            });

            expect(scanModelMock.create.mock.calls[0]?.[0]).toStrictEqual({
                qrCodeId: QR_ID,
                userAgent: 'Mozilla/5.0 (iPhone)',
                deviceType: QrScanDeviceTypeEnum.MOBILE,
                os: QrScanOsEnum.IOS,
                browserLanguage: 'pt',
                targetUrlAtScan: 'https://hospeda.com.ar/es/gastronomia/foo/',
                userId: SCANNER_USER_ID
            });
        });

        it('rejects a qrCodeId that is not a UUID', async () => {
            const result = await service.registerScan({ actor, qrCodeId: 'not-a-uuid' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(scanModelMock.create).not.toHaveBeenCalled();
        });

        it('refuses a user agent past the documented bound rather than truncating twice', async () => {
            // The DERIVER is what truncates. A longer string reaching this
            // schema means the deriver was bypassed — a bug worth failing on,
            // not a value to silently repair a second time behind the caller's
            // back. Failing here is safe: `recordScanBestEffort` in the route
            // swallows it and the redirect continues.
            const result = await service.registerScan({
                actor,
                qrCodeId: QR_ID,
                context: { userAgent: 'A'.repeat(1025) }
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(scanModelMock.create).not.toHaveBeenCalled();
        });

        it('accepts a user agent exactly at the bound', async () => {
            // The other side of the boundary, so the check above cannot be
            // green merely because everything is rejected.
            scanModelMock.create.mockResolvedValue({
                id: SCAN_ID,
                qrCodeId: QR_ID,
                scannedAt: new Date()
            });

            const result = await service.registerScan({
                actor,
                qrCodeId: QR_ID,
                context: { userAgent: 'A'.repeat(1024) }
            });

            expect(result.error).toBeUndefined();
            expect(scanModelMock.create).toHaveBeenCalledTimes(1);
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
                backgroundColor: '#ffffff',
                centerLogo: 'NONE'
            });
        });

        it('refuses an actor without QR_CODE_CREATE', async () => {
            const result = await service.create(createActor({ permissions: [] }), input);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.create).not.toHaveBeenCalled();
        });

        /**
         * The whole point of splitting the family: read access does not carry
         * write access. An actor holding only `view` must not be able to mint a
         * code — if this passed, the four verbs would be four names for one
         * permission.
         */
        it('refuses an actor who holds only QR_CODE_VIEW', async () => {
            const result = await service.create(
                createActor({ permissions: [PermissionEnum.QR_CODE_VIEW] }),
                input
            );

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.create).not.toHaveBeenCalled();
        });

        /**
         * And the gate really is the QR one, not the borrowed settings gate it
         * replaced. Without this, leaving `SETTINGS_MANAGE` in place alongside
         * would look identical from inside the suite.
         */
        it('is no longer satisfied by SETTINGS_MANAGE', async () => {
            const result = await service.create(
                createActor({ permissions: [PermissionEnum.SETTINGS_MANAGE] }),
                input
            );

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

        it('refuses an actor without QR_CODE_UPDATE', async () => {
            const result = await service.update(createActor({ permissions: [] }), QR_ID, {
                targetUrl: 'https://hospeda.com.ar/es/'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.update).not.toHaveBeenCalled();
        });

        /**
         * Retargeting is the one verb worth withholding from somebody who may
         * otherwise browse and print codes: it silently changes where every
         * sticker already in the field sends people.
         */
        it('refuses an actor who holds only QR_CODE_VIEW', async () => {
            const result = await service.update(
                createActor({ permissions: [PermissionEnum.QR_CODE_VIEW] }),
                QR_ID,
                { targetUrl: 'https://hospeda.com.ar/es/' }
            );

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

    /**
     * The aggregate read behind the owner's scan panel (HOS-1044 §6.4).
     *
     * The timezone-safe date math and the null→'unknown' breakdown mapping
     * are pinned as PURE functions in `qr-code.scan-stats.test.ts` — this
     * suite only checks that the service wires the model's raw aggregate
     * through those functions correctly, and defaults the window and
     * `windowStart` the way the route expects.
     */
    describe('getScanStatsForCode', () => {
        // Pinned so the gap-filled daily series is deterministic: the
        // service defaults `now` to the real clock, and the mocked model
        // rows below must land inside whatever window that clock produces.
        const FAKE_NOW = new Date('2026-01-08T12:00:00.000Z');

        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(FAKE_NOW);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('defaults the window to 30d and computes a windowStart from it', async () => {
            (scanModelMock.getScanAggregateForCode as Mock).mockResolvedValue({
                total: 0,
                dailySeries: [],
                byDeviceType: [],
                byOs: [],
                byBrowserLanguage: []
            });

            const result = await service.getScanStatsForCode({ actor, qrCodeId: QR_ID });

            expect(result.error).toBeUndefined();
            expect(result.data?.window).toBe('30d');
            expect(result.data?.dailySeries).toHaveLength(30);
            expect(scanModelMock.getScanAggregateForCode as Mock).toHaveBeenCalledWith(
                { qrCodeId: QR_ID, windowStart: expect.any(Date) },
                undefined
            );
        });

        it('passes the requested window straight through to the response', async () => {
            (scanModelMock.getScanAggregateForCode as Mock).mockResolvedValue({
                total: 0,
                dailySeries: [],
                byDeviceType: [],
                byOs: [],
                byBrowserLanguage: []
            });

            const result = await service.getScanStatsForCode({
                actor,
                qrCodeId: QR_ID,
                window: '7d'
            });

            expect(result.data?.window).toBe('7d');
            expect(result.data?.dailySeries).toHaveLength(7);
        });

        /**
         * AC-6: the model's raw total and daily row pass through untouched —
         * "one scan" reaches the response as `total: 1` with the series entry
         * on the same day the model reported.
         */
        it('surfaces the model total and daily series unchanged (AC-6)', async () => {
            (scanModelMock.getScanAggregateForCode as Mock).mockResolvedValue({
                total: 1,
                dailySeries: [{ date: '2026-01-05', total: 1 }],
                byDeviceType: [],
                byOs: [],
                byBrowserLanguage: []
            });

            const result = await service.getScanStatsForCode({
                actor,
                qrCodeId: QR_ID,
                window: '7d'
            });

            expect(result.data?.total).toBe(1);
            expect(result.data?.dailySeries.find((d) => d.date === '2026-01-05')?.total).toBe(1);
        });

        /**
         * AC-7: a breakdown row with a null key (garbage/absent User-Agent)
         * still counts — the service folds it into 'unknown' rather than
         * dropping it, and the total is untouched by the fold.
         */
        it('folds null breakdown keys into "unknown" without changing the total (AC-7)', async () => {
            (scanModelMock.getScanAggregateForCode as Mock).mockResolvedValue({
                total: 2,
                dailySeries: [{ date: '2026-01-05', total: 2 }],
                byDeviceType: [{ key: null, total: 2 }],
                byOs: [
                    { key: null, total: 1 },
                    { key: 'IOS', total: 1 }
                ],
                byBrowserLanguage: [{ key: null, total: 2 }]
            });

            const result = await service.getScanStatsForCode({ actor, qrCodeId: QR_ID });

            expect(result.data?.total).toBe(2);
            expect(result.data?.byDeviceType).toEqual({ unknown: 2 });
            expect(result.data?.byOs).toEqual({ unknown: 1, IOS: 1 });
            expect(result.data?.byBrowserLanguage).toEqual({ unknown: 2 });
        });

        it('forwards the transaction client from ctx to the model call', async () => {
            const tx = { fakeTx: true } as never;
            (scanModelMock.getScanAggregateForCode as Mock).mockResolvedValue({
                total: 0,
                dailySeries: [],
                byDeviceType: [],
                byOs: [],
                byBrowserLanguage: []
            });

            await service.getScanStatsForCode({ actor, qrCodeId: QR_ID, ctx: { tx } });

            expect(scanModelMock.getScanAggregateForCode as Mock).toHaveBeenCalledWith(
                { qrCodeId: QR_ID, windowStart: expect.any(Date) },
                tx
            );
        });
    });
});
