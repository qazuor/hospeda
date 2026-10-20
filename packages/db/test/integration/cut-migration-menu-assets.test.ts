import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createPreCutDatabase,
    dropPreCutDatabase,
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
        readonly deleted?: boolean;
    }
): Promise<void> {
    const common = [
        args.listingId,
        `cut-${args.listingId}`,
        args.ownerId,
        destination,
        'ACTIVE',
        'PUBLIC',
        args.deleted ?? false
    ];
    if (args.table === 'accommodations') {
        await client.query(
            `INSERT INTO accommodations (id, slug, name, summary, type, description, owner_id, destination_id,
                lifecycle_${'state'}, visib${'ility'}, owner_${'suspended'}, plan_${'restricted'}, deleted_at, created_at)
             VALUES ($1, $2, 'Cut accommodation', 'Summary', 'CABIN', 'Description', $3, $4,
                $5, $6, false, false, CASE WHEN $7 THEN '2025-06-01'::timestamptz ELSE NULL END, '2025-01-01'::timestamptz)`,
            common
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

async function applyCut(client: PoolClient): Promise<void> {
    const sql = withCutList({ sql: readCutMigration(), list: kept });
    for (const statement of splitCutStatements({ sql })) await client.query(statement);
}

beforeAll(async () => {
    testDatabase = await createPreCutDatabase({ name: `hospeda_cut_menu_assets_${process.pid}` });
    const client = await testDatabase.database.connect();
    try {
        for (let index = 0; index < owners.length; index += 1) {
            await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
                owners[index],
                `cut-menu-owner-${index}`,
                `cut-menu-owner-${index}@example.test`
            ]);
        }
        await client.query(
            `INSERT INTO destinations (id, destination_type, path, slug, name, summary, description, location)
             VALUES ($1, 'COUNTRY', '/cut-menu-test', 'cut-menu-test', 'Cut destination', 'Summary', 'Description', '{}'::jsonb)`,
            [destination]
        );
        const listings = [
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
        for (const [table, listingId, ownerId] of listings) {
            await insertListing(client, {
                table,
                listingId,
                ownerId,
                deleted: listingId === removed[3]
            });
        }
        await client.query(
            `INSERT INTO gastronomy_media (gastronomy_id, url, public_id, sort_order)
             VALUES ($1, 'https://example.test/food', 'cloud/food', 0)`,
            [removed[1]]
        );
    } finally {
        client.release();
    }
}, 300_000);

afterAll(async () => {
    if (testDatabase) await dropPreCutDatabase(testDatabase);
});

describe('TEST:1712:1 AC:1712:1 paso-3 cut migration carries gastronomy menu files and dish photos', () => {
    const MENU = { publicId: 'cloud/menu', url: 'https://example.test/menu.pdf' };

    async function seedMenu(
        client: PoolClient,
        args: {
            readonly gastronomyId: string;
            readonly menuUrl: string | null;
            readonly menuPublicId: string | null;
            readonly menuKind: string | null;
            readonly sectionId: string;
            readonly items: readonly {
                readonly id: string;
                readonly name: string;
                readonly displayOrder: number;
                readonly photoUrl: string | null;
                readonly photoPublicId: string | null;
            }[];
        }
    ): Promise<void> {
        await client.query(
            `UPDATE gastronomies SET menu_file_url = $1, menu_file_public_id = $2,
                menu_file_kind = $3 WHERE id = $4`,
            [args.menuUrl, args.menuPublicId, args.menuKind, args.gastronomyId]
        );
        await client.query(
            `INSERT INTO gastronomy_menu_sections (id, gastronomy_id, name, display_order)
                VALUES ($1, $2, 'Main', 0)`,
            [args.sectionId, args.gastronomyId]
        );
        for (const item of args.items) {
            await client.query(
                `INSERT INTO gastronomy_menu_items
                    (id, section_id, gastronomy_id, name, display_order, photo_url, photo_public_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    item.id,
                    args.sectionId,
                    args.gastronomyId,
                    item.name,
                    item.displayOrder,
                    item.photoUrl,
                    item.photoPublicId
                ]
            );
        }
    }

    async function seedBase(client: PoolClient): Promise<void> {
        await seedMenu(client, {
            gastronomyId: removed[1],
            menuUrl: MENU.url,
            menuPublicId: MENU.publicId,
            menuKind: 'pdf',
            sectionId: id(60),
            items: [
                {
                    id: id(63),
                    name: 'Three',
                    displayOrder: 2,
                    photoUrl: null,
                    photoPublicId: 'cloud/dish-three'
                },
                {
                    id: id(61),
                    name: 'One',
                    displayOrder: 0,
                    photoUrl: 'https://example.test/dish-one',
                    photoPublicId: 'cloud/dish-one'
                },
                {
                    id: id(62),
                    name: 'Two',
                    displayOrder: 1,
                    photoUrl: 'https://external.test/dish-two',
                    photoPublicId: null
                }
            ]
        });
        await seedMenu(client, {
            gastronomyId: kept[1].entityId,
            menuUrl: 'https://example.test/kept-menu.jpg',
            menuPublicId: 'cloud/kept-menu',
            menuKind: 'image',
            sectionId: id(64),
            items: [
                {
                    id: id(65),
                    name: 'Kept',
                    displayOrder: 0,
                    photoUrl: 'https://example.test/kept-dish',
                    photoPublicId: 'cloud/kept-dish'
                }
            ]
        });
    }

    async function photosFor(client: PoolClient, entityId: string) {
        return (
            await client.query<{ photos: { publicId: string | null; url: string }[] }>(
                `SELECT photos FROM cutover_v6_deleted_listing
                 WHERE entity_type = 'gastronomy' AND entity_id = $1`,
                [entityId]
            )
        ).rows[0]?.photos;
    }

    it('TEST:1712:1 AC:1712:1 (a) carries gallery, menu, and dishes in order and preserves kept listings', async () => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            await seedBase(client);
            await applyCut(client);
            expect(await photosFor(client, removed[1])).toEqual([
                { publicId: 'cloud/food', url: 'https://example.test/food' },
                MENU,
                { publicId: 'cloud/dish-one', url: 'https://example.test/dish-one' },
                { publicId: 'cloud/dish-three', url: '' }
            ]);
            expect(
                (
                    await client.query(
                        'SELECT count(*)::int AS count FROM cutover_v6_deleted_listing'
                    )
                ).rows
            ).toEqual([{ count: 4 }]);
            expect(
                (
                    await client.query(
                        `SELECT photos FROM cutover_v6_deleted_listing
                         WHERE entity_type = 'experience' AND entity_id = $1`,
                        [removed[2]]
                    )
                ).rows
            ).toEqual([{ photos: [] }]);
            expect(
                (
                    await client.query(
                        'SELECT menu_file_public_id FROM gastronomies WHERE id = $1',
                        [kept[1].entityId]
                    )
                ).rows
            ).toEqual([{ menu_file_public_id: 'cloud/kept-menu' }]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('TEST:1712:1 AC:1712:1 (b) omits menu and dish URLs without public ids', async () => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            await seedMenu(client, {
                gastronomyId: removed[1],
                menuUrl: MENU.url,
                menuPublicId: null,
                menuKind: 'pdf',
                sectionId: id(60),
                items: [
                    {
                        id: id(61),
                        name: 'One',
                        displayOrder: 0,
                        photoUrl: 'https://example.test/one',
                        photoPublicId: null
                    },
                    {
                        id: id(62),
                        name: 'Two',
                        displayOrder: 1,
                        photoUrl: null,
                        photoPublicId: null
                    }
                ]
            });
            await applyCut(client);
            expect(await photosFor(client, removed[1])).toEqual([
                { publicId: 'cloud/food', url: 'https://example.test/food' }
            ]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('TEST:1712:1 AC:1712:1 (c) uses an empty URL when the carried menu has no URL', async () => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            await seedMenu(client, {
                gastronomyId: removed[1],
                menuUrl: null,
                menuPublicId: MENU.publicId,
                menuKind: 'pdf',
                sectionId: id(60),
                items: []
            });
            await applyCut(client);
            expect(await photosFor(client, removed[1])).toEqual([
                { publicId: 'cloud/food', url: 'https://example.test/food' },
                { publicId: 'cloud/menu', url: '' }
            ]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('TEST:1712:1 AC:1712:1 (d) carries menu and dishes when the gallery is empty', async () => {
        const client = await testDatabase.database.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM gastronomy_media WHERE gastronomy_id = $1', [
                removed[1]
            ]);
            await seedBase(client);
            await applyCut(client);
            expect(await photosFor(client, removed[1])).toEqual([
                MENU,
                { publicId: 'cloud/dish-one', url: 'https://example.test/dish-one' },
                { publicId: 'cloud/dish-three', url: '' }
            ]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});
