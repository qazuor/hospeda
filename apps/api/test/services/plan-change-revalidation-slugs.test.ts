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
 * The throw was invisible because each call site wraps the slug lookup AND the
 * `scheduleRevalidationBatch` call in ONE `try/catch` that only warns:
 *
 *     try {
 *         const slugMap = await deps.fetchAccommodationSlugs(allTouchedIds);
 *         …
 *         revalidationService.scheduleRevalidationBatch({ events, reason });
 *     } catch (err) { apiLogger.warn(…, 'revalidation scheduling failed'); }
 *
 * So the failure took the WHOLE revalidation with it, not just the slug lookup:
 * every public accommodation page kept serving stale content after a plan
 * change, silently, in production.
 *
 * Nothing caught it because all ~20 existing tests around these services inject
 * their own `deps` and stub `fetchAccommodationSlugs`, so the real
 * implementation never executed in CI. The shared `@repo/db` mock is the other
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
 * These tests drive the REAL `defaultDeps` of both services and pin the shape
 * they hand to the model. Checked red against the unfixed code.
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
