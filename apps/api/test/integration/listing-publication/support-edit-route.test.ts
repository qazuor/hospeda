import { randomUUID } from 'node:crypto';
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
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
type Vertical = (typeof verticals)[number];
const tables: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const routeTables: Readonly<Record<Vertical, string>> = {
    ...tables,
    [VerticalEnum.VENUE]: 'gastronomies'
};
/** Each vertical's own permissions: create, "edit any", and the list read its router mounts on `/`. */
const perms: Readonly<
    Record<Vertical, { create: PermissionEnum; editAny: PermissionEnum; viewAll: PermissionEnum }>
> = {
    [VerticalEnum.ACCOMMODATION]: {
        create: PermissionEnum.ACCOMMODATION_CREATE,
        editAny: PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        viewAll: PermissionEnum.ACCOMMODATION_VIEW_ALL
    },
    [VerticalEnum.VENUE]: {
        create: PermissionEnum.VENUE_CREATE,
        editAny: PermissionEnum.VENUE_EDIT_ALL,
        viewAll: PermissionEnum.VENUE_VIEW_ALL
    },
    [VerticalEnum.EXPERIENCE]: {
        create: PermissionEnum.EXPERIENCE_CREATE,
        editAny: PermissionEnum.EXPERIENCE_EDIT_ALL,
        viewAll: PermissionEnum.EXPERIENCE_VIEW_ALL
    }
};
const typeFields: Readonly<Record<Vertical, Record<string, unknown>>> = {
    [VerticalEnum.ACCOMMODATION]: { type: 'CABIN' },
    [VerticalEnum.VENUE]: { type: 'RESTAURANT' },
    [VerticalEnum.EXPERIENCE]: { type: 'EXCURSION', priceFrom: 1000, priceUnit: 'per_person' }
};
const REASON = 'La dueña pidió por teléfono que le carguemos la ficha';

/** Owners this file seeded; their listings are removed after each test. */
const owners: string[] = [];

/** A create body on behalf of `ownerId`, born a draft (ACC:15). */
function createBody(vertical: Vertical, ownerId: string, destinationId: string) {
    return {
        name: 'Ficha cargada por soporte',
        slug: `support-${randomUUID().slice(0, 8)}`,
        summary: 'Ficha creada por soporte a nombre de la dueña',
        description: 'Borrador que soporte le crea a la dueña a su pedido, sin publicar.',
        ownerId,
        destinationId,
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        ...typeFields[vertical]
    };
}

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

async function seedListing(vertical: Vertical, ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const status = PublicationStatusEnum.DRAFT;
    if (vertical === VerticalEnum.ACCOMMODATION)
        return createListing({ ownerId, destinationId, status, complete: false });
    return createVerticalListing({ vertical, ownerId, destinationId, status });
}

async function listingsOf(vertical: Vertical, ownerId: string) {
    const rows = await getDb().execute(
        sql`SELECT id, publication_status AS status, description FROM ${sql.identifier(tables[vertical])} WHERE owner_id = ${ownerId}::uuid`
    );
    return rows.rows as { id: string; status: string; description: string }[];
}

async function adminEvents(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT event_type AS "eventType", actor_id AS "actorId", reason FROM domain_event WHERE entity_id = ${listingId} AND actor_type = 'admin' ORDER BY occurred_at`
    );
    return rows.rows;
}

async function adminEditedEvents(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT actor_id AS "actorId", reason, changes FROM domain_event WHERE entity_id = ${listingId} AND actor_type = 'admin' AND event_type = 'listing.edited' ORDER BY occurred_at`
    );
    return rows.rows as { actorId: string; reason: string | null; changes: unknown }[];
}

