import { HostTradeCategoryGroupModel } from '@repo/db';
import type { HostTradeCategoryGroup } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeCategoryGroupService } from '../../../src/services/host-trade-category/host-trade-category-group.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const groupId = getMockId('hostTradeCategoryGroup', 'group-1');

const group = {
    id: groupId,
    slug: 'instalaciones',
    nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalacoes' },
    translationMeta: null,
    displayWeight: 50,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user'),
    updatedById: getMockId('user'),
    deletedAt: null,
    deletedById: null
} as unknown as HostTradeCategoryGroup;

const createInput = {
    slug: 'instalaciones',
    nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalacoes' },
    displayWeight: 50,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

const actorNone = createActor({ permissions: [] });
const actorCreate = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_CREATE] });
const actorUpdate = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_UPDATE] });
const actorDelete = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_DELETE] });
const actorRestore = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_RESTORE] });
const actorView = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_VIEW] });

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

describe('HostTradeCategoryGroupService', () => {
    let service: HostTradeCategoryGroupService;
    let model: HostTradeCategoryGroupModel;

    beforeEach(() => {
        model = createTypedModelMock(HostTradeCategoryGroupModel, [
            'findOne',
            'findById',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'count',
            'countActiveChildren',
            'lockForUpdate'
        ]);
        txState.calls = 0;
        service = new HostTradeCategoryGroupService({ logger: createLoggerMock() }, model);
        vi.clearAllMocks();
        asMock(model.lockForUpdate).mockResolvedValue(true);
    });

    describe('permissions', () => {
        it('should return FORBIDDEN on create when the actor lacks HOST_TRADE_CATEGORY_CREATE', async () => {
            const result = await service.create(actorNone, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on update when the actor lacks HOST_TRADE_CATEGORY_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(group);

            const result = await service.update(actorNone, groupId, { displayWeight: 10 });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on delete when the actor lacks HOST_TRADE_CATEGORY_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(group);

            const result = await service.softDelete(actorNone, groupId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on restore when the actor lacks HOST_TRADE_CATEGORY_RESTORE', async () => {
            asMock(model.findById).mockResolvedValue({ ...group, deletedAt: new Date() });

            const result = await service.restore(actorNone, groupId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on view when the actor lacks HOST_TRADE_CATEGORY_VIEW', async () => {
            asMock(model.findOne).mockResolvedValue(group);

            const result = await service.getById(actorNone, groupId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return the group for an actor with HOST_TRADE_CATEGORY_VIEW', async () => {
            asMock(model.findOne).mockResolvedValue(group);

            const result = await service.getById(actorView, groupId);

            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(groupId);
        });

        it('should refuse hard delete even for an actor holding every catalog permission', async () => {
            const everything = createActor({
                permissions: [
                    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
                    PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
                    PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
                    PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
                    PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
                ]
            });
            asMock(model.findById).mockResolvedValue(group);

            const result = await service.hardDelete(everything, groupId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('create', () => {
        it('should create a group when the slug is free', async () => {
            asMock(model.findOne).mockResolvedValue(null);
            asMock(model.create).mockResolvedValue(group);

            const result = await service.create(actorCreate, createInput);

            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toBe('instalaciones');
        });

        it('should fail with ALREADY_EXISTS when the slug belongs to a soft-deleted group', async () => {
            asMock(model.findOne).mockResolvedValue({ ...group, deletedAt: new Date() });

            const result = await service.create(actorCreate, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should fail with VALIDATION_ERROR when the Spanish name is missing', async () => {
            const result = await service.create(actorCreate, {
                ...createInput,
                nameI18n: { en: 'Installations' }
            } as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.create).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update the name and weight', async () => {
            asMock(model.findById).mockResolvedValue(group);
            asMock(model.update).mockResolvedValue({ ...group, displayWeight: 10 });

            const result = await service.update(actorUpdate, groupId, { displayWeight: 10 });

            expect(result.error).toBeUndefined();
            expect(result.data?.displayWeight).toBe(10);
        });

        it('should reject a payload that carries slug (immutable)', async () => {
            asMock(model.findById).mockResolvedValue(group);

            const result = await service.update(actorUpdate, groupId, {
                slug: 'otro-slug'
            } as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should allow deactivating a group that still has categories', async () => {
            asMock(model.findById).mockResolvedValue(group);
            asMock(model.countActiveChildren).mockResolvedValue(4);
            asMock(model.update).mockResolvedValue({
                ...group,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await service.update(actorUpdate, groupId, {
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        });
    });

    describe('soft delete', () => {
        it('should answer CATEGORY_IN_USE when the group has non-deleted categories', async () => {
            asMock(model.findById).mockResolvedValue(group);
            asMock(model.countActiveChildren).mockResolvedValue(2);

            const result = await service.softDelete(actorDelete, groupId);

            expect(result.error?.code).toBe(ServiceErrorCode.CATEGORY_IN_USE);
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should lock the group row, count and delete in ONE transaction', async () => {
            asMock(model.findById).mockResolvedValue(group);
            asMock(model.countActiveChildren).mockResolvedValue(0);
            asMock(model.softDelete).mockResolvedValue(1);

            await service.softDelete(actorDelete, groupId);

            expect(txState.calls).toBe(1);
            expect(model.lockForUpdate).toHaveBeenCalledWith(groupId, TX);
            expect(model.countActiveChildren).toHaveBeenCalledWith(groupId, TX);
            expect(asMock(model.softDelete).mock.calls[0]?.[2]).toBe(TX);
            const lockOrder = asMock(model.lockForUpdate).mock.invocationCallOrder[0] ?? 0;
            const countOrder = asMock(model.countActiveChildren).mock.invocationCallOrder[0] ?? 0;
            expect(lockOrder).toBeLessThan(countOrder);
        });

        it('should soft delete an empty group', async () => {
            asMock(model.findById).mockResolvedValue(group);
            asMock(model.countActiveChildren).mockResolvedValue(0);
            asMock(model.softDelete).mockResolvedValue(1);

            const result = await service.softDelete(actorDelete, groupId);

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(1);
        });
    });

    describe('restore', () => {
        it('should restore a soft-deleted group', async () => {
            asMock(model.findById).mockResolvedValue({ ...group, deletedAt: new Date() });
            asMock(model.restore).mockResolvedValue(1);

            const result = await service.restore(actorRestore, groupId);

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(1);
        });
    });
});
