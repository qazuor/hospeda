/**
 * HOS-663 — regression tests for the delete-time half of the cascade.
 *
 * Three things are asserted here, and they are NOT the same thing:
 *
 *  1. Soft-deleting an accommodation deactivates its calendar connections.
 *     Exercised through the REAL `AccommodationService.softDelete` lifecycle,
 *     not by calling the cascade helper directly — the bug was never in the
 *     helper, it was that nothing on the delete path called one.
 *  2. **Revocation covers every connection, not only the ones this call just
 *     deactivated.** `is_active = false` means "we stopped using it", never
 *     "the provider closed it": the host-initiated disconnect route flips the
 *     flag and revokes nothing. A host who disconnects first and deletes a week
 *     later must still have their grant closed — that sequence is the most
 *     natural one for somebody leaving, and it leaves no active row behind to
 *     make the leak visible.
 *  3. A revocation that does NOT happen is recorded on the row instead of
 *     disappearing. A silent revocation failure is worse than no revocation,
 *     because it leaves everyone believing the access was closed.
 *
 * The cron-side defence (`findAllActiveByProvider` skipping soft-deleted
 * accommodations) is deliberately tested elsewhere —
 * `packages/db/test/integration/accommodation-calendar-sync.model.integration.test.ts`
 * — against a real database. They are two independent defences and their tests
 * stay independent too: breaking this file must not turn that one green.
 */

import type { AccommodationModel } from '@repo/db';
import { OccupancySourceEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted above every top-level binding, so the stubs it closes
// over have to be hoisted with it.
const { deactivateAllByAccommodation, findAllByAccommodation, markRevocationFailed } = vi.hoisted(
    () => ({
        deactivateAllByAccommodation: vi.fn(),
        findAllByAccommodation: vi.fn(),
        markRevocationFailed: vi.fn()
    })
);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        // Only the calendar-sync singleton is replaced. A whole-module mock
        // would leave every other `@repo/db` import in the service graph
        // `undefined` and pass with zero of the lifecycle actually executing.
        accommodationCalendarSyncModel: {
            deactivateAllByAccommodation,
            findAllByAccommodation,
            markRevocationFailed
        }
    };
});

import {
    cascadeCalendarConnectionsOnAccommodationDelete,
    REVOCATION_FAILURE_PREFIX,
    setCalendarConnectionRevocationPort
} from '../../../src/services/accommodation/accommodation.calendar-cascade';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createAccommodationWithMockIds,
    createMockAccommodation
} from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

/** A connection row, as the model returns it. */
const connectionRow = (
    provider: OccupancySourceEnum,
    accommodationId: string,
    isActive = false
) => ({
    id: `conn-${provider}`,
    accommodationId,
    provider,
    isActive
});

/** Resets every stub to the "no connections anywhere" baseline. */
const resetModelStubs = () => {
    deactivateAllByAccommodation.mockResolvedValue([]);
    findAllByAccommodation.mockResolvedValue([]);
    markRevocationFailed.mockResolvedValue(null);
};