async function supportEmails(ownerId: string) {
    const rows = await getDb().execute(
        sql`SELECT payload FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = 'verticals.listing-content-edited-by-support'`
    );
    return rows.rows as { payload: Record<string, unknown> }[];
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

describe.each(verticals)('TEST:V8a:8 action 15 creates a draft for its owner — %s', (vertical) => {
    const post = (headers: Record<string, string>, body: unknown) =>
        app.request(`/api/v1/admin/${routeTables[vertical]}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

    it('creates a DRAFT owned by her with an admin created event carrying the reason', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const body = createBody(vertical, owner, await createVerticalDestination());

        // Act
        const response = await readResponse(
            await post(
                adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        perms[vertical].viewAll
                    ],
                    reason: encodeURIComponent(REASON)
                }),
                body
            )
        );

        // Assert
        expect(response.status).toBe(201);
        const rows = await listingsOf(vertical, owner);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe(PublicationStatusEnum.DRAFT);
        expect(await adminEvents(rows[0]?.id as string)).toEqual([
            { eventType: 'listing.created', actorId: admin, reason: REASON }
        ]);
    });

    it('refuses the create for somebody else with only the vertical create permission (403)', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const body = createBody(vertical, owner, await createVerticalDestination());

        // Act
        const response = await post(
            adminHeaders({
                id: admin,
                permissions: [perms[vertical].create, perms[vertical].viewAll]
            }),
            body
        );

        // Assert
        expect(response.status).toBe(403);
        expect(await listingsOf(vertical, owner)).toEqual([]);
    });

    it('answers 404 when the owner does not exist', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const admin = await seedOwner();
        const body = createBody(vertical, randomUUID(), await createVerticalDestination());

        // Act
        const response = await post(
            adminHeaders({
                id: admin,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT, perms[vertical].viewAll]
            }),
            body
        );

        // Assert
        expect(response.status).toBe(404);
    });
});

describe.each(verticals)('TEST:V8a:9 action 15 asks for its own permission — %s', (vertical) => {
    const patch = (id: string, headers: Record<string, string>) =>
        app.request(`/api/v1/admin/${routeTables[vertical]}/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                description: 'Texto corregido por soporte a pedido de la dueña.'
            })
        });

    it('an admin with other administrative permissions but not action 15 gets "sin permiso"', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);
        const before = await listingsOf(vertical, owner);

        // Act
        const response = await readResponse(
            await patch(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [
                        perms[vertical].editAny,
                        perms[vertical].viewAll,
                        PermissionEnum.LISTING_MODERATE,
                        PermissionEnum.LISTING_PURGE_ON_REQUEST
                    ],
                    reason: 'intento'
                })
            )
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await listingsOf(vertical, owner)).toEqual(before);
        expect(await adminEvents(id)).toEqual([]);
    });

    it('refuses a malformed action reason with 400 and writes nothing', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);
        const before = await listingsOf(vertical, owner);

        // Act
        const response = await readResponse(
            await patch(
                id,
                adminHeaders({
                    id: admin,
                    // The gastronomy and experience admin routers gate on "view all" before the
                    // handler; step 3 then permits action 15 and the malformed reason
                    // is refused before any write.
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        perms[vertical].editAny,
                        perms[vertical].viewAll
                    ],
                    reason: '%E0%A4%A'
                })
            )
        );

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
        expect(await listingsOf(vertical, owner)).toEqual(before);
    });

    // Staff holding the vertical's "edit any" permission is audited the same way:
    // a foreign content edit by an administrator is action 15 (NUCLEO/08 §1.1 c3).
    it.each([
        ['only action 15', [] as PermissionEnum[]],
        ['action 15 and the vertical edit-any', [perms[vertical].editAny]]
    ])('with %s and the reason header: 200, admin event with the reason and an email to her', async (_label, extra) => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);

        // Act
        const response = await readResponse(
            await patch(
                id,
                adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        perms[vertical].viewAll,
                        ...extra
                    ],
                    reason: encodeURIComponent(REASON)
                })
            )
        );

        // Assert
        expect(response.status).toBe(200);
        const rows = await listingsOf(vertical, owner);
        expect(rows[0]?.status).toBe(PublicationStatusEnum.DRAFT);
        expect(rows[0]?.description).toBe('Texto corregido por soporte a pedido de la dueña.');
        const events = await adminEditedEvents(id);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ actorId: admin, reason: REASON });
        expect(events[0]?.changes).toEqual([{ field: 'description' }]);
        const emails = await supportEmails(owner);
        expect(emails).toHaveLength(1);
        expect(emails[0]?.payload).toMatchObject({ listingId: id });
    });

    it('with only action 15, a field that is not content is refused (403) and nothing is written', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);
        const before = await listingsOf(vertical, owner);

        // Act
        const response = await app.request(`/api/v1/admin/${routeTables[vertical]}/${id}`, {
            method: 'PATCH',
            headers: adminHeaders({
                id: admin,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT, perms[vertical].viewAll],
                reason: encodeURIComponent(REASON)
            }),
            // Not content on purpose (the public URL), and still accepted by the
            // admin update schema of the three verticals: the refusal is action
            // 15's, not Zod's. (The old probe, `visibility`, left with HOS-1641.)
            body: JSON.stringify({ refreshSlugFromName: true })
        });

        // Assert
        expect(response.status).toBe(403);
        expect(await listingsOf(vertical, owner)).toEqual(before);
        expect(await adminEditedEvents(id)).toEqual([]);
        expect(await supportEmails(owner)).toEqual([]);
    });
});

