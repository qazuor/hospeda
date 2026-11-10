/**
 * TEST:7.3:5 (AC:7:8 and AC:7:1 — register, email and public page) — the real
 * chain for a third party's business-line change (ACC:27, HOS-1875).
 *
 * Action 15 rejects `businessLines`, so the only path a support member or admin
 * has is the dedicated route gated by `VENUE_EDIT_ALL`. This file drives the
 * real app, the real listing-access chain, the real service transaction, the
 * real `email_outbox` and the public venue read, against the migrated database.
 *
 * The helpers mirror `support-edit-route.test.ts` on purpose; that file is large
 * and this is a different action.
 */

import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { trans } from '@repo/i18n';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
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
 * trial so steps 5 (coverage) and 6 (`edit_venue_info`) pass. The trial floor is
 * what permits an edit on a non-draft listing.
 */
async function seedPublishedVenue(ownerId: string): Promise<{ id: string; slug: string }> {
    const destinationId = await createVerticalDestination();
    const id = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    await getDb().execute(
        sql`UPDATE venues SET type = 'RESTAURANT', business_lines = ARRAY['food']::text[] WHERE id = ${id}::uuid`
    );
    const rows = await getDb().execute(sql`SELECT slug FROM venues WHERE id = ${id}::uuid`);
    return { id, slug: (rows.rows[0] as { slug: string }).slug };
}

/** Makes sure the venue catalog and an active trial exist for the owner. */
async function seedOwnerCoverage(ownerId: string): Promise<void> {
    await ensurePublicationCatalog(VerticalEnum.VENUE);
    await createTrial({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        status: 'TRIAL_ACTIVE'
    });
}

async function storedBusinessLines(id: string): Promise<readonly string[]> {
    const rows = await getDb().execute(
        sql`SELECT business_lines AS lines FROM venues WHERE id = ${id}::uuid`
    );
    return (rows.rows[0] as { lines: readonly string[] }).lines;
}

async function adminEditedEvents(id: string) {
    const rows = await getDb().execute(
        sql`SELECT actor_id AS "actorId", reason, changes FROM domain_event WHERE entity_id = ${id} AND actor_type = 'admin' AND event_type = 'listing.edited' ORDER BY occurred_at`
    );
    return rows.rows as { actorId: string; reason: string | null; changes: unknown }[];
}

async function businessLinesEmails(ownerId: string) {
    const rows = await getDb().execute(
        sql`SELECT payload FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = 'verticals.listing-business-lines-changed'`
    );
    return rows.rows as { payload: Record<string, unknown> }[];
}

async function supportEmails(ownerId: string) {
    const rows = await getDb().execute(
        sql`SELECT payload FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = 'verticals.listing-content-edited-by-support'`
    );
    return rows.rows;
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
        // The trial row is never deleted (a trigger forbids it, "single for
        // life"); each test seeds a fresh owner, so the residue is harmless.
    }
});
afterAll(async () => testDb.teardown());

/** The dedicated route request. */
function changeBusinessLines(
    id: string,
    headers: Record<string, string>,
    body: unknown = { businessLines: ['food', 'nightlife'] }
) {
    return app.request(`/api/v1/admin/venues/${id}/business-lines`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
    });
}