describe('HOS-663 — soft-deleting an accommodation shuts down its calendar connections', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        resetModelStubs();

        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // @ts-expect-error: lifecycle hooks reach the destination service; stub it out.
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    });

    it('deactivates every calendar connection of the deleted accommodation', async () => {
        const accommodation = createMockAccommodation({
            id: 'acc-1',
            slug: 'casa-quinta',
            destinationId: 'dest-1',
            deletedAt: undefined
        });
        asMock(model.findById).mockResolvedValue(accommodation);
        asMock(model.softDelete).mockResolvedValue(1);
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-1'),
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-1')
        ]);

        const result = await service.softDelete(createAdminActor(), 'acc-1');

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deactivateAllByAccommodation).toHaveBeenCalledTimes(1);
        expect(deactivateAllByAccommodation).toHaveBeenCalledWith(
            { accommodationId: 'acc-1' },
            undefined
        );
    });

    it('asks the provider to revoke the credential of every connection', async () => {
        const revoke = vi.fn().mockResolvedValue({ revoked: true });
        setCalendarConnectionRevocationPort({ revoke });

        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({
                id: 'acc-2',
                slug: 'casa-quinta-2',
                destinationId: 'dest-1',
                deletedAt: undefined
            })
        );
        asMock(model.softDelete).mockResolvedValue(1);
        const rows = [
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-2'),
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-2')
        ];
        deactivateAllByAccommodation.mockResolvedValue(rows);
        findAllByAccommodation.mockResolvedValue(rows);

        await service.softDelete(createAdminActor(), 'acc-2');

        expect(revoke).toHaveBeenCalledTimes(2);
        expect(revoke).toHaveBeenCalledWith({
            accommodationId: 'acc-2',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });
        expect(revoke).toHaveBeenCalledWith({
            accommodationId: 'acc-2',
            provider: OccupancySourceEnum.AIRBNB
        });
        // Nothing failed, so nothing is stamped on any row.
        expect(markRevocationFailed).not.toHaveBeenCalled();
    });

    it('does not touch the connections when the entity was already deleted (count 0)', async () => {
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({
                id: 'acc-3',
                slug: 'ya-borrada',
                destinationId: 'dest-1',
                deletedAt: new Date()
            })
        );

        const result = await service.softDelete(createAdminActor(), 'acc-3');

        expect(result.data?.count).toBe(0);
        expect(deactivateAllByAccommodation).not.toHaveBeenCalled();
        expect(findAllByAccommodation).not.toHaveBeenCalled();
    });

    it('never fails the accommodation delete when the cascade throws', async () => {
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({
                id: 'acc-4',
                slug: 'cascade-explota',
                destinationId: 'dest-1',
                deletedAt: undefined
            })
        );
        asMock(model.softDelete).mockResolvedValue(1);
        deactivateAllByAccommodation.mockRejectedValue(new Error('connection pool exhausted'));
        findAllByAccommodation.mockRejectedValue(new Error('connection pool exhausted'));

        const result = await service.softDelete(createAdminActor(), 'acc-4');

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
    });
});

/**
 * The gap the review caught, and the one this suite previously FROZE: a green
 * test built on the false premise that an inactive row had already been
 * revoked. `calendarDisconnect.ts` calls `deactivate()` and nothing else — no
 * port call, no stamp, no word to Google.
 */
describe('HOS-663 — a connection disconnected BEFORE the delete is still revoked', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        resetModelStubs();
    });

    it('revokes a row that was already inactive, which this call did not flip', async () => {
        const revoke = vi.fn().mockResolvedValue({ revoked: true });
        setCalendarConnectionRevocationPort({ revoke });

        // The host pressed "Disconnect" a week ago: the row is inactive, its
        // encrypted tokens are still there, and the grant is still live.
        deactivateAllByAccommodation.mockResolvedValue([]); // nothing left to flip
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-5', false)
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-5',
            logger: mockLogger
        });

        expect(revoke).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith({
            accommodationId: 'acc-5',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });
        expect(result).toEqual({ deactivated: 0, revoked: 1, revocationFailures: 0 });
    });

    it('revokes the mixed case — one row flipped now, one inactive since before', async () => {
        const revoke = vi.fn().mockResolvedValue({ revoked: true });
        setCalendarConnectionRevocationPort({ revoke });

        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-6')
        ]);
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-6'),
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-6', false)
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-6',
            logger: mockLogger
        });

        // One deactivated, TWO revoked. The counts differ on purpose.
        expect(result).toEqual({ deactivated: 1, revoked: 2, revocationFailures: 0 });
        expect(revoke).toHaveBeenCalledTimes(2);
    });

    it('still revokes when the deactivation write itself failed', async () => {
        // The grants most need closing precisely when the DB write did not land.
        const revoke = vi.fn().mockResolvedValue({ revoked: true });
        setCalendarConnectionRevocationPort({ revoke });

        deactivateAllByAccommodation.mockRejectedValue(new Error('deadlock detected'));
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-7', true)
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-7',
            logger: mockLogger
        });

        expect(revoke).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ deactivated: 0, revoked: 1, revocationFailures: 0 });
    });

    it('does not forward the caller transaction into the revocation stamp', async () => {
        // Outbound HTTP must not run inside an open Postgres transaction, and a
        // stamp that rolls back takes the only record of an irreversible
        // revocation with it.
        setCalendarConnectionRevocationPort({
            revoke: vi.fn().mockResolvedValue({ revoked: false, reason: 'nope' })
        });
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-8')
        ]);
        const fakeTx = { __tx: true } as never;

        await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-8',
            tx: fakeTx,
            logger: mockLogger
        });

        // The write joins the transaction...
        expect(deactivateAllByAccommodation).toHaveBeenCalledWith(
            { accommodationId: 'acc-8' },
            fakeTx
        );
        // ...the stamp does not (single-argument call).
        expect(markRevocationFailed).toHaveBeenCalledTimes(1);
        expect(asMock(markRevocationFailed).mock.calls[0]).toHaveLength(1);
    });
});

