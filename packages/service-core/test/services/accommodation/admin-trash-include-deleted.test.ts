/**
 * HOS-288 regression — the ADMIN accommodation trash/restore view must keep
 * returning soft-deleted rows.
 *
 * HOS-288 made `AccommodationModel.findAll`/`findAllWithRelations`/`count`
 * exclude soft-deleted rows BY DEFAULT. The admin accommodations list exposes an
 * `includeDeleted` filter (see `apps/admin/src/features/accommodations/config/accommodations.config.ts`),
 * so that default must be opt-out-able all the way down: `adminList()` leaves
 * `where.deletedAt` absent when `includeDeleted` is set and forwards the flag to
 * the model, and the model's escape hatch then injects nothing.
 *
 * A default filter that silently breaks the admin trash view would be worse than
 * the leak it fixes, so this file exercises the accommodation-specific path with
 * a REAL `AccommodationModel` and a mocked Drizzle client injected via
 * `setDb()`, asserting on the WHERE clause that actually reaches the database:
 *   - `includeDeleted: true`  → NO soft-delete condition (trash view works)
 *   - `includeDeleted` absent → soft-delete condition present (the default)
 *
 * The two cases are NOT of the same kind, and the names below say so. Only the
 * second is a regression test: it goes red if the HOS-288 default is reverted.
 * The first is a GUARD — with the default reverted nothing is injected either,
 * so it passes identically before and after. Its job is to fail if someone later
 * over-injects the condition and breaks the trash view, not to prove the fix.
 *
 * (The generic `includeDeleted` plumbing through `list()`/`adminList()`/
 * `_executeAdminSearch()` is covered model-agnostically by
 * `test/base/admin-search-include-deleted.test.ts`; the model-level escape hatch
 * by `packages/db/test/models/accommodation.model.soft-delete.test.ts`. This file
 * is the accommodation-specific end-to-end tie between the two.)
 */
import { AccommodationModel, resetDb, setDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

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

/**
 * `AccommodationService` declares default list relations, so `_executeAdminSearch`
 * goes through `findAllWithRelations`, i.e. `db.query.accommodations.findMany()`
 * for items plus `db.select().from().where()` for the count.
 */
function makeRelationalDbMock(opts: { captureFindManyArgs?: (args: unknown) => void }) {
    const findManyFn = vi.fn((args: unknown) => {
        opts.captureFindManyArgs?.(args);
        return Promise.resolve([]);
    });
    const countWhereFn = vi.fn().mockResolvedValue([{ count: 0 }]);
    const countFromFn = vi.fn().mockReturnValue({ where: countWhereFn });
    return {
        query: { accommodations: { findMany: findManyFn } },
        select: vi.fn().mockReturnValue({ from: countFromFn })
    };
}

const mockAdminActor = {
    id: 'admin-1',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
};

function callExecuteAdminSearch(
    service: AccommodationService,
    params: AdminSearchExecuteParams
): Promise<{ items: unknown[]; total: number }> {
    type WithAdminSearch = {
        _executeAdminSearch: (
            p: AdminSearchExecuteParams
        ) => Promise<{ items: unknown[]; total: number }>;
    };
    return (service as unknown as WithAdminSearch)._executeAdminSearch(params);
}

function buildParams(overrides: Partial<AdminSearchExecuteParams> = {}): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        ...overrides
    };
}

describe('AccommodationService admin trash view — includeDeleted escape hatch (HOS-288)', () => {
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AccommodationService(
            {} as ServiceConfig,
            new AccommodationModel() as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            makeMediaModelStub() as never
        );
    });

    afterEach(() => {
        resetDb();
        vi.restoreAllMocks();
    });

    // GUARD (not a regression test — passes with the HOS-288 default reverted too,
    // since nothing is injected either way). It exists to catch a FUTURE
    // over-injection that would break the trash view.
    it('guard: no exclusion is injected when includeDeleted is true, so the trash view keeps working', async () => {
        let findManyArgs: unknown;
        setDb(
            makeRelationalDbMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            }) as never
        );

        // `adminList()` leaves `where.deletedAt` absent when includeDeleted is set —
        // this reproduces the params it hands to _executeAdminSearch in that case.
        await callExecuteAdminSearch(service, buildParams({ includeDeleted: true }));

        const where = (findManyArgs as { where?: unknown } | undefined)?.where;
        expect(hasSoftDeleteCondition(where)).toBe(false);
    });

    it('excludes soft-deleted rows on the normal admin list (includeDeleted absent)', async () => {
        let findManyArgs: unknown;
        setDb(
            makeRelationalDbMock({
                captureFindManyArgs: (args) => {
                    findManyArgs = args;
                }
            }) as never
        );

        await callExecuteAdminSearch(service, buildParams());

        const where = (findManyArgs as { where?: unknown } | undefined)?.where;
        expect(hasSoftDeleteCondition(where)).toBe(true);
    });
});
