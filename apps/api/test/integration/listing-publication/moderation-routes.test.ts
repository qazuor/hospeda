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
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
function listingPath(vertical: (typeof verticals)[number], id: string) {
    const segment: Readonly<Record<(typeof verticals)[number], string>> = {
        [VerticalEnum.ACCOMMODATION]: 'accommodations',
        [VerticalEnum.VENUE]: 'gastronomies',
        [VerticalEnum.EXPERIENCE]: 'experiences'
    };
    return `/api/v1/admin/${segment[vertical]}/${id}/moderate`;
}
function adminPermissions(...permissions: PermissionEnum[]) {
    return [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN, ...permissions];
}
async function makeListing(
    vertical: (typeof verticals)[number],
    ownerId: string,
    destinationId: string
) {
    switch (vertical) {
        case VerticalEnum.ACCOMMODATION:
            return createListing({
                ownerId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED,
                complete: false
            });
        case VerticalEnum.VENUE:
            return createVerticalListing({
                vertical,
                ownerId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED
            });
        case VerticalEnum.EXPERIENCE:
            return createVerticalListing({
                vertical,
                ownerId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED
            });
        default: {
            const exhaustive: never = vertical;
            throw new Error(`Unsupported listing vertical ${exhaustive}`);
        }
    }
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V6:12 moderation HTTP — %s', (vertical) => {
    it('TEST:V6:12 enforces action 13 permission and validates bodies', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await createOwner();
        const admin = await createOwner();
        const destinationId = await createVerticalDestination();
        const id = await makeListing(vertical, owner.id, destinationId);
        const path = listingPath(vertical, id);
        const body = {
            action: 'REQUEST_FIX',
            reason: 'Please update the listing',
            suggestedDate: '2026-10-20'
        };

        const noSession = await readResponse(
            await app.request(path, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
            })
        );
        expect(noSession.status, JSON.stringify(noSession.body)).toBe(401);
        const legacyPermission: Readonly<Record<(typeof verticals)[number], PermissionEnum>> = {
            [VerticalEnum.ACCOMMODATION]: PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
            [VerticalEnum.VENUE]: PermissionEnum.GASTRONOMY_MODERATION_CHANGE,
            [VerticalEnum.EXPERIENCE]: PermissionEnum.EXPERIENCE_MODERATION_CHANGE
        };
        const denied = await readResponse(
            await app.request(path, {
                method: 'POST',
                body: JSON.stringify({ action: 'TAKE_DOWN', reason: 'x' }),
                headers: actorHeaders({
                    id: admin.id,
                    role: RoleEnum.ADMIN,
                    permissions: adminPermissions(legacyPermission[vertical])
                })
            })
        );
        expect(denied.status).toBe(403);
        const invalid = await readResponse(
            await app.request(path, {
                method: 'POST',
                body: JSON.stringify({ action: 'TAKE_DOWN', reason: '' }),
                headers: actorHeaders({
                    id: admin.id,
                    role: RoleEnum.ADMIN,
                    permissions: adminPermissions(PermissionEnum.LISTING_MODERATE)
                })
            })
        );
        expect(invalid.status).toBe(400);
        const missing = await readResponse(
            await app.request(listingPath(vertical, randomUUID()), {
                method: 'POST',
                body: JSON.stringify(body),
                headers: actorHeaders({
                    id: admin.id,
                    role: RoleEnum.ADMIN,
                    permissions: adminPermissions(PermissionEnum.LISTING_MODERATE)
                })
            })
        );
        expect(missing.status).toBe(404);

        const softDeletedId = await makeListing(vertical, owner.id, destinationId);
        const table: Readonly<Record<(typeof verticals)[number], string>> = {
            [VerticalEnum.ACCOMMODATION]: 'accommodations',
            [VerticalEnum.VENUE]: 'venues',
            [VerticalEnum.EXPERIENCE]: 'experiences'
        };
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table[vertical])} SET deleted_at = now() WHERE id = ${softDeletedId}::uuid`
        );
        const softDeleted = await readResponse(
            await app.request(listingPath(vertical, softDeletedId), {
                method: 'POST',
                body: JSON.stringify({ action: 'TAKE_DOWN', reason: 'Review' }),
                headers: actorHeaders({
                    id: admin.id,
                    role: RoleEnum.ADMIN,
                    permissions: adminPermissions(PermissionEnum.LISTING_MODERATE)
                })
            })
        );
        expect(softDeleted.status).toBe(404);

        for (const [index, gesture] of [
            { action: 'REQUEST_FIX', reason: 'Fix this', suggestedDate: '2026-10-20' },
            { action: 'TAKE_DOWN', reason: 'Policy violation' },
            { action: 'LIFT', reason: 'Review complete', keepFixRequest: true },
            { action: 'CLOSE_FIX_REQUEST', reason: 'Resolved' }
        ].entries()) {
            const response = await readResponse(
                await app.request(path, {
                    method: 'POST',
                    body: JSON.stringify(gesture),
                    headers: actorHeaders({
                        id: admin.id,
                        role: RoleEnum.ADMIN,
                        permissions: adminPermissions(PermissionEnum.LISTING_MODERATE)
                    })
                })
            );
            expect(response.status).toBe(200);
            const outbox = await getDb().execute(
                sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${owner.id}::uuid AND template LIKE 'verticals.listing-%'`
            );
            expect(outbox.rows).toHaveLength(index + 1);
            if (gesture.action === 'TAKE_DOWN') {
                const repeated = await readResponse(
                    await app.request(path, {
                        method: 'POST',
                        body: JSON.stringify(gesture),
                        headers: actorHeaders({
                            id: admin.id,
                            role: RoleEnum.ADMIN,
                            permissions: adminPermissions(PermissionEnum.LISTING_MODERATE)
                        })
                    })
                );
                expect(repeated.status).toBe(409);
            }
        }
    });
});
