/**
 * @fileoverview
 * Unit tests for the partner type catalog service (HOS-2336, US-3).
 *
 * Covers the permission matrix (AC-3.6), slug uniqueness including deleted rows
 * (AC-3.2), the immutable slug (AC-3.3), the in-use guard on deactivate and
 * delete with its FOR UPDATE lock (AC-3.4), restore (AC-3.5), the admin
 * partner count (AC-3.1) and the public list shape.
 */
import { PartnerTypeModel } from '@repo/db';
import type { PartnerType } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerTypeService } from '../../../src/services/partner-type/partner-type.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const typeId = getMockId('attraction', 'partner-type-media');

const mediaType = {
    id: typeId,
    slug: 'media',
    nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
    translationMeta: null,
    displayWeight: 40,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
} as unknown as PartnerType;

const createInput = {
    slug: 'media',
    nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
    displayWeight: 40,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

const ALL_PERMISSIONS = [
    PermissionEnum.PARTNER_TYPE_VIEW,
    PermissionEnum.PARTNER_TYPE_CREATE,
    PermissionEnum.PARTNER_TYPE_UPDATE,
    PermissionEnum.PARTNER_TYPE_DELETE,
    PermissionEnum.PARTNER_TYPE_RESTORE
];

const actorNone = createActor({ permissions: [] });
const actorAll = createActor({ permissions: ALL_PERMISSIONS });

const TX = { __tx: true };
const txState = vi.hoisted(() => ({ calls: 0 }));

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: unknown) => Promise<unknown>, baseCtx?: { hookState?: object }) => {
            txState.calls += 1;
            return fn({ ...baseCtx, tx: TX, hookState: baseCtx?.hookState ?? {} });
        }
    )
}));

