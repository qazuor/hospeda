/**
 * HOS-288 regression — `AmenityService.getAccommodationsByAmenity` must return
 * ONLY what an anonymous caller may see: `PUBLIC` visibility, `ACTIVE`
 * lifecycle, not soft-deleted.
 *
 * ## The soft-delete defect
 *
 * This is the predicate-level twin of the `FeatureService.getAccommodationsByFeature`
 * defect fixed in the same change: the method read the accommodations through
 * the JUNCTION model (`RAccommodationAmenityModel.findAllWithRelations({
 * accommodation: true }, …)`), which joins `accommodations` without filtering
 * it at all. The `AccommodationModel` soft-delete default added in HOS-288
 * cannot help there — the query runs against the junction model, not
 * `AccommodationModel`. The fix resolves the amenity's accommodation ids from
 * the junction and then loads the rows through `AccommodationModel.findAll`,
 * which is what applies the soft-delete default. `deletedAt` is deliberately
 * NOT passed by the service: the model default owns it, and passing it would
 * trip that default's explicit-intent escape hatch.
 *
 * ## Why `visibility`/`lifecycleState` are ALSO load-bearing (round-2 decision)
 *
 * This method backs NO route today (`apps/api/src/routes/amenity/public/`
 * exposes only `getById`, `list`), so the leak is latent rather than live. It is
 * nevertheless hardened to match its feature twin, because the obvious future
 * consumer is the symmetric `GET /api/v1/public/amenities/:id/accommodations`
 * and wiring that route must not silently reintroduce a leak.
 *
 * A first review removed the predicates, reasoning that
 * `checkCanGetAccommodationsByAmenity` requires
 * `PermissionEnum.ACCOMMODATION_AMENITIES_EDIT`, which no guest actor carries,
 * so the surviving audience is staff who legitimately need `PRIVATE`/`DRAFT`
 * rows. That reasoning is WRONG on two independent counts, both verified
 * against the code:
 *
 *   1. **The audience is not staff — it is multi-tenant.**
 *      `PermissionEnum.ACCOMMODATION_AMENITIES_EDIT` is granted to
 *      `RoleEnum.HOST` (`packages/seed/src/required/rolePermissions.seed.ts`).
 *      This method has NO owner scoping, so any authenticated host could
 *      enumerate every OTHER host's `DRAFT`/`PRIVATE` listings. The same seed
 *      block documents that SPEC-169 stripped `ACCOMMODATION_VIEW_ALL` from
 *      `HOST` for exactly this class of cross-tenant read leak.
 *
 *   2. **The response would be cached under an actor-blind key, ahead of auth.**
 *      `/api/v1/public/amenities` is already listed in `PUBLIC_CACHE_ENDPOINTS`
 *      (`apps/api/src/middlewares/cache.constants.ts`), and `generateCacheKey`
 *      builds `public:${path}${suffix}` with NO Authorization component — only
 *      the `private:` branch mixes in the token (`apps/api/src/middlewares/cache.ts`).
 *      `cacheMiddleware()` is mounted at `apps/api/src/utils/create-app.ts` BEFORE
 *      `authMiddleware`, and a cache HIT returns the stored body without calling
 *      `next()`, so the permission check never runs. `API_CACHE_ENABLED` defaults
 *      to `true` with a 300s TTL. One authenticated host request would therefore
 *      populate a shared slot, and every anonymous request for the next 300
 *      seconds would be served that `DRAFT`/`PRIVATE` payload.
 *
 * Point 2 also rules out the obvious alternative remedy: making the handler
 * owner-aware on an actor-blind cache key converts a permission leak into cache
 * poisoning. On a `public:`-cached route the RESPONSE must be anonymous-safe, and
 * the only thing it may return is what an anonymous caller is allowed to see.
 *
 * ## Residual, deliberately NOT fixed here (open follow-up)
 *
 * The predicates make the DATA anonymous-safe; they do not make the HANDLER
 * actor-blind. `checkCanGetAccommodationsByAmenity` still runs and still 403s
 * guests — but `CACHEABLE_STATUS_CODES` is `{200, 404}` (`cache.ts`), so the 403
 * is never stored while a privileged 200 would be. The moment this method gets a
 * route, the first staff/host request makes the payload anonymously reachable for
 * the TTL and the gate becomes DECORATIVE. Contained precisely because the payload
 * is public-safe, but the gate/cache mismatch is real and wants its own decision.
 * Same follow-up as the feature twin; see that file's header.
 *
 * The first suite pins the predicates so nobody removes them again, and also
 * pins that `additionalConditions` (argument 3) stays `undefined` — a pin that
 * only inspected argument 1 would let a future re-narrowing slip past.
 *
 * Two suites:
 *   1. Both models mocked — asserts the accommodation rows are re-read through
 *      `AccommodationModel` by id, narrowed to PUBLIC/ACTIVE, with no
 *      `deletedAt` and no `additionalConditions`.
 *   2. REAL `AccommodationModel` + a Drizzle client injected via `setDb()` —
 *      proves the soft-delete default actually reaches SQL from this call site.
 */
