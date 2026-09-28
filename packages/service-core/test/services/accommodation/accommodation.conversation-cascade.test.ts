/**
 * HOS-1383 — regression tests for the conversation cascade on accommodation
 * soft-delete (SPEC-085 AC-008-01).
 *
 * The cascade used to be gated on `ctx?.tx`. Both delete routes call
 * `softDelete(actor, id)` with no context and nothing on that path opens a
 * transaction, so the gate was never satisfied and `closeAllForAccommodation`
 * never ran from the application. The old tests passed because they injected
 * the transaction, which exercised a path production never takes.
 *
 * So the headline case here calls `softDelete(actor, id)` with TWO arguments,
 * exactly like `apps/api/src/routes/accommodation/admin/delete.ts` and
 * `apps/api/src/routes/accommodation/protected/softDelete.ts` do.
 *
 * Only `withTransaction` is replaced in `@repo/db`: a whole-module mock would
 * leave every other import in the service graph `undefined`.
 */

import type { AccommodationModel, DrizzleClient } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted above every top-level binding, so the stubs it closes
// over have to be hoisted with it.
const { withTransaction, OPENED_TX } = vi.hoisted(() => {
    const opened = { __kind: 'tx-opened-by-the-cascade' } as unknown as DrizzleClient;
    return {
        OPENED_TX: opened,
        // Mirrors the real helper: reuse the caller's tx when there is one,
        // otherwise open a new one.
        withTransaction: vi.fn(
            async <T>(
                callback: (tx: DrizzleClient) => Promise<T>,
                existingTx?: DrizzleClient
            ): Promise<T> => callback(existingTx ?? opened)
        )
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return { ...actual, withTransaction };
});

import * as calendarCascade from '../../../src/services/accommodation/accommodation.calendar-cascade';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

describe('HOS-1383 — soft-deleting an accommodation closes its conversations', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;
    let closeAllForAccommodation: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // @ts-expect-error: lifecycle hooks reach the destination service; stub it out.
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        closeAllForAccommodation = vi.fn().mockResolvedValue(2);
        // @ts-expect-error: private collaborator, replaced to observe the cascade.
        service.conversationService = { closeAllForAccommodation };
        // The sibling calendar cascade is covered by its own suite.
        vi.spyOn(
            calendarCascade,
            'cascadeCalendarConnectionsOnAccommodationDelete'
        ).mockResolvedValue(undefined as never);
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    });

    it('closes the conversations when called WITHOUT a context, the way both delete routes call it', async () => {
        // Arrange
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({ id: 'acc-1', deletedAt: undefined })
        );
        asMock(model.softDelete).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(createAdminActor(), 'acc-1');

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(closeAllForAccommodation).toHaveBeenCalledTimes(1);
        // A transaction of its own was opened, since the caller had none.
        expect(withTransaction).toHaveBeenCalledWith(expect.any(Function));
        expect(closeAllForAccommodation).toHaveBeenCalledWith('acc-1', OPENED_TX);
    });

    it("runs inside a savepoint of the caller's transaction when one is passed", async () => {
        // Arrange: `transaction()` on a transaction opens a savepoint.
        const savepointTx = { __kind: 'savepoint-tx' } as unknown as DrizzleClient;
        const callerTx = {
            transaction: vi.fn(async <T>(cb: (tx: DrizzleClient) => Promise<T>) => cb(savepointTx))
        } as unknown as DrizzleClient;
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({ id: 'acc-2', deletedAt: undefined })
        );
        asMock(model.softDelete).mockResolvedValue(1);

        // Act
        await service.softDelete(createAdminActor(), 'acc-2', { tx: callerTx });

        // Assert
        expect(callerTx.transaction).toHaveBeenCalledTimes(1);
        expect(closeAllForAccommodation).toHaveBeenCalledWith('acc-2', savepointTx);
        expect(withTransaction).not.toHaveBeenCalled();
    });

    it('does not run when the soft-delete updated no row (count 0)', async () => {
        // Arrange: the row looked live on read but a concurrent delete won the
        // race, so the model updated nothing. This is the only way to reach
        // the hook with count 0: an entity already deleted at read time
        // returns before any hook runs.
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({ id: 'acc-3', deletedAt: undefined })
        );
        asMock(model.softDelete).mockResolvedValue(0);

        // Act
        const result = await service.softDelete(createAdminActor(), 'acc-3');

        // Assert
        expect(result.data?.count).toBe(0);
        expect(closeAllForAccommodation).not.toHaveBeenCalled();
    });

    it('never fails the accommodation delete when the cascade throws', async () => {
        // Arrange
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({ id: 'acc-4', deletedAt: undefined })
        );
        asMock(model.softDelete).mockResolvedValue(1);
        closeAllForAccommodation.mockRejectedValue(new Error('db down'));

        // Act
        const result = await service.softDelete(createAdminActor(), 'acc-4');

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationId: 'acc-4' }),
            'closeAllForAccommodation failed (non-blocking)'
        );
    });
});
