/**
 * Session recording retention purge (HOS-2347) with a mocked `pg` pool.
 *
 * Pins the SQL contract the purge relies on, so a Umami upgrade that renames a
 * table or column is a deliberate edit here, not a silent no-op in production.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, endMock, poolCtorMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
    endMock: vi.fn(),
    poolCtorMock: vi.fn()
}));

vi.mock('pg', () => ({
    Pool: class {
        constructor(config: unknown) {
            poolCtorMock(config);
        }
        query = queryMock;
        end = endMock;
        on = vi.fn();
    }
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import {
    buildBatchDeleteSql,
    CREATED_AT_COLUMN,
    PURGE_BATCH_SIZE,
    PURGE_TABLES,
    purgeSessionRecordings,
    WEBSITE_COLUMN
} from '../../src/services/session-recording-purge';

const WEBSITE_ID = '3f2b1c9e-5a4d-4e8b-9c1a-0d7e6f5a4b3c';
const URL = 'postgresql://umami_retention:secret@umami-db:5432/umami';

const base = { connectionString: URL, websiteId: WEBSITE_ID, retentionDays: 30 } as const;

describe('Umami schema names the purge relies on (Umami 3.5)', () => {
    it('pins the tables and the two columns', () => {
        expect(PURGE_TABLES).toEqual(['session_replay', 'heatmap_event']);
        expect(WEBSITE_COLUMN).toBe('website_id');
        expect(CREATED_AT_COLUMN).toBe('created_at');
    });

    it('scopes by website, compares created_at to an interval and is parameterized', () => {
        // Act
        const sql = buildBatchDeleteSql({ table: 'session_replay' });

        // Assert
        expect(sql).toContain('FROM session_replay');
        expect(sql).toContain('website_id = $1');
        expect(sql).toContain('created_at < now() - make_interval(days => $2::int)');
        expect(sql).toContain('LIMIT $3');
        expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    });
});

describe('purgeSessionRecordings', () => {
    beforeEach(() => {
        queryMock.mockReset();
        endMock.mockReset();
        poolCtorMock.mockReset();
    });

    it('skips without touching pg when the connection string is unset', async () => {
        const outcome = await purgeSessionRecordings({ ...base, connectionString: undefined });

        expect(outcome).toEqual({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });
        expect(poolCtorMock).not.toHaveBeenCalled();
    });

    it('skips when the connection string is blank', async () => {
        const outcome = await purgeSessionRecordings({ ...base, connectionString: '   ' });

        expect(outcome).toEqual({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });
    });

    it('skips when the website id is unset: it never deletes unscoped', async () => {
        const outcome = await purgeSessionRecordings({ ...base, websiteId: undefined });

        expect(outcome).toEqual({ status: 'skipped', reason: 'WEBSITE_ID_UNSET' });
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('deletes from both tables scoped by website with the period and batch size', async () => {
        // Arrange
        queryMock.mockResolvedValue({ rowCount: 7 });

        // Act
        const outcome = await purgeSessionRecordings({ ...base, retentionDays: 14 });

        // Assert
        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(queryMock).toHaveBeenNthCalledWith(
            1,
            buildBatchDeleteSql({ table: 'session_replay' }),
            [WEBSITE_ID, 14, PURGE_BATCH_SIZE]
        );
        expect(queryMock).toHaveBeenNthCalledWith(
            2,
            buildBatchDeleteSql({ table: 'heatmap_event' }),
            [WEBSITE_ID, 14, PURGE_BATCH_SIZE]
        );
        expect(outcome).toEqual({
            status: 'purged',
            replaysDeleted: 7,
            heatmapEventsDeleted: 7,
            stoppedEarly: false
        });
    });

    it('loops a table until a batch deletes fewer rows than the batch size', async () => {
        // Arrange: replays 5 + 5 + 2, heatmap 1
        queryMock
            .mockResolvedValueOnce({ rowCount: 5 })
            .mockResolvedValueOnce({ rowCount: 5 })
            .mockResolvedValueOnce({ rowCount: 2 })
            .mockResolvedValueOnce({ rowCount: 1 });

        // Act
        const outcome = await purgeSessionRecordings({ ...base, batchSize: 5 });

        // Assert
        expect(queryMock).toHaveBeenCalledTimes(4);
        expect(outcome).toMatchObject({ replaysDeleted: 12, heatmapEventsDeleted: 1 });
    });

    it('treats a null rowCount as zero', async () => {
        queryMock.mockResolvedValue({ rowCount: null });

        const outcome = await purgeSessionRecordings(base);

        expect(outcome).toMatchObject({ replaysDeleted: 0, heatmapEventsDeleted: 0 });
    });

    it('stops between statements when the signal is aborted', async () => {
        // Arrange
        const controller = new AbortController();
        controller.abort();

        // Act
        const outcome = await purgeSessionRecordings({ ...base, signal: controller.signal });

        // Assert
        expect(queryMock).not.toHaveBeenCalled();
        expect(outcome).toMatchObject({ status: 'purged', stoppedEarly: true });
    });

    it('closes the pool and rethrows when a statement fails', async () => {
        queryMock.mockRejectedValue(new Error('permission denied for table session_replay'));

        await expect(purgeSessionRecordings(base)).rejects.toThrow('permission denied');
        expect(endMock).toHaveBeenCalledTimes(1);
    });

    it('uses the connection string it was given and a one-connection pool', async () => {
        queryMock.mockResolvedValue({ rowCount: 0 });

        await purgeSessionRecordings(base);

        expect(poolCtorMock).toHaveBeenCalledWith(
            expect.objectContaining({ connectionString: URL, max: 1 })
        );
        expect(endMock).toHaveBeenCalledTimes(1);
    });
});
