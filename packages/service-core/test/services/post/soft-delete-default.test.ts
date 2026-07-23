/**
 * Integration-style regression test for HOS-274: `PostService.getByCategory`
 * (a PUBLIC list endpoint) must exclude soft-deleted posts by default,
 * WITHOUT the service explicitly filtering `deletedAt` itself.
 *
 * See `packages/service-core/test/services/event/soft-delete-default.test.ts`
 * for the full rationale (real model + `@repo/db`'s `setDb()`/`resetDb()` test
 * hooks, cross-package module resolution note).
 */
import { PostModel, resetDb, setDb } from '@repo/db';
import { PostCategoryEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
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

describe('PostService.getByCategory — soft-delete default (HOS-274, real PostModel)', () => {
    let service: PostService;
    let loggerMock: ServiceLogger;
    const actor = createUser();
    const category = PostCategoryEnum.GENERAL;

    beforeEach(() => {
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new PostService({ logger: loggerMock }, new PostModel());
    });

    afterEach(() => {
        resetDb();
        vi.restoreAllMocks();
    });

    it('excludes soft-deleted posts even though the service passes only { category } (no deletedAt filter of its own)', async () => {
        let capturedWhere: SQL | undefined;
        setDb(
            makeFindAllDbMock({
                captureWhere: (clause) => {
                    capturedWhere = clause;
                }
            }) as never
        );

        const result = await service.getByCategory(actor, { category });

        expectSuccess(result);
        // Proves the model default fired: a soft-delete exclusion condition is
        // present in the real WHERE clause reaching the database, even though
        // post.service.ts's getByCategory() never sets `where.deletedAt`.
        expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
    });
});
