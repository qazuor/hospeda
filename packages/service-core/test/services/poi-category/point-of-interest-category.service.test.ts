import {
    type DrizzleClient,
    PoiCategoryModel,
    PointOfInterestModel,
    poiCategories,
    pointsOfInterest,
    RPoiCategoryModel
} from '@repo/db';
import type { PoiCategoryIdType, PointOfInterestIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    PointOfInterestTypeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { inArray as mockedInArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestCategoryService } from '../../../src/services/poi-category/point-of-interest-category.service';
import { withServiceTransaction as mockedWithServiceTransaction } from '../../../src/utils/transaction';
import { createActor } from '../../factories/actorFactory';
import { PoiCategoryFactoryBuilder } from '../../factories/poiCategoryFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

/**
 * Unit tests have no real DB, so `withServiceTransaction` is mocked to run
 * its callback inline with a stub `tx` object — mirrors
 * `test/services/accommodation/create.test.ts`'s established pattern for
 * transaction-wrapped service methods.
 */
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>,
            baseCtx?: { hookState?: Record<string, unknown> }
        ) => {
            const ctx = { ...baseCtx, tx: {}, hookState: baseCtx?.hookState ?? {} };
            try {
                return await fn(ctx as never);
            } catch (err) {
                if (
                    err !== null &&
                    typeof err === 'object' &&
                    'code' in err &&
                    'name' in err &&
                    (err as { name: string }).name === 'ServiceError'
                ) {
                    return { error: err };
                }
                throw err;
            }
        }
    )
}));

/**
 * `drizzle-orm`'s `inArray` is spied (not stubbed) so the real SQL condition
 * is asserted against, mirroring `PointOfInterestService`'s test-file
 * precedent (HOS-139 judgment-day FIX 1 — `findAll({ id: array })` degrades
 * to a broken `eq()` against real Postgres; the fix uses a real `inArray`
 * additional condition instead).
 */
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual, inArray: vi.fn(actual.inArray) };
});

const poiId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const categoryId = getMockId('poiCategory', 'cat-museum') as PoiCategoryIdType;
const otherCategoryId = getMockId('poiCategory', 'cat-winery') as PoiCategoryIdType;

const actorNoPerms = createActor({ permissions: [] });
const actorWithCreate = createActor({ permissions: [PermissionEnum.POI_CATEGORY_CREATE] });
const actorWithUpdate = createActor({ permissions: [PermissionEnum.POI_CATEGORY_UPDATE] });
const actorWithDelete = createActor({ permissions: [PermissionEnum.POI_CATEGORY_DELETE] });
const actorWithRestore = createActor({ permissions: [PermissionEnum.POI_CATEGORY_RESTORE] });
const actorWithView = createActor({ permissions: [PermissionEnum.POI_CATEGORY_VIEW] });

const poi = PointOfInterestFactoryBuilder.create({
    id: poiId,
    type: PointOfInterestTypeEnum.OTHER
});
const category = PoiCategoryFactoryBuilder.create({
    id: categoryId,
    slug: 'museum',
    displayWeight: 50
});
const wineryCategory = PoiCategoryFactoryBuilder.create({
    id: otherCategoryId,
    slug: 'winery',
    displayWeight: 80
});

/**
 * A stub `DrizzleClient`-shaped object so the service's `ctx.tx` truthiness
 * check passes without a real DB (HOS-139 judgment-day FIX 2 — mirrors
 * `test/services/accommodation/junctionSync.test.ts`'s `mockTx`/`ctxWithTx`
 * precedent).
 */
const mockTx = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
} as unknown as DrizzleClient;
const ctxWithTx = { tx: mockTx, hookState: {} };

