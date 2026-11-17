/**
 * @fileoverview
 * HostTradeService create/update with `categoryIds` (HOS-919 T-022): id
 * validation and atomic replacement of the category set.
 */

import { HostTradeCategoryModel, HostTradeModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import type { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const TX = { __tx: true };
const txState = vi.hoisted(() => ({ calls: 0, threw: false }));

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: unknown) => Promise<unknown>, baseCtx?: { hookState?: object }) => {
            txState.calls += 1;
            try {
                return await fn({ ...baseCtx, tx: TX, hookState: baseCtx?.hookState ?? {} });
            } catch (error) {
                txState.threw = true;
                throw error;
            }
        }
    )
}));

const DEST_ID = getMockId('destination', 'dest-1');
const HT_ID = getMockId('user', 'ht-1');
const CAT_A = getMockId('hostTradeCategory', 'a');
const CAT_B = getMockId('hostTradeCategory', 'b');
const CAT_C = getMockId('hostTradeCategory', 'c');

const category = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    slug: id.slice(0, 6),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    deletedAt: null,
    ...overrides
});

const trade = {
    id: HT_ID,
    slug: 'plomero',
    name: 'Plomero',
    contact: '123',
    benefit: '10%',
    destinationId: DEST_ID,
    is24h: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
};

const createInput = (categoryIds: string[]) => ({
    name: 'Plomero',
    contact: '123',
    benefit: '10%',
    destinationId: DEST_ID,
    is24h: false,
    categoryIds
});

const creator = createActor({ permissions: [PermissionEnum.HOST_TRADE_CREATE] });
const updater = createActor({ permissions: [PermissionEnum.HOST_TRADE_UPDATE] });

