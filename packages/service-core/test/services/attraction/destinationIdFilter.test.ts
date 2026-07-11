import {
    AttractionModel,
    attractions,
    DestinationModel,
    RDestinationAttractionModel
} from '@repo/db';
import type { AttractionIdType } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { inArray as mockedInArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// `drizzle-orm`'s `inArray` is spied (not stubbed) so the real SQL condition
// is still produced — this lets the HOS-125 regression tests below assert
// the destinationId->id-filter resolution actually calls `inArray` with the
// resolved attraction ids, without needing a real Postgres connection.
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual, inArray: vi.fn(actual.inArray) };
});

/**
 * HOS-125 CRITICAL production regression coverage: `attractions` has NO
 * `destinationId` column — it is M2M via `r_destination_attraction`.
 * Before this fix, `_executeSearch`/`_executeCount`/`searchForList` put
 * `where.destinationId = destinationId` and called `this.model.findAll(where)`
 * directly, which either threw `DbError` (unknown column, destinationId-only
 * search — surfaced as HTTP 500 on `GET /api/v1/public/attractions`) or
 * silently dropped the filter (combined with another known column), leaking
 * attractions from every destination. These tests assert the `destinationId`
 * filter is resolved via the join table and applied as an `id IN (...)`
 * additional SQL condition (verified through a spied REAL `inArray` from
 * `drizzle-orm`, not a hand-rolled predicate), and that the plain `where`
 * object passed to `model.findAll`/`model.count` never contains
 * `destinationId` (which would otherwise reach the real `buildWhereClause`
 * as an unknown column and throw/misbehave).
 */
describe('AttractionService destinationId search filter (HOS-125 regression — join table, not a column)', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    const actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
    const destinationId = getMockId('destination', 'dest-1');
    const attractionA = AttractionFactoryBuilder.create({
        id: getMockId('attraction', 'attr-a') as AttractionIdType,
        name: 'Attraction A'
    });
    const attractionB = AttractionFactoryBuilder.create({
        id: getMockId('attraction', 'attr-b') as AttractionIdType,
        name: 'Attraction B'
    });

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findAll', 'count']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne', 'findAll']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    describe('search()', () => {
        it('should filter by destinationId alone via the join table without throwing', async () => {
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [
                    { destinationId, attractionId: attractionA.id },
                    { destinationId, attractionId: attractionB.id }
                ]
            });
            asMock(model.findAll).mockResolvedValue({
                items: [attractionA, attractionB],
                total: 2
            });

            const result = await service.search(actor, {
                destinationId,
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(2);

            // The relation lookup was resolved via the join table.
            expect(relatedModel.findAll).toHaveBeenCalledWith({ destinationId });

            // `where` reaching model.findAll must NOT carry `destinationId` —
            // that column does not exist on `attractions`.
            const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(whereArg).not.toHaveProperty('destinationId');
            expect(whereArg).toEqual({});

            // The id filter is a real `inArray(attractions.id, ids)` condition —
            // asserted via the spied real `inArray`.
            expect(mockedInArray).toHaveBeenCalledWith(
                attractions.id,
                expect.arrayContaining([attractionA.id, attractionB.id])
            );
            expect(additionalConditionsArg).toHaveLength(1);
        });

        it('should apply BOTH destinationId and name constraints (not silently drop destinationId)', async () => {
            asMock(relatedModel.findAll).mockResolvedValue({
                items: [{ destinationId, attractionId: attractionA.id }]
            });
            asMock(model.findAll).mockResolvedValue({ items: [attractionA], total: 1 });

            const result = await service.search(actor, {
                destinationId,
                name: 'Attraction A',
                page: 1,
                pageSize: 10
            });

            expect(result.error).toBeUndefined();

            const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            // `name` is a real column and stays in `where`; `destinationId`
            // must NOT be — both constraints are still applied, just via
            // different mechanisms.
            expect(whereArg).toEqual({ name: 'Attraction A' });
            expect(mockedInArray).toHaveBeenCalledWith(attractions.id, [attractionA.id]);
            expect(additionalConditionsArg).toHaveLength(1);
        });

        it('should short-circuit to an empty result when destinationId maps to zero attractions', async () => {
            asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

            const result = await service.search(actor, {
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
                items: [{ destinationId, attractionId: attractionA.id }]
            });
            asMock(model.count).mockResolvedValue(1);

            const result = await service.count(actor, {
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
            expect(mockedInArray).toHaveBeenCalledWith(attractions.id, [attractionA.id]);
        });

        it('should short-circuit to a zero count when destinationId maps to zero attractions', async () => {
            asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

            const result = await service.count(actor, {
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
                // First call: resolving destinationId -> attraction ids.
                .mockResolvedValueOnce({
                    items: [{ destinationId, attractionId: attractionA.id }]
                })
                // Second call: destination counts for the returned page.
                .mockResolvedValueOnce({
                    items: [{ destinationId, attractionId: attractionA.id }]
                });
            asMock(model.findAll).mockResolvedValue({ items: [attractionA], total: 1 });

            const result = await service.searchForList(actor, {
                destinationId,
                page: 1,
                pageSize: 10
            });

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.id).toBe(attractionA.id);

            const [whereArg, , additionalConditionsArg] = asMock(model.findAll).mock.calls[0] as [
                Record<string, unknown>,
                unknown,
                unknown[]
            ];
            expect(whereArg).not.toHaveProperty('destinationId');
            expect(additionalConditionsArg).toHaveLength(1);
            expect(mockedInArray).toHaveBeenCalledWith(attractions.id, [attractionA.id]);
        });

        it('should short-circuit to an empty page when destinationId maps to zero attractions', async () => {
            asMock(relatedModel.findAll).mockResolvedValue({ items: [] });

            const result = await service.searchForList(actor, {
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
