import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from './publication-routes.helpers';

/** Identifies a listing and remote assets created for a purge integration test. */
export type PurgeAssetFixture = {
    ownerId: string;
    listingId: string;
    vertical:
        | typeof VerticalEnum.GASTRONOMY
        | typeof VerticalEnum.EXPERIENCE
        | typeof VerticalEnum.ACCOMMODATION;
    publicIds: string[];
    galleryMediaId?: string;
    sectionId?: string;
    dishIds?: string[];
};

/** Creates owned listing fixtures and records every remote id seeded by a test. */
export async function createPurgeAssetFixture(
    vertical: PurgeAssetFixture['vertical'],
    status = PublicationStatusEnum.DRAFT,
    options: { readonly includeGallery?: boolean } = {}
): Promise<PurgeAssetFixture> {
    await ensurePublicationCatalog(vertical);
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    const listingId =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({ ownerId: owner.id, destinationId, status, complete: false })
            : await createVerticalListing({
                  vertical,
                  ownerId: owner.id,
                  destinationId,
                  status,
                  complete: false
              });
    const fixture: PurgeAssetFixture = { ownerId: owner.id, listingId, vertical, publicIds: [] };
    const galleryPublicId = `${listingId}:gallery`;
    if (options.includeGallery !== false) fixture.publicIds.push(galleryPublicId);
    if (vertical === VerticalEnum.ACCOMMODATION && options.includeGallery !== false) {
        await getDb().execute(sql`INSERT INTO accommodation_media (accommodation_id, url, public_id, sort_order)
            VALUES (${listingId}::uuid, ${`https://assets.example/${galleryPublicId}`}, ${galleryPublicId}, 0)`);
    } else if (vertical === VerticalEnum.EXPERIENCE && options.includeGallery !== false) {
        await getDb().execute(sql`INSERT INTO experience_media (experience_id, url, public_id, sort_order)
            VALUES (${listingId}::uuid, ${`https://assets.example/${galleryPublicId}`}, ${galleryPublicId}, 0)`);
    } else if (vertical === VerticalEnum.GASTRONOMY) {
        if (options.includeGallery !== false) {
            const gallery = await getDb().execute(sql<{
                id: string;
            }>`INSERT INTO gastronomy_media (gastronomy_id, url, public_id, sort_order)
            VALUES (${listingId}::uuid, ${`https://assets.example/${galleryPublicId}`}, ${galleryPublicId}, 0) RETURNING id`);
            fixture.galleryMediaId = String(gallery.rows[0]?.id);
        }
        const menuPublicId = `${listingId}:menu-file`;
        fixture.publicIds.push(menuPublicId);
        const videos = [{ url: 'https://youtube.example/video', title: 'Fixture video' }];
        await getDb().execute(sql`UPDATE gastronomies SET menu_file_url = 'https://assets.example/menu.pdf',
            menu_file_public_id = ${menuPublicId}, menu_file_kind = 'pdf', videos = ${JSON.stringify(videos)}::jsonb
            WHERE id = ${listingId}::uuid`);
        const section = await getDb().execute(sql<{
            id: string;
        }>`INSERT INTO gastronomy_menu_sections
            (gastronomy_id, name, display_order, created_by_id) VALUES (${listingId}::uuid, 'Fixture section', 0, ${owner.id}::uuid) RETURNING id`);
        fixture.sectionId = String(section.rows[0]?.id);
        const dishA = await getDb().execute(sql<{ id: string }>`INSERT INTO gastronomy_menu_items
            (section_id, gastronomy_id, name, display_order, photo_url, photo_public_id, created_by_id)
            VALUES (${fixture.sectionId}::uuid, ${listingId}::uuid, 'Dish A', 0, 'https://assets.example/dish-a.jpg', ${`${listingId}:dish-a`}, ${owner.id}::uuid) RETURNING id`);
        const dishB = await getDb().execute(sql<{ id: string }>`INSERT INTO gastronomy_menu_items
            (section_id, gastronomy_id, name, display_order, photo_url, created_by_id)
            VALUES (${fixture.sectionId}::uuid, ${listingId}::uuid, 'Dish B', 1, 'https://external.example/dish-b.jpg', ${owner.id}::uuid) RETURNING id`);
        const dishC = await getDb().execute(sql<{ id: string }>`INSERT INTO gastronomy_menu_items
            (section_id, gastronomy_id, name, display_order, created_by_id)
            VALUES (${fixture.sectionId}::uuid, ${listingId}::uuid, 'Dish C', 2, ${owner.id}::uuid) RETURNING id`);
        fixture.dishIds = [dishA.rows[0], dishB.rows[0], dishC.rows[0]].map((row) =>
            String(row?.id)
        );
        fixture.publicIds.push(`${listingId}:dish-a`);
    }
    if (vertical === VerticalEnum.EXPERIENCE) {
        const cert = await getDb().execute(sql<{ id: string }>`INSERT INTO experience_certificates
            (experience_id, recipient_name, completed_at, created_by_id)
            VALUES (${listingId}::uuid, 'Fixture recipient', '2026-10-01', ${owner.id}::uuid) RETURNING id`);
        fixture.sectionId = String(cert.rows[0]?.id);
        await getDb().execute(
            sql`UPDATE experiences SET videos = '[{"url":"https://youtube.example/video","title":"Fixture video"}]'::jsonb WHERE id = ${listingId}::uuid`
        );
    }
    if (vertical === VerticalEnum.ACCOMMODATION) {
        await getDb().execute(
            sql`UPDATE accommodations SET videos = '[{"url":"https://youtube.example/video","title":"Fixture video"}]'::jsonb WHERE id = ${listingId}::uuid`
        );
    }
    return fixture;
}

/** Removes only this fixture's pending media, listing, and owner rows. */
export async function cleanupPurgeAssetFixtures(
    fixtures: readonly PurgeAssetFixture[]
): Promise<void> {
    for (const fixture of fixtures) {
        const table =
            fixture.vertical === VerticalEnum.GASTRONOMY
                ? 'gastronomy_media'
                : fixture.vertical === VerticalEnum.EXPERIENCE
                  ? 'experience_media'
                  : 'accommodation_media';
        const fk =
            fixture.vertical === VerticalEnum.GASTRONOMY
                ? 'gastronomy_id'
                : fixture.vertical === VerticalEnum.EXPERIENCE
                  ? 'experience_id'
                  : 'accommodation_id';
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(fk)} = ${fixture.listingId}::uuid AND remote_deletion_pending_at IS NOT NULL`
        );
        const listingTable =
            fixture.vertical === VerticalEnum.GASTRONOMY
                ? 'gastronomies'
                : fixture.vertical === VerticalEnum.EXPERIENCE
                  ? 'experiences'
                  : 'accommodations';
        await getDb().execute(
            sql`UPDATE ${sql.identifier(listingTable)} SET deleted_at = now() WHERE id = ${fixture.listingId}::uuid AND deleted_at IS NULL`
        );
        await getDb().execute(
            sql`UPDATE users SET deleted_at = now() WHERE id = ${fixture.ownerId}::uuid AND deleted_at IS NULL`
        );
    }
}
