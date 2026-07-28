/**
 * HOS-288 regression — `FeatureService.getAccommodationsByFeature` must return
 * ONLY what an anonymous caller may see: `PUBLIC` visibility, `ACTIVE`
 * lifecycle, not soft-deleted.
 *
 * ## The soft-delete defect
 *
 * The method read the accommodations through the JUNCTION model
 * (`RAccommodationFeatureModel.findAllWithRelations({ accommodation: true }, …)`),
 * which joins `accommodations` without filtering it at all — so soft-deleted
 * rows (production had 107) came back. The `AccommodationModel` soft-delete
 * default added in HOS-288 cannot help there either: the query runs against the
 * junction model, not `AccommodationModel`. The fix resolves the feature's
 * accommodation ids from the junction and then loads the rows through
 * `AccommodationModel.findAll`, which is what applies the soft-delete default.
 * `deletedAt` is deliberately NOT passed by the service: the model default owns
 * it, and passing it would trip that default's explicit-intent escape hatch.
 *
 * ## Why `visibility`/`lifecycleState` are ALSO load-bearing (round-2 decision)
 *
 * A first review removed them, reasoning that `checkCanGetAccommodationsByFeature`
 * requires `PermissionEnum.ACCOMMODATION_FEATURES_EDIT` and `createGuestActor()`
 * carries only `ACCESS_API_PUBLIC`, so guests get 403 and the surviving audience
 * is staff who legitimately need `PRIVATE`/`DRAFT` rows. That reasoning is WRONG
 * on two independent counts, both verified against the code:
 *
 *   1. **The audience is not staff — it is multi-tenant.**
 *      `PermissionEnum.ACCOMMODATION_FEATURES_EDIT` is granted to `RoleEnum.HOST`
 *      (`packages/seed/src/required/rolePermissions.seed.ts`). This method has NO
 *      owner scoping, so any authenticated host could enumerate every OTHER
 *      host's `DRAFT`/`PRIVATE` listings. The same seed block documents that
 *      SPEC-169 stripped `ACCOMMODATION_VIEW_ALL` from `HOST` for exactly this
 *      class of cross-tenant read leak.
 *
 *   2. **The response is cached under an actor-blind key, ahead of auth.**
 *      `/api/v1/public/features` is listed in `PUBLIC_CACHE_ENDPOINTS`
 *      (`apps/api/src/middlewares/cache.constants.ts`), and `generateCacheKey`
 *      builds `public:${path}${suffix}` with NO Authorization component — only
 *      the `private:` branch mixes in the token (`apps/api/src/middlewares/cache.ts`).
 *      `cacheMiddleware()` is mounted at `apps/api/src/utils/create-app.ts` BEFORE
 *      `authMiddleware`, and a cache HIT returns the stored body without calling
 *      `next()`, so the permission check never runs. `API_CACHE_ENABLED` defaults
 *      to `true` with a 300s TTL. One authenticated host request therefore
 *      populates a shared slot, and every anonymous request for the next 300
 *      seconds is served that `DRAFT`/`PRIVATE` payload.
 *
 * Point 2 also rules out the obvious alternative remedy: making the handler
 * owner-aware on an actor-blind cache key converts a permission leak into cache
 * poisoning. On a `public:`-cached route the RESPONSE must be anonymous-safe, and
 * the only thing it may return is what an anonymous caller is allowed to see.
 *
 * ## Residual, deliberately NOT fixed here (open follow-up)
 *
 * The predicates make the DATA anonymous-safe; they do not make the HANDLER
 * actor-blind. `checkCanGetAccommodationsByFeature` still runs and still 403s
 * guests — but `CACHEABLE_STATUS_CODES` is `{200, 404}` (`cache.ts`), so the 403
 * is never stored while the privileged 200 is. The first staff/host request
 * therefore makes the payload anonymously reachable for the TTL, and the gate is
 * effectively DECORATIVE on this route. It is contained precisely because the
 * payload is now public-safe — which is the whole point of restoring the
 * predicates — but the gate/cache mismatch is real and wants its own decision:
 * either drop the permission check (the route is genuinely public) or drop
 * `/api/v1/public/features` from `PUBLIC_CACHE_ENDPOINTS`. Out of scope for a
 * soft-delete bugfix; recorded here rather than left silently implied.
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
import type { FeatureModel, RAccommodationFeatureModel } from '@repo/db';
import { AccommodationModel, resetDb, setDb } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FeatureService } from '../../../src/services/feature/feature.service';
import {
    AccommodationFactoryBuilder,
    getMockAccommodationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { FeatureFactoryBuilder } from '../../factories/featureFactory';
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

describe('FeatureService.getAccommodationsByFeature — HOS-288 public read predicates', () => {
    const logger = createLoggerMock();
    const ctx = { logger };
    const featureId = FeatureFactoryBuilder.create().id;
    const feature = FeatureFactoryBuilder.create({ id: featureId });
    const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    const accommodationId = getMockAccommodationId('acc-1');
    const accommodation = new AccommodationFactoryBuilder().with({ id: accommodationId }).build();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('predicates passed to AccommodationModel', () => {
        it('re-reads the joined accommodations through AccommodationModel narrowed to PUBLIC/ACTIVE', async () => {
            // One shared mock stands in for the feature model, the junction model
            // and the accommodation model (the convention in this directory), so
            // `findAll` is called twice: junction rows first, accommodations second.
            const model = createModelMock();
            const service = new FeatureService(
                ctx,
                model as unknown as FeatureModel,
                model as unknown as RAccommodationFeatureModel,
                model as unknown as AccommodationModel
            );
            (model.findOne as Mock).mockResolvedValueOnce(feature);
            (model.findAll as Mock)
                .mockResolvedValueOnce({ items: [{ featureId, accommodationId }], total: 1 })
                .mockResolvedValueOnce({ items: [accommodation], total: 1 });

            const result = await service.getAccommodationsByFeature(actor, { featureId });

            expectSuccess(result);
            expect(result.data?.accommodations).toEqual([accommodation]);

            expect((model.findAll as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
            const [accommodationWhere, , additionalConditions] =
                (model.findAll as Mock).mock.calls[1] ?? [];
            // DECISION (HOS-288 round 2): the response of this route is cached under
            // an actor-blind `public:` key BEFORE authMiddleware runs, and
            // ACCOMMODATION_FEATURES_EDIT is held by the multi-tenant RoleEnum.HOST.
            // The handler must therefore be actor-blind and may only return what an
            // anonymous caller may see. Full rationale in this file's header.
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

        it('short-circuits without querying accommodations when the feature has none', async () => {
            const model = createModelMock();
            const service = new FeatureService(
                ctx,
                model as unknown as FeatureModel,
                model as unknown as RAccommodationFeatureModel,
                model as unknown as AccommodationModel
            );
            (model.findOne as Mock).mockResolvedValueOnce(feature);
            (model.findAll as Mock).mockResolvedValueOnce({ items: [], total: 0 });

            const result = await service.getAccommodationsByFeature(actor, { featureId });

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
            const featureAndJunctionModel = createModelMock();
            const service = new FeatureService(
                ctx,
                featureAndJunctionModel as unknown as FeatureModel,
                featureAndJunctionModel as unknown as RAccommodationFeatureModel,
                new AccommodationModel()
            );
            (featureAndJunctionModel.findOne as Mock).mockResolvedValueOnce(feature);
            (featureAndJunctionModel.findAll as Mock).mockResolvedValueOnce({
                items: [{ featureId, accommodationId }],
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

            const result = await service.getAccommodationsByFeature(actor, { featureId });

            expectSuccess(result);
            // The ONLY query hitting the injected client is the accommodation read
            // (the feature + junction models are mocked), so this WHERE clause is
            // the accommodation one.
            expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
        });
    });
});
