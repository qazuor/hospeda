import { HostTradeCategoryGroupModel, HostTradeCategoryModel, hostTradeCategories } from '@repo/db';
import type { HostTradeCategory, HostTradeCategoryGroup } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogSearchCondition } from '../../../src/services/host-trade-category/host-trade-category.search';
import { HostTradeCategoryService } from '../../../src/services/host-trade-category/host-trade-category.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

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

const groupId = getMockId('hostTradeCategoryGroup', 'group-1');
const otherGroupId = getMockId('hostTradeCategoryGroup', 'group-2');
const categoryId = getMockId('hostTradeCategory', 'cat-1');

const baseAudit = {
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user'),
    updatedById: getMockId('user'),
    deletedAt: null,
    deletedById: null
};

const group = {
    id: groupId,
    slug: 'instalaciones',
    nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalacoes' },
    displayWeight: 50,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...baseAudit
} as unknown as HostTradeCategoryGroup;

const category = {
    id: categoryId,
    slug: 'plomeria',
    groupId,
    nameI18n: { es: 'Plomeria', en: 'Plumbing', pt: 'Encanamento' },
    keywordsI18n: {},
    displayWeight: 50,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...baseAudit
} as unknown as HostTradeCategory;

const createInput = {
    slug: 'plomeria',
    groupId,
    nameI18n: { es: 'Plomeria', en: 'Plumbing', pt: 'Encanamento' },
    keywordsI18n: {},
    displayWeight: 50,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

const actorNone = createActor({ permissions: [] });
const actorCreate = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_CREATE] });
const actorUpdate = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_UPDATE] });
const actorDelete = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_DELETE] });
const actorRestore = createActor({ permissions: [PermissionEnum.HOST_TRADE_CATEGORY_RESTORE] });