describe('PointOfInterestCategoryService', () => {
    let service: PointOfInterestCategoryService;
    let model: PoiCategoryModel;
    let relatedModel: RPoiCategoryModel;
    let pointOfInterestModel: PointOfInterestModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PoiCategoryModel, [
            'findOne',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'count'
        ]);
        relatedModel = createTypedModelMock(RPoiCategoryModel, [
            'findOne',
            'create',
            'update',
            'hardDelete',
            'findAll'
        ]);
        pointOfInterestModel = createTypedModelMock(PointOfInterestModel, [
            'findOne',
            'update',
            'findAll'
        ]);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestCategoryService(
            ctx,
            model,
            relatedModel,
            pointOfInterestModel
        );
        vi.clearAllMocks();
    });

    describe('catalog CRUD permission gating', () => {
        const createInput = {
            slug: 'museum',
            nameI18n: { es: 'Museo', en: 'Museum', pt: 'Museu' },
            icon: '🏛️',
            displayWeight: 50,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        it('should create a POI category when actor has POI_CATEGORY_CREATE', async () => {
            asMock(model.create).mockResolvedValue({ ...category, ...createInput });
            const result = await service.create(actorWithCreate, createInput);
            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toBe('museum');
        });

        it('should return FORBIDDEN when actor lacks POI_CATEGORY_CREATE', async () => {
            const result = await service.create(actorNoPerms, createInput);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.create).not.toHaveBeenCalled();
        });

        it('should return the category for an actor with POI_CATEGORY_VIEW', async () => {
            asMock(model.findOne).mockResolvedValue(category);
            const result = await service.getById(actorWithView, categoryId);
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(categoryId);
        });

        it('should return FORBIDDEN on view when actor lacks POI_CATEGORY_VIEW', async () => {
            asMock(model.findOne).mockResolvedValue(category);
            const result = await service.getById(actorNoPerms, categoryId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should update when actor has POI_CATEGORY_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.update).mockResolvedValue({ ...category, displayWeight: 70 });
            const result = await service.update(actorWithUpdate, categoryId, { displayWeight: 70 });
            expect(result.error).toBeUndefined();
            expect(result.data?.displayWeight).toBe(70);
        });

        it('should return FORBIDDEN on update when actor lacks POI_CATEGORY_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(category);
            const result = await service.update(actorNoPerms, categoryId, { displayWeight: 70 });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should soft delete when actor has POI_CATEGORY_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(category);
            asMock(model.softDelete).mockResolvedValue(1);
            const result = await service.softDelete(actorWithDelete, categoryId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN on softDelete when actor lacks POI_CATEGORY_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(category);
            const result = await service.softDelete(actorNoPerms, categoryId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.softDelete).not.toHaveBeenCalled();
        });

        it('should restore when actor has POI_CATEGORY_RESTORE', async () => {
            const deletedCategory = { ...category, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedCategory);
            asMock(model.restore).mockResolvedValue(1);
            const result = await service.restore(actorWithRestore, categoryId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN on restore when actor lacks POI_CATEGORY_RESTORE', async () => {
            const deletedCategory = { ...category, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedCategory);
            const result = await service.restore(actorNoPerms, categoryId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN on list/search when actor lacks POI_CATEGORY_VIEW', async () => {
            const result = await service.search(actorNoPerms, { page: 1, pageSize: 10 });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.findAll).not.toHaveBeenCalled();
        });
    });

    /**
     * HOS-139 judgment-day FIX 4: `getSearchableColumns()` advertises `slug`
     * as searchable, but `q` was never wired into `buildSearchWhere` —
     * `?q=...` was silently ignored. Verifies `q` now adds a `safeIlike`
     * additional condition against `slug`.
     */
    describe('search() free-text `q` filter (HOS-139 FIX 4)', () => {
        it('should add an additional condition against slug when q is provided', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [category], total: 1 });

            await service.search(actorWithView, { page: 1, pageSize: 10, q: 'muse' });

            const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(additionalConditions).toHaveLength(1);
        });

        it('should not add an additional condition when q is absent', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [category], total: 1 });

            await service.search(actorWithView, { page: 1, pageSize: 10 });

            const [, , additionalConditions] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(additionalConditions).toHaveLength(0);
        });

        it('should also wire q into count()', async () => {
            asMock(model.count).mockResolvedValue(1);

            await service.count(actorWithView, { page: 1, pageSize: 10, q: 'muse' });

            const [, options] = asMock(model.count).mock.calls[0] as [
                Record<string, unknown>,
                { additionalConditions?: unknown[] }
            ];
            expect(options?.additionalConditions).toHaveLength(1);
        });
    });

    /**
     * HOS-139 judgment-day round-2: `_executeSearch` ignored `ctx.pagination`
     * (page/pageSize/sortBy/sortOrder), so `search()` always returned page 1 /
     * default pageSize. Verifies the caller-provided pagination is forwarded to
     * the model's options argument.
     */
    describe('search() pagination forwarding (HOS-139 round-2)', () => {
        it('should forward ctx.pagination page/pageSize/sort to model.findAll', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [category], total: 1 });

            await service.search(actorWithView, {
                page: 3,
                pageSize: 50,
                sortBy: 'displayWeight',
                sortOrder: 'desc'
            });

            const [, options] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                { page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }
            ];
            expect(options?.page).toBe(3);
            expect(options?.pageSize).toBe(50);
            expect(options?.sortBy).toBe('displayWeight');
            expect(options?.sortOrder).toBe('desc');
        });
    });

    describe('assignCategoryToPointOfInterest', () => {
        it('should return FORBIDDEN when actor lacks POI_CATEGORY_CREATE', async () => {
            const result = await service.assignCategoryToPointOfInterest(actorNoPerms, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(relatedModel.create).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when the point of interest does not exist', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(null);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValue(null);
            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return NOT_FOUND when the category does not exist', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(null);
            asMock(relatedModel.findOne).mockResolvedValue(null);
            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return ALREADY_EXISTS when the relation already exists', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });
            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });
            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        });

        it('should create a non-primary relation without touching type', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValue(null);
            asMock(relatedModel.create).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });

            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });

            expect(result.error).toBeUndefined();
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId, isPrimary: false },
                undefined
            );
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
        });

        /** AC-5: exactly one primary remains, and `type` is synced transactionally. */
        it('should demote the existing primary and sync type when isPrimary=true (AC-5, AC-8)', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne)
                // pre-check: no existing relation for this (poi, category) pair
                .mockResolvedValueOnce(null)
                // inside tx: existing DIFFERENT primary
                .mockResolvedValueOnce({
                    pointOfInterestId: poiId,
                    categoryId: otherCategoryId,
                    isPrimary: true
                });
            asMock(relatedModel.update).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId: otherCategoryId,
                isPrimary: false
            });
            asMock(relatedModel.create).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });
            asMock(pointOfInterestModel.update).mockResolvedValue({
                ...poi,
                type: PointOfInterestTypeEnum.MUSEUM
            });

            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            expect(result.error).toBeUndefined();
            // Old primary demoted exactly once.
            expect(relatedModel.update).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId: otherCategoryId },
                { isPrimary: false },
                {}
            );
            // New primary created.
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId, isPrimary: true },
                {}
            );
            // `type` synced from the new primary's slug (museum -> MUSEUM).
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                {}
            );
        });

        /**
         * HOS-139 judgment-day FIX 2: when the caller already provides an
         * active `ctx.tx`, the primary-changing path must join it instead of
         * always opening a brand-new, independent `withServiceTransaction`
         * boundary.
         */
        it('should join an existing ctx.tx instead of opening a new transaction', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            asMock(relatedModel.create).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            const result = await service.assignCategoryToPointOfInterest(
                actorWithCreate,
                { pointOfInterestId: poiId, categoryId, isPrimary: true },
                ctxWithTx
            );

            expect(result.error).toBeUndefined();
            expect(mockedWithServiceTransaction).not.toHaveBeenCalled();
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId, isPrimary: true },
                mockTx
            );
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                mockTx
            );
        });

        it('should derive type=OTHER when the primary category has no direct enum equivalent', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(wineryCategory);
            asMock(relatedModel.findOne).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            asMock(relatedModel.create).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId: otherCategoryId,
                isPrimary: true
            });

            const result = await service.assignCategoryToPointOfInterest(actorWithCreate, {
                pointOfInterestId: poiId,
                categoryId: otherCategoryId,
                isPrimary: true
            });

            expect(result.error).toBeUndefined();
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.OTHER },
                {}
            );
        });
    });

    describe('unassignCategoryFromPointOfInterest', () => {
        it('should return FORBIDDEN when actor lacks POI_CATEGORY_DELETE', async () => {
            const result = await service.unassignCategoryFromPointOfInterest(actorNoPerms, {
                pointOfInterestId: poiId,
                categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(relatedModel.hardDelete).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when the relation does not exist', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findOne).mockResolvedValue(null);
            const result = await service.unassignCategoryFromPointOfInterest(actorWithDelete, {
                pointOfInterestId: poiId,
                categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should hardDelete a non-primary relation without touching type', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: false
            });

            const result = await service.unassignCategoryFromPointOfInterest(actorWithDelete, {
                pointOfInterestId: poiId,
                categoryId
            });

            expect(result.error).toBeUndefined();
            expect(relatedModel.hardDelete).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId },
                undefined
            );
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
        });

        /** AC-6: auto-promotes the next-highest-displayWeight remaining category. */
        it('should auto-promote the highest-displayWeight remaining category and sync type (AC-6, AC-8)', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [{ pointOfInterestId: poiId, categoryId: otherCategoryId, isPrimary: false }]
            });
            asMock(model.findAll).mockResolvedValue({ items: [wineryCategory] });
            asMock(relatedModel.update).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId: otherCategoryId,
                isPrimary: true
            });

            const result = await service.unassignCategoryFromPointOfInterest(actorWithDelete, {
                pointOfInterestId: poiId,
                categoryId
            });

            expect(result.error).toBeUndefined();
            expect(relatedModel.hardDelete).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId },
                {}
            );
            expect(relatedModel.update).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId: otherCategoryId },
                { isPrimary: true },
                {}
            );
            // winery has no direct enum equivalent -> derives to OTHER.
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.OTHER },
                {}
            );
            // HOS-139 judgment-day FIX 1: the remaining-categories re-fetch must use a
            // real `inArray(poiCategories.id, ids)` additional condition, not a broken
            // `findAll({ id: array })` where-object degradation.
            expect(mockedInArray).toHaveBeenCalledWith(poiCategories.id, [otherCategoryId]);
            expect(model.findAll).toHaveBeenCalledWith(
                {},
                { pageSize: 200 },
                expect.arrayContaining([expect.anything()]),
                {}
            );
        });

        it('should leave type untouched when zero categories remain after removing the primary', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });
            asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

            const result = await service.unassignCategoryFromPointOfInterest(actorWithDelete, {
                pointOfInterestId: poiId,
                categoryId
            });

            expect(result.error).toBeUndefined();
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
        });

        /**
         * HOS-139 judgment-day FIX 2: the auto-promotion path must join an
         * already-active `ctx.tx` instead of always opening a new,
         * independent `withServiceTransaction` boundary.
         */
        it('should join an existing ctx.tx instead of opening a new transaction', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [{ pointOfInterestId: poiId, categoryId: otherCategoryId, isPrimary: false }]
            });
            asMock(model.findAll).mockResolvedValue({ items: [wineryCategory] });
            asMock(relatedModel.update).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId: otherCategoryId,
                isPrimary: true
            });

            const result = await service.unassignCategoryFromPointOfInterest(
                actorWithDelete,
                { pointOfInterestId: poiId, categoryId },
                ctxWithTx
            );

            expect(result.error).toBeUndefined();
            expect(mockedWithServiceTransaction).not.toHaveBeenCalled();
            expect(relatedModel.hardDelete).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId },
                mockTx
            );
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.OTHER },
                mockTx
            );
        });
    });

    describe('setPrimaryCategory', () => {
        it('should return FORBIDDEN when actor lacks POI_CATEGORY_UPDATE', async () => {
            const result = await service.setPrimaryCategory(actorNoPerms, {
                pointOfInterestId: poiId,
                categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return NOT_FOUND when the category is not assigned to the POI', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValue(null);
            const result = await service.setPrimaryCategory(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should no-op when the category is already primary', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            const result = await service.setPrimaryCategory(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryId
            });

            expect(result.error).toBeUndefined();
            expect(relatedModel.update).not.toHaveBeenCalled();
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
        });

        it('should flip the primary and sync type in one transaction', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne)
                // pre-check: the target relation exists, not yet primary
                .mockResolvedValueOnce({ pointOfInterestId: poiId, categoryId, isPrimary: false })
                // inside tx: current primary is the other category
                .mockResolvedValueOnce({
                    pointOfInterestId: poiId,
                    categoryId: otherCategoryId,
                    isPrimary: true
                });
            asMock(relatedModel.update).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            const result = await service.setPrimaryCategory(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryId
            });

            expect(result.error).toBeUndefined();
            expect(relatedModel.update).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId: otherCategoryId },
                { isPrimary: false },
                {}
            );
            expect(relatedModel.update).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId },
                { isPrimary: true },
                {}
            );
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                {}
            );
        });

        /**
         * HOS-139 judgment-day FIX 2: the flip path must join an
         * already-active `ctx.tx` instead of always opening a new,
         * independent `withServiceTransaction` boundary.
         */
        it('should join an existing ctx.tx instead of opening a new transaction', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findOne)
                .mockResolvedValueOnce({ pointOfInterestId: poiId, categoryId, isPrimary: false })
                .mockResolvedValueOnce({
                    pointOfInterestId: poiId,
                    categoryId: otherCategoryId,
                    isPrimary: true
                });
            asMock(relatedModel.update).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            const result = await service.setPrimaryCategory(
                actorWithUpdate,
                { pointOfInterestId: poiId, categoryId },
                ctxWithTx
            );

            expect(result.error).toBeUndefined();
            expect(mockedWithServiceTransaction).not.toHaveBeenCalled();
            expect(relatedModel.update).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId },
                { isPrimary: true },
                mockTx
            );
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                mockTx
            );
        });
    });

    describe('getCategoriesForPointOfInterest', () => {
        it('should return categories sorted by displayWeight descending', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [
                    { pointOfInterestId: poiId, categoryId, isPrimary: true },
                    { pointOfInterestId: poiId, categoryId: otherCategoryId, isPrimary: false }
                ]
            });
            asMock(model.findAll).mockResolvedValue({ items: [category, wineryCategory] });

            const result = await service.getCategoriesForPointOfInterest(actorWithView, {
                pointOfInterestId: poiId,
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.categories).toHaveLength(2);
            expect(result.data?.categories[0]?.id).toBe(wineryCategory.id);
            // HOS-139 judgment-day FIX 1: real `inArray(poiCategories.id, ids)`
            // additional condition, not a broken `findAll({ id: array })`.
            expect(mockedInArray).toHaveBeenCalledWith(
                poiCategories.id,
                expect.arrayContaining([categoryId, otherCategoryId])
            );
            expect(model.findAll).toHaveBeenCalledWith(
                {},
                { pageSize: 200 },
                expect.arrayContaining([expect.anything()]),
                undefined
            );
        });

        it('should carry the per-POI isPrimary flag on each returned category (HOS-144)', async () => {
            // GET must be symmetric with what setCategoriesForPointOfInterest
            // (PUT) already returns — the admin category-manager UI needs
            // isPrimary here to pre-select the primary category on load.
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [
                    { pointOfInterestId: poiId, categoryId, isPrimary: true },
                    { pointOfInterestId: poiId, categoryId: otherCategoryId, isPrimary: false }
                ]
            });
            asMock(model.findAll).mockResolvedValue({ items: [category, wineryCategory] });

            const result = await service.getCategoriesForPointOfInterest(actorWithView, {
                pointOfInterestId: poiId,
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            const categories = result.data?.categories ?? [];
            expect(categories).toHaveLength(2);

            // Sorted by displayWeight descending: wineryCategory (80) first,
            // museum category (50) second.
            const winery = categories.find((c) => c.id === wineryCategory.id);
            const museum = categories.find((c) => c.id === categoryId);
            expect(winery?.isPrimary).toBe(false);
            expect(museum?.isPrimary).toBe(true);
        });

        it('should return an empty array when the POI has no categories', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

            const result = await service.getCategoriesForPointOfInterest(actorWithView, {
                pointOfInterestId: poiId,
                page: 1,
                pageSize: 10
            });

            expect(result.data?.categories).toEqual([]);
            expect(model.findAll).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when the POI does not exist', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(null);
            const result = await service.getCategoriesForPointOfInterest(actorWithView, {
                pointOfInterestId: poiId,
                page: 1,
                pageSize: 10
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('getPointsOfInterestForCategory', () => {
        it('should return points of interest tagged with the category', async () => {
            asMock(model.findOne).mockResolvedValue(category);
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [{ pointOfInterestId: poiId, categoryId, isPrimary: true }]
            });
            asMock(pointOfInterestModel.findAll).mockResolvedValue({ items: [poi] });

            const result = await service.getPointsOfInterestForCategory(actorWithView, {
                categoryId,
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.pointsOfInterest).toHaveLength(1);
            expect(result.data?.pointsOfInterest[0]?.id).toBe(poiId);
            // HOS-139 judgment-day FIX 1: real `inArray(pointsOfInterest.id, ids)`
            // additional condition, not a broken `findAll({ id: array })`.
            expect(mockedInArray).toHaveBeenCalledWith(pointsOfInterest.id, [poiId]);
            expect(pointOfInterestModel.findAll).toHaveBeenCalledWith(
                {},
                { pageSize: 200 },
                expect.arrayContaining([expect.anything()]),
                undefined
            );
        });

        it('should return NOT_FOUND when the category does not exist', async () => {
            asMock(model.findOne).mockResolvedValue(null);
            const result = await service.getPointsOfInterestForCategory(actorWithView, {
                categoryId,
                page: 1,
                pageSize: 10
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('setCategoriesForPointOfInterest (HOS-143 T-006)', () => {
        const missingCategoryId = getMockId('poiCategory', 'cat-missing') as PoiCategoryIdType;

        it('should return FORBIDDEN when actor lacks POI_CATEGORY_UPDATE', async () => {
            const result = await service.setCategoriesForPointOfInterest(actorNoPerms, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId],
                primaryCategoryId: categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(relatedModel.hardDelete).not.toHaveBeenCalled();
            expect(relatedModel.create).not.toHaveBeenCalled();
        });

        it('should return VALIDATION_ERROR when primaryCategoryId is not in categoryIds', async () => {
            const result = await service.setCategoriesForPointOfInterest(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId],
                primaryCategoryId: otherCategoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(pointOfInterestModel.findOne).not.toHaveBeenCalled();
            expect(relatedModel.hardDelete).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND when the point of interest does not exist', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(null);
            const result = await service.setCategoriesForPointOfInterest(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId],
                primaryCategoryId: categoryId
            });
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(relatedModel.hardDelete).not.toHaveBeenCalled();
        });

        /**
         * AC-6: a bad categoryId anywhere in the array (here, the middle
         * position) must fail the WHOLE call before any write — the previous
         * assignment must remain untouched (no partial delete+insert).
         */
        it('should return NOT_FOUND and perform zero writes when a categoryId in the middle of the array does not exist (AC-6)', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne)
                .mockResolvedValueOnce(category)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(wineryCategory);

            const result = await service.setCategoriesForPointOfInterest(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId, missingCategoryId, otherCategoryId],
                primaryCategoryId: categoryId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toContain(missingCategoryId);
            // No write of any kind happened — the previous assignment is intact.
            expect(relatedModel.hardDelete).not.toHaveBeenCalled();
            expect(relatedModel.create).not.toHaveBeenCalled();
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
            expect(mockedWithServiceTransaction).not.toHaveBeenCalled();
        });

        /**
         * AC-5: a valid full-replace call ends with EXACTLY the submitted
         * categories, exactly one `isPrimary: true`, and the derived `type`
         * synced from the primary category's slug — all in one transaction.
         */
        it('should replace the full category set with exactly the submitted categories and one primary (AC-5)', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne)
                .mockResolvedValueOnce(category)
                .mockResolvedValueOnce(wineryCategory);
            asMock(relatedModel.hardDelete).mockResolvedValue(2);
            asMock(relatedModel.create)
                .mockResolvedValueOnce({ pointOfInterestId: poiId, categoryId, isPrimary: true })
                .mockResolvedValueOnce({
                    pointOfInterestId: poiId,
                    categoryId: otherCategoryId,
                    isPrimary: false
                });
            asMock(pointOfInterestModel.update).mockResolvedValue({
                ...poi,
                type: PointOfInterestTypeEnum.MUSEUM
            });

            const result = await service.setCategoriesForPointOfInterest(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId, otherCategoryId],
                primaryCategoryId: categoryId
            });

            expect(result.error).toBeUndefined();
            // Full replace: delete ALL existing rows for the POI first.
            expect(relatedModel.hardDelete).toHaveBeenCalledWith({ pointOfInterestId: poiId }, {});
            // Then re-insert exactly the submitted set, primary flag only on categoryId.
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId, isPrimary: true },
                {}
            );
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId: otherCategoryId, isPrimary: false },
                {}
            );
            expect(relatedModel.create).toHaveBeenCalledTimes(2);
            // `type` synced from the primary's slug (museum -> MUSEUM).
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                {}
            );
            // Resulting state: exactly the submitted categories, exactly one primary.
            const returnedCategories = result.data?.categories ?? [];
            expect(returnedCategories).toHaveLength(2);
            expect(returnedCategories.filter((c) => c.isPrimary)).toHaveLength(1);
            expect(returnedCategories.find((c) => c.isPrimary)?.id).toBe(categoryId);
            // Sorted by displayWeight descending (winery=80 before museum=50).
            expect(returnedCategories[0]?.id).toBe(otherCategoryId);
            expect(returnedCategories[1]?.id).toBe(categoryId);
        });

        /**
         * AC-6: if the insert half of the delete+insert fails partway through
         * (simulated here by the second `create` call rejecting), the whole
         * operation must fail — it must never surface a success result with
         * a partially-written category set. In production this failure
         * propagates out of the `withServiceTransaction` callback and rolls
         * back the real Postgres transaction (including the earlier
         * `hardDelete`); this unit test verifies the code-level contract
         * that delete + all inserts + the `type` sync share ONE transactional
         * callback, so a mid-array insert failure cannot leave a partial write.
         */
        it('should surface a failure (not a partial success) when an insert fails mid-array (AC-6)', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne)
                .mockResolvedValueOnce(category)
                .mockResolvedValueOnce(wineryCategory);
            asMock(relatedModel.hardDelete).mockResolvedValue(2);
            asMock(relatedModel.create)
                .mockResolvedValueOnce({ pointOfInterestId: poiId, categoryId, isPrimary: true })
                .mockRejectedValueOnce(new Error('simulated insert failure'));

            const result = await service.setCategoriesForPointOfInterest(actorWithUpdate, {
                pointOfInterestId: poiId,
                categoryIds: [categoryId, otherCategoryId],
                primaryCategoryId: categoryId
            });

            expect(result.data).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(pointOfInterestModel.update).not.toHaveBeenCalled();
        });

        /**
         * HOS-139 judgment-day FIX 2 precedent: when the caller already
         * provides an active `ctx.tx`, the full-replace path must join it
         * instead of always opening a new, independent transaction.
         */
        it('should join an existing ctx.tx instead of opening a new transaction', async () => {
            asMock(pointOfInterestModel.findOne).mockResolvedValue(poi);
            asMock(model.findOne).mockResolvedValueOnce(category);
            asMock(relatedModel.hardDelete).mockResolvedValue(1);
            asMock(relatedModel.create).mockResolvedValue({
                pointOfInterestId: poiId,
                categoryId,
                isPrimary: true
            });

            const result = await service.setCategoriesForPointOfInterest(
                actorWithUpdate,
                {
                    pointOfInterestId: poiId,
                    categoryIds: [categoryId],
                    primaryCategoryId: categoryId
                },
                ctxWithTx
            );

            expect(result.error).toBeUndefined();
            expect(mockedWithServiceTransaction).not.toHaveBeenCalled();
            expect(relatedModel.hardDelete).toHaveBeenCalledWith(
                { pointOfInterestId: poiId },
                mockTx
            );
            expect(relatedModel.create).toHaveBeenCalledWith(
                { pointOfInterestId: poiId, categoryId, isPrimary: true },
                mockTx
            );
            expect(pointOfInterestModel.update).toHaveBeenCalledWith(
                { id: poiId },
                { type: PointOfInterestTypeEnum.MUSEUM },
                mockTx
            );
        });
    });
});
