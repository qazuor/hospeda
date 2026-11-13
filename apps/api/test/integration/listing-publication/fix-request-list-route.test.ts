import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock, systemClock } from '../../../src/utils/clock';
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
type ListingVertical = (typeof verticals)[number];
const segments: Readonly<Record<ListingVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};
const tables: Readonly<Record<ListingVertical, string>> = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
};
const owners: string[] = [];
const listingIds: string[] = [];
const fixIds: string[] = [];
let routeNow = new Date();

async function createListingFor(
    vertical: ListingVertical
): Promise<{ vertical: ListingVertical; ownerId: string; listingId: string }> {
    await ensurePublicationCatalog(vertical);
    const owner = await createOwner();
    owners.push(owner.id);
    const destinationId = await createVerticalDestination();
    const status = PublicationStatusEnum.PUBLISHED;
    let listingId: string;
    switch (vertical) {
        case VerticalEnum.ACCOMMODATION:
            listingId = await createListing({
                ownerId: owner.id,
                destinationId,
                status,
                complete: false
            });
            break;
        case VerticalEnum.VENUE:
        case VerticalEnum.EXPERIENCE:
            listingId = await createVerticalListing({
                vertical,
                ownerId: owner.id,
                destinationId,
                status
            });
            break;
        default: {
            const exhaustive: never = vertical;
            throw new Error(`Unsupported vertical ${String(exhaustive)}`);
        }
    }
    listingIds.push(listingId);
    return { vertical, ownerId: owner.id, listingId };
}

