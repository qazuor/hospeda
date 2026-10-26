import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { accommodationMedia, getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { onListingPurged } from '../../../src/utils/listing-publication/listing-purged-emitter';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const { mediaDelete } = vi.hoisted(() => ({ mediaDelete: vi.fn() }));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ delete: mediaDelete })
}));

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
const tables: Readonly<Record<(typeof verticals)[number], string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const createFixture: Readonly<
    Record<
        (typeof verticals)[number],
        (ownerId: string, destinationId: string, status: PublicationStatusEnum) => Promise<string>
    >
> = {
    [VerticalEnum.ACCOMMODATION]: (ownerId, destinationId, status) =>
        createListing({ ownerId, destinationId, status, complete: false }),
    [VerticalEnum.VENUE]: (ownerId, destinationId, status) =>
        createVerticalListing({
            vertical: VerticalEnum.VENUE,
            ownerId,
            destinationId,
            status
        }),
    [VerticalEnum.EXPERIENCE]: (ownerId, destinationId, status) =>
        createVerticalListing({ vertical: VerticalEnum.EXPERIENCE, ownerId, destinationId, status })
};
function listingPath(vertical: (typeof verticals)[number], id: string) {
    return `/api/v1/protected/${tables[vertical]}/${id}/purge`;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V6:13 PB12 owner route — %s', (vertical) => {
    it('TEST:V6:13 purges DRAFT, PUBLISHED, and MODERATED owned listings and emits after the response', async () => {
        await ensurePublicationCatalog(vertical);
        for (const status of [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.PUBLISHED,
            PublicationStatusEnum.MODERATED
        ]) {
            const owner = await createOwner();
            const destinationId = await createVerticalDestination();
            const id = await createFixture[vertical](owner.id, destinationId, status);
            let pushed: string | undefined;
            let resolvePush: ((value: string) => void) | undefined;
            const push = new Promise<string>((resolve) => {
                resolvePush = resolve;
            });
            const unsubscribe = onListingPurged(async (event) => {
                const row = await getDb().execute(
                    sql<{
                        publicationStatus: string;
                    }>`SELECT publication_status AS "publicationStatus" FROM ${sql.identifier(tables[vertical])} WHERE id = ${event.listingId}::uuid`
                );
                const status: unknown = row.rows[0]?.publicationStatus;
                pushed = typeof status === 'string' ? status : undefined;
                resolvePush?.(pushed ?? 'missing');
            });
            const response = await readResponse(
                await app.request(listingPath(vertical, id), {
                    method: 'POST',
                    headers: actorHeaders({ id: owner.id })
                })
            );
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ purged: true });
            await expect(push).resolves.toBe(PublicationStatusEnum.PURGED);
            unsubscribe();
            const again = await readResponse(
                await app.request(listingPath(vertical, id), {
                    method: 'POST',
                    headers: actorHeaders({ id: owner.id })
                })
            );
            expect(again.status).toBe(404);
            const outbox = await getDb().execute(
                sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${owner.id}::uuid AND template = 'verticals.listing-purged'`
            );
            expect(outbox.rows).toHaveLength(1);
        }
    });

    it('TEST:V6:13 conceals foreign listings from owners and action 15 admins', async () => {
        const routeSource = readFileSync(
            new URL(`../../../src/routes/${vertical}/protected/purge.ts`, import.meta.url),
            'utf8'
        );
        expect(routeSource).not.toMatch(/\bbypassPermission\b/);
        const owner = await createOwner();
        const stranger = await createOwner();
        const destinationId = await createVerticalDestination();
        const id = await createFixture[vertical](
            owner.id,
            destinationId,
            PublicationStatusEnum.DRAFT
        );
        const strangerResponse = await readResponse(
            await app.request(listingPath(vertical, id), {
                method: 'POST',
                headers: actorHeaders({ id: stranger.id })
            })
        );
        expect(strangerResponse.status).toBe(404);
        const adminResponse = await readResponse(
            await app.request(listingPath(vertical, id), {
                method: 'POST',
                headers: actorHeaders({
                    id: stranger.id,
                    role: RoleEnum.ADMIN,
                    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
                })
            })
        );
        expect(adminResponse.status).toBe(404);
        const row = await getDb().execute(
            sql<{
                publicationStatus: string;
            }>`SELECT publication_status AS "publicationStatus" FROM ${sql.identifier(tables[vertical])} WHERE id = ${id}::uuid`
        );
        expect(row.rows[0]?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
    });
});

describe('TEST:V6:13 PB12 remote media failure', () => {
    it('TEST:V6:13 returns success and leaves the marked photo when storage fails', async () => {
        await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
        const owner = await createOwner();
        const destinationId = await createVerticalDestination();
        const id = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT,
            complete: false
        });
        const [media] = await getDb()
            .insert(accommodationMedia)
            .values({
                accommodationId: id,
                url: 'https://example.test/photo.jpg',
                publicId: `failure-${randomUUID()}`,
                moderationState: 'APPROVED',
                state: 'visible',
                sortOrder: 0
            })
            .returning({ id: accommodationMedia.id });
        if (!media) throw new Error('Media fixture was not created');
        mediaDelete.mockRejectedValue(new Error('storage unavailable'));
        const response = await readResponse(
            await app.request(listingPath(VerticalEnum.ACCOMMODATION, id), {
                method: 'POST',
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(response.status).toBe(200);
        const row = await getDb().execute(
            sql<{
                pending: Date | null;
            }>`SELECT remote_deletion_pending_at AS pending FROM accommodation_media WHERE id = ${media.id}::uuid`
        );
        expect(row.rows[0]?.pending).toBeTruthy();
    });
});
