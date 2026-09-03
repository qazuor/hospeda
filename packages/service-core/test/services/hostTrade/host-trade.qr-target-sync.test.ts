/**
 * Repointing a provider's QR when the listing is renamed (HOS-981 PR 4).
 *
 * The feature this pins is the one the whole indirection exists for: a sticker
 * already printed on a van keeps working after the provider changes its slug.
 * Two halves make that true and both are asserted here, because either alone is
 * a defect wearing the other's clothes.
 *
 * - `target_url` MOVES, or every scan lands on a page that no longer exists.
 * - `qr_codes.slug` does NOT move, or the printed symbol stops matching the
 *   code the platform will resolve.
 *
 * The listing's slug is only reachable through the ADMIN update path.
 * `HostTradeOwnerUpdateSchema` does not declare `slug` — the field is absent
 * from the schema rather than validated as forbidden — so a provider's own
 * PATCH loses it at parse time and cannot reach this hook at all.
 *
 * @module test/services/hostTrade/host-trade.qr-target-sync
 */

import type { AccommodationModel, HostTradeModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, QrCodeSourceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import type { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const HT_ID = getMockId('attraction', 'ht-qr-1');
const DEST_ID = getMockId('destination', 'dest-qr-1');
const USER_ID = getMockId('user', 'owner-qr-1');
const QR_ID = getMockId('user', 'qr-row-1');

const SITE = 'https://hospeda.com.ar';
const OLD_SLUG = 'plomero-centro';
const NEW_SLUG = 'plomero-del-centro';

const usageUrl = (slug: string) => `${SITE}/mi-cuenta/directorio-proveedores/${slug}/registrar-uso`;

const makeHostTrade = (overrides: Record<string, unknown> = {}) => ({
    id: HT_ID,
    slug: OLD_SLUG,
    name: 'Plomero Centro',
    category: 'PLOMERIA',
    contact: '+54 3442 123456',
    benefit: '10% descuento presentando Hospeda',
    destinationId: DEST_ID,
    is24h: false,
    scheduleText: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: USER_ID,
    updatedById: USER_ID,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

/**
 * A stateful QR double.
 *
 * Stateful rather than a bare `vi.fn()` because the property under test is the
 * END STATE of the stored row: a spy would let an implementation that "called
 * something with the right argument" pass while writing the wrong column, and
 * it could not show that the slug survived at all.
 */
function makeQrDouble(initial: { slug: string; targetUrl: string } | null) {
    const stored = initial
        ? {
              id: QR_ID,
              slug: initial.slug,
              targetUrl: initial.targetUrl,
              label: 'Host trade usage QR — Plomero Centro (plomero-centro)',
              description: null,
              source: QrCodeSourceEnum.GENERATED,
              entityType: EntityTypeEnum.HOST_TRADE,
              entityId: HT_ID,
              isActive: true,
              deletedAt: null
          }
        : null;

    const findLiveCodeForEntity = vi.fn(async () => ({ data: stored, error: undefined }));
    const setEntityTargetUrl = vi.fn(async (input: { targetUrl: string }) => {
        if (!stored) return { data: { updated: false }, error: undefined };
        if (stored.targetUrl === input.targetUrl) {
            return { data: { updated: false }, error: undefined };
        }
        stored.targetUrl = input.targetUrl;
        return { data: { updated: true }, error: undefined };
    });

    return {
        stored,
        findLiveCodeForEntity,
        setEntityTargetUrl,
        asService: () => ({ findLiveCodeForEntity, setEntityTargetUrl }) as unknown as QrCodeService
    };
}

function buildService(input: {
    qr: ReturnType<typeof makeQrDouble>;
    existing?: Record<string, unknown>;
    updated?: Record<string, unknown>;
}) {
    const existing = input.existing ?? makeHostTrade();
    const updated = input.updated ?? makeHostTrade({ slug: NEW_SLUG });

    const model = {
        ...createModelMock(['findForHost']),
        findById: vi.fn().mockResolvedValue(existing),
        // The `_beforeUpdate` collision check: the new slug is free.
        findOne: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(updated)
    };

    const service = new HostTradeService(
        { logger: createLoggerMock() },
        model as unknown as HostTradeModel,
        createModelMock() as unknown as AccommodationModel,
        null,
        input.qr.asService()
    );

    return { service, model };
}

const admin = createActor({ permissions: [PermissionEnum.HOST_TRADE_UPDATE] });

describe('HostTradeService — QR target sync on slug change', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repoints the QR code’s target_url at the new slug', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: usageUrl(OLD_SLUG) });
        const { service } = buildService({ qr });

        const result = await service.update(admin, HT_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(qr.stored?.targetUrl).toBe(usageUrl(NEW_SLUG));
    });

    /**
     * The heart of the feature. A sticker is ink: if the rename moved the QR's
     * own slug, every code already in the field would resolve to nothing, and
     * the fix would have been a more expensive version of the bug.
     */
    it('leaves the QR code’s own slug untouched, so the printed sticker still resolves', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: usageUrl(OLD_SLUG) });
        const { service } = buildService({ qr });

        await service.update(admin, HT_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(qr.stored?.slug).toBe('k7Qm2XbT');
        // And no call was even offered a slug to write.
        const patch = qr.setEntityTargetUrl.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.hasOwn(patch, 'slug')).toBe(false);
    });

    it('is a silent no-op when the listing has no QR code yet', async () => {
        const qr = makeQrDouble(null);
        const { service } = buildService({ qr });

        const result = await service.update(admin, HT_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        // No error, and nothing minted: a code is created when somebody first
        // asks to SEE one, never during an unrelated edit.
        expect(result.error).toBeUndefined();
        expect(qr.setEntityTargetUrl).not.toHaveBeenCalled();
    });

    it('writes nothing when the update did not move the slug', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: usageUrl(OLD_SLUG) });
        const { service } = buildService({
            qr,
            updated: makeHostTrade({ name: 'Plomero Centro SRL' })
        });

        await service.update(admin, HT_ID, {
            name: 'Plomero Centro SRL'
        } as Parameters<typeof service.update>[2]);

        const outcome = await qr.setEntityTargetUrl.mock.results[0]?.value;
        expect(outcome?.data?.updated).toBe(false);
        expect(qr.stored?.targetUrl).toBe(usageUrl(OLD_SLUG));
    });

    /**
     * The listing row is already written when this hook runs and no transaction
     * wraps it, so a QR failure that propagated would hand an admin an error
     * over a change that did happen — and leave the stale target behind anyway.
     */
    it('lets the listing update stand when the QR sync throws', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: usageUrl(OLD_SLUG) });
        qr.setEntityTargetUrl.mockRejectedValue(new Error('database is down'));
        const { service } = buildService({ qr });

        const result = await service.update(admin, HT_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(result.data?.slug).toBe(NEW_SLUG);
    });

    /**
     * The site origin is read back out of the stored target rather than taken
     * from configuration, so a row whose target is not a parseable absolute URL
     * must be left alone instead of being rewritten against a guessed origin.
     */
    it('refuses to guess an origin when the stored target is not a URL', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: 'not-a-url' });
        const { service } = buildService({ qr });

        const result = await service.update(admin, HT_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(qr.setEntityTargetUrl).not.toHaveBeenCalled();
        expect(qr.stored?.targetUrl).toBe('not-a-url');
    });
});
