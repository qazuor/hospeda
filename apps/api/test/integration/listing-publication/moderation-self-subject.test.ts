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
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
const table = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
} as const;
const segment = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
} as const;
const permissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.LISTING_MODERATE
];

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe.each(
    verticals
)('TEST:V5:8 TEST:1691:3 action 12 refuses the owner moderating their own listing — %s', (vertical) => {
    it('refuses owner REQUEST_FIX without writes and allows another admin', async () => {
        const owner = await createOwner();
        const admin = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED,
                      complete: false
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED
                  });
        const path = `/api/v1/admin/${segment[vertical]}/${listingId}/moderate`;
        const body = {
            action: 'REQUEST_FIX',
            reason: 'Please update this listing',
            suggestedDate: '2026-10-20'
        };
        const before = await getDb().execute(
            sql`SELECT publication_status AS status, (SELECT count(*) FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${listingId} AND closed_at IS NULL) AS requests, (SELECT count(*) FROM email_outbox WHERE recipient_user_id = ${owner.id}::uuid) AS mail, (SELECT count(*) FROM domain_event WHERE entity_id = ${listingId}) AS events FROM ${sql.identifier(table[vertical])} WHERE id = ${listingId}::uuid`
        );
        const denied = await readResponse(
            await app.request(path, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: actorHeaders({ id: owner.id, role: RoleEnum.ADMIN, permissions })
            })
        );
        expect(denied.status).toBe(403);
        expect(denied.body.error?.code).toBe('FORBIDDEN');
        const after = await getDb().execute(
            sql`SELECT publication_status AS status, (SELECT count(*) FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${listingId} AND closed_at IS NULL) AS requests, (SELECT count(*) FROM email_outbox WHERE recipient_user_id = ${owner.id}::uuid) AS mail, (SELECT count(*) FROM domain_event WHERE entity_id = ${listingId}) AS events FROM ${sql.identifier(table[vertical])} WHERE id = ${listingId}::uuid`
        );
        expect(after.rows).toEqual(before.rows);
        const accepted = await readResponse(
            await app.request(path, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: actorHeaders({ id: admin.id, role: RoleEnum.ADMIN, permissions })
            })
        );
        expect(accepted.status).toBe(200);
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table[vertical])} SET deleted_at = now() WHERE id = ${listingId}::uuid`
        );
    });
    it('returns 404 for an absent listing before actor equals subject', async () => {
        const owner = await createOwner();
        const response = await readResponse(
            await app.request(`/api/v1/admin/${segment[vertical]}/${randomUUID()}/moderate`, {
                method: 'POST',
                body: JSON.stringify({ action: 'TAKE_DOWN', reason: 'review' }),
                headers: actorHeaders({ id: owner.id, role: RoleEnum.ADMIN, permissions })
            })
        );
        expect(response.status).toBe(404);
    });
});
