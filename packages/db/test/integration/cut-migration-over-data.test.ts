import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createPreCutDatabase,
    dropPreCutDatabase,
    findCutStatement,
    readCutMigration,
    splitCutStatements,
    withCutList
} from './support/cut-migration.ts';

type TestDatabase = Awaited<ReturnType<typeof createPreCutDatabase>>;
const id = (number: number): string =>
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const owners = Array.from({ length: 7 }, (_, index) => id(index + 1));
const destination = id(20);
const kept = [
    { entityType: 'accommodation', entityId: id(31) },
    { entityType: 'gastronomy', entityId: id(32) },
    { entityType: 'experience', entityId: id(33) },
    { entityType: 'accommodation', entityId: id(34), publicationStatus: 'DRAFT' },
    { entityType: 'gastronomy', entityId: id(35) }
] as const;
const removed = [id(41), id(42), id(43), id(44)];
let testDatabase: TestDatabase;

async function insertListing(
    client: PoolClient,
    args: {
        readonly table: 'accommodations' | 'gastronomies' | 'experiences';
        readonly listingId: string;
        readonly ownerId: string;
        readonly lifecycle?: string;
        readonly visibility?: string;
        readonly suspended?: boolean;
        readonly restricted?: boolean;
        readonly deleted?: boolean;
    }
): Promise<void> {
    const common = [
        args.listingId,
        `cut-${args.listingId}`,
        args.ownerId,
        destination,
        args.lifecycle ?? 'ACTIVE',
        args.visibility ?? 'PUBLIC',
        args.deleted ?? false
    ];
    if (args.table === 'accommodations') {
        await client.query(
            `INSERT INTO accommodations (id, slug, name, summary, type, description, owner_id, destination_id,
                lifecycle_state, visibility, owner_suspended, plan_restricted, deleted_at, created_at)
             VALUES ($1, $2, 'Cut accommodation', 'Summary', 'CABIN', 'Description', $3, $4,
                $5, $6, $8, $9, CASE WHEN $7 THEN '2025-06-01'::timestamptz ELSE NULL END, '2025-01-01'::timestamptz)`,
            [...common, args.suspended ?? false, args.restricted ?? false]
        );
    } else {
        await client.query(
            `INSERT INTO ${args.table} (id, slug, name, summary, description, type, owner_id, destination_id,
                lifecycle_state, visibility, deleted_at, created_at)
             VALUES ($1, $2, 'Cut listing', 'Summary', 'Description', $8, $3, $4,
                $5, $6, CASE WHEN $7 THEN '2025-06-01'::timestamptz ELSE NULL END, '2025-01-01'::timestamptz)`,
            [...common, args.table === 'gastronomies' ? 'RESTAURANT' : 'EXCURSION']
        );
    }
}

async function applyCut(client: PoolClient, list: readonly object[]): Promise<void> {
    const sql = withCutList({ sql: readCutMigration(), list });
    for (const statement of splitCutStatements({ sql })) await client.query(statement);
}

async function countListings(client: PoolClient): Promise<number> {
    const result = await client.query<{ count: string }>(
        `SELECT (SELECT count(*) FROM accommodations) + (SELECT count(*) FROM gastronomies)
             + (SELECT count(*) FROM experiences) AS count`
    );
    return Number(result.rows[0]?.count);
}

