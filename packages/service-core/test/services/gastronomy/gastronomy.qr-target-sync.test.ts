/**
 * Repointing a venue's menu QR when the listing is renamed (HOS-1044 §6.3,
 * AC-5).
 *
 * Mirrors `host-trade.qr-target-sync.test.ts` structurally — same double
 * shape, same case list — because `GastronomyService._afterUpdate` copies
 * `HostTradeService._afterUpdate`'s four decisions verbatim (see the spec's
 * §6.3). The one addition here is the locale round-trip: a gastronomy menu
 * target carries `/{lang}/...`, which `HostTradeService`'s fixed-path target
 * never had to preserve.
 *
 * @module test/services/gastronomy/gastronomy.qr-target-sync
 */

import {
    EntityTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    QrCodePurposeEnum,
    QrCodeSourceEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import type { Actor } from '../../../src/types';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const G_ID = getMockId('user', 'gastro-qr-1');
const OWNER_ID = getMockId('user', 'owner-gastro-qr-1');
const QR_ID = getMockId('user', 'qr-row-gastro-1');

const SITE = 'https://hospeda.com.ar';
const OLD_SLUG = 'la-parrilla-del-sur';
const NEW_SLUG = 'la-nueva-parrilla-del-sur';

const menuUrl = (lang: string, slug: string) => `${SITE}/${lang}/gastronomia/${slug}/carta/`;

const makeGastronomy = (overrides: Record<string, unknown> = {}) => ({
    id: G_ID,
    name: 'La Parrilla del Sur',
    slug: OLD_SLUG,
    type: 'PARRILLA',
    destinationId: getMockId('destination', 'dest-gastro-qr-1'),
    ownerId: OWNER_ID,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    averageRating: 0,
    reviewsCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: OWNER_ID,
    updatedById: OWNER_ID,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

/**
 * A stateful QR double — same rationale as the host-trade twin: the property
 * under test is the END STATE of the stored row, which a bare spy cannot show.
 */
function makeQrDouble(initial: { slug: string; targetUrl: string } | null) {
    const stored = initial
        ? {
              id: QR_ID,
              slug: initial.slug,
              targetUrl: initial.targetUrl,
              label: 'Gastronomy menu QR — La Parrilla del Sur (la-parrilla-del-sur)',
              description: null,
              source: QrCodeSourceEnum.GENERATED,
              entityType: EntityTypeEnum.GASTRONOMY,
              entityId: G_ID,
              purpose: QrCodePurposeEnum.MENU,
              isActive: true,
              deletedAt: null
          }
        : null;

    /** Keys that ADDRESS the row rather than patch it. */
    const ADDRESSING_KEYS = new Set(['actor', 'entityType', 'entityId', 'purpose', 'ctx']);

    const findLiveCodeForEntity = vi.fn(async (_input: Record<string, unknown>) => ({
        data: stored,
        error: undefined
    }));
    const setEntityTargetUrl = vi.fn(async (input: Record<string, unknown>) => {
        if (!stored) return { data: { updated: false }, error: undefined };

        const patch = Object.fromEntries(
            Object.entries(input).filter(([key]) => !ADDRESSING_KEYS.has(key))
        );
        const changed = Object.entries(patch).some(
            ([key, value]) => (stored as Record<string, unknown>)[key] !== value
        );
        Object.assign(stored, patch);

        return { data: { updated: changed }, error: undefined };
    });

    return {
        stored,
        findLiveCodeForEntity,
        setEntityTargetUrl,
        asService: () => ({ findLiveCodeForEntity, setEntityTargetUrl }) as unknown as QrCodeService
    };
}

/**
 * Loosened on purpose, matching `gastronomy.service.test.ts`'s own escape
 * hatch: the test injects doubles onto PRIVATE fields (`model`,
 * `_destinationModel`) that the public `GastronomyService` type does not
 * expose.
 */
type AnyService = any;

function buildService(input: {
    qr: ReturnType<typeof makeQrDouble>;
    existing?: Record<string, unknown>;
    updated?: Record<string, unknown>;
}) {
    const existing = input.existing ?? makeGastronomy();
    const updated = input.updated ?? makeGastronomy({ slug: NEW_SLUG });

    const model = {
        entityName: 'gastronomy',
        findById: vi.fn().mockResolvedValue(existing),
        findByIds: vi.fn().mockResolvedValue([existing]),
        // The `_beforeUpdate` slug-collision check: the new slug is free.
        findOne: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue({ items: [existing], total: 1 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        update: vi.fn().mockResolvedValue(updated),
        updateById: vi.fn().mockResolvedValue(updated),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        findWithRelations: vi.fn().mockResolvedValue(existing),
        findOneWithRelations: vi.fn().mockResolvedValue(existing),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };

    const service: AnyService = new GastronomyService(
        { logger: createLoggerMock() },
        undefined,
        input.qr.asService()
    );
    service.model = model;
    // Never publicly visible in this suite's fixtures if destinationId lookup
    // is exercised — stubbed so `_scheduleListingRevalidation` never touches a
    // real DB (same stub `gastronomy.service.test.ts` uses).
    service._destinationModel = {
        findById: vi.fn().mockResolvedValue({ slug: 'destino-test' })
    };

    return { service: service as GastronomyService, model };
}

const admin: Actor = {
    id: 'admin-uuid-1',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.COMMERCE_EDIT_ALL]
};

describe('GastronomyService — menu QR target sync on slug change (HOS-1044 AC-5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('repoints the QR code’s target_url at the new slug', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('es', OLD_SLUG) });
        const { service } = buildService({ qr });

        const result = await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(qr.stored?.targetUrl).toBe(menuUrl('es', NEW_SLUG));
    });

    it('preserves the locale segment the code was minted with', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('en', OLD_SLUG) });
        const { service } = buildService({ qr });

        await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(qr.stored?.targetUrl).toBe(menuUrl('en', NEW_SLUG));
    });

    it('addresses the listing’s code by its MENU purpose on both calls', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('es', OLD_SLUG) });
        const { service } = buildService({ qr });

        await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        const read = qr.findLiveCodeForEntity.mock.calls[0]?.[0] as Record<string, unknown>;
        const write = qr.setEntityTargetUrl.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(read.purpose).toBe(QrCodePurposeEnum.MENU);
        expect(write.purpose).toBe(QrCodePurposeEnum.MENU);
        expect(write.purpose).toBe(read.purpose);
    });

    it('leaves the QR code’s own slug untouched, so the printed sticker still resolves', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('es', OLD_SLUG) });
        const { service } = buildService({ qr });

        await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(qr.stored?.slug).toBe('k7Qm2XbT');
        const patch = qr.setEntityTargetUrl.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.hasOwn(patch, 'slug')).toBe(false);
    });

    it('is a silent no-op when the venue has no menu QR yet', async () => {
        const qr = makeQrDouble(null);
        const { service } = buildService({ qr });

        const result = await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        // No error, and nothing minted: a code is created when somebody first
        // asks to SEE one, never during an unrelated edit.
        expect(result.error).toBeUndefined();
        expect(qr.setEntityTargetUrl).not.toHaveBeenCalled();
    });

    it('writes nothing when the update did not move the slug', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('es', OLD_SLUG) });
        const { service } = buildService({
            qr,
            updated: makeGastronomy({ name: 'La Parrilla del Sur SRL' })
        });

        await service.update(admin, G_ID, {
            name: 'La Parrilla del Sur SRL'
        } as Parameters<typeof service.update>[2]);

        const outcome = await qr.setEntityTargetUrl.mock.results[0]?.value;
        expect(outcome?.data?.updated).toBe(false);
        expect(qr.stored?.targetUrl).toBe(menuUrl('es', OLD_SLUG));
    });

    it('lets the listing update stand when the QR sync throws', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: menuUrl('es', OLD_SLUG) });
        qr.setEntityTargetUrl.mockRejectedValue(new Error('database is down'));
        const { service } = buildService({ qr });

        const result = await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(result.data?.slug).toBe(NEW_SLUG);
    });

    it('refuses to guess an origin when the stored target is not a URL', async () => {
        const qr = makeQrDouble({ slug: 'k7Qm2XbT', targetUrl: 'not-a-url' });
        const { service } = buildService({ qr });

        const result = await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(qr.setEntityTargetUrl).not.toHaveBeenCalled();
        expect(qr.stored?.targetUrl).toBe('not-a-url');
    });

    it('refuses to guess a locale when the stored target is not a recognizable menu URL', async () => {
        // A URL that IS absolute but does not match `/{lang}/gastronomia/{slug}/carta/`
        // — e.g. hand-edited by an operator, or a future format change.
        const qr = makeQrDouble({
            slug: 'k7Qm2XbT',
            targetUrl: `${SITE}/es/gastronomia/${OLD_SLUG}/`
        });
        const { service } = buildService({ qr });

        const result = await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(qr.setEntityTargetUrl).not.toHaveBeenCalled();
    });

    it('leaves an unchanged listing without a QR code without one', async () => {
        // AC-5's second half: a venue with no code still has none afterwards.
        const qr = makeQrDouble(null);
        const { service } = buildService({ qr });

        await service.update(admin, G_ID, {
            slug: NEW_SLUG
        } as Parameters<typeof service.update>[2]);

        expect(qr.stored).toBeNull();
    });
});
