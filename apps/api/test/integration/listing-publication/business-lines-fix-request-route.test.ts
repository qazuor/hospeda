/**
 * TEST:7.4:1 (AC:7:4) — a REQUEST_FIX about the business lines reaches the owner
 * and does not touch the listing until the owner answers.
 *
 * REQUEST_FIX has no structured business-line field (DEC-FAC-057): a request
 * «about the lines» is a normal request whose free-text reason talks about the
 * lines. This journey drives the real moderation route against the migrated
 * database, then reads the consequence from every surface the owner sees — the
 * outbox, the in-app notices read and the stored row — and finally lets the
 * owner answer through her own editor. The positive control for «did not touch
 * the listing» is case 5: the SAME read that returned `['food']` before sees the
 * change once the owner writes it.
 *
 * The fixtures and the SQL reads mirror `business-lines-notice-route.test.ts`
 * (part 7.3) and `report-fixed-route.test.ts`; this file adds the composition.
 */

import { getDb, sql } from '@repo/db';
import {
    type ListingNoticesResponse,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    VerticalEnum
} from '@repo/schemas';
import { LISTING_FIX_REQUESTED_TEMPLATE } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from './publication-routes.helpers';

const app = initApp();
/** Neutral reason that talks about the business lines (G-FAC-R1: no food label text). */
const REASON = 'Revisá los rubros: el local abre de noche';
const BUSINESS_LINES_CHANGED_TEMPLATE = 'verticals.listing-business-lines-changed';

/** Owners this file seeded; their listings, requests and mail are removed after each test. */
const owners: string[] = [];
const listings: string[] = [];

interface ModerationBody {
    readonly data?: { readonly publicationStatus?: string; readonly fixRequestOpen?: boolean };
    readonly error?: {
        readonly code?: string;
        readonly message?: string;
        readonly details?: Record<string, unknown>;
    };
}
interface NoticesBody {
    readonly data?: ListingNoticesResponse;
}

async function seedOwner(): Promise<string> {
    const owner = await createOwner();
    owners.push(owner.id);
    return owner.id;
}

/**
 * A foreign venue in `PUBLISHED`, assigned `food`, whose owner is on a live
 * trial so the route's steps 5 (coverage) and 6 (`edit_venue_info`) pass, both
 * for the admin request and for the owner's own PATCH afterwards.
 */
async function seedPublishedVenue(ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const id = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    listings.push(id);
    await ensurePublicationCatalog(VerticalEnum.VENUE);
    await createTrial({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        status: 'TRIAL_ACTIVE'
    });
    return id;
}

async function readJson<T>(response: Response): Promise<{
    readonly status: number;
    readonly text: string;
    readonly body: T;
}> {
    const text = await response.text();
    return { status: response.status, text, body: JSON.parse(text) as T };
}

function requestFix(id: string, adminId: string, reason: string) {
    return app.request(`/api/v1/admin/venues/${id}/moderate`, {
        method: 'POST',
        headers: actorHeaders({
            id: adminId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.LISTING_MODERATE
            ]
        }),
        body: JSON.stringify({ action: 'REQUEST_FIX', reason, suggestedDate: '2026-10-20' })
    });
}

/** The listing row as any surface reads it: the stored lines and the update clock. */
async function readVenueFacts(id: string): Promise<{
    readonly businessLines: readonly string[];
    readonly updatedAt: string;
}> {
    const result = await getDb().execute(
        sql`SELECT business_lines AS "businessLines", updated_at AS "updatedAt" FROM venues WHERE id = ${id}::uuid`
    );
    const row = result.rows[0] as
        | { readonly businessLines?: readonly string[]; readonly updatedAt?: Date }
        | undefined;
    return {
        businessLines: row?.businessLines ?? [],
        updatedAt: row?.updatedAt ? new Date(String(row.updatedAt)).toISOString() : ''
    };
}

async function readFixRequests(id: string) {
    const result = await getDb().execute(
        sql`SELECT closed_at AS "closedAt", owner_reported_fixed_at AS "ownerReportedFixedAt" FROM fix_request WHERE entity_type = 'venue' AND entity_id = ${id}::uuid`
    );
    return result.rows.map((row) => ({
        closedAt: row.closedAt === null ? null : new Date(String(row.closedAt)),
        ownerReportedFixedAt:
            row.ownerReportedFixedAt === null ? null : new Date(String(row.ownerReportedFixedAt))
    }));
}

