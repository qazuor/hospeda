/**
 * Google Calendar Sync Cron Job Tests (HOS-157 Phase 2 — Layer 4)
 *
 * Unit tests for the `calendar-sync-google` job handler: dry-run, mixed
 * per-accommodation outcomes, per-iteration throw isolation, and the empty case.
 *
 * Mocked collaborators:
 * - `@repo/db` — `accommodationCalendarSyncModel.findAllActiveByProvider`.
 * - the sync service — `syncAccommodationCalendar`.
 *
 * @module test/cron/calendar-sync-google.job
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

const { mockFindAllActiveByProvider, mockSyncAccommodationCalendar } = vi.hoisted(() => ({
    mockFindAllActiveByProvider: vi.fn(),
    mockSyncAccommodationCalendar: vi.fn()
}));

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: {
        findAllActiveByProvider: mockFindAllActiveByProvider
    }
}));

vi.mock('../../src/services/google-calendar/google-calendar-sync.service.js', () => ({
    syncAccommodationCalendar: mockSyncAccommodationCalendar
}));

const buildCtx = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date(),
    dryRun
});

describe('calendar-sync-google job', () => {
    let calendarSyncGoogleJob: typeof import('../../src/cron/jobs/calendar-sync-google.job.js').calendarSyncGoogleJob;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ calendarSyncGoogleJob } = await import(
            '../../src/cron/jobs/calendar-sync-google.job.js'
        ));
    });

    it('has the expected name and 6-hourly schedule', () => {
        expect(calendarSyncGoogleJob.name).toBe('calendar-sync-google');
        expect(calendarSyncGoogleJob.schedule).toBe('0 */6 * * *');
        expect(calendarSyncGoogleJob.enabled).toBe(true);
    });

    it('queries active connections by the GOOGLE_CALENDAR provider', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([]);

        await calendarSyncGoogleJob.handler(buildCtx());

        expect(mockFindAllActiveByProvider).toHaveBeenCalledWith({ provider: 'GOOGLE_CALENDAR' });
    });

    it('does not sync in dry-run mode; reports the count that would be synced', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([
            { accommodationId: 'acc-1' },
            { accommodationId: 'acc-2' }
        ]);

        const result = await calendarSyncGoogleJob.handler(buildCtx(true));

        expect(mockSyncAccommodationCalendar).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.details?.dryRun).toBe(true);
    });

    it('aggregates mixed ok / error / skipped outcomes and flags failure', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([
            { accommodationId: 'acc-ok' },
            { accommodationId: 'acc-err' },
            { accommodationId: 'acc-skip' }
        ]);
        mockSyncAccommodationCalendar
            .mockResolvedValueOnce({
                status: 'ok',
                eventsProcessed: 3,
                datesUpserted: 4,
                datesRemoved: 1,
                fullSync: false
            })
            .mockResolvedValueOnce({ status: 'error', kind: 'terminal', message: 'reconnect' })
            .mockResolvedValueOnce({ status: 'skipped', reason: 'inactive' });

        const result = await calendarSyncGoogleJob.handler(buildCtx());

        expect(mockSyncAccommodationCalendar).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(false); // one error → run flagged unsuccessful
        expect(result.processed).toBe(1); // ok count
        expect(result.errors).toBe(1);
        expect(result.details).toMatchObject({
            ok: 1,
            errors: 1,
            skipped: 1,
            datesUpserted: 4,
            datesRemoved: 1
        });
    });

    it('reports success when every connection syncs OK', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([{ accommodationId: 'acc-1' }]);
        mockSyncAccommodationCalendar.mockResolvedValue({
            status: 'ok',
            eventsProcessed: 1,
            datesUpserted: 2,
            datesRemoved: 0,
            fullSync: true
        });

        const result = await calendarSyncGoogleJob.handler(buildCtx());

        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
    });

    it('isolates a per-accommodation throw and keeps sweeping', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([
            { accommodationId: 'acc-throws' },
            { accommodationId: 'acc-ok' }
        ]);
        mockSyncAccommodationCalendar
            .mockRejectedValueOnce(new Error('unexpected boom'))
            .mockResolvedValueOnce({
                status: 'ok',
                eventsProcessed: 0,
                datesUpserted: 0,
                datesRemoved: 0,
                fullSync: false
            });

        const result = await calendarSyncGoogleJob.handler(buildCtx());

        // The throw did not abort the sweep — the second connection still synced.
        expect(mockSyncAccommodationCalendar).toHaveBeenCalledTimes(2);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(1);
    });

    it('succeeds trivially when there are no active connections', async () => {
        mockFindAllActiveByProvider.mockResolvedValue([]);

        const result = await calendarSyncGoogleJob.handler(buildCtx());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
    });
});