import type { AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import { AccommodationModel, resetDb, setDb } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';
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
// SQL-clause introspection helpers. Local copy of
// packages/db/test/utils/soft-delete-clause.ts, which cannot be imported across
// the package boundary; kept in sync by hand, OR guard included.
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

/**
 * True when `sql.join` interleaved these chunks with ` and ` separators.
 *
 * `and(...)` and `or(...)` compile to the SAME `['(', <joined>, ')']` shape; only the
 * separator at the odd indices tells them apart. Flattening without this check reads a
 * disjunction as a conjunction, so a clause where `deleted_at IS NULL` is merely one
 * branch of an `or(...)` — a query that DOES return soft-deleted rows — would satisfy
 * `hasSoftDeleteCondition`. Mirrors `packages/db/test/utils/soft-delete-clause.ts`,
 * which cannot be imported across the package boundary.
 */
function isAndJoined(innerChunks: QueryChunk[]): boolean {
    for (let i = 1; i < innerChunks.length; i += 2) {
        if (innerChunks[i]?.value?.[0] !== ' and ') return false;
    }
    return true;
}

function flattenAndConditions(clause: unknown): unknown[] {
    if (clause === undefined) return [];
    const chunks = chunksOf(clause);
    const isGroupWrapper =
        chunks?.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')';
    if (!isGroupWrapper) return [clause];
    const innerChunks = chunksOf(chunks?.[1]);
    if (!innerChunks) return [clause];
    // An OR group is opaque: its branches are alternatives, not conjuncts.
    if (!isAndJoined(innerChunks)) return [clause];
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
        it('re-reads the joined accommodations through AccommodationModel narrowed to PUBLIC/ACTIVE', async () => {
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

            // Exactly two: the junction read, then the accommodation read. A third
            // silent round trip must fail — the two-step shape is the design.
            expect((model.findAll as Mock).mock.calls).toHaveLength(2);
            const [accommodationWhere, , additionalConditions] =
                (model.findAll as Mock).mock.calls[1] ?? [];
            // DECISION (HOS-288 round 2): `/api/v1/public/amenities` is already an
            // actor-blind `public:` cache prefix and cacheMiddleware runs before
            // authMiddleware, and ACCOMMODATION_AMENITIES_EDIT is held by the
            // multi-tenant RoleEnum.HOST. The response must be anonymous-safe: it
            // may only carry what an anonymous caller may see. Rationale in the header.
            expect(accommodationWhere).toMatchObject({
                id: [accommodationId],
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            // `deletedAt` must NOT be passed: the model default owns it, and
            // passing it would trip that default's explicit-intent escape hatch.
            expect(accommodationWhere).not.toHaveProperty('deletedAt');
            // Argument 3 is `additionalConditions`. Pinning only argument 1 would let
            // a future re-narrowing slip in through this channel unnoticed.
            expect(additionalConditions).toBeUndefined();
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
