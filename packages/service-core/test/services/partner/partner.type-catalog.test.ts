/**
 * @fileoverview
 * PartnerService against the partner type catalog (HOS-2336, release N).
 *
 * Covers: `typeId` validation on create and update (AC-4.3), the dual-write of
 * the legacy enum column, the FOR SHARE read inside one transaction, the
 * hydration of the `partnerType` ref, and the admin `type` filter by slug
 * (AC-4.2).
 */
import type { PartnerModel, PartnerTypeModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PartnerService } from '../../../src/services/partner/partner.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const TX = { __tx: true };

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: unknown) => Promise<unknown>, baseCtx?: { hookState?: object }) =>
            fn({ ...baseCtx, tx: TX, hookState: baseCtx?.hookState ?? {} })
    )
}));

const PARTNER_ID = getMockId('attraction', 'partner-type-catalog-1');
const BUSINESS_ID = getMockId('attraction', 'pt-business');
const MEDIA_ID = getMockId('attraction', 'pt-media');
const RETIRED_ID = getMockId('attraction', 'pt-retired');
const DELETED_ID = getMockId('attraction', 'pt-deleted');

const TYPES: Record<
    string,
    { id: string; slug: string; lifecycleState: string; deletedAt: Date | null }
> = {
    [BUSINESS_ID]: {
        id: BUSINESS_ID,
        slug: 'business',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: null
    },
    [MEDIA_ID]: {
        id: MEDIA_ID,
        slug: 'media',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: null
    },
    [RETIRED_ID]: {
        id: RETIRED_ID,
        slug: 'retired',
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        deletedAt: null
    },
    [DELETED_ID]: {
        id: DELETED_ID,
        slug: 'gone',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: new Date()
    }
};

const adminActor = createActor({ permissions: [PermissionEnum.PARTNER_MANAGE] });
const panelAdmin = createActor({
    permissions: [PermissionEnum.PARTNER_MANAGE, PermissionEnum.ACCESS_PANEL_ADMIN]
});

const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    slug: 'acme',
    name: 'Acme',
    typeId: BUSINESS_ID,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    analytics: {},
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

function buildService(modelOverrides: Record<string, unknown> = {}) {
    const model = {
        ...createModelMock(),
        create: vi.fn(async (data: Record<string, unknown>) => makePartner(data)),
        update: vi.fn(async (_where: unknown, data: Record<string, unknown>) => makePartner(data)),
        ...modelOverrides
    };
    const partnerTypeModel = {
        findByIdForShare: vi.fn(async (id: string) => TYPES[id] ?? null),
        findRefsByIds: vi.fn(
            async (ids: readonly string[]) =>
                new Map(
                    ids
                        .filter((id) => TYPES[id])
                        .map((id) => [
                            id,
                            {
                                id,
                                slug: TYPES[id]?.slug,
                                nameI18n: { es: `Tipo ${TYPES[id]?.slug}` },
                                lifecycleState: TYPES[id]?.lifecycleState
                            }
                        ])
                )
        )
    };
    const service = new PartnerService({
        logger: createLoggerMock(),
        model: model as unknown as PartnerModel,
        partnerTypeModel: partnerTypeModel as unknown as PartnerTypeModel
    });
    return { service, model, partnerTypeModel };
}

const createInput = (typeId: string) => ({
    slug: 'acme',
    name: 'Acme',
    typeId,
    lifecycleState: LifecycleStatusEnum.DRAFT
});

