/**
 * Session recording retention purge (HOS-2347) with a mocked `pg` pool.
 *
 * Pins the SQL contract the purge relies on, so a Umami upgrade that renames a
 * table or column is a deliberate edit here, not a silent no-op in production.
 * The real statements run against Postgres in
 * `test/integration/session-recording-purge.integration.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, releaseMock, endMock, connectMock, poolCtorMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
    releaseMock: vi.fn(),
    endMock: vi.fn(),
    connectMock: vi.fn(),
    poolCtorMock: vi.fn()
}));

vi.mock('pg', () => ({
    Pool: class {
        constructor(config: unknown) {
            poolCtorMock(config);
        }
        connect = connectMock;
        end = endMock;
        on = vi.fn();
    }
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import {
    buildBatchDeleteSql,
    buildSavedPointerDeleteSql,
    CREATED_AT_COLUMN,
    MAX_BATCHES_PER_TABLE,
    PURGE_BATCH_SIZE,
    PURGE_LOCK_KEY,
    PURGE_TABLES,
    purgeSessionRecordings,
    SAVED_TABLE,
    VISIT_COLUMN,
    WEBSITE_COLUMN
} from '../../src/services/session-recording-purge';

const WEBSITE_ID = '3f2b1c9e-5a4d-4e8b-9c1a-0d7e6f5a4b3c';
const URL = 'postgresql://umami_retention:secret@umami-db:5432/umami';

const base = { connectionString: URL, websiteId: WEBSITE_ID, retentionDays: 30 } as const;

const LOCK_SQL = 'SELECT pg_try_advisory_lock($1) AS acquired';
const UNLOCK_SQL = 'SELECT pg_advisory_unlock($1)';

/** Routes the lock statements and answers every delete with `rowCount`. */
function answer(input: { readonly acquired?: boolean; readonly rowCount?: number | null }) {
    queryMock.mockImplementation(async (sql: string) => {
        if (sql === LOCK_SQL) return { rows: [{ acquired: input.acquired ?? true }] };
        if (sql === UNLOCK_SQL) return { rows: [{ pg_advisory_unlock: true }] };
        return { rowCount: input.rowCount === undefined ? 0 : input.rowCount };
    });
}

/** The delete statements the purge sent, in order (lock and unlock excluded). */
const deletes = () =>
    queryMock.mock.calls.filter(([sql]) => sql !== LOCK_SQL && sql !== UNLOCK_SQL);

