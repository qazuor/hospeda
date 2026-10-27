import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
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
import { deletePurgePreviewInstances, seedPurgePreviewAddon } from './purge-preview-fixtures';

const app = initApp();
type ListingVertical = VerticalEnum.ACCOMMODATION | VerticalEnum.VENUE | VerticalEnum.EXPERIENCE;
const listingVerticals: readonly ListingVertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
];
const plural: Readonly<Record<ListingVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const instanceIds = new Set<string>();
const ownerIds = new Set<string>();
const listingIds: string[] = [];
const destinationIds = new Set<string>();

async function makeDestination(): Promise<string> {
    const id = await createVerticalDestination();
    destinationIds.add(id);
    return id;
}

async function cleanOwnedRows(): Promise<void> {
    await deletePurgePreviewInstances({ instanceIds: [...instanceIds] });
    instanceIds.clear();
    for (const id of listingIds.splice(0)) {
        await getDb().execute(sql`DELETE FROM accommodations WHERE id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM venues WHERE id = ${id}::uuid`);
        await getDb().execute(sql`DELETE FROM experiences WHERE id = ${id}::uuid`);
    }
    for (const id of destinationIds) {
        await getDb().execute(sql`DELETE FROM destinations WHERE id = ${id}::uuid`);
    }
    destinationIds.clear();
    for (const id of ownerIds) {
        await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
    ownerIds.clear();
}

async function seed(args: Parameters<typeof seedPurgePreviewAddon>[0]) {
    const row = await seedPurgePreviewAddon(args);
    instanceIds.add(row.instanceId);
    return row.instanceId;
}

async function makeListing(vertical: ListingVertical, ownerId: string, destinationId: string) {
    const id =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({
                  ownerId,
                  destinationId,
                  status: PublicationStatusEnum.DRAFT,
                  complete: false
              })
            : await createVerticalListing({
                  vertical,
                  ownerId,
                  destinationId,
                  status: PublicationStatusEnum.DRAFT
              });
    listingIds.push(id);
    return id;
}

function previewPath(vertical: ListingVertical, id: string): string {
    return `/api/v1/protected/${plural[vertical]}/${id}/purge-preview`;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    for (const vertical of listingVerticals) {
        await ensurePublicationCatalog(vertical);
    }
});

afterEach(async () => {
    await cleanOwnedRows();
});

afterAll(async () => {
    await testDb.teardown();
});

