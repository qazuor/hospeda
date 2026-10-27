import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { onListingPurged } from '../../../src/utils/listing-publication/listing-purged-emitter';
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

const { mediaDelete } = vi.hoisted(() => ({ mediaDelete: vi.fn() }));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ delete: mediaDelete })
}));

/** One-shot hook run right before PB12 takes its lock (after the route authorized). */
const beforeLock: { current: (() => Promise<void>) | undefined } = { current: undefined };
vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/utils/listing-publication/ports')>();
    return {
        ...actual,
        getListingPublicationPorts: (
            ...args: Parameters<typeof actual.getListingPublicationPorts>
        ) => {
            const ports = actual.getListingPublicationPorts(...args);
            return {
                ...ports,
                unitOfWork: {
                    runLocked: async (
                        ...lockArgs: Parameters<typeof ports.unitOfWork.runLocked>
                    ) => {
                        const hook = beforeLock.current;
                        beforeLock.current = undefined;
                        if (hook) await hook();
                        return ports.unitOfWork.runLocked(...lockArgs);
                    }
                }
            };
        }
    };
});

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
    [VerticalEnum.VENUE]: 'venues'
};
const createFixture: Readonly<
    Record<
        Vertical,
        (ownerId: string, destinationId: string, status: PublicationStatusEnum) => Promise<string>
    >
> = {
    [VerticalEnum.ACCOMMODATION]: (ownerId, destinationId, status) =>
        createListing({ ownerId, destinationId, status, complete: false }),
    [VerticalEnum.VENUE]: (ownerId, destinationId, status) =>
        createVerticalListing({
            vertical: VerticalEnum.VENUE,
            ownerId,
            destinationId,
            status
        }),
    [VerticalEnum.EXPERIENCE]: (ownerId, destinationId, status) =>
        createVerticalListing({ vertical: VerticalEnum.EXPERIENCE, ownerId, destinationId, status })
};
const REASON = 'Juan pidió por correo que borremos sus dos fichas';

/** Listings this file seeded and did not purge; removed after each test. */
const seeded: { vertical: Vertical; id: string }[] = [];

function adminPath(vertical: Vertical, id: string): string {
    return `/api/v1/admin/${routeTables[vertical]}/${id}/purge`;
}

function ownerPath(vertical: Vertical, id: string): string {
    return `/api/v1/protected/${routeTables[vertical]}/${id}/purge`;
}

function adminHeaders(id: string, permission: PermissionEnum): Record<string, string> {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, permission]
    });
}

async function seedListing(
    vertical: Vertical,
    ownerId: string,
    status: PublicationStatusEnum
): Promise<string> {
    const id = await createFixture[vertical](ownerId, await createVerticalDestination(), status);
    seeded.push({ vertical, id });
    return id;
}

async function readListing(
    vertical: Vertical,
    id: string
): Promise<{ status: unknown; deletedAt: unknown }> {
    const rows = await getDb().execute(
        sql`SELECT publication_status AS status, deleted_at AS "deletedAt" FROM ${sql.identifier(tables[vertical])} WHERE id = ${id}::uuid`
    );
    return { status: rows.rows[0]?.status, deletedAt: rows.rows[0]?.deletedAt };
}

async function purgedMails(ownerId: string, listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT payload->>'bySupport' AS "bySupport" FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid AND template = 'verticals.listing-purged' AND payload->>'listingId' = ${listingId}`
    );
    return rows.rows;
}

async function statusEvents(listingId: string) {
    const rows = await getDb().execute(
        sql`SELECT actor_type AS "actorType", actor_id AS "actorId", reason FROM domain_event WHERE event_type = 'listing.status_changed' AND entity_id = ${listingId}`
    );
    return rows.rows;
}

/** Posts the admin purge and resolves the status the post-commit push read. */
async function purgeAndCapturePush(vertical: Vertical, id: string, adminId: string) {
    let pushed: string | undefined;
    let resolvePush: ((value: string) => void) | undefined;
    const push = new Promise<string>((resolve) => {
        resolvePush = resolve;
    });
    const unsubscribe = onListingPurged(async (event) => {
        if (event.listingId !== id) return;
        const row = await readListing(vertical, id);
        pushed = typeof row.status === 'string' ? row.status : 'missing';
        resolvePush?.(pushed);
    });
    const response = await readResponse(
        await app.request(adminPath(vertical, id), {
            method: 'POST',
            headers: adminHeaders(adminId, PermissionEnum.LISTING_PURGE_ON_REQUEST),
            body: JSON.stringify({ reason: REASON })
        })
    );
    const pushedBeforeResponse = pushed;
    const pushedStatus = await push;
    unsubscribe();
    return { response, pushedBeforeResponse, pushedStatus };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    beforeLock.current = undefined;
    for (const { vertical, id } of seeded.splice(0)) {
        const row = await readListing(vertical, id);
        if (row.status === PublicationStatusEnum.PURGED) continue;
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(tables[vertical])} WHERE id = ${id}::uuid`
        );
    }
});
afterAll(async () => testDb.teardown());

