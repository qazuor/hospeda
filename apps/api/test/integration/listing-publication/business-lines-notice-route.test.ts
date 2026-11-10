/**
 * TEST:7.3:10 (AC:7:1 — the in-app half, end to end) — the owner's
 * `BUSINESS_LINES_CHANGED` notice (HOS-1875, DEC-FAC-056).
 *
 * A third party changes a foreign venue's business lines through the real
 * dedicated route (ACC:27). The owner's listing-notices read then carries the
 * notice with the line that was added and the section it makes visible. When
 * the owner edits the lines back, the notice disappears: the last change is
 * no longer a third party's.
 *
 * The fixtures mirror `business-lines-third-party-route.test.ts` (part 2) and
 * the listing-notices read (HOS-1492); this file adds the composition.
 */

import { getDb, sql } from '@repo/db';
import {
    type ListingNoticesResponse,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    VerticalEnum
} from '@repo/schemas';
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
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const REASON = 'La dueña pidió por teléfono que le agreguemos el rubro noche';

/** Owners this file seeded; their listings and mail are removed after each test. */
const owners: string[] = [];

function adminHeaders(args: {
    readonly id: string;
    readonly permissions: readonly PermissionEnum[];
    readonly reason?: string;
}): Record<string, string> {
    const headers = actorHeaders({
        id: args.id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...args.permissions]
    });
    return args.reason === undefined ? headers : { ...headers, 'x-action-reason': args.reason };
}

async function seedOwner(): Promise<string> {
    const owner = await createOwner();
    owners.push(owner.id);
    return owner.id;
}

/**
 * A foreign venue in `PUBLISHED`, assigned `food`, whose owner is on a live
 * trial so the route's steps 5 (coverage) and 6 (`edit_venue_info`) pass.
 */
async function seedPublishedVenue(ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const id = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    await ensurePublicationCatalog(VerticalEnum.VENUE);
    await createTrial({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        status: 'TRIAL_ACTIVE'
    });
    return id;
}

async function changeBusinessLines(
    id: string,
    headers: Record<string, string>,
    body: unknown = { businessLines: ['food', 'nightlife'] }
) {
    return readResponse(
        await app.request(`/api/v1/admin/venues/${id}/business-lines`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body)
        })
    );
}

async function readBusinessLinesNotice(ownerId: string, listingId: string) {
    const response = await app.request('/api/v1/protected/publish/listing-notices/venue', {
        headers: actorHeaders({ id: ownerId })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data?: ListingNoticesResponse };
    const item = body.data?.items.find((candidate) => candidate.listingId === listingId);
    return item?.notices.find((notice) => notice.kind === 'BUSINESS_LINES_CHANGED');
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    for (const ownerId of owners.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid`
        );
        await getDb().execute(sql`DELETE FROM venues WHERE owner_id = ${ownerId}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:7.3:10 the business-lines change notice survives until the owner edits (AC:7:1)', () => {
    it('shows the third party change and hides it after the owner edits the lines', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedPublishedVenue(owner);

        // Act 1: the admin changes the lines through the dedicated route.
        const changed = await changeBusinessLines(
            id,
            adminHeaders({
                id: admin,
                permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL],
                reason: encodeURIComponent(REASON)
            })
        );

        // Assert 1: the owner's read carries the notice with its lists.
        expect(changed.status).toBe(200);
        const notice = await readBusinessLinesNotice(owner, id);
        expect(notice).toMatchObject({
            kind: 'BUSINESS_LINES_CHANGED',
            addedLines: ['nightlife'],
            removedLines: [],
            shownSections: ['nightInfo'],
            hiddenSections: []
        });
        expect(notice && 'at' in notice ? notice.at : undefined).toEqual(expect.any(String));

        // Act 2: the owner edits the lines back on her own listing.
        const ownerEdit = await readResponse(
            await app.request(`/api/v1/protected/venues/${id}`, {
                method: 'PATCH',
                headers: actorHeaders({
                    id: owner,
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.VENUE_EDIT_OWN]
                }),
                body: JSON.stringify({ businessLines: ['food'] })
            })
        );

        // Assert 2: the edit passed and the notice is gone.
        expect(ownerEdit.status).toBe(200);
        expect(await readBusinessLinesNotice(owner, id)).toBeUndefined();
    });
});
