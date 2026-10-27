/**
 * TEST:V8a:9 (ACC:15, HOS-1493) through the gastronomy and experience photo and
 * FAQ admin routes: an admin with action 15 and the reason header edits a
 * foreign listing's photos and FAQ, which leaves an admin `listing.edited`
 * event carrying the reason and queues the support-edit email to the owner.
 * The owner editing her own listing through the same routes is unaffected:
 * her edit is recorded as her own act and no email is queued.
 *
 * Route gates these cases carry (pre-existing, not part of action 15): each
 * admin router gates a GET and its sibling write on the same path together, so
 * `POST /{id}/faqs` asks for the vertical's VIEW_ALL (from `getFaqs`) and
 * `POST /{id}/media` for its EDIT_ALL (from `getMedia`). The photo cases that
 * must run with action 15 alone use `PATCH /{id}/media/{mediaId}` instead.
 */
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const verticals = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;
type Vertical = (typeof verticals)[number];
const tables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const routeTables: Readonly<Record<Vertical, string>> = {
    ...tables,
    [VerticalEnum.VENUE]: 'gastronomies'
};
/** Each vertical's own permissions: edit own, edit all, view all. */
const perms: Readonly<
    Record<Vertical, { editOwn: PermissionEnum; editAll: PermissionEnum; viewAll: PermissionEnum }>
> = {
    [VerticalEnum.VENUE]: {
        editOwn: PermissionEnum.VENUE_EDIT_OWN,
        editAll: PermissionEnum.VENUE_EDIT_ALL,
        viewAll: PermissionEnum.VENUE_VIEW_ALL
    },
    [VerticalEnum.EXPERIENCE]: {
        editOwn: PermissionEnum.EXPERIENCE_EDIT_OWN,
        editAll: PermissionEnum.EXPERIENCE_EDIT_ALL,
        viewAll: PermissionEnum.EXPERIENCE_VIEW_ALL
    }
};
/** The media table and its listing column, per vertical. */
const media: Readonly<Record<Vertical, { table: string; fk: string }>> = {
    [VerticalEnum.VENUE]: { table: 'venue_media', fk: 'venue_id' },
    [VerticalEnum.EXPERIENCE]: { table: 'experience_media', fk: 'experience_id' }
};
const REASON = 'La dueña pidió que le corrijamos la foto y la pregunta frecuente';
const PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/support-photo.jpg';
const FAQ_BODY = {
    question: '¿Se puede ir con mascotas?',
    answer: 'Sí, con aviso previo a la dueña del lugar.'
};

/** Owners this file seeded; their listings and emails are removed after each test. */
const owners: string[] = [];

async function seedOwner(): Promise<string> {
    const owner = await createOwner();
    owners.push(owner.id);
    return owner.id;
}

async function seedListing(vertical: Vertical, ownerId: string): Promise<string> {
    await ensurePublicationCatalog(vertical);
    const destinationId = await createVerticalDestination();
    return createVerticalListing({
        vertical,
        ownerId,
        destinationId,
        status: PublicationStatusEnum.DRAFT
    });
}

/** A gallery photo of the listing, written straight to its table (no event). */
async function seedPhoto(vertical: Vertical, listingId: string): Promise<string> {
    const { table, fk } = media[vertical];
    const rows = await getDb().execute(
        sql`INSERT INTO ${sql.identifier(table)} (${sql.identifier(fk)}, url, sort_order) VALUES (${listingId}::uuid, ${PHOTO_URL}, 0) RETURNING id`
    );
    return (rows.rows[0] as { id: string }).id;
}

function adminHeaders(permissions: readonly PermissionEnum[], id: string) {
    return {
        ...actorHeaders({
            id,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                ...permissions
            ]
        }),
        'x-action-reason': encodeURIComponent(REASON)
    };
}

function ownerHeaders(vertical: Vertical, id: string) {
    return actorHeaders({
        id,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            perms[vertical].editOwn,
            perms[vertical].viewAll
        ]
    });
}

