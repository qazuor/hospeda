import {
    DestinationModel,
    PoiCategoryModel,
    PointOfInterestModel,
    pointsOfInterest,
    RDestinationPointOfInterestModel,
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
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// `drizzle-orm`'s `inArray` is spied (not stubbed) so the real SQL condition
// is still produced — this lets the HOS-113 regression tests below assert
// the destinationId->id-filter resolution actually calls `inArray` with the
// resolved POI ids, without needing a real Postgres connection.
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual, inArray: vi.fn(actual.inArray) };
});

const poiId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const actorNoPerms = createActor({ permissions: [] });
const actorWithCreate = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_CREATE] });
const actorWithUpdate = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE] });
const actorWithDelete = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_DELETE] });
const actorWithRestore = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_RESTORE] });

const poi = PointOfInterestFactoryBuilder.create({ id: poiId });

describe('PointOfInterestService', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let categoryModel: PoiCategoryModel;
    let categoryRelatedModel: RPoiCategoryModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, [
            'findOne',
            'create',
            'update',
            'softDelete',
            'restore',
            'findAll',
            'count'
        ]);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne', 'findAll']);
        categoryModel = createTypedModelMock(PoiCategoryModel, ['findOne']);
        categoryRelatedModel = createTypedModelMock(RPoiCategoryModel, ['findAll']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(
            ctx,
            model,
            relatedModel,
            destinationModel,
            categoryModel,
            categoryRelatedModel
        );
        vi.clearAllMocks();
    });

    describe('create', () => {
        const createInput = {
            slug: 'playa-banco-pelay',
            lat: -32.4901,
            long: -58.2255,
            type: PointOfInterestTypeEnum.BEACH,
            description: 'A well-known beach in Concepcion del Uruguay',
            isFeatured: false,
            isBuiltin: true,
            displayWeight: 50,
            hasOwnPage: false,
            verified: false,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        it('should create a point of interest when actor has POINT_OF_INTEREST_CREATE', async () => {
            asMock(model.create).mockResolvedValue({ ...poi, ...createInput });
            const result = await service.create(actorWithCreate, createInput);
            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toBe('playa-banco-pelay');
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_CREATE', async () => {
            const result = await service.create(actorNoPerms, createInput);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
            expect(model.create).not.toHaveBeenCalled();
        });
    });

    describe('getById', () => {
        it('should return the point of interest for any actor (public view)', async () => {
            asMock(model.findOne).mockResolvedValue(poi);
            const result = await service.getById(actorNoPerms, poiId);
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(poiId);
        });

        it('should return NOT_FOUND when the point of interest does not exist', async () => {
            asMock(model.findOne).mockResolvedValue(null);
            const result = await service.getById(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('update', () => {
        it('should update when actor has POINT_OF_INTEREST_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            asMock(model.update).mockResolvedValue({ ...poi, displayWeight: 80 });
            const result = await service.update(actorWithUpdate, poiId, { displayWeight: 80 });
            expect(result.error).toBeUndefined();
            expect(result.data?.displayWeight).toBe(80);
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_UPDATE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            const result = await service.update(actorNoPerms, poiId, { displayWeight: 80 });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete when actor has POINT_OF_INTEREST_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            asMock(model.softDelete).mockResolvedValue(1);
            const result = await service.softDelete(actorWithDelete, poiId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_DELETE', async () => {
            asMock(model.findById).mockResolvedValue(poi);
            const result = await service.softDelete(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.softDelete).not.toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore when actor has POINT_OF_INTEREST_RESTORE', async () => {
            const deletedPoi = { ...poi, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedPoi);
            asMock(model.restore).mockResolvedValue(1);
            const result = await service.restore(actorWithRestore, poiId);
            expect(result.error).toBeUndefined();
        });

        it('should return FORBIDDEN when actor lacks POINT_OF_INTEREST_RESTORE', async () => {
            const deletedPoi = { ...poi, deletedAt: new Date() };
            asMock(model.findById).mockResolvedValue(deletedPoi);
            const result = await service.restore(actorNoPerms, poiId);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });
    });

    describe('searchForList', () => {
        it('should return points of interest with destination counts', async () => {
            const poi1 = PointOfInterestFactoryBuilder.create({
                id: getMockId('pointOfInterest', 'poi-a') as PointOfInterestIdType
            });
            const poi2 = PointOfInterestFactoryBuilder.create({
                id: getMockId('pointOfInterest', 'poi-b') as PointOfInterestIdType
            });
            asMock(model.findAll).mockResolvedValue({ items: [poi1, poi2], total: 2 });
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [
                    { destinationId: getMockId('destination', 'd1'), pointOfInterestId: poi1.id },
                    { destinationId: getMockId('destination', 'd2'), pointOfInterestId: poi1.id }
                ]
            });

            const result = await service.searchForList(actorNoPerms, { page: 1, pageSize: 10 });

            expect(result.data).toHaveLength(2);
            expect(result.data[0]?.destinationCount).toBe(2);
            expect(result.data[1]?.destinationCount).toBe(0);
            expect(result.pagination.total).toBe(2);
        });

        it('should return an empty page when there are no results', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });

            const result = await service.searchForList(actorNoPerms, { page: 1, pageSize: 10 });

            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
        });
    });

    /**
     * HOS-113 CRITICAL regression coverage: `points_of_interest` has NO
     * `destinationId` column — it is M2M via `r_destination_point_of_interest`.
     * Before this fix, `_executeSearch`/`_executeCount`/`searchForList` put
     * `where.destinationId = destinationId` and called `this.model.findAll(where)`
     * directly, which either threw `DbError` (unknown column, destinationId-only
     * search) or silently dropped the filter (combined with another known
     * column), leaking POIs from every destination. These tests assert the
     * `destinationId` filter is resolved via the join table and applied as an
     * `id IN (...)` additional SQL condition (verified through a spied REAL
     * `inArray` from `drizzle-orm`, not a hand-rolled predicate), and that the
     * plain `where` object passed to `model.findAll`/`model.count` never
     * contains `destinationId` (which would otherwise reach the real
     * `buildWhereClause` as an unknown column and throw/misbehave).
     */
    describe('destinationId search filter (HOS-113 regression — join table, not a column)', () => {
        const destinationId = getMockId('destination', 'dest-1');
        const poiA = PointOfInterestFactoryBuilder.create({
            id: getMockId('pointOfInterest', 'poi-dest-a') as PointOfInterestIdType,
            type: PointOfInterestTypeEnum.BEACH
        });
        const poiB = PointOfInterestFactoryBuilder.create({
            id: getMockId('pointOfInterest', 'poi-dest-b') as PointOfInterestIdType,
            type: PointOfInterestTypeEnum.BEACH
        });

        describe('search()', () => {
            it('should filter by destinationId alone via the join table without throwing', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({
                    items: [
                        { destinationId, pointOfInterestId: poiA.id },
                        { destinationId, pointOfInterestId: poiB.id }
                    ]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA, poiB], total: 2 });

                const result = await service.search(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.items).toHaveLength(2);

                // The relation lookup was resolved via the join table. HOS-140:
                // `resolveDestinationIdFilter` defaults to a PRIMARY-only
                // constraint — a behavior-preserving no-op for every row that
                // existed before this spec shipped.
                expect(relatedModel.findAll).toHaveBeenCalledWith({
                    destinationId,
                    relation: 'PRIMARY'
                });

                // `where` reaching model.findAll must NOT carry `destinationId` —
                // that column does not exist on `points_of_interest`.
                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                expect(whereArg).not.toHaveProperty('destinationId');
                expect(whereArg).toEqual({});

                // The id filter is a real `inArray(pointsOfInterest.id, ids)`
                // condition — asserted via the spied real `inArray`.
                expect(mockedInArray).toHaveBeenCalledWith(
                    pointsOfInterest.id,
                    expect.arrayContaining([poiA.id, poiB.id])
                );
                expect(additionalConditionsArg).toHaveLength(1);
            });

            it('should apply BOTH destinationId and type constraints (not silently drop destinationId)', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({
                    items: [{ destinationId, pointOfInterestId: poiA.id }]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.search(actorNoPerms, {
                    destinationId,
                    type: PointOfInterestTypeEnum.BEACH,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();

                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                // `type` is a real column and stays in `where`; `destinationId`
                // must NOT be — both constraints are still applied, just via
                // different mechanisms.
                expect(whereArg).toEqual({ type: PointOfInterestTypeEnum.BEACH });
                expect(mockedInArray).toHaveBeenCalledWith(pointsOfInterest.id, [poiA.id]);
                expect(additionalConditionsArg).toHaveLength(1);
            });

            it('should short-circuit to an empty result when destinationId maps to zero POIs', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

                const result = await service.search(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.items).toEqual([]);
                expect(result.data?.total).toBe(0);
                expect(model.findAll).not.toHaveBeenCalled();
            });
        });

        describe('count()', () => {
            it('should apply the same destinationId join-table resolution as search()', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({
                    items: [{ destinationId, pointOfInterestId: poiA.id }]
                });
                asMock(model.count).mockResolvedValue(1);

                const result = await service.count(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.count).toBe(1);

                const [whereArg, optionsArg] = asMock(model.count).mock.calls[0] as [
                    Record<string, unknown>,
                    { additionalConditions?: unknown[] }
                ];
                expect(whereArg).toEqual({});
                expect(optionsArg?.additionalConditions).toHaveLength(1);
                expect(mockedInArray).toHaveBeenCalledWith(pointsOfInterest.id, [poiA.id]);
            });

            it('should short-circuit to a zero count when destinationId maps to zero POIs', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

                const result = await service.count(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.count).toBe(0);
                expect(model.count).not.toHaveBeenCalled();
            });
        });

        describe('searchForList()', () => {
            it('should apply the destinationId join-table id-filter (not a where column)', async () => {
                asMock(relatedModel.findAll)
                    // First call: resolving destinationId -> poi ids.
                    .mockResolvedValueOnce({
                        items: [{ destinationId, pointOfInterestId: poiA.id }]
                    })
                    // Second call: destination counts for the returned page.
                    .mockResolvedValueOnce({
                        items: [{ destinationId, pointOfInterestId: poiA.id }]
                    });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.searchForList(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.id).toBe(poiA.id);

                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                expect(whereArg).not.toHaveProperty('destinationId');
                expect(additionalConditionsArg).toHaveLength(1);
                expect(mockedInArray).toHaveBeenCalledWith(pointsOfInterest.id, [poiA.id]);
            });

            it('should short-circuit to an empty page when destinationId maps to zero POIs', async () => {
                asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

                const result = await service.searchForList(actorNoPerms, {
                    destinationId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toEqual([]);
                expect(result.pagination.total).toBe(0);
                expect(model.findAll).not.toHaveBeenCalled();
            });
        });
    });

    /**
     * HOS-139 T-016 regression coverage: `points_of_interest` has no
     * `categoryId` column either — the new category taxonomy is M2M via
     * `r_poi_category`, resolved the same way `destinationId` already is
     * (id-filter through the join table, additive alongside — never
     * replacing — the legacy `type` plain-column filter).
     */
    describe('categoryId/categorySlug search filter (HOS-139 — join table, not a column)', () => {
        const categoryId = getMockId('poiCategory', 'cat-museum') as PoiCategoryIdType;
        const poiA = PointOfInterestFactoryBuilder.create({
            id: getMockId('pointOfInterest', 'poi-cat-a') as PointOfInterestIdType,
            type: PointOfInterestTypeEnum.MUSEUM
        });
        const poiB = PointOfInterestFactoryBuilder.create({
            id: getMockId('pointOfInterest', 'poi-cat-b') as PointOfInterestIdType,
            type: PointOfInterestTypeEnum.MUSEUM
        });

        describe('search()', () => {
            it('should filter by categoryId alone via the join table without throwing', async () => {
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [
                        { pointOfInterestId: poiA.id, categoryId, isPrimary: true },
                        { pointOfInterestId: poiB.id, categoryId, isPrimary: false }
                    ]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA, poiB], total: 2 });

                const result = await service.search(actorNoPerms, {
                    categoryId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.items).toHaveLength(2);
                expect(categoryRelatedModel.findAll).toHaveBeenCalledWith(
                    { categoryId },
                    { pageSize: 200 }
                );
                expect(categoryModel.findOne).not.toHaveBeenCalled();

                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                expect(whereArg).not.toHaveProperty('categoryId');
                expect(mockedInArray).toHaveBeenCalledWith(
                    pointsOfInterest.id,
                    expect.arrayContaining([poiA.id, poiB.id])
                );
                expect(additionalConditionsArg).toHaveLength(1);
            });

            it('should resolve categorySlug to a categoryId before joining', async () => {
                asMock(categoryModel.findOne).mockResolvedValue({
                    id: categoryId,
                    slug: 'museum'
                });
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [{ pointOfInterestId: poiA.id, categoryId, isPrimary: true }]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.search(actorNoPerms, {
                    categorySlug: 'museum',
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: 'museum' });
                expect(categoryRelatedModel.findAll).toHaveBeenCalledWith(
                    { categoryId },
                    { pageSize: 200 }
                );
                expect(result.data?.items).toHaveLength(1);
            });

            it('should short-circuit to an empty result when categorySlug does not match any category', async () => {
                asMock(categoryModel.findOne).mockResolvedValue(null);

                const result = await service.search(actorNoPerms, {
                    categorySlug: 'unknown-slug',
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.items).toEqual([]);
                expect(result.data?.total).toBe(0);
                expect(categoryRelatedModel.findAll).not.toHaveBeenCalled();
                expect(model.findAll).not.toHaveBeenCalled();
            });

            it('should short-circuit to an empty result when categoryId maps to zero POIs', async () => {
                asMock(categoryRelatedModel.findAll).mockResolvedValue({ items: [] });

                const result = await service.search(actorNoPerms, {
                    categoryId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.items).toEqual([]);
                expect(model.findAll).not.toHaveBeenCalled();
            });

            it('should apply BOTH the type column filter and the categoryId join filter (type branch unchanged)', async () => {
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [{ pointOfInterestId: poiA.id, categoryId, isPrimary: true }]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.search(actorNoPerms, {
                    categoryId,
                    type: PointOfInterestTypeEnum.MUSEUM,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                // `type` is a real column and stays in `where`; `categoryId`
                // must NOT be — both constraints are still applied, just via
                // different mechanisms.
                expect(whereArg).toEqual({ type: PointOfInterestTypeEnum.MUSEUM });
                expect(additionalConditionsArg).toHaveLength(1);
            });
        });

        describe('count()', () => {
            it('should apply the same categoryId join-table resolution as search()', async () => {
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [{ pointOfInterestId: poiA.id, categoryId, isPrimary: true }]
                });
                asMock(model.count).mockResolvedValue(1);

                const result = await service.count(actorNoPerms, {
                    categoryId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.count).toBe(1);
                const [whereArg, optionsArg] = asMock(model.count).mock.calls[0] as [
                    Record<string, unknown>,
                    { additionalConditions?: unknown[] }
                ];
                expect(whereArg).toEqual({});
                expect(optionsArg?.additionalConditions).toHaveLength(1);
            });
        });

        describe('searchForList()', () => {
            it('should apply the categoryId join-table id-filter (not a where column)', async () => {
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [{ pointOfInterestId: poiA.id, categoryId, isPrimary: true }]
                });
                asMock(relatedModel.findAll).mockResolvedValue({ items: [] });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.searchForList(actorNoPerms, {
                    categoryId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.id).toBe(poiA.id);
                const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock
                    .calls[0] as [Record<string, unknown>, unknown, unknown[]];
                expect(whereArg).not.toHaveProperty('categoryId');
                expect(additionalConditionsArg).toHaveLength(1);
            });
        });

        describe('combined destinationId + categoryId filters', () => {
            it('should AND-combine both join-table id-filters (POI must satisfy both)', async () => {
                const destinationId = getMockId('destination', 'dest-cat-1');
                asMock(relatedModel.findAll).mockResolvedValue({
                    items: [
                        { destinationId, pointOfInterestId: poiA.id },
                        { destinationId, pointOfInterestId: poiB.id }
                    ]
                });
                asMock(categoryRelatedModel.findAll).mockResolvedValue({
                    items: [{ pointOfInterestId: poiA.id, categoryId, isPrimary: true }]
                });
                asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

                const result = await service.search(actorNoPerms, {
                    destinationId,
                    categoryId,
                    page: 1,
                    pageSize: 10
                });

                expect(result.error).toBeUndefined();
                const [, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                    Record<string, unknown>,
                    unknown,
                    unknown[]
                ];
                // Both id-filter conditions are present (AND-combined by the model layer).
                expect(additionalConditionsArg).toHaveLength(2);
            });
        });
    });

    describe('search() pagination/sort forwarding + text search (HOS-142 G-6 regression)', () => {
        const poiA = PointOfInterestFactoryBuilder.create({
            id: getMockId('pointOfInterest', 'poi-search-a') as PointOfInterestIdType
        });

        it('should forward page/pageSize/sortBy/sortOrder to model.findAll instead of always calling it with undefined options', async () => {
            // Before the fix, `_executeSearch` called
            // `this.model.findAll(where, undefined, additionalConditions)`,
            // silently discarding the caller's page/pageSize/sortBy/sortOrder
            // (republished via `BaseCrudRead.search`'s `ctx.pagination`) —
            // the public list endpoint always fell back to the model's own
            // default pagination and never sorted.
            asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

            const result = await service.search(actorNoPerms, {
                page: 2,
                pageSize: 5,
                sortBy: 'displayWeight',
                sortOrder: 'desc'
            });

            expect(result.error).toBeUndefined();
            const [, optionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                { page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }
            ];
            expect(optionsArg).toEqual({
                page: 2,
                pageSize: 5,
                sortBy: 'displayWeight',
                sortOrder: 'desc'
            });
        });

        it('should default to page 1 / pageSize 10 when the caller omits pagination', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

            // Cast: `page`/`pageSize` carry Zod `.default()`s, so the schema
            // happily fills them in at runtime for an omitted-pagination
            // caller (e.g. a route passing a raw query object) — but the
            // service's TS signature reflects the POST-parse (defaults
            // applied) shape, which makes them look required. The cast lets
            // this test exercise that real, supported runtime path.
            await service.search(actorNoPerms, {} as Parameters<typeof service.search>[1]);

            const [, optionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                { page?: number; pageSize?: number }
            ];
            expect(optionsArg?.page).toBe(1);
            expect(optionsArg?.pageSize).toBe(10);
        });

        it('should build a text-search condition from `q` against slug/description and merge it into additionalConditions', async () => {
            // Before the fix, `q` was accepted by the HTTP schema but never
            // reached the database query — `_executeSearch` ignored it
            // entirely, so free-text search silently did nothing.
            asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

            const result = await service.search(actorNoPerms, {
                q: 'plaza',
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            const [, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(additionalConditionsArg).toHaveLength(1);
        });

        it('should not add a text-search condition when `q` is absent', async () => {
            asMock(model.findAll).mockResolvedValue({ items: [poiA], total: 1 });

            await service.search(actorNoPerms, { page: 1, pageSize: 10 });

            const [, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(additionalConditionsArg).toEqual([]);
        });
    });
});