describe('PartnerTypeService', () => {
    let service: PartnerTypeService;
    let model: PartnerTypeModel;

    beforeEach(() => {
        model = createTypedModelMock(PartnerTypeModel, [
            'findOne',
            'findById',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'count',
            'lockForUpdate',
            'countPartners',
            'countPartnersByTypeIds',
            'findPublicList',
            'getTable'
        ]);
        txState.calls = 0;
        service = new PartnerTypeService({ logger: createLoggerMock() }, model);
        vi.clearAllMocks();
        asMock(model.lockForUpdate).mockResolvedValue(true);
        asMock(model.countPartners).mockResolvedValue(0);
    });

    describe('permissions (AC-3.6)', () => {
        it('should refuse every admin operation to an actor with no partnerType.* permission', async () => {
            // Arrange
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.findOne).mockResolvedValue(mediaType);

            // Act
            const results = [
                await service.create(actorNone, createInput),
                await service.update(actorNone, typeId, { displayWeight: 10 }),
                await service.softDelete(actorNone, typeId),
                await service.getById(actorNone, typeId)
            ];

            // Assert
            for (const result of results) {
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
            expect(model.create).not.toHaveBeenCalled();
            expect(model.update).not.toHaveBeenCalled();
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should refuse restore without PARTNER_TYPE_RESTORE (AC-3.5)', async () => {
            asMock(model.findById).mockResolvedValue({ ...mediaType, deletedAt: new Date() });
            const actor = createActor({
                permissions: ALL_PERMISSIONS.filter(
                    (p) => p !== PermissionEnum.PARTNER_TYPE_RESTORE
                )
            });

            const result = await service.restore(actor, typeId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });

        it('should refuse hard delete even with every catalog permission', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);

            const result = await service.hardDelete(actorAll, typeId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('create (AC-3.2)', () => {
        it('should create an ACTIVE type', async () => {
            asMock(model.findOne).mockResolvedValue(null);
            asMock(model.create).mockResolvedValue(mediaType);

            const result = await service.create(actorAll, createInput);

            expect(result.error).toBeUndefined();
            expect(asMock(model.create).mock.calls[0]?.[0]).toMatchObject({
                slug: 'media',
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
        });

        it('should answer ALREADY_EXISTS for a slug held by a soft-deleted row', async () => {
            asMock(model.findOne).mockResolvedValue({ ...mediaType, deletedAt: new Date() });

            const result = await service.create(actorAll, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should refuse a slug that is not kebab-case', async () => {
            const result = await service.create(actorAll, { ...createInput, slug: 'Media Outlet' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('update', () => {
        it('should refuse a body carrying slug: the slug is immutable (AC-3.3)', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);

            const result = await service.update(actorAll, typeId, {
                slug: 'press'
            } as unknown as { displayWeight: number });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should answer PARTNER_TYPE_IN_USE with the count when deactivating a used type (AC-3.4)', async () => {
            // Arrange
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.countPartners).mockResolvedValue(3);

            // Act
            const result = await service.update(actorAll, typeId, {
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.PARTNER_TYPE_IN_USE);
            expect(result.error?.details).toMatchObject({ partnerTypeId: typeId, count: 3 });
            expect(model.lockForUpdate).toHaveBeenCalledWith(typeId, TX);
            expect(model.update).not.toHaveBeenCalled();
            expect(txState.calls).toBe(1);
        });

        it('should deactivate an unused type', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.update).mockResolvedValue({
                ...mediaType,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await service.update(actorAll, typeId, {
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            expect(result.error).toBeUndefined();
            expect(model.countPartners).toHaveBeenCalledWith(typeId, TX);
        });

        it('should not run the in-use guard for an edit that keeps the type ACTIVE', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.update).mockResolvedValue({ ...mediaType, displayWeight: 5 });

            const result = await service.update(actorAll, typeId, { displayWeight: 5 });

            expect(result.error).toBeUndefined();
            expect(model.countPartners).not.toHaveBeenCalled();
        });
    });

    describe('softDelete (AC-3.4)', () => {
        it('should refuse to delete a used type and change nothing', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.countPartners).mockResolvedValue(1);

            const result = await service.softDelete(actorAll, typeId);

            expect(result.error?.code).toBe(ServiceErrorCode.PARTNER_TYPE_IN_USE);
            expect(result.error?.details).toMatchObject({ count: 1 });
            expect(model.lockForUpdate).toHaveBeenCalledWith(typeId, TX);
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should delete an unused type', async () => {
            asMock(model.findById).mockResolvedValue(mediaType);
            asMock(model.softDelete).mockResolvedValue(1);

            const result = await service.softDelete(actorAll, typeId);

            expect(result.error).toBeUndefined();
            expect(model.softDelete).toHaveBeenCalled();
        });
    });

    describe('restore (AC-3.5)', () => {
        it('should restore a soft-deleted type', async () => {
            asMock(model.findById).mockResolvedValue({ ...mediaType, deletedAt: new Date() });
            asMock(model.restore).mockResolvedValue(1);

            const result = await service.restore(actorAll, typeId);

            expect(result.error).toBeUndefined();
            expect(model.restore).toHaveBeenCalled();
        });
    });

    describe('adminList (AC-3.1)', () => {
        it('should add the partner count of each row from one grouped query', async () => {
            // Arrange
            const other = { ...mediaType, id: getMockId('attraction', 'pt-2'), slug: 'person' };
            asMock(model.findAll).mockResolvedValue({ items: [mediaType, other], total: 2 });
            asMock(model.countPartnersByTypeIds).mockResolvedValue(new Map([[typeId, 4]]));
            asMock(model.getTable).mockReturnValue({
                createdAt: {},
                deletedAt: {},
                lifecycleState: {}
            });

            // Act
            const admin = createActor({
                permissions: [...ALL_PERMISSIONS, PermissionEnum.ACCESS_PANEL_ADMIN]
            });
            const result = await service.adminList(admin, { page: 1, pageSize: 20 });

            // Assert
            expect(result.error).toBeUndefined();
            const items = result.data?.items as unknown as Array<{
                id: string;
                partnerCount: number;
            }>;
            expect(items.map((item) => item.partnerCount)).toEqual([4, 0]);
            expect(model.countPartnersByTypeIds).toHaveBeenCalledTimes(1);
        });
    });

    describe('getPublicList', () => {
        it('should return only the public fields, for a guest', async () => {
            // Arrange
            asMock(model.findPublicList).mockResolvedValue([
                { slug: 'media', nameI18n: mediaType.nameI18n, displayWeight: 40 }
            ]);

            // Act
            const result = await service.getPublicList(actorNone);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(1);
            expect(Object.keys(result.data?.items[0] ?? {}).sort()).not.toContain('id');
        });
    });
});
