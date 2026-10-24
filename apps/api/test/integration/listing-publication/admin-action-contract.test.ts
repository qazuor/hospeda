import { getDb } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
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
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const permissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.LISTING_MODERATE,
    PermissionEnum.LISTING_PURGE_ON_REQUEST,
    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
    PermissionEnum.ACCOMMODATION_UPDATE_OWN
];
const base = '/api/v1/admin/accommodations';
const actor = async (id?: string) => {
    const actorId = id ?? (await createOwner()).id;
    return actorHeaders({ id: actorId, role: RoleEnum.ADMIN, permissions });
};
async function listing(status: PublicationStatusEnum) {
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    const id = await createListing({ ownerId: owner.id, destinationId, status, complete: false });
    return { id, ownerId: owner.id };
}
async function moderate(id: string, action: string, reason = 'Contract check') {
    return readResponse(
        await app.request(`${base}/${id}/moderate`, {
            method: 'POST',
            headers: { ...(await actor()), 'content-type': 'application/json' },
            body: JSON.stringify({
                action,
                reason,
                ...(action === 'LIFT' ? { keepFixRequest: true } : {})
            })
        })
    );
}
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe('TEST:1760:6 admin action API contract', () => {
    it('rejects repeated/open-state moderation and refuses purge/edit on PURGED or ARCHIVED', async () => {
        const { id } = await listing(PublicationStatusEnum.PUBLISHED);
        expect((await moderate(id, 'REQUEST_FIX')).status).toBe(200);
        const repeated = await moderate(id, 'REQUEST_FIX');
        expect(repeated.status).toBe(409);
        expect(repeated.body.error?.code).toBe('ALREADY_EXISTS');
        const { id: noRequestId } = await listing(PublicationStatusEnum.PUBLISHED);
        const noRequestClose = await moderate(noRequestId, 'CLOSE_FIX_REQUEST');
        expect(noRequestClose.status).toBe(409);
        expect(noRequestClose.body.error?.code).toBe('ALREADY_EXISTS');
        const { id: moderatedId } = await listing(PublicationStatusEnum.MODERATED);
        expect((await moderate(moderatedId, 'REQUEST_FIX')).status).toBe(200);
        const moderatedClose = await moderate(moderatedId, 'CLOSE_FIX_REQUEST');
        expect(moderatedClose.status).toBe(409);
        expect(moderatedClose.body.error?.code).toBe('ALREADY_EXISTS');
        const { id: purgedId, ownerId: purgedOwnerId } = await listing(
            PublicationStatusEnum.PUBLISHED
        );
        await getDb().execute(
            sql`UPDATE accommodations SET publication_status = 'PURGED' WHERE id = ${purgedId}::uuid`
        );
        const purgedHeaders = { ...(await actor()), 'content-type': 'application/json' };
        const purge = await readResponse(
            await app.request(`${base}/${purgedId}/purge`, {
                method: 'POST',
                headers: purgedHeaders,
                body: JSON.stringify({ reason: 'Owner asked' })
            })
        );
        expect(purge.status).toBe(404);
        expect(purge.body.error?.code).toBe('NOT_FOUND');
        const purgedPatch = await readResponse(
            await app.request(`${base}/${purgedId}`, {
                method: 'PATCH',
                headers: { ...(await actor(purgedOwnerId)), 'content-type': 'application/json' },
                body: JSON.stringify({ summary: 'A sufficiently long updated summary.' })
            })
        );
        expect(purgedPatch.status).toBe(404);
        expect(purgedPatch.body.error?.code).toBe('NOT_FOUND');
        const { id: archivedId, ownerId: archivedOwnerId } = await listing(
            PublicationStatusEnum.ARCHIVED
        );
        const archivedPatch = await readResponse(
            await app.request(`${base}/${archivedId}`, {
                method: 'PATCH',
                headers: { ...(await actor(archivedOwnerId)), 'content-type': 'application/json' },
                body: JSON.stringify({ summary: 'A sufficiently long updated summary.' })
            })
        );
        expect(archivedPatch.status).toBe(404);
        expect(archivedPatch.body.error?.code).toBe('NOT_FOUND');
        const { id: noOpenModeratedId } = await listing(PublicationStatusEnum.MODERATED);
        expect((await moderate(noOpenModeratedId, 'REQUEST_FIX')).status).toBe(200);
    });
});
