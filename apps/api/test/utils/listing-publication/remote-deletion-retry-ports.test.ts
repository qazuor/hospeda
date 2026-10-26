import { VerticalEnum } from '@repo/schemas';
import type { MarkedMediaCursor } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMarkedMedia, listMarkedCalendarConnections, deleteRemoteMedia, revoke, ping } =
    vi.hoisted(() => ({
        listMarkedMedia: vi.fn(),
        listMarkedCalendarConnections: vi.fn(),
        deleteRemoteMedia: vi.fn(),
        revoke: vi.fn(),
        ping: vi.fn()
    }));
vi.mock('@repo/db', () => ({
    listingPurgeModel: { listMarkedMedia, listMarkedCalendarConnections }
}));
vi.mock('../../../src/utils/listing-publication/purge-ports', () => ({
    getPurgeAfterCommit: () => ({ deleteRemoteMedia, revokeCalendarConnection: revoke })
}));
vi.mock('../../../src/utils/cron-heartbeat', () => ({ pingCronMonitor: ping }));

import { CRON_SCHEDULES } from '../../../src/cron/schedules.manifest';
import {
    getRemoteDeletionRetryPorts,
    REMOTE_DELETION_RETRY_CHECKIN_MARGIN_MINUTES
} from '../../../src/utils/listing-publication/remote-deletion-retry-ports';

describe('AC:V6:30 remote deletion retry production ports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ping.mockResolvedValue(undefined);
    });

    it('reads the marked media population from the purge model without a transaction', async () => {
        const page = { items: [], next: null };
        listMarkedMedia.mockResolvedValue(page);
        const after: MarkedMediaCursor = { vertical: VerticalEnum.VENUE, mediaId: 'm-1' };
        await expect(
            getRemoteDeletionRetryPorts().pending.listMarkedMedia({ after, limit: 200 })
        ).resolves.toBe(page);
        expect(listMarkedMedia).toHaveBeenCalledWith({ after, limit: 200 });
    });

    it('reads the marked calendar population from the purge model without a transaction', async () => {
        const page = { items: [], next: 'c-2' };
        listMarkedCalendarConnections.mockResolvedValue(page);
        await expect(
            getRemoteDeletionRetryPorts().pending.listMarkedCalendarConnections({
                after: 'c-1',
                limit: 5
            })
        ).resolves.toBe(page);
        expect(listMarkedCalendarConnections).toHaveBeenCalledWith({ after: 'c-1', limit: 5 });
    });

    it('uses the PB12 post-commit adapters for both remote deletions', () => {
        const { remote } = getRemoteDeletionRetryPorts();
        expect(remote.deleteRemoteMedia).toBe(deleteRemoteMedia);
        expect(remote.revokeCalendarConnection).toBe(revoke);
    });

    it('pings the monitor with the manifest schedule and the 26 h margin', async () => {
        const entry = CRON_SCHEDULES.find(({ name }) => name === 'listing-remote-deletion-retry');
        expect(entry?.schedule).toBe('45 5 * * *');
        await getRemoteDeletionRetryPorts().monitor.ping({
            job: 'listing-remote-deletion-retry'
        });
        expect(REMOTE_DELETION_RETRY_CHECKIN_MARGIN_MINUTES).toBe(120);
        expect(ping).toHaveBeenCalledWith({
            job: 'listing-remote-deletion-retry',
            schedule: '45 5 * * *',
            checkinMargin: 120
        });
    });

    it('throws when the pinged job has no schedule in the manifest', async () => {
        await expect(
            getRemoteDeletionRetryPorts().monitor.ping({ job: 'no-such-job' })
        ).rejects.toThrow('no-such-job');
        expect(ping).not.toHaveBeenCalled();
    });
});
