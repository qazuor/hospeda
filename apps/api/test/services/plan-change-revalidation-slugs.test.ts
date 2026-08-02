/**
 * Regression — the ISR revalidation after a plan upgrade/downgrade never ran.
 *
 * Both plan-change services resolve accommodation slugs before scheduling
 * revalidation, and both did it with:
 *
 *     accommodationModel.findAll({ id: { in: ids } }, …)
 *
 * `buildWhereClause` (`packages/db/src/utils/drizzle-helpers.ts`) THROWS a
 * `DbError` on any plain-object value — "Use ilike()/eq() directly via
 * additionalConditions instead of passing objects in the where clause". That
 * throw is already pinned by
 * `packages/db/test/utils/drizzle-helpers.test.ts` ("throws DbError when a plain
 * object is passed as a value"). An ARRAY on a scalar column is what it turns
 * into `inArray`, so the correct shape is `{ id: ids }` — also pinned there.
 *
 * The failure went unnoticed — not unlogged. Each call site wrapped the slug
 * lookup AND the `scheduleRevalidationBatch` call in ONE `try/catch` that emits
 * `apiLogger.warn`, so prod logs have been carrying this `DbError` on every plan
 * change; nobody was reading them. The structural half of that hazard is fixed
 * too: the lookup is now caught on its own and the batch is scheduled
 * regardless, so a future throw degrades the events instead of deleting them.
 *
 * The old shape was:
 *
 *     try {
 *         const slugMap = await deps.fetchAccommodationSlugs(allTouchedIds);
 *         …
 *         revalidationService.scheduleRevalidationBatch({ events, reason });
 *     } catch (err) { apiLogger.warn(…, 'revalidation scheduling failed'); }
 *
 * so the throw took the WHOLE revalidation with it, not just the slug lookup:
 * every public accommodation page kept serving stale content after a plan change.
 *
 * Nothing caught it because all ~60 existing tests across the four suites around
 * these services inject their own `deps` and stub `fetchAccommodationSlugs`, so
 * the real implementation never executed in CI. That is the shape of the blind
 * spot: a DI default object has zero coverage no matter how many tests exist, as
 * long as every one of them injects. The shared `@repo/db` mock is the other
 * half of the proof: its `accommodationModel` stub exposes `findTopRated` and
 * `findAllWithRelations` but no `findAll` at all, because nothing in the api
 * suite had ever reached this code path.
 *
 * The same repo already carried the evidence. Both
 * `plan-upgrade-restoration.service.ts` and
 * `plan-downgrade-remediation.service.ts` have a destination-recount block
 * commenting that `accommodationModel.findAll` "does NOT support the
 * `{ id: { in: [...] } }` operator (buildWhereClause throws on plain objects)"
 * and hand-rolling a raw `inArray` query instead. Whoever hit it there fixed
 * that call site and left these two.
 *
 * These tests drive the REAL `defaultDeps` of both services. They pin the shape
 * handed to the model AND push that shape through the REAL `buildWhereClause`
 * against the REAL `accommodations` table, so the assertion is about behaviour
 * rather than about an argument literal. `apps/api/test/setup.ts` mocks
 * `@repo/db` globally, but `vi.importActual` reaches past it — `buildWhereClause`
 * is a pure `(where, table) => SQL` and `packages/db/src/client.ts` opens no
 * connection at import time. Checked red against the unfixed code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findAllSpy = vi.hoisted(() => vi.fn());

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;
    const accommodationModel = (base.accommodationModel ?? {}) as Record<string, unknown>;
    return {
        ...base,
        accommodationModel: { ...accommodationModel, findAll: findAllSpy }
    };
});

import { defaultDeps as downgradeDeps } from '../../src/services/plan-downgrade-remediation.service';
import { defaultDeps as upgradeDeps } from '../../src/services/plan-upgrade-restoration.deps';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('plan-change ISR revalidation — accommodation slug lookup', () => {
    beforeEach(() => {
        findAllSpy.mockReset();
        findAllSpy.mockResolvedValue({ items: [], total: 0 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe.each([
        ['plan-upgrade-restoration', upgradeDeps],
        ['plan-downgrade-remediation', downgradeDeps]
    ])('%s defaultDeps.fetchAccommodationSlugs', (_name, deps) => {
        it('passes the ids as a plain array, not the { in: [...] } object buildWhereClause rejects', async () => {
            findAllSpy.mockResolvedValue({
                items: [
                    { id: ID_A, slug: 'casa-del-lago' },
                    { id: ID_B, slug: 'cabana-del-rio' }
                ],
                total: 2
            });

            await deps.fetchAccommodationSlugs([ID_A, ID_B]);

            expect(findAllSpy).toHaveBeenCalledTimes(1);
            const [where] = findAllSpy.mock.calls[0] ?? [];
            // An ARRAY: buildWhereClause maps a scalar column + array value to
            // `inArray`. A plain object here throws DbError, which the caller's
            // try/catch swallows along with the whole revalidation.
            expect(Array.isArray((where as { id?: unknown })?.id)).toBe(true);
            expect(where).toEqual({ id: [ID_A, ID_B] });
        });

        it('hands the model a where the REAL buildWhereClause compiles to IN (…)', async () => {
            // The assertion above pins an argument literal against a spy, which
            // cannot notice if `buildWhereClause`'s array semantics ever change.
            // This one runs the captured `where` through the real implementation
            // against the real `accommodations` table — the exact call production
            // makes. `vi.importActual` reaches past the global `@repo/db` mock in
            // `test/setup.ts`; safe because `buildWhereClause` is a pure function
            // and importing `@repo/db` opens no connection.
            const { buildWhereClause } =
                await vi.importActual<typeof import('@repo/db')>('@repo/db');
            // The table has to come from `@repo/db/schemas` specifically: `setup.ts`
            // mocks that subpath separately, and `importActual('@repo/db')` unmocks
            // only the module asked for, not its dependencies — so the barrel's
            // re-exported `accommodations` is still the (billing-only) stub.
            const { accommodations } =
                await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');

            findAllSpy.mockResolvedValue({
                items: [{ id: ID_A, slug: 'casa-del-lago' }],
                total: 1
            });
            await deps.fetchAccommodationSlugs([ID_A, ID_B]);
            const [where] = findAllSpy.mock.calls[0] ?? [];

            const clause = buildWhereClause(where as Record<string, unknown>, accommodations);
            expect(clause).toBeDefined();
            // `inArray(col, [...])` compiles to FIVE chunks:
            // `['', col, ' in ', params, '']`. These indices are drizzle-internal;
            // if a drizzle bump reshapes them these assertions go red, which is the
            // intended signal — the contract they stand for is the rendered SQL.
            const chunks = (clause as unknown as { queryChunks?: { value?: unknown[] }[] })
                .queryChunks;
            const column = chunks?.[1] as unknown as { name?: string } | undefined;
            const operator = chunks?.[2]?.value?.[0];
            expect(column?.name).toBe('id');
            expect(typeof operator === 'string' && operator.includes('in')).toBe(true);
        });

        it('requests a page large enough to hold every id', async () => {
            // `ids.length + 10` exists so a single page covers the whole set. If it
            // regresses to the model default (20) the slug map silently truncates
            // and the caller emits slug-less events for the remainder.
            const ids = Array.from(
                { length: 25 },
                (_, i) => `3333333${i.toString().padStart(4, '0')}-3333-4333-8333-333333333333`
            );
            findAllSpy.mockResolvedValue({ items: [], total: 0 });

            await deps.fetchAccommodationSlugs(ids);

            const [, options] = findAllSpy.mock.calls[0] ?? [];
            expect((options as { pageSize?: number } | undefined)?.pageSize).toBeGreaterThanOrEqual(
                ids.length
            );
        });

        it('builds the slug map from the returned rows', async () => {
            findAllSpy.mockResolvedValue({
                items: [
                    { id: ID_A, slug: 'casa-del-lago' },
                    { id: ID_B, slug: 'cabana-del-rio' }
                ],
                total: 2
            });

            await expect(deps.fetchAccommodationSlugs([ID_A, ID_B])).resolves.toEqual({
                [ID_A]: 'casa-del-lago',
                [ID_B]: 'cabana-del-rio'
            });
        });

        it('short-circuits on an empty id list without querying', async () => {
            await expect(deps.fetchAccommodationSlugs([])).resolves.toEqual({});
            expect(findAllSpy).not.toHaveBeenCalled();
        });

        it('skips rows that carry no slug', async () => {
            findAllSpy.mockResolvedValue({
                items: [
                    { id: ID_A, slug: 'casa-del-lago' },
                    { id: ID_B, slug: null }
                ],
                total: 2
            });

            await expect(deps.fetchAccommodationSlugs([ID_A, ID_B])).resolves.toEqual({
                [ID_A]: 'casa-del-lago'
            });
        });
    });
});
