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
 *   - `visibility`/`lifecycleState` stay EXPLICIT here, because they must not
 *     become model defaults (admin has to see `PRIVATE`, an owner has to see
 *     their own `DRAFT`). The first suite asserts they are passed.
 */
import { AccommodationModel, DestinationModel, resetDb, setDb } from '@repo/db';
import type { GetDestinationAccommodationsInput } from '@repo/schemas';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
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

const ADMIN_ACTOR = { id: 'user-1', role: RoleEnum.ADMIN, permissions: [] };

describe('DestinationService.getAccommodations — HOS-288 public read predicates', () => {
    describe('visibility / lifecycleState (explicit at this call site)', () => {
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
            // PUBLIC/ACTIVE is what an anonymous caller may see at all;
            // `ownerSuspended`/`planRestricted` are the two entitlement gates that
            // withdraw an otherwise-public listing from public surfaces.
            // KNOWN FOLLOW-UP: `DestinationService.updateAccommodationsCount` counts
            // WITHOUT any `visibility` predicate, so this list and that destination's
            // `accommodationsCount` still disagree for ACTIVE + PRIVATE rows (the
            // count includes them, this list does not). Out of scope for HOS-288.
            expect(where).toMatchObject({
                destinationId: destination.id,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerSuspended: false,
                planRestricted: false
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
