import { randomUUID } from 'node:crypto';
import { getDb } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
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

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
const plural = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
} as const;
const table = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
} as const;
function path(vertical: (typeof verticals)[number], id: string) {
    return `/api/v1/admin/${plural[vertical]}/${id}/moderation`;
}
function headers(id: string, permissions: PermissionEnum[] = [PermissionEnum.LISTING_MODERATE]) {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
    });
}
async function makeListing(
    vertical: (typeof verticals)[number],
    ownerId: string,
    destinationId: string
) {
    return vertical === VerticalEnum.ACCOMMODATION
        ? createListing({ ownerId, destinationId, status: PublicationStatusEnum.PUBLISHED })
        : createVerticalListing({
              vertical,
              ownerId,
              destinationId,
              status: PublicationStatusEnum.PUBLISHED
          });
}
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:1760:1 moderation state GET — %s', (vertical) => {
    it('orders permission, id and row checks, then reports open and closed request state', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await createOwner();
        const admin = await createOwner();
        const destinationId = await createVerticalDestination();
        const id = await makeListing(vertical, owner.id, destinationId);
        expect(
            (
                await readResponse(
                    await app.request(path(vertical, id), { headers: { 'user-agent': 'vitest' } })
                )
            ).status
        ).toBe(401);
        const denied = await readResponse(
            await app.request(path(vertical, randomUUID()), { headers: headers(admin.id, []) })
        );
        expect(denied.status).toBe(403);
        expect(
            (
                await readResponse(
                    await app.request(path(vertical, 'bad-id'), { headers: headers(admin.id) })
                )
            ).status
        ).toBe(400);
        expect(
            (
                await readResponse(
                    await app.request(path(vertical, randomUUID()), { headers: headers(admin.id) })
                )
            ).status
        ).toBe(404);
        const deletedId = await makeListing(vertical, owner.id, destinationId);
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table[vertical])} SET deleted_at = now() WHERE id = ${deletedId}::uuid`
        );
        expect(
            (
                await readResponse(
                    await app.request(path(vertical, deletedId), { headers: headers(admin.id) })
                )
            ).status
        ).toBe(404);
        const initial = await readResponse(
            await app.request(path(vertical, id), { headers: headers(admin.id) })
        );
        expect(initial.status).toBe(200);
        expect(initial.body.data).toEqual({ publicationStatus: 'PUBLISHED', fixRequest: null });
        const request = await readResponse(
            await app.request(`/api/v1/admin/${plural[vertical]}/${id}/moderate`, {
                method: 'POST',
                headers: { ...headers(admin.id), 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'REQUEST_FIX',
                    reason: 'Please repair the listing',
                    suggestedDate: '2026-11-01'
                })
            })
        );
        expect(request.status).toBe(200);
        const opened = await readResponse(
            await app.request(path(vertical, id), { headers: headers(admin.id) })
        );
        const fixRequest = (
            opened.body.data! as unknown as {
                fixRequest: {
                    reason: string;
                    suggestedDate: string | null;
                    openedAt: string;
                    ownerReportedFixedAt: string | null;
                };
            }
        ).fixRequest;
        expect(opened.status).toBe(200);
        expect(fixRequest.reason).toBe('Please repair the listing');
        expect(fixRequest.suggestedDate).toBe('2026-11-01');
        expect(typeof fixRequest.openedAt).toBe('string');
        expect(new Date(fixRequest.openedAt).toISOString()).toBe(fixRequest.openedAt);
        expect(fixRequest.ownerReportedFixedAt).toBe(null);
        const close = await readResponse(
            await app.request(`/api/v1/admin/${plural[vertical]}/${id}/moderate`, {
                method: 'POST',
                headers: { ...headers(admin.id), 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'CLOSE_FIX_REQUEST', reason: 'Resolved' })
            })
        );
        expect(close.status).toBe(200);
        const closed = await readResponse(
            await app.request(path(vertical, id), { headers: headers(admin.id) })
        );
        expect(closed.body.data).toEqual({ publicationStatus: 'PUBLISHED', fixRequest: null });
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table[vertical])} SET publication_status = 'PURGED' WHERE id = ${id}::uuid`
        );
        const purged = await readResponse(
            await app.request(path(vertical, id), { headers: headers(admin.id) })
        );
        expect(purged.body.data).toEqual({ publicationStatus: 'PURGED', fixRequest: null });
    });
});
