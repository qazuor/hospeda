// HOS-1794 (follow-up to extras-032-fails-loud.test.ts) — extras 005, 006, 007, 008, 018
// (accommodation-media) and 033 must FAIL when a target table is missing, never skip with a
// NOTICE. A silent skip leaves a DB invariant absent while `db:apply-extras` exits 0.
// Uses an empty scratch database plus minimal stand-in tables, so it does not depend on the full
// migration chain. Every DO block is run ALONE, so reverting any single block turns a test red.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH_DB = `hospeda_scratch_extras_rest_${process.pid}`;

interface ExtraCase {
    readonly file: string;
    readonly blocks: number;
    readonly standIns: readonly string[];
}

const MEDIA_STAND_IN = (table: string, fk: string): string =>
    `CREATE TABLE ${table} (id serial PRIMARY KEY, ${fk} uuid NOT NULL,
        is_featured boolean NOT NULL DEFAULT false, state text NOT NULL DEFAULT 'active',
        deleted_at timestamptz)`;

const CASES: readonly ExtraCase[] = [
    {
        file: '005-media.constraints.sql',
        blocks: 8,
        standIns: ['accommodations', 'destinations', 'events', 'posts'].map(
            (t) => `CREATE TABLE ${t} (id serial PRIMARY KEY, media jsonb)`
        )
    },
    {
        file: '006-conversation.indexes.sql',
        blocks: 3,
        standIns: [
            `CREATE TABLE conversations (id serial PRIMARY KEY, user_id uuid, accommodation_id uuid,
                anonymous_email text, anonymous_email_verified boolean, deleted_at timestamptz)`,
            `CREATE TABLE conversation_notification_schedules (id serial PRIMARY KEY,
                conversation_id int, recipient_side text, cancelled_at timestamptz)`
        ]
    },
    {
        file: '007-messages.constraints.sql',
        blocks: 1,
        standIns: ['CREATE TABLE messages (id serial PRIMARY KEY, body text)']
    },
    {
        file: '008-bookmark.indexes.sql',
        blocks: 2,
        standIns: [
            `CREATE TABLE user_bookmarks (id serial PRIMARY KEY, entity_id uuid, entity_type text,
                deleted_at timestamptz)`,
            `CREATE TABLE user_bookmark_collections (id serial PRIMARY KEY, user_id uuid, name text,
                deleted_at timestamptz)`
        ]
    },
    {
        file: '018-accommodation-media.constraints.sql',
        blocks: 2,
        standIns: [MEDIA_STAND_IN('accommodation_media', 'accommodation_id')]
    },
    {
        file: '033-content-media.constraints.sql',
        blocks: 4,
        standIns: [
            MEDIA_STAND_IN('post_media', 'post_id'),
            MEDIA_STAND_IN('event_media', 'event_id')
        ]
    }
];

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

function readExtra({ file }: { readonly file: string }): string {
    return readFileSync(resolve(PACKAGE_DIR, 'src/migrations/extras', file), 'utf8');
}

function splitBlocks({ sql }: { readonly sql: string }): readonly string[] {
    return sql.split(/^(?=DO \$\$)/m).filter((b) => b.startsWith('DO $$'));
}

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

describe.each(CASES)('TEST:HOS-1794 $file fails loudly on a missing table', (extra) => {
    const sql = readExtra({ file: extra.file });
    const blocks = splitBlocks({ sql });

    it(`has the expected ${extra.blocks} DO blocks`, () => {
        expect(blocks).toHaveLength(extra.blocks);
    });

    it.each(
        Array.from({ length: extra.blocks }, (_, i) => i)
    )('block %i raises on its own when its table is missing', async (index) => {
        // Arrange: a database with none of the target tables
        const block = blocks[index] as string;
        // Act + Assert
        await expect(scratch.query(block)).rejects.toThrow(/does not exist/);
    });

    it('applies with the tables present, and re-applying is a no-op', async () => {
        // Arrange
        for (const standIn of extra.standIns) await scratch.query(standIn);
        // Act + Assert
        await scratch.query(sql);
        await scratch.query(sql);
    });
});

describe('TEST:HOS-1794 extras/005 keeps the intentional accommodations.media column skip', () => {
    it('skips (no error) the two accommodations blocks when the table exists without media', async () => {
        // Arrange: the column was dropped on purpose (HOS-372)
        await scratch.query('ALTER TABLE accommodations DROP COLUMN media');
        const sql = readExtra({ file: '005-media.constraints.sql' });
        // Act + Assert
        await expect(scratch.query(sql)).resolves.toBeDefined();
    });
});