beforeAll(async () => {
    testDatabase = await createPreCutDatabase({ name: `hospeda_cut_over_data_${process.pid}` });
    const client = await testDatabase.database.connect();
    try {
        for (let index = 0; index < owners.length; index += 1) {
            await client.query(`INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)`, [
                owners[index],
                `cut-owner-${index}`,
                `cut-owner-${index}@example.test`
            ]);
        }
        await client.query(
            `INSERT INTO destinations (id, destination_type, path, slug, name, summary, description, location)
             VALUES ($1, 'COUNTRY', '/cut-test', 'cut-test', 'Cut destination', 'Summary', 'Description', '{}'::jsonb)`,
            [destination]
        );
        const rows = [
            ['accommodations', kept[0].entityId, owners[0]],
            ['gastronomies', kept[1].entityId, owners[1]],
            ['experiences', kept[2].entityId, owners[2]],
            ['accommodations', kept[3].entityId, owners[3]],
            ['gastronomies', kept[4].entityId, owners[4]],
            ['accommodations', removed[0], owners[5]],
            ['gastronomies', removed[1], owners[5]],
            ['experiences', removed[2], owners[6]],
            ['accommodations', removed[3], owners[6]]
        ] as const;
        for (const [table, listingId, ownerId] of rows) {
            await insertListing(client, {
                table,
                listingId,
                ownerId,
                deleted: listingId === removed[3]
            });
        }
        await client.query(
            `INSERT INTO accommodation_media (accommodation_id, url, public_id, sort_order)
            VALUES ($1, 'https://example.test/photo-one', 'cloud/one', 0),
                   ($1, 'https://example.test/photo-two', NULL, 1)`,
            [removed[0]]
        );
        await client.query(
            `INSERT INTO gastronomy_media (gastronomy_id, url, public_id, sort_order)
            VALUES ($1, 'https://example.test/food', 'cloud/food', 0)`,
            [removed[1]]
        );
        await client.query(
            `INSERT INTO accommodation_calendar_sync
            (accommodation_id, provider, access_token_ciphertext, access_token_iv, access_token_auth_tag,
             refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag, external_calendar_id, created_by_id)
            VALUES ($1, 'GOOGLE_CALENDAR', 'cipher-test', 'iv-test', 'tag-test',
                'refresh-test', 'refresh-iv-test', 'refresh-tag-test', 'external-test', $2)`,
            [removed[0], owners[5]]
        );
        await client.query(`INSERT INTO conversations (id, accommodation_id) VALUES ($1, $2)`, [
            id(50),
            removed[0]
        ]);
    } finally {
        client.release();
    }
}, 300_000);

afterAll(async () => {
    if (testDatabase) await dropPreCutDatabase(testDatabase);
});

