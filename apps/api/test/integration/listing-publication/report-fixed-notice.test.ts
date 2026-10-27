/** Real-route integration coverage for the staff notice sent after an owner reports a fix. */

import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    getDb,
    sql,
    userRole,
    users
} from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';
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
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const sqlTables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const createdOwners: string[] = [];
const createdListings: string[] = [];
const noticeTemplate = 'verticals.listing-fix-reported';
const reason = 'Actualizá el horario';
type NoticeRow = {
    recipientUserId: string;
    recipientEmail: string;
    template: string;
    payload: Record<string, unknown>;
    dedupKey: string;
    status: string;
};

async function makeOwner() {
    const result = await createOwner();
    createdOwners.push(result.id);
    return result;
}

async function makeSuperAdmin() {
    const admin = await makeOwner();
    await getDb().insert(userRole).values({ userId: admin.id, role: RoleEnum.SUPER_ADMIN });
    return admin;
}

async function publishedListing(vertical: Vertical, ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const status = PublicationStatusEnum.PUBLISHED;
    const id =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({ ownerId, destinationId, status, complete: false })
            : await createVerticalListing({ vertical, ownerId, destinationId, status });
    createdListings.push(id);
    return id;
}

async function moderate(vertical: Vertical, listingId: string, body: Record<string, unknown>) {
    const admin = await makeOwner();
    const response = await app.request(
        `/api/v1/admin/${segments[vertical]}/${listingId}/moderate`,
        {
            method: 'POST',
            body: JSON.stringify(body),
            headers: actorHeaders({
                id: admin.id,
                role: RoleEnum.ADMIN,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.LISTING_MODERATE
                ]
            })
        }
    );
    expect(response.status, await response.clone().text()).toBe(200);
    return admin.id;
}

async function report(vertical: Vertical, listingId: string, ownerId: string) {
    const response = await app.request(
        `/api/v1/protected/${segments[vertical]}/${listingId}/fix-request/report-fixed`,
        { method: 'POST', headers: actorHeaders({ id: ownerId }) }
    );
    const text = await response.text();
    return {
        status: response.status,
        text,
        body: JSON.parse(text) as { data?: { ownerReportedFixedAt?: string } }
    };
}

async function noticeRows(listingId: string) {
    const result = await getDb().execute(
        sql<{
            recipientUserId: string;
            recipientEmail: string;
            template: string;
            payload: Record<string, unknown>;
            dedupKey: string;
            status: string;
        }>`SELECT recipient_user_id AS "recipientUserId", recipient_email AS "recipientEmail", template, payload, dedup_key AS "dedupKey", status FROM email_outbox WHERE template = ${noticeTemplate} AND payload->>'listingId' = ${listingId}`
    );
    return result.rows as unknown as NoticeRow[];
}

async function readFixRequest(vertical: Vertical, listingId: string) {
    const result = await getDb().execute(
        sql<{
            id: string;
            reason: string;
            suggestedDate: string | null;
            openedAt: Date;
            ownerReportedFixedAt: Date | null;
        }>`SELECT id, reason, suggested_date AS "suggestedDate", opened_at AS "openedAt", owner_reported_fixed_at AS "ownerReportedFixedAt" FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${listingId}::uuid AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );
    return result.rows[0];
}

async function rowsForUser(listingId: string, userId: string) {
    return (await noticeRows(listingId)).filter((row) => row.recipientUserId === userId);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    vi.restoreAllMocks();
    const listingIds = createdListings.splice(0);
    if (listingIds.length > 0) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE template = ${noticeTemplate} AND payload->>'listingId' = ANY(${sql.param(listingIds)}::text[])`
        );
    }
    const ownerIds = createdOwners.splice(0);
    if (ownerIds.length === 0) return;
    await getDb().execute(
        sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${sql.param(ownerIds)}::uuid[])`
    );
    await getDb()
        .delete(userRole)
        .where(sql`${userRole.userId} = ANY(${sql.param(ownerIds)}::uuid[])`);
    await getDb()
        .update(users)
        .set({ deletedAt: new Date() })
        .where(sql`${users.id} = ANY(${sql.param(ownerIds)}::uuid[])`);
    for (const table of Object.values(sqlTables)) {
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table)} SET deleted_at = now() WHERE owner_id = ANY(${sql.param(ownerIds)}::uuid[]) AND deleted_at IS NULL`
        );
    }
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:1701:1 AC:1701:1 — %s', (vertical) => {
    it('sends one complete notice to this test SUPER_ADMIN after the real owner route', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await makeOwner();
        const superAdmin = await makeSuperAdmin();
        const listingId = await publishedListing(vertical, owner.id);
        const moderatorId = await moderate(vertical, listingId, { action: 'REQUEST_FIX', reason });
        const response = await report(vertical, listingId, owner.id);
        expect(response.status, response.text).toBe(200);
        const fixRequest = await readFixRequest(vertical, listingId);
        expect(fixRequest?.ownerReportedFixedAt).not.toBeNull();
        const reportedAt = new Date(String(fixRequest?.ownerReportedFixedAt)).toISOString();
        const requestedAt = new Date(String(fixRequest?.openedAt)).toISOString();
        const rows = await rowsForUser(listingId, superAdmin.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({
            recipientUserId: superAdmin.id,
            recipientEmail: superAdmin.email,
            template: noticeTemplate,
            payload: {
                vertical,
                listingId,
                ownerId: owner.id,
                fixRequestId: fixRequest?.id,
                reason,
                suggestedDate: null,
                requestedAt,
                reportedAt
            },
            dedupKey: buildEmailDedupKey({
                recipient: superAdmin.id,
                template: noticeTemplate,
                occurrence: buildEventOccurrence({ eventId: String(fixRequest?.id) })
            }),
            status: 'pending'
        });
        expect(fixRequest?.id).toBeTruthy();
        expect(response.body.data?.ownerReportedFixedAt).toBe(reportedAt);
        expect(await rowsForUser(listingId, moderatorId)).toEqual([]);
        expect(await rowsForUser(listingId, owner.id)).toEqual([]);
    });

    it('includes the suggested date from the moderation request', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await makeOwner();
        const superAdmin = await makeSuperAdmin();
        const listingId = await publishedListing(vertical, owner.id);
        await moderate(vertical, listingId, {
            action: 'REQUEST_FIX',
            reason,
            suggestedDate: '2026-11-30'
        });
        const response = await report(vertical, listingId, owner.id);
        expect(response.status, response.text).toBe(200);
        const row = (await rowsForUser(listingId, superAdmin.id))[0];
        const fixRequest = await readFixRequest(vertical, listingId);
        expect(row?.payload).toEqual({
            vertical,
            listingId,
            ownerId: owner.id,
            fixRequestId: fixRequest?.id,
            reason,
            suggestedDate: fixRequest?.suggestedDate,
            requestedAt: new Date(String(fixRequest?.openedAt)).toISOString(),
            reportedAt: new Date(String(fixRequest?.ownerReportedFixedAt)).toISOString()
        });
        expect(fixRequest?.suggestedDate).toBe('2026-11-30');
        expect(row?.payload.reportedAt).toBe(response.body.data?.ownerReportedFixedAt);
    });
});

