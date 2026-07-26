/**
 * HOS-288 regression — `AmenityService.getAccommodationsByAmenity` must not
 * return soft-deleted accommodations.
 *
 * This is the exact twin of the `FeatureService.getAccommodationsByFeature`
 * defect fixed in the same change: the method read the accommodations through
 * the JUNCTION model (`RAccommodationAmenityModel.findAllWithRelations({
 * accommodation: true }, …)`), which joins `accommodations` without filtering
 * it at all. The `AccommodationModel` soft-delete default added in HOS-288
 * cannot help there — the query runs against the junction model, not
 * `AccommodationModel`.
 *
 * The fix resolves the amenity's accommodation ids from the junction and then
 * loads the rows through `AccommodationModel.findAll`, which is what applies
 * the soft-delete default.
 *
 * NOTE on the real gate: this method backs NO route today
 * (`apps/api/src/routes/amenity/public/` exposes only `getById`, `list`), so
 * the leak was latent, not live. It is also gated by
 * `checkCanGetAccommodationsByAmenity`, i.e. `ACCOMMODATION_AMENITIES_EDIT` — a
 * permission no guest actor carries. DECISION (HOS-288 review): visibility/
 * lifecycle policy is deliberately NOT baked in here — its audience is
 * staff/hosts, and an editor auditing where an amenity is used must see
 * `PRIVATE` and `DRAFT` rows. The first suite pins that so nobody re-adds those
 * predicates silently.
 *
 * Two suites:
 *   1. Both models mocked — asserts the accommodation rows are re-read through
 *      `AccommodationModel` by id, with no visibility/lifecycle narrowing.
 *   2. REAL `AccommodationModel` + a Drizzle client injected via `setDb()` —
 *      proves the soft-delete default actually reaches SQL from this call site.
 */
import type { AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import { AccommodationModel, resetDb, setDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import {
    AccommodationFactoryBuilder,
    getMockAccommodationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder, getMockAmenityId } from '../../factories/amenityFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// SQL-clause introspection helpers (same approach as
// packages/db/test/models/accommodation.model.soft-delete.test.ts)
// ---------------------------------------------------------------------------

type QueryChunk = { value?: unknown[] };

function chunksOf(clause: unknown): QueryChunk[] | undefined {
    return (clause as { queryChunks?: QueryChunk[] } | undefined)?.queryChunks;
}

function operatorOf(clause: unknown): string | undefined {
    const chunks = chunksOf(clause);
    const middle = chunks?.[2]?.value?.[0];
    return typeof middle === 'string' ? middle : undefined;
}

function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isAndWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isAndWrapper) return [clause];
    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    return innerChunks.filter((_, i) => i % 2 === 0);
}

/** True when the clause carries an `IS NULL` on a column named `deleted_at`. */
function hasSoftDeleteCondition(clause: unknown): boolean {
    return flattenAndConditions(clause).some((c) => {
        if (operatorOf(c) !== ' is null') return false;
        const column = chunksOf(c)?.[1] as unknown as { name?: string } | undefined;
        return column?.name === 'deleted_at';
    });
}

/** Mock for `db.select().from().where().$dynamic().limit().offset()` + count query. */
function makeFindAllDbMock(opts: {
    items?: unknown[];
    total?: number;
    captureWhere?: (clause: SQL | undefined) => void;
}) {
    const { items = [], total = 0, captureWhere } = opts;

    const countWhereFn = vi.fn().mockResolvedValue([{ count: total }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });

    const offsetFn = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
    const dynamicFn = vi.fn().mockReturnValue({ limit: limitFn });
    const itemsWhereFn = vi.fn((clause: SQL | undefined) => {
        captureWhere?.(clause);
        return { $dynamic: dynamicFn };
    });
    const itemsFromFn = vi.fn().mockReturnValue({ where: itemsWhereFn });

    let callN = 0;
    const selectFn = vi.fn().mockImplementation(() => {
        callN += 1;
        if (callN <= 1) return { from: itemsFromFn };
        return { from: countFromFn };
    });

    return { select: selectFn };
}

// ---------------------------------------------------------------------------