describe('TEST:V6:19 paso-3 cut migration over data', () => {
    it('keeps five, writes C, preserves deletion payloads and removes the restricted conversation', async () => {
        const client = await testDatabase.database.connect();
        const before = new Date();
        try {
            await client.query('BEGIN');
            await applyCut(client, kept);
            const after = new Date();
            expect(await countListings(client)).toBe(5);
            const rows = await client.query<{
                id: string;
                publication_status: string;
                inactive_since: Date;
                created_at: Date;
                deadlines_version: number;
            }>(`SELECT id, publication_status, inactive_since, created_at, deadlines_version FROM accommodations
                UNION ALL SELECT id, publication_status, inactive_since, created_at, deadlines_version FROM gastronomies
                UNION ALL SELECT id, publication_status, inactive_since, created_at, deadlines_version FROM experiences`);
            expect(rows.rows.map((row) => row.id).sort()).toEqual(
                kept.map((item) => item.entityId).sort()
            );
            expect(rows.rows.filter((row) => row.publication_status === 'PUBLISHED')).toHaveLength(
                4
            );
            expect(rows.rows.find((row) => row.id === kept[3].entityId)?.publication_status).toBe(
                'DRAFT'
            );
            expect(
                rows.rows.every((row) => row.publication_status !== 'UNPUBLISHED_BY_BILLING')
            ).toBe(true);
            expect(new Set(rows.rows.map((row) => row.inactive_since.toISOString())).size).toBe(1);
            for (const row of rows.rows) {
                expect(row.inactive_since.getTime()).toBeGreaterThanOrEqual(before.getTime());
                expect(row.inactive_since.getTime()).toBeLessThanOrEqual(after.getTime());
                expect(row.inactive_since.toISOString()).not.toBe(row.created_at.toISOString());
                expect(row.deadlines_version).toBe(1);
            }
            const passage = await client.query<{
                entity_type: string;
                entity_id: string;
                photos: { publicId: string | null; url: string }[];
                calendar_tokens: Record<string, string | null>[];
            }>(`SELECT * FROM cutover_v6_deleted_listing ORDER BY entity_id`);
            expect(passage.rows).toHaveLength(4);
            expect(passage.rows.map((row) => row.entity_id).sort()).toEqual([...removed].sort());
            const accommodation = passage.rows.find((row) => row.entity_id === removed[0]);
            expect(accommodation?.photos).toEqual(
                expect.arrayContaining([
                    { publicId: 'cloud/one', url: 'https://example.test/photo-one' },
                    { publicId: null, url: 'https://example.test/photo-two' }
                ])
            );
            expect(accommodation?.calendar_tokens).toEqual([
                {
                    access_token_ciphertext: 'cipher-test',
                    access_token_iv: 'iv-test',
                    access_token_auth_tag: 'tag-test',
                    refresh_token_ciphertext: 'refresh-test',
                    refresh_token_iv: 'refresh-iv-test',
                    refresh_token_auth_tag: 'refresh-tag-test',
                    external_calendar_id: 'external-test'
                }
            ]);
            expect(passage.rows.find((row) => row.entity_id === removed[1])?.photos).toEqual([
                { publicId: 'cloud/food', url: 'https://example.test/food' }
            ]);
            expect(
                passage.rows
                    .filter((row) => row.entity_type !== 'accommodation')
                    .every((row) => row.calendar_tokens.length === 0)
            ).toBe(true);
            expect(
                (await client.query('SELECT 1 FROM conversations WHERE id = $1', [id(50)])).rowCount
            ).toBe(0);
            const columns = await client.query<{
                table_name: string;
                column_name: string;
                is_nullable: string;
            }>(
                `SELECT table_name, column_name, is_nullable FROM information_schema.columns
                 WHERE table_name IN ('accommodations', 'gastronomies', 'experiences')
                   AND column_name IN ('publication_status', 'inactive_since', 'deadlines_version')`
            );
            for (const column of columns.rows)
                expect(column.is_nullable, `${column.table_name}.${column.column_name}`).toBe('NO');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('keeps every row in placeholder mode and derives the bridge state, including deleted rows', async () => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE accommodations SET plan_restricted = true WHERE id = $1`, [
                kept[0].entityId
            ]);
            await client.query(`UPDATE accommodations SET owner_suspended = true WHERE id = $1`, [
                kept[3].entityId
            ]);
            await applyCut(client, []);
            expect(await countListings(client)).toBe(9);
            const result = await client.query<{
                id: string;
                publication_status: string;
                inactive_since: Date;
            }>(
                `SELECT id, publication_status, inactive_since FROM accommodations WHERE id = ANY($1::uuid[])`,
                [[removed[0], kept[0].entityId, kept[3].entityId, removed[3]]]
            );
            expect(result.rows.find((row) => row.id === removed[0])?.publication_status).toBe(
                'PUBLISHED'
            );
            expect(result.rows.find((row) => row.id === kept[0].entityId)?.publication_status).toBe(
                'DRAFT'
            );
            expect(result.rows.find((row) => row.id === kept[3].entityId)?.publication_status).toBe(
                'DRAFT'
            );
            expect(result.rows.find((row) => row.id === removed[3])?.inactive_since).toBeInstanceOf(
                Date
            );
            expect(
                (
                    await client.query(
                        'SELECT count(*)::int AS count FROM cutover_v6_deleted_listing'
                    )
                ).rows[0]?.count
            ).toBe(0);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it.each([
        [
            'six elements',
            [...kept, { entityType: 'accommodation', entityId: removed[0] }],
            'more than five'
        ],
        [
            'unknown entity type',
            [{ entityType: 'other', entityId: kept[0].entityId }],
            'entityType'
        ],
        ['unknown id', [{ entityType: 'accommodation', entityId: id(99) }], 'entityId'],
        [
            'billing status',
            [{ ...kept[0], publicationStatus: 'UNPUBLISHED_BY_BILLING' }],
            'publicationStatus'
        ],
        ['purged status', [{ ...kept[0], publicationStatus: 'PURGED' }], 'publicationStatus'],
        [
            'repeated owner',
            [
                { entityType: 'accommodation', entityId: removed[0] },
                { entityType: 'gastronomy', entityId: removed[1] }
            ],
            'owner_id'
        ]
    ])('rejects %s before deleting a listing', async (_case, list, message) => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            const statements = splitCutStatements({
                sql: withCutList({ sql: readCutMigration(), list })
            });
            for (const statement of statements.slice(0, 3)) await client.query(statement);
            const cut = findCutStatement({ statements, fragment: 'CUT-LIST:BEGIN' });
            await expect(client.query(cut)).rejects.toThrow(message);
        } finally {
            await client.query('ROLLBACK');
            expect(await countListings(client)).toBe(9);
            client.release();
        }
    });
});