describe('HostTradeService category writes', () => {
    let service: HostTradeService;
    let model: HostTradeModel;
    let categoryModel: HostTradeCategoryModel;

    beforeEach(() => {
        model = createTypedModelMock(HostTradeModel, [
            'findOne',
            'findById',
            'create',
            'update',
            'replaceCategories',
            'hydrateCategories'
        ]);
        categoryModel = createTypedModelMock(HostTradeCategoryModel, [
            'findByIds',
            'findIdsInDeletedGroups'
        ]);
        asMock(categoryModel.findIdsInDeletedGroups).mockResolvedValue([]);
        const qr = {
            findLiveCodeForEntity: vi.fn().mockResolvedValue({ data: null })
        } as unknown as QrCodeService;
        service = new HostTradeService(
            { logger: createLoggerMock() },
            model,
            undefined,
            null,
            qr,
            categoryModel
        );
        vi.clearAllMocks();
        txState.calls = 0;
        txState.threw = false;
        asMock(model.findOne).mockResolvedValue(null);
        asMock(model.findById).mockResolvedValue(trade);
        asMock(model.create).mockResolvedValue(trade);
        asMock(model.update).mockResolvedValue(trade);
        asMock(model.replaceCategories).mockResolvedValue({ added: [], removed: [] });
        asMock(model.hydrateCategories).mockResolvedValue(new Map());
    });

    describe('create', () => {
        it('should write the row and replace categories on the SAME transaction', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A), category(CAT_B)]);

            const result = await service.create(creator, createInput([CAT_A, CAT_B]) as never);

            expect(result.error).toBeUndefined();
            expect(txState.calls).toBe(1);
            expect(asMock(model.create).mock.calls[0]?.[1]).toBe(TX);
            expect(model.replaceCategories).toHaveBeenCalledWith({
                hostTradeId: HT_ID,
                categoryIds: [CAT_A, CAT_B],
                tx: TX
            });
        });

        it('should not send categoryIds to the row insert', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);

            await service.create(creator, createInput([CAT_A]) as never);

            expect(
                (asMock(model.create).mock.calls[0]?.[0] as { categoryIds?: unknown }).categoryIds
            ).toBeUndefined();
        });

        it('should reject an unknown id naming categoryIds, without writing', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);

            const result = await service.create(creator, createInput([CAT_A, CAT_B]) as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ field: 'categoryIds' });
            expect(model.create).not.toHaveBeenCalled();
            expect(model.replaceCategories).not.toHaveBeenCalled();
        });

        it('should reject a soft-deleted category', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([
                category(CAT_A, { deletedAt: new Date() })
            ]);

            const result = await service.create(creator, createInput([CAT_A]) as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should reject a category whose group is soft-deleted', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);
            asMock(categoryModel.findIdsInDeletedGroups).mockResolvedValue([CAT_A]);

            const result = await service.create(creator, createInput([CAT_A]) as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({
                field: 'categoryIds',
                reason: 'UNKNOWN_CATEGORY'
            });
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should reject an INACTIVE category on create (nothing is linked yet)', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([
                category(CAT_A, { lifecycleState: LifecycleStatusEnum.INACTIVE })
            ]);

            const result = await service.create(creator, createInput([CAT_A]) as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ field: 'categoryIds' });
        });

        it('should reject 0 ids and 11 ids', async () => {
            const eleven = Array.from({ length: 11 }, (_, i) =>
                getMockId('hostTradeCategory', `x${i}`)
            );

            const none = await service.create(creator, createInput([]) as never);
            const many = await service.create(creator, createInput(eleven) as never);

            expect(none.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(many.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should roll the transaction back and answer an error when the category write fails', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);
            asMock(model.replaceCategories).mockRejectedValue(new Error('insert failed'));

            const result = await service.create(creator, createInput([CAT_A]) as never);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            expect(txState.threw).toBe(true);
        });

        it('should join the caller transaction instead of opening a new one', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);
            const callerTx = { __caller: true };

            await service.create(creator, createInput([CAT_A]) as never, {
                tx: callerTx as never,
                hookState: {}
            });

            expect(txState.calls).toBe(0);
            expect(asMock(model.replaceCategories).mock.calls[0]?.[0]).toMatchObject({
                tx: callerTx
            });
        });
    });

    describe('update', () => {
        it('should replace the set on the same transaction as the row update', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A), category(CAT_C)]);

            const result = await service.update(updater, HT_ID, { categoryIds: [CAT_A, CAT_C] });

            expect(result.error).toBeUndefined();
            expect(asMock(model.update).mock.calls[0]?.[2]).toBe(TX);
            expect(model.replaceCategories).toHaveBeenCalledWith({
                hostTradeId: HT_ID,
                categoryIds: [CAT_A, CAT_C],
                tx: TX
            });
        });

        it('should leave the set untouched when categoryIds is absent', async () => {
            const result = await service.update(updater, HT_ID, { name: 'Nuevo nombre' });

            expect(result.error).toBeUndefined();
            expect(model.replaceCategories).not.toHaveBeenCalled();
            expect(categoryModel.findByIds).not.toHaveBeenCalled();
        });

        it('should accept an INACTIVE category the provider already has', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([
                category(CAT_A, { lifecycleState: LifecycleStatusEnum.INACTIVE })
            ]);
            asMock(model.hydrateCategories).mockResolvedValue(
                new Map([
                    [HT_ID, [{ id: CAT_A, slug: 'a', nameI18n: {}, groupSlug: 'g' }]]
                ]) as never
            );

            const result = await service.update(updater, HT_ID, { categoryIds: [CAT_A] });

            expect(result.error).toBeUndefined();
            expect(model.replaceCategories).toHaveBeenCalledTimes(1);
        });

        it('should reject an INACTIVE category the provider does not have', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([
                category(CAT_B, { lifecycleState: LifecycleStatusEnum.INACTIVE })
            ]);

            const result = await service.update(updater, HT_ID, { categoryIds: [CAT_B] });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ field: 'categoryIds' });
            expect(model.replaceCategories).not.toHaveBeenCalled();
        });

        it('should reject unknown and deleted ids', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([
                category(CAT_A, { deletedAt: new Date() })
            ]);

            const result = await service.update(updater, HT_ID, { categoryIds: [CAT_A, CAT_B] });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should propagate a category write failure and roll back', async () => {
            asMock(categoryModel.findByIds).mockResolvedValue([category(CAT_A)]);
            asMock(model.replaceCategories).mockRejectedValue(new Error('boom'));

            const result = await service.update(updater, HT_ID, { categoryIds: [CAT_A] });

            expect(result.error).toBeDefined();
            expect(txState.threw).toBe(true);
        });
    });
});
