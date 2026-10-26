import type { Venue } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { listingPurgeModel } from '../../src/models/listing/listing-purge.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function createListing(tx: DrizzleClient, ownerId: string, destinationId: string) {
    const base = {
        name: `HOS-1702 ${crypto.randomUUID()}`,
        slug: `hos-1702-${crypto.randomUUID()}`,
        summary: 'private summary',
        description: 'private description',
        ownerId,
        destinationId
    };
    return new VenueModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx);
}

async function seedMenuFileAndVideos(tx: DrizzleClient, listingId: string) {
    await tx.execute(sql`UPDATE gastronomies
        SET menu_file_url = 'https://cdn.example.test/menu.pdf',
            menu_file_public_id = 'remote/menu-file', menu_file_kind = 'pdf',
            videos = '[{"url":"https://youtu.be/example","platform":"youtube"}]'::jsonb
        WHERE id = ${listingId}`);
}

async function insertSection(tx: DrizzleClient, listingId: string) {
    const result = await tx.execute(sql<{ id: string }>`
        INSERT INTO gastronomy_menu_sections (gastronomy_id, name, display_order)
        VALUES (${listingId}, 'Dinner', 0) RETURNING id`);
    return String(result.rows[0]!.id);
}

async function insertDish(
    tx: DrizzleClient,
    listingId: string,
    sectionId: string,
    name: string,
    photoUrl: string | null,
    photoPublicId?: string
) {
    await tx.execute(sql`
        INSERT INTO gastronomy_menu_items
            (gastronomy_id, section_id, name, display_order, photo_url, photo_public_id)
        VALUES (${listingId}, ${sectionId}, ${name}, 0, ${photoUrl}, ${photoPublicId ?? null})`);
}

async function insertGalleryPhoto(tx: DrizzleClient, listingId: string) {
    const result = await tx.execute(sql<{ id: string }>`
        INSERT INTO gastronomy_media (gastronomy_id, url, public_id, sort_order)
        VALUES (${listingId}, 'https://cdn.example.test/gallery.jpg', 'remote/gallery', 0)
        RETURNING id`);
    return String(result.rows[0]!.id);
}

async function readMarkedPages(tx: DrizzleClient) {
    const items: { vertical: string; mediaId: string; publicId: string | null; markedAt: Date }[] =
        [];
    let after: { vertical: 'accommodation' | 'gastronomy' | 'experience'; mediaId: string } | null =
        null;
    do {
        const page = await listingPurgeModel.listMarkedMedia({ tx, after, limit: 2 });
        items.push(...page.items);
        after = page.next;
    } while (after !== null);
    return items;
}

