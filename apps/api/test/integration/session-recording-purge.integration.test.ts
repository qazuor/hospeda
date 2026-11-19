/**
 * Session recording retention purge (HOS-2347) against REAL Postgres.
 *
 * The unit test mocks `pg` and pins the SQL text; this one runs the actual
 * statements on throwaway copies of the three Umami 3.5 tables (the columns the
 * purge touches, same names and types) in a temp schema, and asserts the data:
 *
 * - old rows of OUR website are deleted, new rows and OTHER websites' rows stay,
 * - saved pointers are removed when they are old or when no chunk is left, and
 *   kept while their visit still has a chunk and they are young,
 * - the advisory lock makes a second concurrent purge answer `locked`.
 *
 * It needs a reachable Postgres (`HOSPEDA_DATABASE_URL`, which the integration
 * `globalSetup` points at the disposable test database). Without one it SKIPS,
 * and says so loudly: a skipped run proves nothing about the SQL.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PURGE_LOCK_KEY, purgeSessionRecordings } from '../../src/services/session-recording-purge';

const BASE_URL = process.env.HOSPEDA_DATABASE_URL;
const SCHEMA = `umami_purge_${randomUUID().replaceAll('-', '').slice(0, 12)}`;

if (!BASE_URL) {
    console.warn(
        '[session-recording-purge.integration] SKIPPED: HOSPEDA_DATABASE_URL is not set, the real SQL was NOT exercised.'
    );
}

/** Same URL, pinned to the temp schema so the purge's unqualified table names resolve there. */
function urlForSchema(base: string): string {
    const url = new URL(base);
    url.searchParams.set('options', `-c search_path=${SCHEMA}`);
    return url.toString();
}

const OURS = randomUUID();
const OTHER = randomUUID();
const daysAgo = (days: number): string => `now() - interval '${days} days'`;

