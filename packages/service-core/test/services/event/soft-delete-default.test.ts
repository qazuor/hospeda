/**
 * Integration-style regression test for HOS-274: `EventService.getByAuthor`
 * (a PUBLIC list endpoint) must exclude soft-deleted events by default,
 * WITHOUT the service explicitly filtering `deletedAt` itself.
 *
 * Unlike the other `EventService.getByAuthor` tests (`getByAuthor.test.ts`),
 * which fully mock `EventModel` and therefore cannot observe model-internal
 * default filtering, this file constructs the service with a REAL
 * `EventModel` and injects a mocked Drizzle client via `@repo/db`'s
 * `setDb()`/`resetDb()` test hooks. This proves the fix end-to-end: the
 * service passes `{ authorId }` straight through (no `deletedAt` filter of
 * its own — see `event.service.ts`), and `EventModel.findAll`'s new default
 * (HOS-274) is what actually excludes soft-deleted rows from the WHERE
 * clause reaching the database.
 *
 * @repo/db and @repo/service-core both resolve `@repo/db` to the SAME
 * `packages/db/src/client.ts` module instance at test time (via
 * `vite-tsconfig-paths`, see `packages/typescript-config/package-base.json`),
 * so `setDb()` called from this file is visible to `EventModel`'s internal
 * `getClient()` calls.
 */
import { EventModel, resetDb, setDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createUser } from '../../factories/userFactory';
import { expectSuccess } from '../../helpers/assertions';

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

function hasSoftDeleteCondition(clause: unknown): boolean {
    return flattenAndConditions(clause).some((c) => operatorOf(c) === ' is null');
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

describe('EventService.getByAuthor — soft-delete default (HOS-274, real EventModel)', () => {
    let service: EventService;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({
        permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW]
    });
    const authorId = createUser().id;

    beforeEach(() => {
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: new EventModel(), logger: loggerMock });
    });

    afterEach(() => {
        resetDb();
        vi.restoreAllMocks();
    });

    it('excludes soft-deleted events even though the service passes only { authorId } (no deletedAt filter of its own)', async () => {
        let capturedWhere: SQL | undefined;
        setDb(
            makeFindAllDbMock({
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            }) as never
        );

        const result = await service.getByAuthor(actorWithPerm, {
            authorId,
            page: 1,
            pageSize: 10
        });

        expectSuccess(result);
        // Proves the model default fired: a soft-delete exclusion condition is
        // present in the real WHERE clause reaching the database, even though
        // event.service.ts's getByAuthor() never sets `filters.deletedAt`.
        expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
    });
});