describe('TEST:1702:1 AC:1702:1 AC:1702:4 gastronomy purge keeps a marked media row for every remote file', () => {
    it('keeps and marks gallery, dish and menu file rows while deleting the menu content', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, owner.id, destination.id);
            const galleryId = await insertGalleryPhoto(tx, listing.id);
            await seedMenuFileAndVideos(tx, listing.id);
            const sectionId = await insertSection(tx, listing.id);
            await insertDish(
                tx,
                listing.id,
                sectionId,
                'Dish A',
                'https://cdn.example.test/a.jpg',
                'remote/dish-a'
            );
            await insertDish(
                tx,
                listing.id,
                sectionId,
                'Dish B',
                'https://external.example.test/b.jpg'
            );
            await insertDish(tx, listing.id, sectionId, 'Dish C', null);
            const at = new Date('2026-10-19T12:00:00.000Z');

            const result = await listingPurgeModel.purgeListingContent({
                tx,
                vertical: 'gastronomy',
                listingId: listing.id,
                at
            });
            const storedMedia = await tx.execute(
                sql<{
                    id: string;
                    public_id: string | null;
                    remote_deletion_pending_at: Date | null;
                    is_featured: boolean;
                }>`SELECT id, public_id, remote_deletion_pending_at, is_featured FROM gastronomy_media WHERE gastronomy_id = ${listing.id}`
            );
            const storedMediaOrdered = storedMedia.rows
                .map((row) => ({
                    mediaId: String(row.id),
                    publicId: row.public_id,
                    markedAt:
                        row.remote_deletion_pending_at === null
                            ? null
                            : new Date(String(row.remote_deletion_pending_at)),
                    isFeatured: row.is_featured
                }))
                .sort((a, b) => String(a.publicId).localeCompare(String(b.publicId)));
            const expected = [
                { mediaId: galleryId, publicId: 'remote/gallery' },
                {
                    mediaId: storedMediaOrdered.find((row) => row.publicId === 'remote/dish-a')!
                        .mediaId,
                    publicId: 'remote/dish-a'
                },
                {
                    mediaId: storedMediaOrdered.find((row) => row.publicId === 'remote/menu-file')!
                        .mediaId,
                    publicId: 'remote/menu-file'
                }
            ].sort((a, b) => a.publicId.localeCompare(b.publicId));

            expect(
                [...result.markedMedia].sort((a, b) =>
                    String(a.publicId).localeCompare(String(b.publicId))
                )
            ).toEqual(expected);
            expect(storedMediaOrdered).toEqual(
                expected.map((row) => ({
                    ...row,
                    markedAt: at,
                    isFeatured: false
                }))
            );
            const storedListing = await tx.execute(
                sql<{
                    menu_file_url: string | null;
                    menu_file_public_id: string | null;
                    menu_file_kind: string | null;
                    videos: unknown;
                }>`SELECT menu_file_url, menu_file_public_id, menu_file_kind, videos FROM gastronomies WHERE id = ${listing.id}`
            );
            expect(storedListing.rows).toEqual([
                {
                    menu_file_url: null,
                    menu_file_public_id: null,
                    menu_file_kind: null,
                    videos: null
                }
            ]);
            const remainingItems = await tx.execute(
                sql`SELECT id FROM gastronomy_menu_items WHERE gastronomy_id = ${listing.id}`
            );
            const remainingSections = await tx.execute(
                sql`SELECT id FROM gastronomy_menu_sections WHERE gastronomy_id = ${listing.id}`
            );
            expect(remainingItems.rows).toEqual([]);
            expect(remainingSections.rows).toEqual([]);
            expect(
                (await readMarkedPages(tx))
                    .filter((row) =>
                        storedMedia.rows.some((media) => String(media.id) === row.mediaId)
                    )
                    .map((row) => row.mediaId)
                    .sort()
            ).toEqual(expected.map((row) => row.mediaId).sort());
            const menuMedia = storedMedia.rows.find((row) => row.public_id === 'remote/menu-file')!;
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical: 'gastronomy',
                    mediaId: String(menuMedia.id)
                })
            ).toBe(true);
        });
    });

    it('preserves the menu file and dish photo of another gastronomy owned by the same user', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, owner.id, destination.id);
            await seedMenuFileAndVideos(tx, listing.id);
            const sectionId = await insertSection(tx, listing.id);
            await insertDish(
                tx,
                listing.id,
                sectionId,
                'Witness dish',
                'https://cdn.example.test/witness.jpg',
                'remote/witness-dish'
            );

            const stored = await tx.execute(sql<{
                menu_file_public_id: string | null;
                photo_public_id: string | null;
            }>`SELECT g.menu_file_public_id, i.photo_public_id
                FROM gastronomies g JOIN gastronomy_menu_items i ON i.gastronomy_id = g.id
                WHERE g.id = ${listing.id}`);
            expect(stored.rows).toEqual([
                {
                    menu_file_public_id: 'remote/menu-file',
                    photo_public_id: 'remote/witness-dish'
                }
            ]);
        });
    });

    it('keeps the existing gallery-only marking path when no menu file or dish photos exist', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, owner.id, destination.id);
            const galleryId = await insertGalleryPhoto(tx, listing.id);
            const at = new Date('2026-10-19T12:00:00.000Z');

            const result = await listingPurgeModel.purgeListingContent({
                tx,
                vertical: 'gastronomy',
                listingId: listing.id,
                at
            });

            expect(result.markedMedia).toEqual([
                { mediaId: galleryId, publicId: 'remote/gallery' }
            ]);
        });
    });
});