describe('HOS-663 — a revocation that does not happen is recorded, never swallowed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        resetModelStubs();
    });

    it('stamps the row when the provider exposes no revocation (iCal feed URLs)', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi
                .fn()
                .mockResolvedValue({ revoked: false, reason: 'no revocation endpoint (iCal feed)' })
        });
        const rows = [connectionRow(OccupancySourceEnum.AIRBNB, 'acc-9')];
        deactivateAllByAccommodation.mockResolvedValue(rows);
        findAllByAccommodation.mockResolvedValue(rows);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-9',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 1, revoked: 0, revocationFailures: 1 });
        expect(markRevocationFailed).toHaveBeenCalledTimes(1);
        const [stamped] = asMock(markRevocationFailed).mock.calls[0] as [
            { errorMessage: string; provider: string }
        ];
        expect(stamped.errorMessage).toContain(REVOCATION_FAILURE_PREFIX);
        expect(stamped.errorMessage).toContain('no revocation endpoint');
        expect(stamped.provider).toBe(OccupancySourceEnum.AIRBNB);
    });

    it('stamps the row when no revocation adapter is registered at all', async () => {
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-10')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-10',
            logger: mockLogger
        });

        expect(result.revocationFailures).toBe(1);
        const [stamped] = asMock(markRevocationFailed).mock.calls[0] as [{ errorMessage: string }];
        expect(stamped.errorMessage).toContain(REVOCATION_FAILURE_PREFIX);
        expect(stamped.errorMessage).toContain('no revocation adapter registered');
    });

    it('stamps the row when the adapter throws', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi.fn().mockRejectedValue(new Error('google returned 503'))
        });
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-11')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-11',
            logger: mockLogger
        });

        expect(result.revocationFailures).toBe(1);
        const [stamped] = asMock(markRevocationFailed).mock.calls[0] as [{ errorMessage: string }];
        expect(stamped.errorMessage).toContain('google returned 503');
    });

    it('treats a malformed adapter result as a failure instead of crashing the delete', async () => {
        // The port is a registration hole anyone can fill. Reading `.revoked`
        // off `undefined` would throw a TypeError out of `_afterSoftDelete` —
        // a 500 on a DELETE whose row is already gone.
        setCalendarConnectionRevocationPort({
            revoke: vi.fn().mockResolvedValue(undefined as never)
        });
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-12')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-12',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 0, revoked: 0, revocationFailures: 1 });
        const [stamped] = asMock(markRevocationFailed).mock.calls[0] as [{ errorMessage: string }];
        expect(stamped.errorMessage).toContain('malformed');
    });

    it('treats a failure with no reason as a failure, with a stand-in reason', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi.fn().mockResolvedValue({ revoked: false } as never)
        });
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-13')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-13',
            logger: mockLogger
        });

        expect(result.revocationFailures).toBe(1);
        const [stamped] = asMock(markRevocationFailed).mock.calls[0] as [{ errorMessage: string }];
        expect(stamped.errorMessage).toContain('no reason');
    });

    it('counts a mixed batch honestly — one revoked, one not', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi
                .fn()
                .mockImplementation(({ provider }: { provider: OccupancySourceEnum }) =>
                    provider === OccupancySourceEnum.GOOGLE_CALENDAR
                        ? Promise.resolve({ revoked: true })
                        : Promise.resolve({ revoked: false, reason: 'no revocation endpoint' })
                )
        });
        const rows = [
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-14'),
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-14')
        ];
        deactivateAllByAccommodation.mockResolvedValue(rows);
        findAllByAccommodation.mockResolvedValue(rows);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-14',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 2, revoked: 1, revocationFailures: 1 });
        expect(markRevocationFailed).toHaveBeenCalledTimes(1);
    });

    it('does nothing at all when the accommodation never had a connection', async () => {
        const revoke = vi.fn();
        setCalendarConnectionRevocationPort({ revoke });

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-15',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 0, revoked: 0, revocationFailures: 0 });
        expect(revoke).not.toHaveBeenCalled();
        expect(markRevocationFailed).not.toHaveBeenCalled();
    });
});

