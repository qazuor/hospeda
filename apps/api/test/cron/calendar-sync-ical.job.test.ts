/**
 * iCal Calendar Sync Cron Job Tests (HOS-162 Phase 3 — Layer E)
 *
 * Unit tests for the `calendar-sync-ical` job handler: provider iteration
 * (AIRBNB/BOOKING/OTHER), dry-run, mixed per-connection outcomes, per-iteration
 * throw isolation, and the empty case.
 *
 * Mocked collaborators:
 * - `@repo/db` — `accommodationCalendarSyncModel.findAllActiveByProvider`.
 * - the sync service — `syncAccommodationIcalCalendar`.
 *
 * @module test/cron/calendar-sync-ical.job
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

const { mockFindAllActiveByProvider, mockSyncAccommodationIcalCalendar } = vi.hoisted(() => ({
    mockFindAllActiveByProvider: vi.fn(),
    mockSyncAccommodationIcalCalendar: vi.fn()
}));

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: {
        findAllActiveByProvider: mockFindAllActiveByProvider
    }
}));

vi.mock('../../src/services/ical-calendar/ical-calendar-sync.service.js', () => ({
    syncAccommodationIcalCalendar: mockSyncAccommodationIcalCalendar
}));

const buildCtx = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date(),
    dryRun
});

/** Connections belong to `provider`; every other provider returns none. */
const connectionsForProvider = (
    provider: string,
    connections: readonly { accommodationId: string }[]
) => {
    mockFindAllActiveByProvider.mockImplementation((params: { provider: string }) =>
        Promise.resolve(params.provider === provider ? connections : [])
    );
};

describe('calendar-sync-ical job', () => {
    let calendarSyncIcalJob: typeof import('../../src/cron/jobs/calendar-sync-ical.job.js').calendarSyncIcalJob;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ calendarSyncIcalJob } = await import('../../src/cron/jobs/calendar-sync-ical.job.js'));
    });

    it('has the expected name and 6-hourly schedule', () => {
        expect(calendarSyncIcalJob.name).toBe('calendar-sync-ical');
        expect(calendarSyncIcalJob.schedule).toBe('0 */6 * * *');
        expect(calendarSyncIcalJob.enabled).toBe(true);
    });

    it('queries active connections for each of the three iCal providers', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([]);

        await calendarSyncIcalJob.handler(buildCtx());

        expect(mockFindAllActiveByProvider).toHaveBeenCalledWith({ provider: 'AIRBNB' });
        expect(mockFindAllActiveByProvider).toHaveBeenCalledWith({ provider: 'BOOKING' });
        expect(mockFindAllActiveByProvider).toHaveBeenCalledWith({ provider: 'OTHER' });
        expect(mockFindAllActiveByProvider).toHaveBeenCalledTimes(3);
    });

    it('does not sync in dry-run mode; reports the count that would be synced', async () => {
        connectionsForProvider('AIRBNB', [
            { accommodationId: 'acc-1' },
            { accommodationId: 'acc-2' }
        ]);

        const result = await calendarSyncIcalJob.handler(buildCtx(true));

        expect(mockSyncAccommodationIcalCalendar).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.details?.dryRun).toBe(true);
    });

    it('passes the owning provider to the sync service for each connection', async () => {
        connectionsForProvider('BOOKING', [{ accommodationId: 'acc-b' }]);
        mockSyncAccommodationIcalCalendar.mockResolvedValue({
            status: 'ok',
            removed: 0,
            inserted: 1
        });

        await calendarSyncIcalJob.handler(buildCtx());

        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledWith({
            accommodationId: 'acc-b',
            provider: 'BOOKING'
        });
    });

    it('aggregates mixed ok / error / skipped outcomes and flags failure', async () => {
        connectionsForProvider('AIRBNB', [
            { accommodationId: 'acc-ok' },
            { accommodationId: 'acc-err' },
            { accommodationId: 'acc-skip' }
        ]);
        mockSyncAccommodationIcalCalendar
            .mockResolvedValueOnce({ status: 'ok', removed: 1, inserted: 4 })
            .mockResolvedValueOnce({ status: 'error', kind: 'fetch_error', message: 'unreachable' })
            .mockResolvedValueOnce({ status: 'skipped', reason: 'inactive' });

        const result = await calendarSyncIcalJob.handler(buildCtx());

        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(false); // one error → run flagged unsuccessful
        expect(result.processed).toBe(1); // ok count
        expect(result.errors).toBe(1);
        expect(result.details).toMatchObject({
            ok: 1,
            errors: 1,
            skipped: 1,
            inserted: 4,
            removed: 1
        });
    });

    it('reports success when every connection syncs OK', async () => {
        connectionsForProvider('OTHER', [{ accommodationId: 'acc-1' }]);
        mockSyncAccommodationIcalCalendar.mockResolvedValue({
            status: 'ok',
            removed: 0,
            inserted: 2
        });

        const result = await calendarSyncIcalJob.handler(buildCtx());

        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
    });

    it('isolates a per-connection throw and keeps sweeping', async () => {
        connectionsForProvider('AIRBNB', [
            { accommodationId: 'acc-throws' },
            { accommodationId: 'acc-ok' }
        ]);
        mockSyncAccommodationIcalCalendar
            .mockRejectedValueOnce(new Error('unexpected boom'))
            .mockResolvedValueOnce({ status: 'ok', removed: 0, inserted: 0 });

        const result = await calendarSyncIcalJob.handler(buildCtx());

        // The throw did not abort the sweep — the second connection still synced.
        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledTimes(2);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(1);
    });

    it('succeeds trivially when there are no active connections', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([]);

        const result = await calendarSyncIcalJob.handler(buildCtx());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
    });
});
