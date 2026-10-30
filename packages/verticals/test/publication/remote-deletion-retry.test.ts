import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { PublicationVertical } from '../../src/publication/publication-types';
import {
    type MarkedCalendarConnectionRow,
    type MarkedMediaCursor,
    type MarkedMediaRow,
    REMOTE_DELETION_RETRY_JOB,
    REMOTE_DELETION_RETRY_PAGE_SIZE,
    type RemoteDeletionRetryPorts,
    runRemoteDeletionRetry
} from '../../src/publication/remote-deletion-retry';

const markedAt = new Date('2026-10-12T12:00:00.000Z');

/** In-memory storage, marked rows and calendar provider, each of which can be taken down. */
function makeWorld(args: {
    readonly media: readonly MarkedMediaRow[];
    readonly calendar: readonly MarkedCalendarConnectionRow[];
    readonly pageSize?: number;
}) {
    const storage = new Set<string>(
        args.media.flatMap((row) => (row.publicId === null ? [] : [row.publicId]))
    );
    const mediaRows = new Map(args.media.map((row) => [`${row.vertical}|${row.mediaId}`, row]));
    const calendarRows = new Map(args.calendar.map((row) => [row.connectionId, row]));
    const state = { storageUp: false, providerUp: false };
    const deleteRemoteMedia = vi.fn(
        async (input: {
            readonly vertical: PublicationVertical;
            readonly mediaId: string;
            readonly publicId: string | null;
        }) => {
            if (input.publicId !== null) {
                if (!state.storageUp) throw new Error('storage down');
                storage.delete(input.publicId);
            }
            mediaRows.delete(`${input.vertical}|${input.mediaId}`);
        }
    );
    const revokeCalendarConnection = vi.fn(
        async (input: {
            readonly connectionId: string;
            readonly accommodationId: string;
            readonly provider: string;
        }) => {
            if (!state.providerUp) throw new Error('provider down');
            calendarRows.delete(input.connectionId);
        }
    );
    const ping = vi.fn(async (_input: { readonly job: string }) => {});
    const listMarkedMedia = vi.fn(
        async (input: { readonly after: MarkedMediaCursor | null; readonly limit: number }) => {
            const size = args.pageSize ?? input.limit;
            const sorted = [...mediaRows.values()].sort((a, b) =>
                `${a.vertical}|${a.mediaId}`.localeCompare(`${b.vertical}|${b.mediaId}`)
            );
            const start =
                input.after === null
                    ? sorted
                    : sorted.filter(
                          (row) =>
                              `${row.vertical}|${row.mediaId}` >
                              `${input.after?.vertical}|${input.after?.mediaId}`
                      );
            const items = start.slice(0, size);
            const last = items.at(-1);
            return {
                items,
                next:
                    start.length > size && last
                        ? { vertical: last.vertical, mediaId: last.mediaId }
                        : null
            };
        }
    );
    const listMarkedCalendarConnections = vi.fn(
        async (input: { readonly after: string | null; readonly limit: number }) => {
            const size = args.pageSize ?? input.limit;
            const sorted = [...calendarRows.values()]
                .sort((a, b) => a.connectionId.localeCompare(b.connectionId))
                .filter((row) => input.after === null || row.connectionId > input.after);
            const items = sorted.slice(0, size);
            const last = items.at(-1);
            return { items, next: sorted.length > size && last ? last.connectionId : null };
        }
    );
    const ports: RemoteDeletionRetryPorts = {
        pending: { listMarkedMedia, listMarkedCalendarConnections },
        remote: { deleteRemoteMedia, revokeCalendarConnection },
        monitor: { ping }
    };
    return {
        ports,
        state,
        storage,
        mediaRows,
        calendarRows,
        deleteRemoteMedia,
        revokeCalendarConnection,
        ping,
        listMarkedMedia
    };
}

const photo: MarkedMediaRow = {
    vertical: VerticalEnum.ACCOMMODATION,
    mediaId: 'media-1',
    publicId: 'remote/photo-1',
    markedAt
};
const connection: MarkedCalendarConnectionRow = {
    connectionId: 'calendar-1',
    accommodationId: 'listing-1',
    provider: 'GOOGLE_CALENDAR',
    markedAt
};