describe('Umami schema names the purge relies on (Umami 3.5)', () => {
    it('pins the tables and the columns', () => {
        expect(PURGE_TABLES).toEqual(['session_replay', 'heatmap_event']);
        expect(SAVED_TABLE).toBe('session_replay_saved');
        expect(WEBSITE_COLUMN).toBe('website_id');
        expect(CREATED_AT_COLUMN).toBe('created_at');
        expect(VISIT_COLUMN).toBe('visit_id');
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

    it('the pointer delete is website-scoped and removes old or chunkless pointers only', () => {
        const sql = buildSavedPointerDeleteSql();

        expect(sql).toContain('DELETE FROM session_replay_saved');
        expect(sql).toContain('s.website_id = $1');
        expect(sql).toContain('s.created_at < now() - make_interval(days => $2::int)');
        expect(sql).toContain('NOT EXISTS (SELECT 1 FROM session_replay r');
        expect(sql).toContain('r.visit_id = s.visit_id');
        expect(sql).toContain('r.website_id = s.website_id');
    });
});

describe('purgeSessionRecordings', () => {
    beforeEach(() => {
        queryMock.mockReset();
        releaseMock.mockReset();
        endMock.mockReset();
        connectMock.mockReset();
        poolCtorMock.mockReset();
        connectMock.mockResolvedValue({ query: queryMock, release: releaseMock });
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

    it.each([
        Number.NaN,
        0,
        -1,
        15,
        45,
        30.5
    ])('throws before any pool or query for the period %s', async (days) => {
        await expect(
            purgeSessionRecordings({ ...base, retentionDays: days as never })
        ).rejects.toThrow('Invalid session recording retention');

        expect(poolCtorMock).not.toHaveBeenCalled();
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('takes the lock, deletes both tables then the pointers on ONE client, and unlocks', async () => {
        // Arrange
        answer({ rowCount: 7 });

        // Act
        const outcome = await purgeSessionRecordings({ ...base, retentionDays: 14 });

        // Assert
        expect(connectMock).toHaveBeenCalledTimes(1);
        expect(queryMock.mock.calls.map(([sql]) => sql)).toEqual([
            LOCK_SQL,
            buildBatchDeleteSql({ table: 'session_replay' }),
            buildBatchDeleteSql({ table: 'heatmap_event' }),
            buildSavedPointerDeleteSql(),
            UNLOCK_SQL
        ]);
        expect(queryMock).toHaveBeenNthCalledWith(1, LOCK_SQL, [PURGE_LOCK_KEY]);
        expect(queryMock).toHaveBeenNthCalledWith(
            2,
            buildBatchDeleteSql({ table: 'session_replay' }),
            [WEBSITE_ID, 14, PURGE_BATCH_SIZE]
        );
        expect(queryMock).toHaveBeenNthCalledWith(4, buildSavedPointerDeleteSql(), [
            WEBSITE_ID,
            14
        ]);
        expect(queryMock).toHaveBeenNthCalledWith(5, UNLOCK_SQL, [PURGE_LOCK_KEY]);
        expect(releaseMock).toHaveBeenCalledTimes(1);
        expect(endMock).toHaveBeenCalledTimes(1);
        expect(outcome).toEqual({
            status: 'purged',
            replaysDeleted: 7,
            heatmapEventsDeleted: 7,
            savedReplaysDeleted: 7,
            stoppedEarly: false
        });
    });

    it('answers locked and deletes nothing when another purge holds the lock', async () => {
        // Arrange
        answer({ acquired: false });

        // Act
        const outcome = await purgeSessionRecordings(base);

        // Assert
        expect(outcome).toEqual({ status: 'locked' });
        expect(deletes()).toHaveLength(0);
        expect(queryMock.mock.calls.map(([sql]) => sql)).not.toContain(UNLOCK_SQL);
        expect(releaseMock).toHaveBeenCalledTimes(1);
        expect(endMock).toHaveBeenCalledTimes(1);
    });

    it('loops a table until a batch deletes fewer rows than the batch size', async () => {
        // Arrange: replays 5 + 5 + 2, heatmap 1, pointers 0
        queryMock
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({ rowCount: 5 })
            .mockResolvedValueOnce({ rowCount: 5 })
            .mockResolvedValueOnce({ rowCount: 2 })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rowCount: 0 })
            .mockResolvedValueOnce({ rows: [] });

        // Act
        const outcome = await purgeSessionRecordings({ ...base, batchSize: 5 });

        // Assert
        expect(deletes()).toHaveLength(5);
        expect(outcome).toMatchObject({
            replaysDeleted: 12,
            heatmapEventsDeleted: 1,
            savedReplaysDeleted: 0
        });
    });

    it('stops at MAX_BATCHES_PER_TABLE when every batch comes back full, and keeps the pointers', async () => {
        // Arrange: a table that never drains
        answer({ rowCount: 5 });

        // Act
        const outcome = await purgeSessionRecordings({ ...base, batchSize: 5 });

        // Assert: each table stops at the ceiling; the pointer delete never runs
        expect(deletes()).toHaveLength(2 * MAX_BATCHES_PER_TABLE);
        expect(deletes().map(([sql]) => sql)).not.toContain(buildSavedPointerDeleteSql());
        expect(outcome).toMatchObject({
            status: 'purged',
            replaysDeleted: 5 * MAX_BATCHES_PER_TABLE,
            heatmapEventsDeleted: 5 * MAX_BATCHES_PER_TABLE,
            savedReplaysDeleted: 0,
            stoppedEarly: true
        });
    });

    it('treats a null rowCount as zero', async () => {
        answer({ rowCount: null });

        const outcome = await purgeSessionRecordings(base);

        expect(outcome).toMatchObject({ replaysDeleted: 0, heatmapEventsDeleted: 0 });
    });

    it('stops between statements when the signal is aborted, and unlocks', async () => {
        // Arrange
        answer({ rowCount: 0 });
        const controller = new AbortController();
        controller.abort();

        // Act
        const outcome = await purgeSessionRecordings({ ...base, signal: controller.signal });

        // Assert
        expect(deletes()).toHaveLength(0);
        expect(queryMock.mock.calls.map(([sql]) => sql)).toContain(UNLOCK_SQL);
        expect(outcome).toMatchObject({ status: 'purged', stoppedEarly: true });
    });

    it('unlocks, releases and closes the pool, then rethrows, when a statement fails', async () => {
        // Arrange
        queryMock.mockImplementation(async (sql: string) => {
            if (sql === LOCK_SQL) return { rows: [{ acquired: true }] };
            if (sql === UNLOCK_SQL) return { rows: [] };
            throw new Error('permission denied for table session_replay');
        });

        // Act / Assert
        await expect(purgeSessionRecordings(base)).rejects.toThrow('permission denied');
        expect(queryMock.mock.calls.map(([sql]) => sql)).toContain(UNLOCK_SQL);
        expect(releaseMock).toHaveBeenCalledTimes(1);
        expect(endMock).toHaveBeenCalledTimes(1);
    });

    it('uses the connection string it was given and a one-connection pool', async () => {
        answer({ rowCount: 0 });

        await purgeSessionRecordings(base);

        expect(poolCtorMock).toHaveBeenCalledWith(
            expect.objectContaining({ connectionString: URL, max: 1 })
        );
    });
});