describe('TEST:7.3:5 a third party changes business lines (AC:7:8)', () => {
    it('case 1: action 15 rejects businessLines and writes nothing', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act: the general admin PATCH, which runs as action 15.
        const response = await readResponse(
            await app.request(`/api/v1/admin/venues/${id}`, {
                method: 'PATCH',
                headers: adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        PermissionEnum.VENUE_EDIT_ALL,
                        PermissionEnum.VENUE_VIEW_ALL
                    ],
                    reason: encodeURIComponent(REASON)
                }),
                body: JSON.stringify({ businessLines: ['food', 'nightlife'] })
            })
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await storedBusinessLines(id)).toEqual(['food']);
        expect(await adminEditedEvents(id)).toEqual([]);
        expect(await businessLinesEmails(owner)).toEqual([]);
        expect(await supportEmails(owner)).toEqual([]);
    });

    it('case 2: editAll passes, records, emails and reflects on the public page (AC:7:1)', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id, slug } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        PermissionEnum.VENUE_EDIT_ALL,
                        PermissionEnum.VENUE_VIEW_ALL
                    ],
                    reason: encodeURIComponent(REASON)
                })
            )
        );

        // Assert: the row, the timeline and the owner's email.
        expect(response.status).toBe(200);
        expect(await storedBusinessLines(id)).toEqual(['food', 'nightlife']);

        const events = await adminEditedEvents(id);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ actorId: admin, reason: REASON });
        expect(events[0]?.changes).toEqual([
            { field: 'businessLines', old: ['food'], new: ['food', 'nightlife'] }
        ]);

        const emails = await businessLinesEmails(owner);
        expect(emails).toHaveLength(1);
        expect(emails[0]?.payload).toMatchObject({
            addedLines: [trans.es['venue.owner.businessLines.nightlife.label']],
            shownSections: [trans.es['listing.owner.editor.sectionNav.nightInfo']]
        });
        expect(await supportEmails(owner)).toEqual([]);

        // The public read, with no cache: the new line is now projected on the
        // page. The public schema does not expose `businessLines`; the line is
        // visible through what it owns — `nightInfo` is no longer absent and the
        // listing has more than one line with a present section.
        const publicResponse = await app.request(`/api/v1/public/venues/slug/${slug}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(publicResponse.status).toBe(200);
        const publicBody = (await publicResponse.json()) as {
            data: Record<string, unknown>;
        };
        expect(publicBody.data.multiLine).toBe(true);
        expect('entryKind' in publicBody.data).toBe(true);
    });

    it('case 3: only editAll, without action 15, is enough for the dedicated route', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL],
                    reason: encodeURIComponent(REASON)
                })
            )
        );

        // Assert
        expect(response.status).toBe(200);
        expect(await storedBusinessLines(id)).toEqual(['food', 'nightlife']);
    });

    it('case 4a: no session is a 401', async () => {
        // Arrange
        const owner = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act: no actor header, but a well-formed JSON body so the 401 is the
        // authentication tier's answer, not a body-shape 400.
        const response = await changeBusinessLines(id, {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        });

        // Assert
        expect(response.status).toBe(401);
    });

    it('case 4b: an admin without VENUE_EDIT_ALL is a 403', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        PermissionEnum.VENUE_VIEW_ALL
                    ],
                    reason: encodeURIComponent(REASON)
                })
            )
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await storedBusinessLines(id)).toEqual(['food']);
    });

    it('case 4c: a body with another field is a 400 (strict)', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL]
                }),
                { businessLines: ['food'], description: 'x' }
            )
        );

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('case 4d: a line the venue type does not allow is a 400 with the business-line reason', async () => {
        // Arrange: BOLICHE only admits `nightlife`. The stored row is valid
        // (BOLICHE + nightlife); the requested selection is not. The DB CHECK
        // rejects an invalid ROW, so the invalid SELECTION is what reaches the
        // service validator and answers 400.
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);
        await getDb().execute(
            sql`UPDATE venues SET type = 'BOLICHE', business_lines = ARRAY['nightlife']::text[] WHERE id = ${id}::uuid`
        );

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL]
                }),
                { businessLines: ['food'] }
            )
        );

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
        expect(response.body.error?.details).toMatchObject({
            field: 'businessLines',
            reason: 'NOT_ALLOWED_FOR_TYPE'
        });
        expect(await storedBusinessLines(id)).toEqual(['nightlife']);
    });

    it('case 4e: an unknown id is a 404', async () => {
        // Arrange
        const admin = await seedOwner();

        // Act
        const response = await changeBusinessLines(
            randomUUID(),
            adminHeaders({
                id: admin,
                permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL]
            })
        );

        // Assert
        expect(response.status).toBe(404);
    });

    it('case 5: the owner cannot use the dedicated route on her own listing', async () => {
        // Arrange
        const owner = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await changeBusinessLines(
                id,
                actorHeaders({
                    id: owner,
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_EDIT_OWN]
                })
            )
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await storedBusinessLines(id)).toEqual(['food']);
    });

    it('case 6: row 26 does not show a business-line change as a content edit', async () => {
        // Arrange: a real ACC:27 change, then the owner's row-26 read.
        const owner = await seedOwner();
        const admin = await seedOwner();
        const { id } = await seedPublishedVenue(owner);
        await seedOwnerCoverage(owner);
        const changed = await changeBusinessLines(
            id,
            adminHeaders({
                id: admin,
                permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL],
                reason: encodeURIComponent(REASON)
            })
        );
        expect(changed.status).toBe(200);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/protected/venues/${id}/support-edits`, {
                method: 'GET',
                headers: actorHeaders({
                    id: owner,
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.VENUE_EDIT_OWN]
                })
            })
        );

        // Assert: the event exists but carries no content part, so row 26 is empty.
        expect(response.status).toBe(200);
        expect((response.body.data as { items?: unknown[] }).items).toEqual([]);
    });
});
