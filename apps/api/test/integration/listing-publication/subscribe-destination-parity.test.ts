/** TEST:V8a:1 — the destination read and PB1 share the same publication decision. */
import { randomUUID } from 'node:crypto';
import {
    accommodations,
    and,
    eq,
    experiences,
    gastronomies,
    getDb,
    planVersions,
    trials
} from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { ListingPublicationService } from '../../../src/services/listing-publication/listing-publication.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    MATRIX_NOW,
    readResponse
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
const pathByVertical: Record<(typeof verticals)[number], string> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};
const subscribePath = (vertical: (typeof verticals)[number]) =>
    `/api/v1/protected/publish/subscribe-destination/${vertical}`;
const publishPath = (vertical: (typeof verticals)[number], id: string) =>
    `/api/v1/protected/${pathByVertical[vertical]}/${id}/publish`;
const auth = (id: string) =>
    actorHeaders({
        id,
        role: RoleEnum.HOST,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });
let savedCatalog: { id: string; current: boolean; sellable: boolean }[] = [];

async function makeDraft(vertical: (typeof verticals)[number]) {
    const owner = await createOwner();
    const listingId =
        vertical === VerticalEnum.ACCOMMODATION
            ? await (async () => {
                  const { createDestination, createListing } = await import(
                      './publication-routes.helpers'
                  );
                  return createListing({
                      ownerId: owner.id,
                      destinationId: await createDestination(),
                      status: PublicationStatusEnum.DRAFT
                  });
              })()
            : await createVerticalListing({
                  vertical,
                  ownerId: owner.id,
                  destinationId: await createVerticalDestination(),
                  status: PublicationStatusEnum.DRAFT
              });
    return { owner, listingId };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    for (const vertical of verticals) await ensurePublicationCatalog(vertical);
});
afterEach(async () => {
    for (const version of savedCatalog) {
        await getDb()
            .update(planVersions)
            .set({ current: version.current, sellable: version.sellable })
            .where(eq(planVersions.id, version.id));
    }
    savedCatalog = [];
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V8a:1 subscribe destination parity — %s', (vertical) => {
    it('PUBLISH from PRE_TRIAL agrees with PB1 and starts the trial', async () => {
        const { owner, listingId } = await makeDraft(vertical);
        const get = await app.request(subscribePath(vertical), { headers: auth(owner.id) });
        const decision = await get.json();
        expect(get.status).toBe(200);
        expect(decision.data.destination).toBe('PUBLISH');
        expect(decision.data.trialDays).toBeGreaterThan(0);
        const publish = await readResponse(
            await app.request(publishPath(vertical, listingId), {
                method: 'POST',
                headers: auth(owner.id)
            })
        );
        expect(publish.status).toBe(201);
        const table =
            vertical === VerticalEnum.ACCOMMODATION
                ? accommodations
                : vertical === VerticalEnum.GASTRONOMY
                  ? gastronomies
                  : experiences;
        const [listing] = await getDb()
            .select({ status: table.publicationStatus })
            .from(table)
            .where(eq(table.id, listingId));
        expect(listing?.status).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await getDb().select().from(trials).where(eq(trials.userId, owner.id))).toHaveLength(
            1
        );
    });

    it('COVERED with an active trial keeps the existing V5 decision without a second PB1 trial', async () => {
        const { owner, listingId } = await makeDraft(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_ACTIVE' });
        const get = await app.request(subscribePath(vertical), { headers: auth(owner.id) });
        expect((await get.json()).data.destination).toBe('COVERED');
        const publish = await readResponse(
            await app.request(publishPath(vertical, listingId), {
                method: 'POST',
                headers: auth(owner.id)
            })
        );
        expect(publish.status).toBe(403);
        expect(publish.body.error?.message).toBe('subscription_required');
        expect(await getDb().select().from(trials).where(eq(trials.userId, owner.id))).toHaveLength(
            1
        );
    });

    it('CHECKOUT after a consumed trial agrees with PB1 and leaves the draft unchanged', async () => {
        const { owner, listingId } = await makeDraft(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_EXPIRED' });
        const get = await app.request(subscribePath(vertical), { headers: auth(owner.id) });
        expect((await get.json()).data.destination).toBe('CHECKOUT');
        const publish = await readResponse(
            await app.request(publishPath(vertical, listingId), {
                method: 'POST',
                headers: auth(owner.id)
            })
        );
        expect(publish.status).toBe(403);
        expect(publish.body.error?.message).toBe('subscription_required');
        expect(await getDb().select().from(trials).where(eq(trials.userId, owner.id))).toHaveLength(
            1
        );
        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [row] = await getDb()
                .select({ status: accommodations.publicationStatus })
                .from(accommodations)
                .where(eq(accommodations.id, listingId));
            expect(row?.status).toBe(PublicationStatusEnum.DRAFT);
        }
    });

    it('NO_PLANS_AVAILABLE wins over a consumed trial and PB1 leaves the draft untouched', async () => {
        const { owner, listingId } = await makeDraft(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_EXPIRED' });
        savedCatalog = await getDb()
            .select({
                id: planVersions.id,
                current: planVersions.current,
                sellable: planVersions.sellable
            })
            .from(planVersions)
            .where(
                and(
                    eq(planVersions.vertical, vertical),
                    eq(planVersions.current, true),
                    eq(planVersions.sellable, true)
                )
            );
        await getDb()
            .update(planVersions)
            .set({ current: false })
            .where(
                and(
                    eq(planVersions.vertical, vertical),
                    eq(planVersions.current, true),
                    eq(planVersions.sellable, true)
                )
            );
        const get = await app.request(subscribePath(vertical), { headers: auth(owner.id) });
        expect((await get.json()).data.destination).toBe('NO_PLANS_AVAILABLE');
        const publish = await readResponse(
            await app.request(publishPath(vertical, listingId), {
                method: 'POST',
                headers: auth(owner.id)
            })
        );
        expect(publish.status).toBe(403);
        expect(publish.body.error?.message).toBe('no_plans_available');
        const serviceActor = {
            id: owner.id,
            roles: [RoleEnum.HOST],
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.GASTRONOMY_EDIT_OWN,
                PermissionEnum.EXPERIENCE_EDIT_OWN
            ]
        };
        await expect(
            new ListingPublicationService().publish({
                actor: serviceActor,
                id: listingId,
                vertical
            })
        ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'no_plans_available' });
        expect(await getDb().select().from(trials).where(eq(trials.userId, owner.id))).toHaveLength(
            1
        );
    });

    it('returns 401 for a guest and 400 for an unknown vertical', async () => {
        const guest = await app.request(subscribePath(vertical), {
            headers: actorHeaders({
                id: '00000000-0000-4000-8000-000000000000',
                role: RoleEnum.GUEST,
                permissions: []
            })
        });
        expect(guest.status).toBe(401);
        const unknown = await app.request(
            '/api/v1/protected/publish/subscribe-destination/unknown',
            { headers: auth(randomUUID()) }
        );
        expect(unknown.status).toBe(400);
    });
});