describe('HostTradeCategoryService', () => {
    let service: HostTradeCategoryService;
    let model: HostTradeCategoryModel;
    let groupModel: HostTradeCategoryGroupModel;

    beforeEach(() => {
        model = createTypedModelMock(HostTradeCategoryModel, [
            'findOne',
            'findById',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'findAdminPage',
            'count',
            'countLinkedHostTrades',
            'findIdsInDeletedGroups',
            'lockForUpdate',
            'findPublicCatalog',
            'getTable'
        ]);
        asMock(model.getTable).mockReturnValue(hostTradeCategories);
        groupModel = createTypedModelMock(HostTradeCategoryGroupModel, ['findByIdForShare']);
        service = new HostTradeCategoryService({ logger: createLoggerMock() }, model, groupModel);
        vi.clearAllMocks();
        txState.calls = 0;
        asMock(model.lockForUpdate).mockResolvedValue(true);
    });

    describe('permissions', () => {
        it('should return FORBIDDEN on create without HOST_TRADE_CATEGORY_CREATE', async () => {
            const result = await service.create(actorNone, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on delete without HOST_TRADE_CATEGORY_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(category);

            const result = await service.softDelete(actorNone, categoryId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return FORBIDDEN on restore without HOST_TRADE_CATEGORY_RESTORE', async () => {
            asMock(model.findById).mockResolvedValue({ ...category, deletedAt: new Date() });

            const result = await service.restore(actorNone, categoryId);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('create', () => {
        it('should create a category under an active group', async () => {
            asMock(groupModel.findByIdForShare).mockResolvedValue(group);
            asMock(model.findOne).mockResolvedValue(null);
            asMock(model.create).mockResolvedValue(category);

            const result = await service.create(actorCreate, createInput);

            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toBe('plomeria');
        });

        it('should validate the group FOR SHARE on one write transaction (create, update, restore)', async () => {
            asMock(groupModel.findByIdForShare).mockResolvedValue(group);
            asMock(model.findOne).mockResolvedValue(null);
            asMock(model.create).mockResolvedValue(category);
            asMock(model.findById).mockResolvedValue({ ...category, deletedAt: new Date() });
            asMock(model.update).mockResolvedValue(category);
            asMock(model.restore).mockResolvedValue(1);

            await service.create(actorCreate, createInput);
            await service.update(actorUpdate, categoryId, { groupId: otherGroupId });
            await service.restore(actorRestore, categoryId);

            expect(txState.calls).toBe(3);
            expect(asMock(groupModel.findByIdForShare).mock.calls).toEqual([
                [groupId, TX],
                [otherGroupId, TX],
                [groupId, TX]
            ]);
        });

        it('should fail with VALIDATION_ERROR on groupId when the group does not exist', async () => {
            asMock(groupModel.findByIdForShare).mockResolvedValue(null);

            const result = await service.create(actorCreate, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ field: 'groupId' });
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should fail with VALIDATION_ERROR on groupId when the group is soft-deleted', async () => {
            asMock(groupModel.findByIdForShare).mockResolvedValue({
                ...group,
                deletedAt: new Date()
            });

            const result = await service.create(actorCreate, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should fail with ALREADY_EXISTS when the slug belongs to a soft-deleted category', async () => {
            asMock(groupModel.findByIdForShare).mockResolvedValue(group);
            asMock(model.findOne).mockResolvedValue({ ...category, deletedAt: new Date() });

            const result = await service.create(actorCreate, createInput);

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should fail with VALIDATION_ERROR when the slug is not kebab-case', async () => {
            const result = await service.create(actorCreate, {
                ...createInput,
                slug: 'Plomeria X'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    describe('update', () => {
        it('should reject a payload that carries slug (immutable)', async () => {
            asMock(model.findById).mockResolvedValue(category);

            const result = await service.update(actorUpdate, categoryId, {
                slug: 'otro'
            } as never);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should allow INACTIVE even while a provider uses the category', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.countLinkedHostTrades).mockResolvedValue(7);
            asMock(model.update).mockResolvedValue({
                ...category,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await service.update(actorUpdate, categoryId, {
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        });

        it('should reject moving a category to a deleted group', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(groupModel.findByIdForShare).mockResolvedValue({
                ...group,
                deletedAt: new Date()
            });

            const result = await service.update(actorUpdate, categoryId, { groupId: otherGroupId });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('soft delete', () => {
        it('should answer CATEGORY_IN_USE when a live provider links the category', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.countLinkedHostTrades).mockResolvedValue(3);

            const result = await service.softDelete(actorDelete, categoryId);

            expect(result.error?.code).toBe(ServiceErrorCode.CATEGORY_IN_USE);
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should delete when only soft-deleted providers link it (count already excludes them)', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.countLinkedHostTrades).mockResolvedValue(0);
            asMock(model.softDelete).mockResolvedValue(1);

            const result = await service.softDelete(actorDelete, categoryId);

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(1);
            expect(model.countLinkedHostTrades).toHaveBeenCalledWith(categoryId, TX);
        });

        it('should lock the category row, count and delete in ONE transaction', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.countLinkedHostTrades).mockResolvedValue(0);
            asMock(model.softDelete).mockResolvedValue(1);

            await service.softDelete(actorDelete, categoryId);

            expect(txState.calls).toBe(1);
            expect(model.lockForUpdate).toHaveBeenCalledWith(categoryId, TX);
            expect(asMock(model.softDelete).mock.calls[0]?.[2]).toBe(TX);
            const lockOrder = asMock(model.lockForUpdate).mock.invocationCallOrder[0] ?? 0;
            const countOrder = asMock(model.countLinkedHostTrades).mock.invocationCallOrder[0] ?? 0;
            expect(lockOrder).toBeLessThan(countOrder);
        });
    });

    describe('restore', () => {
        it('should restore a soft-deleted category', async () => {
            asMock(model.findById).mockResolvedValue({ ...category, deletedAt: new Date() });
            asMock(model.restore).mockResolvedValue(1);
            asMock(groupModel.findByIdForShare).mockResolvedValue(group);

            const result = await service.restore(actorRestore, categoryId);

            expect(result.error).toBeUndefined();
        });

        it('should refuse to restore a category whose group is soft-deleted', async () => {
            asMock(model.findById).mockResolvedValue({ ...category, deletedAt: new Date() });
            asMock(groupModel.findByIdForShare).mockResolvedValue({
                ...group,
                deletedAt: new Date()
            });

            const result = await service.restore(actorRestore, categoryId);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({ field: 'groupId', groupId });
            expect(model.restore).not.toHaveBeenCalled();
        });
    });

    describe('admin search condition', () => {
        const dialect = new PgDialect();

        it('should escape % and _ so they match literally', () => {
            const condition = buildCatalogSearchCondition({
                term: '10%_off',
                columns: hostTradeCategories
            });

            const { params } = dialect.sqlToQuery(condition!);

            expect(params.length).toBeGreaterThan(0);
            expect(params).toContain('%10\\%\\_off%');
            expect(params).not.toContain('%10%_off%');
        });

        it('should not match the JSON keys of the i18n columns', () => {
            const condition = buildCatalogSearchCondition({
                term: 'en',
                columns: hostTradeCategories
            });

            const { sql: text } = dialect.sqlToQuery(condition!);

            expect(text).toContain('->>');
            expect(text).not.toMatch(/"name_i18n"::text/);
        });

        it('should return undefined for a blank term', () => {
            expect(
                buildCatalogSearchCondition({ term: '   ', columns: hostTradeCategories })
            ).toBeUndefined();
            expect(
                buildCatalogSearchCondition({ term: undefined, columns: hostTradeCategories })
            ).toBeUndefined();
        });

        it('should apply the filters groupId, lifecycleState and the text term in adminList', async () => {
            const admin = createActor({
                permissions: [
                    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
                    PermissionEnum.ACCESS_PANEL_ADMIN
                ]
            });
            asMock(model.findAdminPage).mockResolvedValue({ items: [category], total: 1 });

            const result = await service.adminList(admin, {
                groupId,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                search: 'plom'
            });

            expect(result.error).toBeUndefined();
            expect(model.findAll).not.toHaveBeenCalled();
            const [input] = asMock(model.findAdminPage).mock.calls[0] as [
                {
                    where: Record<string, unknown>;
                    additionalConditions: unknown[];
                    page: number;
                    pageSize: number;
                }
            ];
            expect(input.where).toMatchObject({
                groupId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            expect(input.additionalConditions).toHaveLength(1);
        });

        it('should use the catalog default order when no sort is sent (AC-3.1)', async () => {
            const admin = createActor({
                permissions: [
                    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
                    PermissionEnum.ACCESS_PANEL_ADMIN
                ]
            });
            asMock(model.findAdminPage).mockResolvedValue({ items: [category], total: 1 });

            await service.adminList(admin, { page: 2, pageSize: 50 });

            expect(model.findAll).not.toHaveBeenCalled();
            expect(asMock(model.findAdminPage).mock.calls[0]?.[0]).toMatchObject({
                page: 2,
                pageSize: 50,
                where: { deletedAt: null }
            });
        });

        it.each([
            'slug:asc',
            'createdAt:desc'
        ])('should honour an explicit sort as sent: %s (AC-3.4)', async (sort) => {
            const admin = createActor({
                permissions: [
                    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
                    PermissionEnum.ACCESS_PANEL_ADMIN
                ]
            });
            asMock(model.findAll).mockResolvedValue({ items: [category], total: 1 });

            await service.adminList(admin, { sort });

            expect(model.findAdminPage).not.toHaveBeenCalled();
            const [, options] = asMock(model.findAll).mock.calls[0] as [
                unknown,
                { sortBy: string; sortOrder: string }
            ];
            const [field, direction] = sort.split(':');
            expect(options).toMatchObject({ sortBy: field, sortOrder: direction });
        });

        it('should include deleted rows only when includeDeleted is true (AC-3.5)', async () => {
            const admin = createActor({
                permissions: [
                    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
                    PermissionEnum.ACCESS_PANEL_ADMIN
                ]
            });
            asMock(model.findAdminPage).mockResolvedValue({ items: [], total: 0 });

            await service.adminList(admin, { includeDeleted: true });

            const [input] = asMock(model.findAdminPage).mock.calls[0] as [
                { where: Record<string, unknown> }
            ];
            expect(input.where).not.toHaveProperty('deletedAt');
        });
    });
});