describe('AC:V6:30 runRemoteDeletionRetry', () => {
    it('AC:V6:30 reports every pending row while storage and provider are down, and still pings', async () => {
        const world = makeWorld({ media: [photo], calendar: [connection] });

        const summary = await runRemoteDeletionRetry({ ports: world.ports });

        expect(summary).toMatchObject({
            mediaRead: 1,
            mediaDeleted: 0,
            calendarRead: 1,
            calendarDeleted: 0,
            complete: true,
            pinged: true
        });
        expect(summary.failures).toEqual([
            {
                kind: 'media',
                id: 'media-1',
                vertical: VerticalEnum.ACCOMMODATION,
                error: expect.any(Error)
            },
            { kind: 'calendar', id: 'calendar-1', error: expect.any(Error) }
        ]);
        expect(world.mediaRows.has('accommodation|media-1')).toBe(true);
        expect(world.calendarRows.has('calendar-1')).toBe(true);
        expect(world.storage.has('remote/photo-1')).toBe(true);
        expect(world.revokeCalendarConnection).toHaveBeenCalledWith({
            connectionId: 'calendar-1',
            accommodationId: 'listing-1',
            provider: 'GOOGLE_CALENDAR'
        });
        expect(world.ping).toHaveBeenCalledTimes(1);
        expect(world.ping).toHaveBeenCalledWith({ job: REMOTE_DELETION_RETRY_JOB });
    });

    it('AC:V6:30 the next run with everything back deletes both sides and pings again', async () => {
        const world = makeWorld({ media: [photo], calendar: [connection] });
        const first = await runRemoteDeletionRetry({ ports: world.ports });
        expect(first.failures).toHaveLength(2);

        world.state.storageUp = true;
        world.state.providerUp = true;
        const second = await runRemoteDeletionRetry({ ports: world.ports });

        expect(second).toEqual({
            mediaRead: 1,
            mediaDeleted: 1,
            calendarRead: 1,
            calendarDeleted: 1,
            failures: [],
            complete: true,
            pinged: true
        });
        expect(world.mediaRows.size).toBe(0);
        expect(world.calendarRows.size).toBe(0);
        expect(world.storage.has('remote/photo-1')).toBe(false);
        expect(world.ping).toHaveBeenCalledTimes(2);
    });

    it('AC:V6:30 follows the cursor across pages of one and attempts each photo exactly once', async () => {
        expect(REMOTE_DELETION_RETRY_PAGE_SIZE).toBe(200);
        const photos: MarkedMediaRow[] = [
            { ...photo, mediaId: 'media-a', publicId: 'remote/a' },
            {
                ...photo,
                vertical: VerticalEnum.EXPERIENCE,
                mediaId: 'media-b',
                publicId: 'remote/b'
            },
            {
                ...photo,
                vertical: VerticalEnum.VENUE,
                mediaId: 'media-c',
                publicId: 'remote/c'
            }
        ];
        const world = makeWorld({ media: photos, calendar: [], pageSize: 1 });
        world.state.storageUp = true;

        const summary = await runRemoteDeletionRetry({ ports: world.ports });

        expect(summary).toMatchObject({ mediaRead: 3, mediaDeleted: 3, complete: true });
        expect(world.listMarkedMedia).toHaveBeenCalledTimes(3);
        const attempted = world.deleteRemoteMedia.mock.calls.map(([input]) => input.mediaId);
        expect(attempted.sort()).toEqual(['media-a', 'media-b', 'media-c']);
        expect(world.storage.size).toBe(0);
    });

    it('AC:V6:30 a population read that throws leaves the run incomplete and never pings', async () => {
        const world = makeWorld({ media: [photo], calendar: [connection] });
        const readError = new Error('database down');
        const ports: RemoteDeletionRetryPorts = {
            ...world.ports,
            pending: {
                ...world.ports.pending,
                listMarkedCalendarConnections: async () => {
                    throw readError;
                }
            }
        };

        const summary = await runRemoteDeletionRetry({ ports });

        expect(summary.complete).toBe(false);
        expect(summary.pinged).toBe(false);
        expect(summary.failures).toContainEqual({ kind: 'population', id: null, error: readError });
        expect(world.ping).not.toHaveBeenCalled();
    });

    it('AC:V6:30 a ping that throws only sets pinged to false', async () => {
        const world = makeWorld({ media: [photo], calendar: [connection] });
        world.state.storageUp = true;
        world.state.providerUp = true;
        const ports: RemoteDeletionRetryPorts = {
            ...world.ports,
            monitor: {
                ping: async () => {
                    throw new Error('monitor down');
                }
            }
        };

        const summary = await runRemoteDeletionRetry({ ports });

        expect(summary).toEqual({
            mediaRead: 1,
            mediaDeleted: 1,
            calendarRead: 1,
            calendarDeleted: 1,
            failures: [],
            complete: true,
            pinged: false
        });
    });

    it('AC:V6:30 a photo without publicId is passed as null and deleted without touching storage', async () => {
        const external: MarkedMediaRow = { ...photo, mediaId: 'media-ext', publicId: null };
        const world = makeWorld({ media: [external, photo], calendar: [] });

        const summary = await runRemoteDeletionRetry({ ports: world.ports });

        expect(world.deleteRemoteMedia).toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            mediaId: 'media-ext',
            publicId: null
        });
        expect(world.mediaRows.has('accommodation|media-ext')).toBe(false);
        expect(world.storage).toEqual(new Set(['remote/photo-1']));
        expect(summary).toMatchObject({ mediaRead: 2, mediaDeleted: 1, complete: true });
        expect(summary.failures).toEqual([
            {
                kind: 'media',
                id: 'media-1',
                vertical: VerticalEnum.ACCOMMODATION,
                error: expect.any(Error)
            }
        ]);
    });
});
