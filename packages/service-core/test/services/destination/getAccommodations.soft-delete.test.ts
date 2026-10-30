/**
 * HOS-288 regression — `DestinationService.getAccommodations`
 * (`GET /api/v1/public/destinations/:id/accommodations`) must not leak
 * soft-deleted, non-PUBLIC or non-ACTIVE accommodations.
 *
 * The method called the BASE `accommodationModel.findAll({ destinationId })`
 * with no other predicate, so it returned every row for the destination:
 * soft-deleted ones (production had 107), `PRIVATE`/`RESTRICTED` ones, and
 * `DRAFT`/`INACTIVE`/`ARCHIVED` ones.
 *
 * The fix is split across two layers on purpose:
 *   - `deletedAt` is now a DEFAULT of `AccommodationModel` (see
 *     `AccommodationModel#softDeleteCondition`), so this service does not — and
 *     must not — pass it. The second suite below proves that default really
 *     reaches SQL from this call site, using a REAL `AccommodationModel` with a
 *     mocked Drizzle client injected via `setDb()`.
 *   - `publicationStatus = PUBLISHED` (which replaced the accommodation's
 *     `visibility`/`lifecycleState` in V6.9b, HOS-1641) stays EXPLICIT here,
 *     because it must not become a model default (admin has to see every
 *     state, an owner their own `DRAFT`). The first suite asserts it is passed.
 */
import { AccommodationModel, DestinationModel, resetDb, setDb } from '@repo/db';
import type { GetDestinationAccommodationsInput } from '@repo/schemas';
import { PublicationStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

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

const ADMIN_ACTOR = { id: 'user-1', roles: [RoleEnum.ADMIN], permissions: [] };

describe('DestinationService.getAccommodations — HOS-288 public read predicates', () => {
    describe('publicationStatus (explicit at this call site)', () => {
        let service: DestinationService;
        let destinationModelMock: DestinationModel;
        let accommodationModelMock: AccommodationModel;
        let loggerMock: ServiceLogger;

        beforeEach(() => {
            destinationModelMock = createTypedModelMock(DestinationModel, []);
            accommodationModelMock = createTypedModelMock(AccommodationModel, ['search']);
            loggerMock = createLoggerMock();
            service = createServiceTestInstance(
                DestinationService,
                destinationModelMock,
                loggerMock
            );
            (service as unknown as { accommodationModel: AccommodationModel }).accommodationModel =
                accommodationModelMock;
        });

        it('restricts the query to PUBLIC/ACTIVE and the two entitlement gates', async () => {
            const destination = new DestinationFactoryBuilder()
                .with({ visibility: VisibilityEnum.PUBLIC })
                .build();
            asMock(destinationModelMock.findById).mockResolvedValue(destination);
            asMock(accommodationModelMock.findAll).mockResolvedValue({ items: [], total: 0 });

            const params: GetDestinationAccommodationsInput = {
                destinationId: destination.id,
                page: 1,
                pageSize: 20
            };
            const result = await service.getAccommodations(ADMIN_ACTOR, params);

            expectSuccess(result);
            const [where] = asMock(accommodationModelMock.findAll).mock.calls[0] ?? [];
            // PUBLISHED is the only state an anonymous caller may see (AC:V5:5,
            // HOS-1641); `updateAccommodationsCount` counts with the same predicate.
            expect(where).toEqual({
                destinationId: destination.id,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            });
        });

        it('does not hand `deletedAt` to the model (the model default owns that)', async () => {
            const destination = new DestinationFactoryBuilder()
                .with({ visibility: VisibilityEnum.PUBLIC })
                .build();
            asMock(destinationModelMock.findById).mockResolvedValue(destination);
            asMock(accommodationModelMock.findAll).mockResolvedValue({ items: [], total: 0 });

            await service.getAccommodations(ADMIN_ACTOR, {
                destinationId: destination.id,
                page: 1,
                pageSize: 20
            });

            const [where] = asMock(accommodationModelMock.findAll).mock.calls[0] ?? [];
            // Passing `deletedAt` here would trip the model's explicit-intent
            // escape hatch, which is exactly what the default is meant to replace.
            expect(where).not.toHaveProperty('deletedAt');
        });
    });

    describe('soft delete (model default, REAL AccommodationModel)', () => {
        let service: DestinationService;
        let destinationModelMock: DestinationModel;
        let loggerMock: ServiceLogger;

        beforeEach(() => {
            destinationModelMock = createTypedModelMock(DestinationModel, []);
            loggerMock = createLoggerMock();
            service = createServiceTestInstance(
                DestinationService,
                destinationModelMock,
                loggerMock
            );
            (service as unknown as { accommodationModel: AccommodationModel }).accommodationModel =
                new AccommodationModel();
        });

        afterEach(() => {
            resetDb();
            vi.restoreAllMocks();
        });

        it('excludes soft-deleted accommodations without the service filtering deletedAt itself', async () => {
            const destination = new DestinationFactoryBuilder()
                .with({ visibility: VisibilityEnum.PUBLIC })
                .build();
            asMock(destinationModelMock.findById).mockResolvedValue(destination);

            let capturedWhere: SQL | undefined;
            setDb(
                makeFindAllDbMock({
                    captureWhere: (clause) => {
                        capturedWhere = clause;
                    }
                }) as never
            );

            const result = await service.getAccommodations(ADMIN_ACTOR, {
                destinationId: destination.id,
                page: 1,
                pageSize: 20
            });

            expectSuccess(result);
            expect(hasSoftDeleteCondition(capturedWhere)).toBe(true);
        });
    });
});