/**
 * A hard delete removes the connection rows by FK cascade, taking the ciphertext
 * with them. Revoking afterwards is impossible — there is no token left to send
 * — so the cascade has to run BEFORE the delete, or the hard path leaves a grant
 * nobody can ever close.
 */
describe('HOS-663 — hard delete revokes BEFORE the FK cascade destroys the token', () => {
    let service: AccommodationService;
    // Mirrors `hardDelete.test.ts`: the hard-delete path needs the full model
    // mock and an actor carrying ACCOMMODATION_HARD_DELETE.
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createAccommodationWithMockIds>;

    const hardDeleteActor = () =>
        createActor({ permissions: [PermissionEnum.ACCOMMODATION_HARD_DELETE] });

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        // @ts-expect-error: lifecycle hooks reach the destination service; stub it out.
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        entity = createAccommodationWithMockIds({ deletedAt: undefined });
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        resetModelStubs();
        asMock(model.findById).mockResolvedValue(entity);
    });

    it('revokes the grant on hardDelete, and does it before the row is gone', async () => {
        const callOrder: string[] = [];
        const revoke = vi.fn().mockImplementation(() => {
            callOrder.push('revoke');
            return Promise.resolve({ revoked: true });
        });
        setCalendarConnectionRevocationPort({ revoke });

        asMock(model.hardDelete).mockImplementation(() => {
            callOrder.push('hardDelete');
            return Promise.resolve(1);
        });
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, entity.id, true)
        ]);

        const result = await service.hardDelete(hardDeleteActor(), entity.id);

        expect(result.error).toBeUndefined();
        expect(revoke).toHaveBeenCalledTimes(1);
        // The ordering IS the assertion: reversed, there is no token left to
        // send, because the FK cascade took the ciphertext with the row.
        expect(callOrder).toEqual(['revoke', 'hardDelete']);
    });

    it('still deactivates and revokes when the accommodation has several providers', async () => {
        const revoke = vi.fn().mockResolvedValue({ revoked: true });
        setCalendarConnectionRevocationPort({ revoke });
        asMock(model.hardDelete).mockResolvedValue(1);
        findAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, entity.id, true),
            connectionRow(OccupancySourceEnum.AIRBNB, entity.id, false)
        ]);

        await service.hardDelete(hardDeleteActor(), entity.id);

        expect(revoke).toHaveBeenCalledTimes(2);
    });
});
