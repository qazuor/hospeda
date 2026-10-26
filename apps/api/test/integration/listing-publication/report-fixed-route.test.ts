/**
 * TEST:V8a:7 backend half of row 30 (HOS-1492, V8a.1b, run 1, H4): the owner's
 * «ya lo corregí» button over a real fix request opened by the real moderation
 * route, in the three verticals. Every status is checked against the row read
 * back by SQL. Cleans its own rows in `afterEach`.
 */
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from './publication-routes.helpers';

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
type Vertical = (typeof verticals)[number];
const segments: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const createdOwners: string[] = [];
const createdListings: string[] = [];

async function owner(): Promise<string> {
    const created = await createOwner();
    createdOwners.push(created.id);
    return created.id;
}

async function publishedListing(vertical: Vertical, ownerId: string) {
    const destinationId = await createVerticalDestination();
    const status = PublicationStatusEnum.PUBLISHED;
    switch (vertical) {
        case VerticalEnum.ACCOMMODATION:
            return trackListing(
                await createListing({ ownerId, destinationId, status, complete: false })
            );
        case VerticalEnum.VENUE:
        case VerticalEnum.EXPERIENCE:
            return trackListing(
                await createVerticalListing({ vertical, ownerId, destinationId, status })
            );
        default: {
            const exhaustive: never = vertical;
            throw new Error(`Unsupported vertical ${String(exhaustive)}`);
        }
    }
}

function trackListing(id: string): string {
    createdListings.push(id);
    return id;
}

async function requestFix(vertical: Vertical, id: string) {
    const admin = await owner();
    const response = await app.request(`/api/v1/admin/${segments[vertical]}/${id}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REQUEST_FIX', reason: 'Actualizá el horario' }),
        headers: actorHeaders({
            id: admin,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.LISTING_MODERATE
            ]
        })
    });
    expect(response.status, await response.clone().text()).toBe(200);
}

async function report(vertical: Vertical, id: string, headers: Record<string, string>) {
    const response = await app.request(
        `/api/v1/protected/${segments[vertical]}/${id}/fix-request/report-fixed`,
        { method: 'POST', headers }
    );
    const text = await response.text();
    return {
        status: response.status,
        text,
        body: JSON.parse(text) as {
            data?: { ownerReportedFixedAt?: string };
            error?: { code?: string };
        }
    };
}

async function readFixRequests(vertical: Vertical, id: string) {
    const result = await getDb().execute(
        sql<{
            ownerReportedFixedAt: Date | null;
            closedAt: Date | null;
        }>`SELECT owner_reported_fixed_at AS "ownerReportedFixedAt", closed_at AS "closedAt" FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${id}::uuid`
    );
    return result.rows.map((row) => ({
        ownerReportedFixedAt:
            row.ownerReportedFixedAt === null
                ? null
                : new Date(String(row.ownerReportedFixedAt)).toISOString(),
        closedAt: row.closedAt
    }));
}

async function readListingFacts(vertical: Vertical, id: string) {
    const result = await getDb().execute(
        sql<{
            publicationStatus: string;
            inactiveSince: Date;
        }>`SELECT publication_status AS "publicationStatus", inactive_since AS "inactiveSince" FROM ${sql.identifier(segments[vertical])} WHERE id = ${id}::uuid`
    );
    const row = result.rows[0];
    return {
        publicationStatus: row?.publicationStatus,
        inactiveSince: new Date(String(row?.inactiveSince)).toISOString()
    };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const listingIds = createdListings.splice(0);
    if (listingIds.length > 0) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE template = 'verticals.listing-fix-reported' AND payload->>'listingId' = ANY(${sql.param(listingIds)}::text[])`
        );
    }
    const ids = createdOwners.splice(0);
    if (ids.length === 0) return;
    const list = sql.param(ids);
    await getDb().execute(
        sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${list}::uuid[])`
    );
    for (const table of Object.values(segments)) {
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table)} SET deleted_at = now() WHERE owner_id = ANY(${list}::uuid[]) AND deleted_at IS NULL`
        );
    }
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('HOS-1492 row 30 report-fixed — %s', (vertical) => {
    it('TEST:V8a:7 records the report once: a repeat answers the same instant', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const id = await publishedListing(vertical, ownerId);
        await requestFix(vertical, id);
        const before = await readListingFacts(vertical, id);

        // Act
        const first = await report(vertical, id, actorHeaders({ id: ownerId }));
        const second = await report(vertical, id, actorHeaders({ id: ownerId }));

        // Assert
        expect(first.status, first.text).toBe(200);
        expect(second.status, second.text).toBe(200);
        const reportedAt = first.body.data?.ownerReportedFixedAt;
        expect(typeof reportedAt).toBe('string');
        expect(second.body.data?.ownerReportedFixedAt).toBe(reportedAt);
        expect(await readFixRequests(vertical, id)).toEqual([
            { ownerReportedFixedAt: reportedAt, closedAt: null }
        ]);
        expect(await readListingFacts(vertical, id)).toEqual(before);
        const events = await getDb().execute(
            sql`SELECT event_type FROM domain_event WHERE entity_type = ${vertical} AND entity_id = ${id} AND event_type NOT IN ('listing.created', 'listing.fix_request_opened', 'listing.status_changed')`
        );
        expect(events.rows).toEqual([]);
    });

    it('TEST:V8a:7 answers 409 NO_OPEN_FIX_REQUEST without an open request and writes nothing', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const id = await publishedListing(vertical, ownerId);

        // Act
        const response = await report(vertical, id, actorHeaders({ id: ownerId }));

        // Assert
        expect(response.status, response.text).toBe(409);
        expect(response.body.error?.code).toBe('ALREADY_EXISTS');
        expect(response.text).toContain('NO_OPEN_FIX_REQUEST');
        expect(await readFixRequests(vertical, id)).toEqual([]);
    });

    it('answers 404 to another user and 401 to a guest, leaving the request untouched', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const stranger = await owner();
        const id = await publishedListing(vertical, ownerId);
        await requestFix(vertical, id);

        // Act
        const foreign = await report(vertical, id, actorHeaders({ id: stranger }));
        const guest = await report(vertical, id, {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        });

        // Assert
        expect(foreign.status, foreign.text).toBe(404);
        expect(guest.status, guest.text).toBe(401);
        expect(await readFixRequests(vertical, id)).toEqual([
            { ownerReportedFixedAt: null, closedAt: null }
        ]);
    });
});