async function countEmails(ownerId: string, template: string): Promise<number> {
    const result = await getDb().execute(
        sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = ${template}`
    );
    return result.rows.length;
}

async function listingEditedEvents(id: string): Promise<readonly unknown[]> {
    // `domain_event.entity_id` is varchar, not uuid: no cast here.
    const result = await getDb().execute(
        sql`SELECT id FROM domain_event WHERE entity_type = 'venue' AND entity_id = ${id} AND event_type = 'listing.edited'`
    );
    return result.rows;
}

async function readListingItem(ownerId: string, listingId: string) {
    const response = await app.request('/api/v1/protected/publish/listing-notices/venue', {
        headers: actorHeaders({ id: ownerId })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as NoticesBody;
    return body.data?.items.find((candidate) => candidate.listingId === listingId);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const ids = listings.splice(0);
    if (ids.length > 0) {
        const list = sql.param(ids);
        await getDb().execute(
            sql`DELETE FROM fix_request WHERE entity_type = 'venue' AND entity_id = ANY(${list}::uuid[])`
        );
    }
    for (const ownerId of owners.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid`
        );
        await getDb().execute(sql`DELETE FROM venues WHERE owner_id = ${ownerId}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:7.4:1 AC:7:4 a business-lines fix request reaches the owner and leaves the listing alone', () => {
    it('opens the request, notifies the owner, leaves the row untouched, refuses a second request and lets the owner answer', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedPublishedVenue(owner);
        const before = await readVenueFacts(id);
        expect(before.businessLines).toEqual(['food']);

        // Act 1: the admin asks the owner to revisit the lines.
        const requested = await readJson<ModerationBody>(await requestFix(id, admin, REASON));

        // Assert 1: the gesture succeeded and the open request is reported.
        expect(requested.status, requested.text).toBe(200);
        expect(requested.body.data?.fixRequestOpen).toBe(true);
        expect(requested.body.data?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);

        // Assert 2: it reaches the owner — one request email, one in-app notice.
        expect(await countEmails(owner, LISTING_FIX_REQUESTED_TEMPLATE)).toBe(1);
        const asked = await readListingItem(owner, id);
        const fixNotice = asked?.notices.find((notice) => notice.kind === 'FIX_REQUESTED');
        expect(fixNotice).toMatchObject({ kind: 'FIX_REQUESTED', reason: REASON });

        // Assert 3: it does NOT modify the listing.
        const afterRequest = await readVenueFacts(id);
        expect(afterRequest.businessLines).toEqual(['food']);
        expect(afterRequest.updatedAt).toBe(before.updatedAt);
        expect(await listingEditedEvents(id)).toEqual([]);
        expect(await countEmails(owner, BUSINESS_LINES_CHANGED_TEMPLATE)).toBe(0);
        expect(asked?.notices.some((notice) => notice.kind === 'BUSINESS_LINES_CHANGED')).toBe(
            false
        );

        // Act 2 / Assert 4: a second request is refused and opens nothing new.
        const repeated = await readJson<ModerationBody>(await requestFix(id, admin, REASON));
        expect(repeated.status, repeated.text).toBe(409);
        expect(repeated.body.error?.code).toBe('ALREADY_EXISTS');
        expect(repeated.text).toContain('Fix request already open');
        expect(await readFixRequests(id)).toHaveLength(1);
        expect(await countEmails(owner, LISTING_FIX_REQUESTED_TEMPLATE)).toBe(1);

        // Act 3: the owner answers through her own editor (positive control of 3).
        const ownerEdit = await readJson<ModerationBody>(
            await app.request(`/api/v1/protected/venues/${id}`, {
                method: 'PATCH',
                headers: actorHeaders({
                    id: owner,
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.VENUE_EDIT_OWN]
                }),
                body: JSON.stringify({ businessLines: ['food', 'nightlife'] })
            })
        );
        expect(ownerEdit.status, ownerEdit.text).toBe(200);
        expect((await readVenueFacts(id)).businessLines).toEqual(['food', 'nightlife']);

        // Assert 5: editing does not close the request; only the admin closes it.
        expect(await readFixRequests(id)).toEqual([{ closedAt: null, ownerReportedFixedAt: null }]);
        const reported = await readJson<{ data?: { ownerReportedFixedAt?: string | null } }>(
            await app.request(`/api/v1/protected/venues/${id}/fix-request/report-fixed`, {
                method: 'POST',
                headers: actorHeaders({ id: owner })
            })
        );
        expect(reported.status, reported.text).toBe(200);
        const [stillOpen] = await readFixRequests(id);
        expect(stillOpen?.ownerReportedFixedAt).not.toBeNull();
        expect(stillOpen?.closedAt).toBeNull();
    });
});