describe.skipIf(!BASE_URL)('purgeSessionRecordings on real Postgres', () => {
    let admin: Pool;

    const count = async (table: string, where: string): Promise<number> => {
        const result = await admin.query(
            `SELECT count(*)::int AS n FROM ${SCHEMA}.${table} WHERE ${where}`
        );
        return result.rows[0].n as number;
    };

    beforeAll(async () => {
        admin = new Pool({ connectionString: BASE_URL, max: 2 });
        await admin.query(`CREATE SCHEMA ${SCHEMA}`);
        await admin.query(`
            CREATE TABLE ${SCHEMA}.session_replay (
                replay_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                website_id uuid NOT NULL, session_id uuid NOT NULL, visit_id uuid NOT NULL,
                chunk_index int NOT NULL DEFAULT 0, events bytea NOT NULL DEFAULT ''::bytea,
                event_count int NOT NULL DEFAULT 0,
                started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz NOT NULL DEFAULT now(),
                created_at timestamptz DEFAULT now());
            CREATE TABLE ${SCHEMA}.heatmap_event (
                heatmap_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                website_id uuid NOT NULL, session_id uuid NOT NULL, visit_id uuid NOT NULL,
                url_path varchar(500) NOT NULL DEFAULT '/', event_type int NOT NULL DEFAULT 1,
                created_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE ${SCHEMA}.session_replay_saved (
                saved_replay_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name varchar(100) NOT NULL, website_id uuid NOT NULL, visit_id uuid NOT NULL,
                created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
                UNIQUE (website_id, visit_id));
        `);

        const vSavedOld = randomUUID();
        const vYoung = randomUUID();
        const vPlainOld = randomUUID();
        const vOtherSite = randomUUID();
        const vAgedPointer = randomUUID();
        const session = randomUUID();

        const replay = (site: string, visitId: string, age: number) =>
            admin.query(
                `INSERT INTO ${SCHEMA}.session_replay (website_id, session_id, visit_id, created_at)
                 VALUES ($1, $2, $3, ${daysAgo(age)})`,
                [site, session, visitId]
            );
        // OURS: three old chunks of a SAVED visit, one old chunk of a plain visit, young chunks of two visits.
        for (let i = 0; i < 3; i++) await replay(OURS, vSavedOld, 40);
        await replay(OURS, vPlainOld, 40);
        await replay(OURS, vYoung, 1);
        await replay(OURS, vAgedPointer, 1);
        await replay(OTHER, vOtherSite, 400);

        const heat = (site: string, age: number) =>
            admin.query(
                `INSERT INTO ${SCHEMA}.heatmap_event (website_id, session_id, visit_id, created_at)
                 VALUES ($1, $2, $3, ${daysAgo(age)})`,
                [site, session, randomUUID()]
            );
        await heat(OURS, 40);
        await heat(OURS, 40);
        await heat(OURS, 40);
        await heat(OURS, 1);
        await heat(OTHER, 400);

        const saved = (site: string, visitId: string, age: number) =>
            admin.query(
                `INSERT INTO ${SCHEMA}.session_replay_saved (name, website_id, visit_id, created_at)
                 VALUES ('keep', $1, $2, ${daysAgo(age)})`,
                [site, visitId]
            );
        await saved(OURS, vSavedOld, 5); // young pointer, but every chunk is old: dangling after the purge
        await saved(OURS, vYoung, 1); // young pointer, chunk still there: kept
        await saved(OURS, vAgedPointer, 40); // old pointer, chunk young: removed by age
        await saved(OTHER, vOtherSite, 400); // other website: untouched
    });

    afterAll(async () => {
        await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
        await admin.end();
    });

    it('while another purge holds the lock, answers locked and deletes nothing', async () => {
        // Arrange: a second session takes the advisory lock, like a running purge would
        const holder = await admin.connect();
        await holder.query('SELECT pg_advisory_lock($1)', [PURGE_LOCK_KEY]);
        try {
            // Act
            const outcome = await purgeSessionRecordings({
                connectionString: urlForSchema(BASE_URL as string),
                websiteId: OURS,
                retentionDays: 30
            });

            // Assert
            expect(outcome).toEqual({ status: 'locked' });
            expect(await count('session_replay', `website_id = '${OURS}'`)).toBe(6);
        } finally {
            await holder.query('SELECT pg_advisory_unlock($1)', [PURGE_LOCK_KEY]);
            holder.release();
        }
    });

    it('deletes old rows of our website in batches and keeps young rows and other websites', async () => {
        // Act: batch size 2 forces several statements per table
        const outcome = await purgeSessionRecordings({
            connectionString: urlForSchema(BASE_URL as string),
            websiteId: OURS,
            retentionDays: 30,
            batchSize: 2
        });

        // Assert: counts
        expect(outcome).toEqual({
            status: 'purged',
            replaysDeleted: 4,
            heatmapEventsDeleted: 3,
            savedReplaysDeleted: 2,
            stoppedEarly: false
        });
        // our young rows stay
        expect(await count('session_replay', `website_id = '${OURS}'`)).toBe(2);
        expect(await count('heatmap_event', `website_id = '${OURS}'`)).toBe(1);
        // the other website keeps everything, however old
        expect(await count('session_replay', `website_id = '${OTHER}'`)).toBe(1);
        expect(await count('heatmap_event', `website_id = '${OTHER}'`)).toBe(1);
        expect(await count('session_replay_saved', `website_id = '${OTHER}'`)).toBe(1);
        // saved pointers: the dangling one and the aged one are gone, the live one stays
        expect(await count('session_replay_saved', `website_id = '${OURS}'`)).toBe(1);
        expect(
            await count(
                'session_replay_saved',
                `website_id = '${OURS}' AND created_at > now() - interval '2 days'`
            )
        ).toBe(1);
    });

    it('releases the lock when it finishes: a second run purges again', async () => {
        const outcome = await purgeSessionRecordings({
            connectionString: urlForSchema(BASE_URL as string),
            websiteId: OURS,
            retentionDays: 30
        });

        expect(outcome).toMatchObject({
            status: 'purged',
            replaysDeleted: 0,
            heatmapEventsDeleted: 0,
            savedReplaysDeleted: 0
        });
    });
});