describe('AmenityService.getAccommodationsByAmenity — HOS-288 read predicates', () => {
    const logger = createLoggerMock();
    const ctx = { logger };
    const amenityId = getMockAmenityId('am-1');
    const amenity = AmenityFactoryBuilder.create({ id: amenityId });
    const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT] });
    const accommodationId = getMockAccommodationId('acc-1');
    const accommodation = new AccommodationFactoryBuilder()
        .with({ id: accommodationId, name: 'Visible Accommodation' })
        .build();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('predicates passed to AccommodationModel', () => {
        it('re-reads the joined accommodations through AccommodationModel by id only', async () => {
            // One shared mock stands in for the amenity model, the junction model
            // and the accommodation model (the convention in this directory), so
            // `findAll` is called twice: junction rows first, accommodations second.
            const model = createModelMock();
            const service = new AmenityService(
                ctx,
                model as unknown as AmenityModel,
                model as unknown as RAccommodationAmenityModel,
                model as unknown as AccommodationModel
            );
            (model.findOne as Mock).mockResolvedValueOnce(amenity);
            (model.findAll as Mock)
                .mockResolvedValueOnce({ items: [{ amenityId, accommodationId }], total: 1 })
                .mockResolvedValueOnce({ items: [accommodation], total: 1 });

            const result = await service.getAccommodationsByAmenity(actor, {
                amenityId,
                page: 1,
                pageSize: 10
            });

            expectSuccess(result);
            expect(result.data?.accommodations).toHaveLength(1);
            expect(result.data?.accommodations[0]).toMatchObject({
                id: accommodationId,
                name: accommodation.name
            });

            expect((model.findAll as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
            const [accommodationWhere] = (model.findAll as Mock).mock.calls[1] ?? [];
            expect(accommodationWhere).toMatchObject({ id: [accommodationId] });
            // DECISION (HOS-288 review): this method is gated by
            // ACCOMMODATION_AMENITIES_EDIT, so its audience is staff/hosts, not
            // anonymous visitors. It must NOT narrow visibility or lifecycle —
            // an editor auditing an amenity's usage needs PRIVATE and DRAFT rows.
            expect(accommodationWhere).not.toHaveProperty('visibility');
            expect(accommodationWhere).not.toHaveProperty('lifecycleState');
            // `deletedAt` must NOT be passed either: the model default owns it, and
            // passing it would trip that default's explicit-intent escape hatch.
            expect(accommodationWhere).not.toHaveProperty('deletedAt');
        });

        it('short-circuits without querying accommodations when the amenity has none', async () => {
            const model = createModelMock();
            const service = new AmenityService(
                ctx,
                model as unknown as AmenityModel,
                model as unknown as RAccommodationAmenityModel,
                model as unknown as AccommodationModel
            );
            (model.findOne as Mock).mockResolvedValueOnce(amenity);
            (model.findAll as Mock).mockResolvedValueOnce({ items: [], total: 0 });

            const result = await service.getAccommodationsByAmenity(actor, {
                amenityId,
                page: 1,
                pageSize: 10
            });

            expectSuccess(result);
            expect(result.data?.accommodations).toEqual([]);
            // Only the junction query ran — an empty id list must never reach
            // `inArray()`.
            expect((model.findAll as Mock).mock.calls).toHaveLength(1);
        });
    });

    describe('soft delete (model default, REAL AccommodationModel)', () => {
        afterEach(() => {
            resetDb();
            vi.restoreAllMocks();
        });

        it('excludes soft-deleted accommodations without the service filtering deletedAt itself', async () => {
            const amenityAndJunctionModel = createModelMock();
            const service = new AmenityService(
                ctx,
                amenityAndJunctionModel as unknown as AmenityModel,
                amenityAndJunctionModel as unknown as RAccommodationAmenityModel,
                new AccommodationModel()
            );
            (amenityAndJunctionModel.findOne as Mock).mockResolvedValueOnce(amenity);
            (amenityAndJunctionModel.findAll as Mock).mockResolvedValueOnce({
                items: [{ amenityId, accommodationId }],
                total: 1
            });

            let capturedWhere: SQL | undefined;
            setDb(
                makeFindAllDbMock({
                    captureWhere: (clause) => {
                        capturedWhere = clause;
                    }
                }) as never
            );

            const result = await service.getAccommodationsByAmenity(actor, {
                amenityId,
                page: 1,
                pageSize: 10
            });

            expectSuccess(result);
            // The ONLY query hitting the injected client is the accommodation read
            // (the amenity + junction models are mocked), so this WHERE clause is
            // the accommodation one.
            expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
        });
    });
});