describe.each(verticals)('TEST:1701:2 AC:1701:2 — %s', (vertical) => {
    it('keeps the owner report successful when a real database error aborts enqueue savepoint', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await makeOwner();
        await makeSuperAdmin();
        const listingId = await publishedListing(vertical, owner.id);
        const fixRequestId = await (async () => {
            await moderate(vertical, listingId, { action: 'REQUEST_FIX', reason });
            return (await readFixRequest(vertical, listingId))?.id;
        })();
        const enqueueSpy = vi
            .spyOn(emailOutboxModel, 'enqueue')
            .mockImplementation(async (_mail, tx) => {
                await (tx as DrizzleClient).execute(sql`SELECT 1/0`);
                throw new Error('unreachable');
            });
        const errorSpy = vi.spyOn(apiLogger, 'error');
        const response = await report(vertical, listingId, owner.id);
        expect(enqueueSpy).toHaveBeenCalledOnce();
        expect(response.status, response.text).toBe(200);
        const request = await readFixRequest(vertical, listingId);
        expect(request?.ownerReportedFixedAt).not.toBeNull();
        expect(response.body.data?.ownerReportedFixedAt).toBe(
            new Date(String(request?.ownerReportedFixedAt)).toISOString()
        );
        expect(await noticeRows(listingId)).toEqual([]);
        expect(errorSpy).toHaveBeenCalledOnce();
        expect(errorSpy.mock.calls[0]?.[0]).toMatchObject({ fixRequestId });
    });
});

describe.each(verticals)('TEST:1701:3 AC:1701:3 — %s', (vertical) => {
    it('deduplicates repeated reports and sends again for a newly opened request', async () => {
        await ensurePublicationCatalog(vertical);
        const owner = await makeOwner();
        const superAdmin = await makeSuperAdmin();
        const listingId = await publishedListing(vertical, owner.id);
        await moderate(vertical, listingId, { action: 'REQUEST_FIX', reason });
        const first = await report(vertical, listingId, owner.id);
        const firstRows = await rowsForUser(listingId, superAdmin.id);
        const second = await report(vertical, listingId, owner.id);
        const secondRows = await rowsForUser(listingId, superAdmin.id);
        expect(first.status, first.text).toBe(200);
        expect(second.status, second.text).toBe(200);
        expect(second.body.data?.ownerReportedFixedAt).toBe(first.body.data?.ownerReportedFixedAt);
        expect(secondRows).toHaveLength(1);
        expect(secondRows[0]?.dedupKey).toBe(firstRows[0]?.dedupKey);

        await moderate(vertical, listingId, { action: 'CLOSE_FIX_REQUEST', reason: 'Listo' });
        await moderate(vertical, listingId, { action: 'REQUEST_FIX', reason });
        const third = await report(vertical, listingId, owner.id);
        expect(third.status, third.text).toBe(200);
        const newRequestRows = await rowsForUser(listingId, superAdmin.id);
        expect(newRequestRows).toHaveLength(2);
        const ids = newRequestRows.map((row) => row.payload.fixRequestId);
        expect(new Set(ids).size).toBe(2);
    });
});