async function adminPost(
    vertical: ListingVertical,
    listingId: string,
    action: 'REQUEST_FIX' | 'CLOSE_FIX_REQUEST',
    suggestedDate?: string
) {
    const admin = await createOwner();
    owners.push(admin.id);
    const response = await app.request(
        `/api/v1/admin/${segments[vertical]}/${listingId}/moderate`,
        {
            method: 'POST',
            body: JSON.stringify({
                action,
                reason: 'Update listing details',
                ...(suggestedDate ? { suggestedDate } : {})
            }),
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
}

async function openRequest(vertical: ListingVertical, suggestedDate?: string) {
    const listing = await createListingFor(vertical);
    await adminPost(vertical, listing.listingId, 'REQUEST_FIX', suggestedDate);
    const result = await getDb().execute(
        sql<{
            id: string;
        }>`SELECT id FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${listing.listingId}::uuid AND closed_at IS NULL`
    );
    const fixRequestId = result.rows[0]?.id;
    if (!fixRequestId) throw new Error('The moderation route did not open a fix request');
    fixIds.push(String(fixRequestId));
    return { ...listing, fixRequestId: String(fixRequestId) };
}

async function expectedItem(fixture: Awaited<ReturnType<typeof openRequest>>, today: string) {
    const result =
        await getDb().execute(sql`SELECT fr.entity_type AS vertical, fr.entity_id::text AS "listingId",
        l.name AS "listingName", l.slug AS "listingSlug", l.publication_status AS "publicationStatus",
        fr.reason, fr.suggested_date AS "suggestedDate", fr.opened_at AS "openedAt",
        fr.owner_reported_fixed_at AS "ownerReportedFixedAt"
        FROM fix_request fr JOIN ${sql.identifier(tables[fixture.vertical])} l ON l.id = fr.entity_id
        WHERE fr.id = ${fixture.fixRequestId}::uuid`);
    const row = result.rows[0] as unknown as {
        vertical: ListingVertical;
        listingId: string;
        listingName: string;
        listingSlug: string;
        publicationStatus: string;
        reason: string;
        suggestedDate: string | null;
        openedAt: Date;
        ownerReportedFixedAt: Date | null;
    };
    const openedAt = new Date(row.openedAt);
    const openedDate = getLocalDateString({ instant: openedAt });
    const [oy, om, od] = openedDate.split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    return {
        fixRequestId: fixture.fixRequestId,
        vertical: row.vertical,
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        publicationStatus: row.publicationStatus,
        reason: row.reason,
        suggestedDate: row.suggestedDate,
        overdue: row.suggestedDate !== null && row.suggestedDate < today,
        ageDays: (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(oy!, om! - 1, od!)) / 86_400_000,
        openedAt: openedAt.toISOString(),
        ownerReportedFixedAt: row.ownerReportedFixedAt
            ? new Date(row.ownerReportedFixedAt).toISOString()
            : null
    };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(() => {
    routeNow = new Date(Date.now() + 86_400_000);
    injectClock({ clock: { now: () => routeNow } });
});

afterEach(async () => {
    injectClock({ clock: systemClock });
    const ids = owners.splice(0);
    if (ids.length > 0) {
        const list = sql.param(ids);
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${list}::uuid[])`
        );
        for (const table of Object.values(tables))
            await getDb().execute(
                sql`UPDATE ${sql.identifier(table)} SET deleted_at = now() WHERE owner_id = ANY(${list}::uuid[]) AND deleted_at IS NULL`
            );
    }
    const requestIds = fixIds.splice(0);
    if (requestIds.length > 0)
        await getDb().execute(
            sql`DELETE FROM fix_request WHERE id = ANY(${sql.param(requestIds)}::uuid[])`
        );
    listingIds.splice(0);
});
afterAll(async () => testDb.teardown());

describe('TEST:1704:1 admin listing fix-request list route', () => {
    it('returns only open requests in order with filters, pagination fields, and required errors', async () => {
        const fixtures: Awaited<ReturnType<typeof openRequest>>[] = [];
        for (const vertical of verticals) fixtures.push(await openRequest(vertical, '2020-01-01'));
        const venue = fixtures[1]!;
        const ownerNotice = await app.request(
            `/api/v1/protected/${segments[venue.vertical as ListingVertical]}/${venue.listingId}/fix-request/report-fixed`,
            {
                method: 'POST',
                headers: actorHeaders({ id: venue.ownerId })
            }
        );
        expect(ownerNotice.status).toBe(200);
        const closed = await openRequest(VerticalEnum.EXPERIENCE, '2020-01-01');
        await adminPost(VerticalEnum.EXPERIENCE, closed.listingId, 'CLOSE_FIX_REQUEST');
        const future = await openRequest(VerticalEnum.ACCOMMODATION, '2099-12-31');
        const listActor = await createOwner();
        owners.push(listActor.id);
        const listHeaders = actorHeaders({
            id: listActor.id,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.LISTING_MODERATE
            ]
        });
        const response = await app.request(
            '/api/v1/admin/listing-fix-requests?page=1&pageSize=100',
            { headers: listHeaders }
        );
        const body = (await response.json()) as {
            data: {
                items: Array<Record<string, unknown>>;
                pagination: {
                    page: number;
                    pageSize: number;
                    total: number;
                    totalPages: number;
                    hasNextPage: boolean;
                    hasPreviousPage: boolean;
                };
            };
            error?: { code?: string };
        };
        expect(response.status).toBe(200);
        const own = body.data.items.filter((item) => fixIds.includes(String(item.fixRequestId)));
        expect(body.data.pagination.page).toBe(1);
        expect(body.data.pagination.pageSize).toBe(100);
        expect(own).toHaveLength(4);
        const expectedIds = [
            fixtures[0]!.fixRequestId,
            fixtures[1]!.fixRequestId,
            fixtures[2]!.fixRequestId,
            future.fixRequestId
        ];
        const opened = await getDb().execute(
            sql`SELECT id::text AS id, opened_at AS "openedAt" FROM fix_request WHERE id = ANY(${sql.param(expectedIds)}::uuid[])`
        );
        const openedRows = opened.rows as unknown as { id: string; openedAt: Date }[];
        const orderedIds = [...openedRows]
            .sort(
                (a, b) =>
                    new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime() ||
                    a.id.localeCompare(b.id)
            )
            .map((item) => item.id);
        expect(own.map((item) => item.fixRequestId)).toEqual(orderedIds);
        const today = getLocalDateString({ instant: routeNow });
        const expectedItems = await Promise.all(
            [fixtures[0]!, venue, fixtures[2]!, future].map((fixture) =>
                expectedItem(fixture, today)
            )
        );
        expectedItems.sort(
            (a, b) =>
                a.openedAt.localeCompare(b.openedAt) || a.fixRequestId.localeCompare(b.fixRequestId)
        );
        expect(own).toEqual(expectedItems);
        expect(
            expectedItems.find((item) => item.fixRequestId === venue.fixRequestId)
                ?.ownerReportedFixedAt
        ).not.toBeNull();

        const venueFilter = await app.request('/api/v1/admin/listing-fix-requests?vertical=venue', {
            headers: listHeaders
        });
        const venueBody = (await venueFilter.json()) as {
            data: { items: Array<Record<string, unknown>> };
        };
        expect(
            venueBody.data.items
                .filter((item) => fixIds.includes(String(item.fixRequestId)))
                .map((item) => item.fixRequestId)
        ).toEqual([venue.fixRequestId]);
        for (const [query, expected] of [
            ['ownerReported=yes', [venue.fixRequestId]],
            [
                'ownerReported=no',
                [fixtures[0]!.fixRequestId, fixtures[2]!.fixRequestId, future.fixRequestId]
            ]
        ] as const) {
            const filtered = await app.request(`/api/v1/admin/listing-fix-requests?${query}`, {
                headers: listHeaders
            });
            const filteredBody = (await filtered.json()) as {
                data: { items: Array<Record<string, unknown>> };
            };
            expect(
                filteredBody.data.items
                    .filter((item) => fixIds.includes(String(item.fixRequestId)))
                    .map((item) => item.fixRequestId)
                    .sort()
            ).toEqual([...expected].sort());
        }
        const overdue = await app.request('/api/v1/admin/listing-fix-requests?overdue=true', {
            headers: listHeaders
        });
        const overdueBody = (await overdue.json()) as {
            data: { items: Array<Record<string, unknown>> };
        };
        expect(
            overdueBody.data.items.some((item) => item.fixRequestId === future.fixRequestId)
        ).toBe(false);

        const forbidden = await app.request('/api/v1/admin/listing-fix-requests', {
            headers: actorHeaders({
                id: listActor.id,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN]
            })
        });
        const forbiddenBody = (await forbidden.json()) as { error?: { code?: string } };
        expect(forbidden.status).toBe(403);
        expect(forbiddenBody.error?.code).toBe('FORBIDDEN');
        const invalid = await app.request('/api/v1/admin/listing-fix-requests?vertical=partner', {
            headers: listHeaders
        });
        const invalidBody = (await invalid.json()) as { error?: { code?: string } };
        expect(invalid.status).toBe(400);
        expect(invalidBody.error?.code).toBe('VALIDATION_ERROR');
    });
});