describe('TEST:V8a:9 action 15 reaches an accommodation sub-entity route', () => {
    it('adds a FAQ to her listing: admin event with the reason and an email to her', async () => {
        // Arrange
        const vertical = VerticalEnum.ACCOMMODATION;
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const id = await seedListing(vertical, owner);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/admin/accommodations/${id}/faqs`, {
                method: 'POST',
                headers: adminHeaders({
                    id: admin,
                    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT],
                    reason: encodeURIComponent(REASON)
                }),
                body: JSON.stringify({
                    question: '¿Se admiten mascotas en la cabaña?',
                    answer: 'Sí, con aviso previo a la dueña de la cabaña.'
                })
            })
        );

        // Assert
        expect(response.status).toBeLessThan(300);
        const events = await adminEditedEvents(id);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ actorId: admin, reason: REASON });
        expect(await supportEmails(owner)).toHaveLength(1);
    });
});

describe.each(verticals)('TEST:V8a:8 row 26 read — %s', (vertical) => {
    it('the owner reads the support edit with its parts; anybody else gets 404', async () => {
        // Arrange: support creates her listing; she then edits it herself.
        await ensurePublicationCatalog(vertical);
        const owner = await seedOwner();
        const admin = await seedOwner();
        const stranger = await seedOwner();
        const created = await app.request(`/api/v1/admin/${routeTables[vertical]}`, {
            method: 'POST',
            headers: adminHeaders({
                id: admin,
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT, perms[vertical].viewAll],
                reason: encodeURIComponent(REASON)
            }),
            body: JSON.stringify(createBody(vertical, owner, await createVerticalDestination()))
        });
        expect(created.status).toBe(201);
        const id = (await listingsOf(vertical, owner))[0]?.id as string;
        await getDb().execute(
            sql`INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, actor_id, changes, correlation_id) VALUES ('listing.edited', ${vertical}, ${id}, 'owner', ${owner}::uuid, '[{"field":"description"}]'::jsonb, ${randomUUID()}::uuid)`
        );
        const path = `/api/v1/protected/${routeTables[vertical]}/${id}/support-edits`;

        // Act
        const mine = await readResponse(
            await app.request(path, { headers: actorHeaders({ id: owner }) })
        );
        const theirs = await app.request(path, { headers: actorHeaders({ id: stranger }) });

        // Assert
        expect(mine.status).toBe(200);
        const items = (mine.body.data as { items: { occurredAt: string; parts: string[] }[] })
            .items;
        expect(items).toHaveLength(1);
        expect(items[0]?.parts).toContain('texts');
        expect(items[0]).not.toHaveProperty('reason');
        expect(theirs.status).toBe(404);
    });
});
