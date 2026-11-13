import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { AddonPurchaseResponseSchema } from '@repo/schemas';
import { z } from 'zod';
import esExperience from '../../../../packages/i18n/src/locales/es/experience.json' with {
    type: 'json'
};
import esVenue from '../../../../packages/i18n/src/locales/es/venue.json' with { type: 'json' };
import {
    addonProviderIds,
    cleanupAddonEndToEnd,
    readAddonInstance,
    startAddonWorld
} from '../../fixtures/addon-end-to-end.ts';
import {
    type CreatedUser,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    deliverNotices,
    type FakeWorld,
    recordCreditedCycle,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import {
    cleanupFeaturedAddonPayments,
    createFeaturedDestination,
    deleteFeaturedDestination,
    deleteVerticalListings,
    ensureFeaturedBoostCatalog,
    insertExperience,
    insertVenue,
    monthlyOptionForAnySlug,
    readFeaturedFlag,
    readPublicList
} from '../../fixtures/listing-featured.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/** TEST:HOS-2138:6-7 proves venue and experience public ordering and badges. */
test.describe('TEST:HOS-2138:6-7 venue and experience lists pin boosted listings first @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let userIds: string[] = [];
    let destinationId = '';
    let venueIds: string[] = [];
    let experienceIds: string[] = [];

    test.beforeEach(async () => {
        const started = await startAddonWorld();
        world = started.world;
        namespace = started.namespace;
        userIds = [];
        venueIds = [];
        experienceIds = [];
        destinationId = (await createFeaturedDestination()).id;
    });

    test.afterEach(async () => {
        let providerIds: string[] = [];
        try {
            await world?.fakeServer.close();
            providerIds = namespace ? await addonProviderIds({ namespace }) : [];
        } finally {
            try {
                await cleanupFeaturedAddonPayments({ userIds });
                await cleanupAddonEndToEnd({ userIds, providerIds });
                await cleanupArrearsRows({ userIds });
                await deleteVerticalListings({ venueIds, experienceIds });
                await cleanupTestUsers(getDbPool(), userIds);
                if (destinationId) await deleteFeaturedDestination({ id: destinationId });
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                namespace = '';
                userIds = [];
                venueIds = [];
                experienceIds = [];
                destinationId = '';
            }
        }
    });

    test('TEST:HOS-2138:6 venue listing puts a purchased boost first with its badge', async ({
        page
    }) => {
        await checkVertical({ page, vertical: 'venue' });
    });

    test('TEST:HOS-2138:7 experience listing puts a purchased boost first with its badge', async ({
        page
    }) => {
        await checkVertical({ page, vertical: 'experience' });
    });

    async function checkVertical(args: {
        readonly page: Page;
        readonly vertical: 'venue' | 'experience';
    }): Promise<void> {
        if (!world) throw new Error('Expected case-local fake world.');
        const vertical = args.vertical;
        const slug = vertical === 'venue' ? 'venue-basico' : 'experience-basico';
        const owner = await host();
        const controlOwner = await host();
        const admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        const subscription = await createApiCardSubscription({
            user: owner,
            billingOptionId: await monthlyOptionForAnySlug({ slug })
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: subscription.subscriptionId
        });
        await recordCreditedCycle({
            fakeServer: world.fakeServer,
            subscriptionId: subscription.subscriptionId,
            authorizationId: subscription.authorizationId
        });

        const zName = `HOS-2138 Z ${randomUUID().slice(0, 8)}`;
        const aName = `HOS-2138 A ${randomUUID().slice(0, 8)}`;
        const boosted =
            vertical === 'venue'
                ? await insertVenue({ ownerId: owner.id, destinationId, name: zName })
                : await insertExperience({ ownerId: owner.id, destinationId, name: zName });
        const a =
            vertical === 'venue'
                ? await insertVenue({ ownerId: controlOwner.id, destinationId, name: aName })
                : await insertExperience({ ownerId: controlOwner.id, destinationId, name: aName });
        if (vertical === 'venue') venueIds.push(boosted.id, a.id);
        else experienceIds.push(boosted.id, a.id);

        expect(await readPublicList({ vertical, destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: boosted.id, isFeatured: false }
        ]);
        const catalog = await ensureFeaturedBoostCatalog({ kind: 'recurring', vertical });
        const purchase = await fetch(`${API_URL}/api/v1/protected/billing/addons/purchases`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({
                productId: catalog.productId,
                targetId: boosted.id,
                orderRequestId: `hos2138-${randomUUID()}`,
                addonVersionId: catalog.addonVersionId
            })
        });
        expect(purchase.status).toBe(201);
        const purchased = z
            .object({ data: AddonPurchaseResponseSchema })
            .parse(await purchase.json()).data;
        expect(purchased.chargeKind).toBe('PERIODICO');
        expect(purchased.processing).toBe(false);
        const pending = await readAddonInstance({ instanceId: purchased.instanceId });
        await world.fakeServer.provider.approve({ authorizationId: pending.authorizationId });
        await deliverNotices({ fakeServer: world.fakeServer });
        await expect
            .poll(() =>
                readAddonInstance({ instanceId: purchased.instanceId }).then(({ status }) => status)
            )
            .toBe('ACTIVE');
        const table = vertical === 'venue' ? 'venues' : 'experiences';
        await expect.poll(() => readFeaturedFlag({ table, id: boosted.id })).toBe(true);
        expect(await readPublicList({ vertical, destinationId })).toEqual([
            { id: boosted.id, isFeatured: true },
            { id: a.id, isFeatured: false }
        ]);

        const path = vertical === 'venue' ? 'comer-y-salir' : 'experiencias';
        await args.page.goto(`${WEB_URL}/es/${path}/?destinationId=${destinationId}`);
        const cards = args.page.locator(
            vertical === 'venue' ? 'article.venue-card' : 'article.exp-card'
        );
        await expect(cards).toHaveCount(2);
        const names =
            vertical === 'venue'
                ? cards.locator('.venue-card__name')
                : cards.locator('.exp-card__name');
        await expect(names).toHaveText([zName, aName]);
        await expect(args.page.locator('.featured-badge')).toHaveCount(1);
        await expect(cards.first().locator('.featured-badge')).toContainText(
            vertical === 'venue' ? esVenue.card.featured : esExperience.card.featured
        );
    }

    async function host(): Promise<CreatedUser> {
        const owner = await createUser({ role: 'HOST' });
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        return owner;
    }
});
