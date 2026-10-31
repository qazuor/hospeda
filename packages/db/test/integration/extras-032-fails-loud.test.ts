// HOS-1794 — extras/032 must FAIL when its target table is missing, never skip with a NOTICE.
// A silent skip leaves the "one featured photo per listing" index absent while
// `db:apply-extras` exits 0. Uses an empty scratch database plus minimal stand-in tables, so it
// does not depend on the full migration chain.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH_DB = `hospeda_scratch_extras032_${process.pid}`;
const EXTRA_SQL = readFileSync(
    resolve(PACKAGE_DIR, 'src/migrations/extras/032-venue-experience-media.constraints.sql'),
    'utf8'
);

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

const CREATE_VENUE_MEDIA = `CREATE TABLE venue_media (
    id serial PRIMARY KEY, venue_id uuid NOT NULL, is_featured boolean NOT NULL DEFAULT false,
    state text NOT NULL DEFAULT 'active', deleted_at timestamptz)`;
const CREATE_EXPERIENCE_MEDIA = `CREATE TABLE experience_media (
    id serial PRIMARY KEY, experience_id uuid NOT NULL, is_featured boolean NOT NULL DEFAULT false,
    state text NOT NULL DEFAULT 'active', deleted_at timestamptz)`;

let admin: Pool;
let scratch: Pool;

beforeAll(async () => {
    admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
    await waitForNoConnections({ admin, database: SCRATCH_DB });
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
    scratch = new Pool({ connectionString: urlFor({ database: SCRATCH_DB }) });
    protectScratchPool({ pool: scratch });
}, 60_000);

afterAll(async () => {
    await scratch?.end();
    if (admin) {
        await waitForNoConnections({ admin, database: SCRATCH_DB });
        await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
        await admin.end();
    }
});

describe('TEST:HOS-1794 extras/032 fails loudly on a missing table', () => {
    it('raises when venue_media does not exist', async () => {
        // Arrange: empty database, no tables
        // Act + Assert
        await expect(scratch.query(EXTRA_SQL)).rejects.toThrow(/venue_media/);
    });

    it('raises when only experience_media is missing', async () => {
        // Arrange
        await scratch.query(CREATE_VENUE_MEDIA);
        // Act + Assert
        await expect(scratch.query(EXTRA_SQL)).rejects.toThrow(/experience_media/);
    });

    it('applies when both tables exist, and re-applying is a no-op', async () => {
        // Arrange
        await scratch.query(CREATE_EXPERIENCE_MEDIA);
        // Act
        await scratch.query(EXTRA_SQL);
        await scratch.query(EXTRA_SQL);
        // Assert
        const indexes = await scratch.query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes
             WHERE indexname IN ('uq_venue_media_single_featured', 'uq_experience_media_single_featured')
             ORDER BY indexname`
        );
        expect(indexes.rows.map((r) => r.indexname)).toEqual([
            'uq_experience_media_single_featured',
            'uq_venue_media_single_featured'
        ]);
        const checks = await scratch.query<{ conname: string }>(
            `SELECT conname FROM pg_constraint
             WHERE conname IN ('chk_venue_media_featured_not_archived', 'chk_experience_media_featured_not_archived')`
        );
        expect(checks.rows).toHaveLength(2);
    });
});
