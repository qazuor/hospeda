import { getDb, listingPurgeModel, sql } from '@repo/db';
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
    readResponse
} from './publication-routes.helpers';

/**
 * HOS-1748: a PURGED listing keeps its row with `summary = ''` and
 * `description = ''`. Every read that serializes it must answer instead of
 * failing the whole response.
 *
 * - TEST:1748:4 admin list holds the purged row and a short draft.
 * - TEST:1748:5 admin detail of the purged row answers 200.
 * - TEST:1748:6 protected reads: owner 404 on PURGED (design, not 500), staff
 *   200, owner 200 on a short draft, accommodation own-list includes it.
 */

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
const viewAll: Readonly<Record<Vertical, PermissionEnum>> = {
    [VerticalEnum.ACCOMMODATION]: PermissionEnum.ACCOMMODATION_VIEW_ALL,
    [VerticalEnum.VENUE]: PermissionEnum.GASTRONOMY_VIEW_ALL,
    [VerticalEnum.EXPERIENCE]: PermissionEnum.EXPERIENCE_VIEW_ALL
};
const staffReadVerticals = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;

interface Fixture {
    readonly ownerId: string;
    readonly purgedId: string;
    readonly draftId: string;
}

interface ListedItem {
    readonly id: string;
    readonly summary: string;
    readonly publicationStatus: string;
}

const seeded: { vertical: Vertical; id: string }[] = [];

async function createDraft(vertical: Vertical, ownerId: string): Promise<string> {
    const destinationId = await createVerticalDestination();
    const status = PublicationStatusEnum.DRAFT;
    const id =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({ ownerId, destinationId, status, complete: false })
            : await createVerticalListing({ vertical, ownerId, destinationId, status });
    seeded.push({ vertical, id });
    return id;
}

/** The real purge write: PB12 sets the state, then blanks the content. */
async function purge(vertical: Vertical, id: string): Promise<void> {
    await getDb().transaction(async (tx) => {
        await tx.execute(
            sql`UPDATE ${sql.identifier(tables[vertical])} SET publication_status = 'PURGED' WHERE id = ${id}::uuid`
        );
        await listingPurgeModel.purgeListingContent({
            tx,
            vertical,
            listingId: id,
            at: new Date()
        });
    });
}

/** An owner with one PURGED listing and one DRAFT whose texts are below every minimum. */
async function seedFixture(vertical: Vertical): Promise<Fixture> {
    const owner = await createOwner();
    const purgedId = await createDraft(vertical, owner.id);
    await purge(vertical, purgedId);
    const draftId = await createDraft(vertical, owner.id);
    await getDb().execute(
        sql`UPDATE ${sql.identifier(tables[vertical])} SET summary = 'corto', description = '' WHERE id = ${draftId}::uuid`
    );
    return { ownerId: owner.id, purgedId, draftId };
}

function adminHeaders(vertical: Vertical): Record<string, string> {
    return actorHeaders({
        id: '00000000-0000-4000-8000-000000001748',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, viewAll[vertical]]
    });
}

function staffHeaders(vertical: Vertical): Record<string, string> {
    return actorHeaders({
        id: '00000000-0000-4000-8000-000000001749',
        role: RoleEnum.ADMIN,
        permissions: [viewAll[vertical]]
    });
}

function ownerHeaders(ownerId: string): Record<string, string> {
    return actorHeaders({ id: ownerId, role: RoleEnum.HOST });
}

async function get(path: string, headers: Record<string, string>) {
    return readResponse(await app.request(path, { headers }));
}

function itemsOf(body: unknown): ListedItem[] {
    const data = (body as { data?: { items?: ListedItem[] } }).data;
    return data?.items ?? [];
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    for (const { vertical, id } of seeded.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(tables[vertical])} WHERE id = ${id}::uuid`
        );
    }
});
afterAll(async () => testDb.teardown());

describe.each(
    verticals
)('TEST:1748:4 admin list shows PURGED and short drafts — %s', (vertical) => {
    it('answers 200 with the purged row flagged and the short draft', async () => {
        // Arrange
        const fx = await seedFixture(vertical);

        // Act
        const res = await get(
            `/api/v1/admin/${routeTables[vertical]}?ownerId=${fx.ownerId}&page=1&pageSize=50`,
            adminHeaders(vertical)
        );

        // Assert
        expect(res.status).toBe(200);
        const items = itemsOf(res.body);
        expect(items.map((item) => item.id).sort()).toEqual([fx.purgedId, fx.draftId].sort());
        expect(items.find((item) => item.id === fx.purgedId)).toMatchObject({
            summary: '',
            publicationStatus: 'PURGED'
        });
        expect(items.find((item) => item.id === fx.draftId)).toMatchObject({ summary: 'corto' });
    });
});

describe.each(verticals)('TEST:1748:5 admin detail of a PURGED listing — %s', (vertical) => {
    it('answers 200 with the blank texts', async () => {
        // Arrange
        const fx = await seedFixture(vertical);

        // Act
        const res = await get(
            `/api/v1/admin/${routeTables[vertical]}/${fx.purgedId}`,
            adminHeaders(vertical)
        );

        // Assert
        expect(res.status).toBe(200);
        expect((res.body as { data: object }).data).toMatchObject({
            id: fx.purgedId,
            summary: '',
            description: '',
            publicationStatus: 'PURGED'
        });
    });
});

describe.each(verticals)('TEST:1748:6 protected reads — %s', (vertical) => {
    it('answers 404, never 500, to the owner asking for the PURGED listing', async () => {
        // Arrange
        const fx = await seedFixture(vertical);

        // Act
        const res = await get(
            `/api/v1/protected/${routeTables[vertical]}/${fx.purgedId}`,
            ownerHeaders(fx.ownerId)
        );

        // Assert
        expect(res.status).toBe(404);
    });

    it('answers 200 to the owner asking for the short draft', async () => {
        // Arrange
        const fx = await seedFixture(vertical);

        // Act
        const res = await get(
            `/api/v1/protected/${routeTables[vertical]}/${fx.draftId}`,
            ownerHeaders(fx.ownerId)
        );

        // Assert
        expect(res.status).toBe(200);
        expect((res.body as { data: object }).data).toMatchObject({
            id: fx.draftId,
            summary: 'corto'
        });
    });
});

describe.each(
    staffReadVerticals
)('TEST:1748:6 staff protected read of a PURGED listing — %s', (vertical) => {
    it('answers 200 to the actor holding the view-all permission', async () => {
        // Arrange
        const fx = await seedFixture(vertical);

        // Act
        const res = await get(
            `/api/v1/protected/${routeTables[vertical]}/${fx.purgedId}`,
            staffHeaders(vertical)
        );

        // Assert
        expect(res.status).toBe(200);
        expect((res.body as { data: object }).data).toMatchObject({
            id: fx.purgedId,
            summary: '',
            publicationStatus: 'PURGED'
        });
    });
});

describe('TEST:1748:6 accommodation own list', () => {
    it('answers 200 and includes the PURGED accommodation', async () => {
        // Arrange
        const fx = await seedFixture(VerticalEnum.ACCOMMODATION);

        // Act
        const res = await get(
            '/api/v1/protected/accommodations?page=1&pageSize=50',
            ownerHeaders(fx.ownerId)
        );

        // Assert
        expect(res.status).toBe(200);
        expect(itemsOf(res.body).map((item) => item.id)).toContain(fx.purgedId);
    });
});