describe('PartnerService.create — partner type catalog', () => {
    it('should dual-write type_id and the legacy enum value for a legacy slug', async () => {
        // Arrange
        const { service, model, partnerTypeModel } = buildService();

        // Act
        const result = await service.create(adminActor, createInput(BUSINESS_ID));

        // Assert
        expect(result.error).toBeUndefined();
        const written = model.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.typeId).toBe(BUSINESS_ID);
        expect(written.type).toBe('business');
        // The read takes FOR SHARE inside the write's own transaction.
        expect(partnerTypeModel.findByIdForShare).toHaveBeenCalledWith(BUSINESS_ID, TX);
    });

    it('should write a NULL legacy type for a catalog-only type', async () => {
        const { service, model } = buildService();

        const result = await service.create(adminActor, createInput(MEDIA_ID));

        expect(result.error).toBeUndefined();
        const written = model.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.typeId).toBe(MEDIA_ID);
        expect(written.type).toBeNull();
    });

    it('should hydrate the partnerType ref on the returned partner', async () => {
        const { service } = buildService();

        const result = await service.create(adminActor, createInput(MEDIA_ID));

        expect(result.data?.partnerType).toMatchObject({ id: MEDIA_ID, slug: 'media' });
    });

    it.each([
        ['inactive', RETIRED_ID],
        ['soft-deleted', DELETED_ID],
        ['unknown', getMockId('attraction', 'pt-unknown')]
    ])('should refuse an %s type with VALIDATION_ERROR on typeId', async (_label, typeId) => {
        const { service, model } = buildService();

        const result = await service.create(adminActor, createInput(typeId));

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.details).toMatchObject({ field: 'typeId' });
        expect(model.create).not.toHaveBeenCalled();
    });

    it('should refuse a create without typeId', async () => {
        const { service, model } = buildService();

        const result = await service.create(adminActor, {
            slug: 'acme',
            name: 'Acme',
            lifecycleState: LifecycleStatusEnum.DRAFT
        } as unknown as ReturnType<typeof createInput>);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.create).not.toHaveBeenCalled();
    });
});

describe('PartnerService.update — partner type catalog (AC-4.3)', () => {
    it('should refuse moving a partner to an inactive type that is not its own', async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ typeId: BUSINESS_ID }))
        });

        // Act
        const result = await service.update(adminActor, PARTNER_ID, { typeId: RETIRED_ID });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.details).toMatchObject({ field: 'typeId' });
        expect(model.update).not.toHaveBeenCalled();
    });

    it("should accept the partner's own current type even though it is inactive", async () => {
        // Arrange
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ typeId: RETIRED_ID }))
        });

        // Act
        const result = await service.update(adminActor, PARTNER_ID, {
            typeId: RETIRED_ID,
            name: 'Acme renamed'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const written = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(written.typeId).toBe(RETIRED_ID);
        // `retired` has no legacy enum value.
        expect(written.type).toBeNull();
    });

    it('should leave both type columns alone when the update does not carry typeId', async () => {
        const { service, model, partnerTypeModel } = buildService({
            findById: vi.fn(async () => makePartner())
        });

        const result = await service.update(adminActor, PARTNER_ID, { name: 'Acme 2' });

        expect(result.error).toBeUndefined();
        const written = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect('typeId' in written).toBe(false);
        expect('type' in written).toBe(false);
        expect(partnerTypeModel.findByIdForShare).not.toHaveBeenCalled();
    });

    it('should dual-write when moving to another ACTIVE type', async () => {
        const { service, model } = buildService({
            findById: vi.fn(async () => makePartner({ typeId: MEDIA_ID }))
        });

        const result = await service.update(adminActor, PARTNER_ID, { typeId: BUSINESS_ID });

        expect(result.error).toBeUndefined();
        const written = model.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(written).toMatchObject({ typeId: BUSINESS_ID, type: 'business' });
    });
});

describe('PartnerService.adminList — type filter by slug (AC-4.2)', () => {
    it('should turn ?type=<slug> into an SQL condition, never a column filter', async () => {
        // Arrange
        const findAll = vi.fn(async () => ({ items: [makePartner()], total: 1 }));
        const { service } = buildService({
            findAll,
            findAllWithRelations: findAll,
            getTable: vi.fn(() => ({ createdAt: {}, deletedAt: {}, lifecycleState: {} }))
        });

        // Act
        const result = await service.adminList(panelAdmin, {
            page: 1,
            pageSize: 20,
            type: 'media'
        });

        // Assert
        expect(result.error).toBeUndefined();
        const [, where, , conditions] = findAll.mock.calls[0] as unknown as [
            unknown,
            Record<string, unknown>,
            unknown,
            unknown[] | undefined
        ];
        expect(where).not.toHaveProperty('type');
        expect(conditions?.length ?? 0).toBeGreaterThan(0);
        expect(result.data?.items[0]?.partnerType).toMatchObject({ slug: 'business' });
    });
});