describe.each(verticals)("TEST:V8a:10 action 23 purges at the owner's request — %s", (vertical) => {
    it("runs PB12 on each of Juan's two listings with the admin as actor and the reason", async () => {
        // Arrange: Juan (no plan, no trial: floor coverage only) and his two listings.
        await ensurePublicationCatalog(vertical);
        const juan = await createOwner();
        const admin = await createOwner();
        const draft = await seedListing(vertical, juan.id, PublicationStatusEnum.DRAFT);
        const published = await seedListing(vertical, juan.id, PublicationStatusEnum.PUBLISHED);

        for (const id of [draft, published]) {
            // Act
            const { response, pushedBeforeResponse, pushedStatus } = await purgeAndCapturePush(
                vertical,
                id,
                admin.id
            );

            // Assert
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ purged: true });
            expect(pushedBeforeResponse).toBeUndefined();
            expect(pushedStatus).toBe(PublicationStatusEnum.PURGED);
            expect(await readListing(vertical, id)).toEqual({
                status: PublicationStatusEnum.PURGED,
                deletedAt: null
            });
            expect(await statusEvents(id)).toEqual([
                { actorType: 'admin', actorId: admin.id, reason: REASON }
            ]);
            expect(await purgedMails(juan.id, id)).toEqual([{ bySupport: 'true' }]);
            const again = await readResponse(
                await app.request(adminPath(vertical, id), {
                    method: 'POST',
                    headers: adminHeaders(admin.id, PermissionEnum.LISTING_PURGE_ON_REQUEST),
                    body: JSON.stringify({ reason: REASON })
                })
            );
            expect(again.status).toBe(404);
        }
    });

    it.each([
        ['missing', {}],
        ['empty', { reason: '' }],
        ['whitespace-only', { reason: '   ' }]
    ])('refuses a %s reason with 400 and leaves the listing untouched', async (_label, body) => {
        await ensurePublicationCatalog(vertical);
        const juan = await createOwner();
        const admin = await createOwner();
        const id = await seedListing(vertical, juan.id, PublicationStatusEnum.DRAFT);

        const response = await readResponse(
            await app.request(adminPath(vertical, id), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_PURGE_ON_REQUEST),
                body: JSON.stringify(body)
            })
        );

        expect(response.status).toBe(400);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
        expect(await readListing(vertical, id)).toEqual({
            status: PublicationStatusEnum.DRAFT,
            deletedAt: null
        });
        expect(await statusEvents(id)).toEqual([]);
        expect(await purgedMails(juan.id, id)).toEqual([]);
    });

    it('refuses with 409 and writes nothing when the owner changes between authorization and purge', async () => {
        // Arrange: the route authorizes on Juan; before PB12 locks, the listing moves to Ana.
        await ensurePublicationCatalog(vertical);
        const juan = await createOwner();
        const ana = await createOwner();
        const admin = await createOwner();
        const id = await seedListing(vertical, juan.id, PublicationStatusEnum.PUBLISHED);
        beforeLock.current = async () => {
            await getDb().execute(
                sql`UPDATE ${sql.identifier(tables[vertical])} SET owner_id = ${ana.id}::uuid WHERE id = ${id}::uuid`
            );
        };

        // Act
        const response = await readResponse(
            await app.request(adminPath(vertical, id), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_PURGE_ON_REQUEST),
                body: JSON.stringify({ reason: REASON })
            })
        );

        // Assert
        expect(response.status).toBe(409);
        expect(await readListing(vertical, id)).toEqual({
            status: PublicationStatusEnum.PUBLISHED,
            deletedAt: null
        });
        expect(await statusEvents(id)).toEqual([]);
        expect(await purgedMails(juan.id, id)).toEqual([]);
        expect(await purgedMails(ana.id, id)).toEqual([]);
    });

    it('answers 404 for a listing that does not exist', async () => {
        const admin = await createOwner();

        const response = await readResponse(
            await app.request(adminPath(vertical, crypto.randomUUID()), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_PURGE_ON_REQUEST),
                body: JSON.stringify({ reason: REASON })
            })
        );

        expect(response.status).toBe(404);
    });
});

describe.each(verticals)('TEST:V8a:9 action 15 does not purge — %s', (vertical) => {
    async function expectUntouched(ownerId: string, id: string): Promise<void> {
        expect(await readListing(vertical, id)).toEqual({
            status: PublicationStatusEnum.PUBLISHED,
            deletedAt: null
        });
        expect(await purgedMails(ownerId, id)).toEqual([]);
    }

    it('refuses the admin purge route to an admin holding only the action 15 permission', async () => {
        await ensurePublicationCatalog(vertical);
        const juan = await createOwner();
        const admin = await createOwner();
        const id = await seedListing(vertical, juan.id, PublicationStatusEnum.PUBLISHED);

        const response = await readResponse(
            await app.request(adminPath(vertical, id), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT),
                body: JSON.stringify({ reason: REASON })
            })
        );

        expect(response.status).toBe(403);
        await expectUntouched(juan.id, id);
    });

    it("does not purge through the owner's route for the action 15 admin", async () => {
        await ensurePublicationCatalog(vertical);
        const juan = await createOwner();
        const admin = await createOwner();
        const id = await seedListing(vertical, juan.id, PublicationStatusEnum.PUBLISHED);

        const response = await readResponse(
            await app.request(ownerPath(vertical, id), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT)
            })
        );

        expect(response.status).toBeGreaterThanOrEqual(400);
        await expectUntouched(juan.id, id);
    });

    it('refuses action 23 on the admin own listing (actor = subject)', async () => {
        await ensurePublicationCatalog(vertical);
        const admin = await createOwner();
        const id = await seedListing(vertical, admin.id, PublicationStatusEnum.PUBLISHED);

        const response = await readResponse(
            await app.request(adminPath(vertical, id), {
                method: 'POST',
                headers: adminHeaders(admin.id, PermissionEnum.LISTING_PURGE_ON_REQUEST),
                body: JSON.stringify({ reason: REASON })
            })
        );

        expect(response.status).toBe(403);
        await expectUntouched(admin.id, id);
    });
});
