/**
 * HOS-663 — regression tests for the delete-time half of the cascade.
 *
 * Two things are asserted here, and they are NOT the same thing:
 *
 *  1. Soft-deleting an accommodation deactivates its calendar connections.
 *     Exercised through the REAL `AccommodationService.softDelete` lifecycle,
 *     not by calling the cascade helper directly — the bug was never in the
 *     helper, it was that nothing on the delete path called one.
 *  2. The connection's credential is handed to the provider for revocation,
 *     and a revocation that does NOT happen is recorded on the row instead of
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
import { CalendarSyncStatusEnum, OccupancySourceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` is hoisted above every top-level binding, so the stubs it closes
// over have to be hoisted with it.
const { deactivateAllByAccommodation, updateSyncState } = vi.hoisted(() => ({
    deactivateAllByAccommodation: vi.fn(),
    updateSyncState: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        // Only the calendar-sync singleton is replaced. A whole-module mock
        // would leave every other `@repo/db` import in the service graph
        // `undefined` and pass with zero of the lifecycle actually executing.
        accommodationCalendarSyncModel: {
            deactivateAllByAccommodation,
            updateSyncState
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
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const mockLogger = createLoggerMock();

/** A deactivated connection row, as `deactivateAllByAccommodation` returns it. */
const connectionRow = (provider: OccupancySourceEnum, accommodationId: string) => ({
    id: `conn-${provider}`,
    accommodationId,
    provider,
    isActive: false
});

describe('HOS-663 — soft-deleting an accommodation shuts down its calendar connections', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        deactivateAllByAccommodation.mockResolvedValue([]);
        updateSyncState.mockResolvedValue(null);

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

    it('asks the provider to revoke the credential of every connection it deactivated', async () => {
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
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-2'),
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-2')
        ]);

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
        expect(updateSyncState).not.toHaveBeenCalled();
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

        const result = await service.softDelete(createAdminActor(), 'acc-4');

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
    });
});

describe('HOS-663 — a revocation that does not happen is recorded, never swallowed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setCalendarConnectionRevocationPort(undefined);
        updateSyncState.mockResolvedValue(null);
    });

    it('stamps the row when the provider exposes no revocation (iCal feed URLs)', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi
                .fn()
                .mockResolvedValue({ revoked: false, reason: 'no revocation endpoint (iCal feed)' })
        });
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-5')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-5',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 1, revoked: 0, revocationFailures: 1 });
        expect(updateSyncState).toHaveBeenCalledTimes(1);
        const [stamped] = asMock(updateSyncState).mock.calls[0] as [
            { lastSyncStatus: string; lastErrorMessage: string; provider: string }
        ];
        expect(stamped.lastSyncStatus).toBe(CalendarSyncStatusEnum.ERROR);
        expect(stamped.lastErrorMessage).toContain(REVOCATION_FAILURE_PREFIX);
        expect(stamped.lastErrorMessage).toContain('no revocation endpoint');
        expect(stamped.provider).toBe(OccupancySourceEnum.AIRBNB);
    });

    it('stamps the row when no revocation adapter is registered at all', async () => {
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-6')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-6',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 1, revoked: 0, revocationFailures: 1 });
        const [stamped] = asMock(updateSyncState).mock.calls[0] as [{ lastErrorMessage: string }];
        expect(stamped.lastErrorMessage).toContain(REVOCATION_FAILURE_PREFIX);
        expect(stamped.lastErrorMessage).toContain('no revocation adapter registered');
    });

    it('stamps the row when the adapter throws', async () => {
        setCalendarConnectionRevocationPort({
            revoke: vi.fn().mockRejectedValue(new Error('google returned 503'))
        });
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-7')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-7',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 1, revoked: 0, revocationFailures: 1 });
        const [stamped] = asMock(updateSyncState).mock.calls[0] as [{ lastErrorMessage: string }];
        expect(stamped.lastErrorMessage).toContain(REVOCATION_FAILURE_PREFIX);
        expect(stamped.lastErrorMessage).toContain('google returned 503');
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
        deactivateAllByAccommodation.mockResolvedValue([
            connectionRow(OccupancySourceEnum.GOOGLE_CALENDAR, 'acc-8'),
            connectionRow(OccupancySourceEnum.AIRBNB, 'acc-8')
        ]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-8',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 2, revoked: 1, revocationFailures: 1 });
        expect(updateSyncState).toHaveBeenCalledTimes(1);
    });

    it('does nothing at all when the accommodation had no active connection', async () => {
        const revoke = vi.fn();
        setCalendarConnectionRevocationPort({ revoke });
        deactivateAllByAccommodation.mockResolvedValue([]);

        const result = await cascadeCalendarConnectionsOnAccommodationDelete({
            accommodationId: 'acc-9',
            logger: mockLogger
        });

        expect(result).toEqual({ deactivated: 0, revoked: 0, revocationFailures: 0 });
        expect(revoke).not.toHaveBeenCalled();
        expect(updateSyncState).not.toHaveBeenCalled();
    });
});