describe('TEST:B13a:3a AC:B13a:4 the purge preview names what the listing loses', () => {
    it('returns empty, scoped live add-ons in stable order, with one-time and pending details', async () => {
        const owner = await createOwner();
        const otherOwner = await createOwner();
        ownerIds.add(owner.id);
        ownerIds.add(otherOwner.id);
        const destinationId = await makeDestination();
        const listingId = await makeListing(VerticalEnum.ACCOMMODATION, owner.id, destinationId);
        const otherListingId = await makeListing(
            VerticalEnum.ACCOMMODATION,
            owner.id,
            destinationId
        );
        const empty = await readResponse(
            await app.request(previewPath(VerticalEnum.ACCOMMODATION, listingId), {
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(empty.status).toBe(200);
        expect(empty.body.data).toEqual({ lostAddons: [] });

        const until = new Date('2026-11-30T23:59:59.000Z');
        const periodicId = await seed({
            ownerId: owner.id,
            targetId: listingId,
            scopeType: 'LISTING',
            vertical: VerticalEnum.ACCOMMODATION,
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            price: 250000,
            name: 'Monthly photos'
        });
        await seed({
            ownerId: owner.id,
            targetId: listingId,
            scopeType: 'LISTING',
            vertical: VerticalEnum.ACCOMMODATION,
            status: 'PENDING_AUTHORIZATION',
            endsAt: until,
            name: 'One-time highlight'
        });
        await seed({
            ownerId: owner.id,
            targetId: otherListingId,
            scopeType: 'LISTING',
            vertical: VerticalEnum.ACCOMMODATION,
            name: 'Other listing'
        });
        await seed({
            ownerId: otherOwner.id,
            targetId: listingId,
            scopeType: 'LISTING',
            vertical: VerticalEnum.ACCOMMODATION,
            name: 'Other owner add-on'
        });
        for (const status of ['CANCELLED', 'EXPIRED', 'ABANDONED'] as const) {
            await seed({
                ownerId: owner.id,
                targetId: listingId,
                scopeType: 'LISTING',
                vertical: VerticalEnum.ACCOMMODATION,
                status,
                name: `${status} add-on`
            });
        }
        for (const scopeType of ['USER', 'GLOBAL'] as const) {
            await seed({
                ownerId: owner.id,
                targetId: null,
                scopeType,
                vertical: VerticalEnum.ACCOMMODATION,
                name: `${scopeType} add-on`
            });
        }
        await seed({
            ownerId: owner.id,
            targetId: listingId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            vertical: VerticalEnum.ACCOMMODATION,
            name: 'Subscription add-on'
        });

        const response = await readResponse(
            await app.request(previewPath(VerticalEnum.ACCOMMODATION, listingId), {
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(response.status).toBe(200);
        const data = response.body.data as unknown as {
            lostAddons: readonly Record<string, unknown>[];
        };
        expect(data.lostAddons).toHaveLength(2);
        expect(data.lostAddons[0]).toMatchObject({
            addonInstanceId: periodicId,
            name: 'Monthly photos',
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            price: 250000,
            currency: 'ARS',
            status: 'ACTIVE',
            endsAt: null
        });
        expect(data.lostAddons[1]).toMatchObject({
            name: 'One-time highlight',
            chargeKind: 'UNA_VEZ',
            cycle: null,
            endsAt: until.toISOString(),
            status: 'PENDING_AUTHORIZATION'
        });
    });

    it('returns 404 for a foreign owner, 401 without a session, and 400 for a malformed id', async () => {
        const owner = await createOwner();
        const stranger = await createOwner();
        ownerIds.add(owner.id);
        ownerIds.add(stranger.id);
        const id = await makeListing(VerticalEnum.ACCOMMODATION, owner.id, await makeDestination());
        const foreign = await readResponse(
            await app.request(previewPath(VerticalEnum.ACCOMMODATION, id), {
                headers: actorHeaders({ id: stranger.id })
            })
        );
        const anonymous = await readResponse(
            await app.request(previewPath(VerticalEnum.ACCOMMODATION, id), {
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
            })
        );
        const malformed = await readResponse(
            await app.request(previewPath(VerticalEnum.ACCOMMODATION, 'bad-id'), {
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(foreign.status).toBe(404);
        expect(anonymous.status).toBe(401);
        expect(malformed.status).toBe(400);
    });

    it.each(
        listingVerticals
    )('returns 404 to a foreign actor for a %s listing', async (vertical) => {
        const owner = await createOwner();
        const stranger = await createOwner();
        ownerIds.add(owner.id);
        ownerIds.add(stranger.id);
        const destinationId = await makeDestination();
        const id =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.DRAFT,
                      complete: false
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.DRAFT,
                      complete: false
                  });
        listingIds.push(id);
        const response = await readResponse(
            await app.request(previewPath(vertical, id), {
                headers: actorHeaders({ id: stranger.id, permissions: [] })
            })
        );

        expect(response.status).toBe(404);
        expect(response.body.error?.code).toBe('NOT_FOUND');
    });

    it.each([
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)('is registered for %s and returns its listing add-on', async (vertical) => {
        const owner = await createOwner();
        ownerIds.add(owner.id);
        const id = await makeListing(vertical, owner.id, await makeDestination());
        await seed({
            ownerId: owner.id,
            targetId: id,
            scopeType: 'LISTING',
            vertical,
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            price: 250000,
            name: 'Vertical add-on'
        });
        const response = await readResponse(
            await app.request(previewPath(vertical, id), {
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(response.status).toBe(200);
        const data = response.body.data as unknown as {
            lostAddons: readonly Record<string, unknown>[];
        };
        expect(data.lostAddons).toHaveLength(1);
        expect(data.lostAddons[0]).toMatchObject({
            name: 'Vertical add-on',
            price: 250000,
            cycle: 'monthly'
        });
    });
});