async function editedEvents(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT actor_type AS "actorType", actor_id AS "actorId", reason, changes FROM domain_event WHERE entity_id = ${listingId} AND event_type = 'listing.edited' ORDER BY occurred_at`
    );
    return rows.rows as {
        actorType: string;
        actorId: string;
        reason: string | null;
        changes: unknown;
    }[];
}

async function supportEmails(ownerId: string) {
    const rows = await getDb().execute(
        sql`SELECT payload FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = 'verticals.listing-content-edited-by-support'`
    );
    return rows.rows as { payload: Record<string, unknown> }[];
}

async function send(path: string, method: string, headers: Record<string, string>, body: unknown) {
    return readResponse(
        await app.request(`/api/v1/admin/${path}`, {
            method,
            headers,
            body: JSON.stringify(body)
        })
    );
}

/** The admin edit was audited as action 15 and the owner was told. */
async function expectSupportEdit(args: {
    readonly listingId: string;
    readonly ownerId: string;
    readonly adminId: string;
    readonly field: string;
}) {
    const events = await editedEvents(args.listingId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorType: 'admin', actorId: args.adminId, reason: REASON });
    expect(events[0]?.changes).toEqual([{ field: args.field }]);
    const emails = await supportEmails(args.ownerId);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.payload).toMatchObject({ listingId: args.listingId });
}

/** The owner's own edit: her own act, no reason, no email. */
async function expectOwnEdit(args: { readonly listingId: string; readonly ownerId: string }) {
    const events = await editedEvents(args.listingId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorType: 'owner', actorId: args.ownerId, reason: null });
    expect(await supportEmails(args.ownerId)).toEqual([]);
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
        for (const vertical of verticals) {
            await getDb().execute(
                sql`DELETE FROM ${sql.identifier(tables[vertical])} WHERE owner_id = ${ownerId}::uuid`
            );
        }
    }
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V8a:9 action 15 edits photos and FAQ — %s', (vertical) => {
    it('adds a photo to her listing (action 15 + edit all): admin event with the reason and an email', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);

        // Act
        const response = await send(
            `${routeTables[vertical]}/${id}/media`,
            'POST',
            adminHeaders([perms[vertical].viewAll, perms[vertical].editAll], admin),
            { url: PHOTO_URL }
        );

        // Assert
        expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
        await expectSupportEdit({ listingId: id, ownerId: owner, adminId: admin, field: 'media' });
    });

    it('corrects a photo caption with action 15 alone: admin event with the reason and an email', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);
        const mediaId = await seedPhoto(vertical, id);

        // Act
        const response = await send(
            `${routeTables[vertical]}/${id}/media/${mediaId}`,
            'PATCH',
            adminHeaders([perms[vertical].viewAll], admin),
            { caption: 'Vista del salón principal' }
        );

        // Assert
        expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
        await expectSupportEdit({ listingId: id, ownerId: owner, adminId: admin, field: 'media' });
    });

    it('adds a FAQ with action 15 alone: admin event with the reason and an email', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);

        // Act
        const response = await send(
            `${routeTables[vertical]}/${id}/faqs`,
            'POST',
            adminHeaders([perms[vertical].viewAll], admin),
            FAQ_BODY
        );

        // Assert
        expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
        await expectSupportEdit({ listingId: id, ownerId: owner, adminId: admin, field: 'faqs' });
    });

    it('the owner corrects her own photo and adds a FAQ by the same routes: her own acts, no email', async () => {
        // Arrange
        const owner = await seedOwner();
        const photoListing = await seedListing(vertical, owner);
        const faqListing = await seedListing(vertical, owner);
        const mediaId = await seedPhoto(vertical, photoListing);

        // Act
        const photo = await send(
            `${routeTables[vertical]}/${photoListing}/media/${mediaId}`,
            'PATCH',
            ownerHeaders(vertical, owner),
            { caption: 'Vista del salón principal' }
        );
        const faq = await send(
            `${routeTables[vertical]}/${faqListing}/faqs`,
            'POST',
            ownerHeaders(vertical, owner),
            FAQ_BODY
        );

        // Assert
        expect(photo.status, JSON.stringify(photo.body)).toBeLessThan(300);
        expect(faq.status, JSON.stringify(faq.body)).toBeLessThan(300);
        await expectOwnEdit({ listingId: photoListing, ownerId: owner });
        await expectOwnEdit({ listingId: faqListing, ownerId: owner });
    });

    it('refuses an approved photo from action 15 (403) and writes nothing', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);

        // Act
        const response = await send(
            `${routeTables[vertical]}/${id}/media`,
            'POST',
            adminHeaders([perms[vertical].viewAll, perms[vertical].editAll], admin),
            { url: PHOTO_URL, moderationState: 'APPROVED' }
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.message).toContain('moderationState');
        expect(await editedEvents(id)).toEqual([]);
        expect(await supportEmails(owner)).toEqual([]);
    });
});
