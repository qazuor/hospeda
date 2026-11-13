import { randomUUID } from 'node:crypto';
import { expect, type Locator, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import { z as zod } from 'zod';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json' with { type: 'json' };
import esHome from '../../../../packages/i18n/src/locales/es/home.json' with { type: 'json' };
import {
    buyRecurringAddon,
    cleanupAddonEndToEnd,
    readAddonInstance,
    startAddonWorld
} from '../../fixtures/addon-end-to-end.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cleanupArrearsRows,
    DAY_MS,
    deliverNotices,
    type FakeWorld,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    cleanupFeaturedAddonPayments,
    createFeaturedDestination,
    deleteFeaturedDestination,
    ensureFeaturedBoostCatalog,
    readFeaturedFlag,
    readPublicList
} from '../../fixtures/listing-featured.ts';
import { renameListing } from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const PURCHASE_PRICE = /\$\s?3\.000(?:,00)?(?!\d)/;

/** Assert the recurring boost's purchase summary uses the Spanish catalog copy. */
async function inspectSummary(summary: Locator): Promise<void> {
    await expect(summary.getByRole('heading')).toHaveText(esBilling.addonPurchase.summary);
    await expect(summary).toContainText('E2E HOS-2138 boost recurring accommodation');
    await expect(summary).toContainText(esBilling.addonPurchase.cycle.monthly);
    await expect(summary).toContainText(PURCHASE_PRICE);
}

/** TEST:HOS-2138:1-2 proves recurring purchase/withdrawal and one-time expiry. */
test.describe('TEST:HOS-2138:1-2 listing boost features the listing @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let owner: CreatedUser;
    let admin: CreatedUser;
    let userIds: string[] = [];
    let destinationId = '';

    test.beforeEach(async ({ page }) => {
        const started = await startAddonWorld();
        world = started.world;
        namespace = started.namespace;
        userIds = [];
        owner = await createUser({ role: 'HOST' });
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        await signUpCardSubscriber({ page, world, user: owner, slug: 'owner-basico' });
        destinationId = (await createFeaturedDestination()).id;
    });

    test.afterEach(async () => {
        let providerRows: { readonly provider_id: string }[] = [];
        try {
            await world?.fakeServer.close();
            providerRows = namespace
                ? await execSQL<{ provider_id: string }>(
                      'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                      [`fake-auth-${namespace}-%`]
                  )
                : [];
        } finally {
            try {
                await cleanupFeaturedAddonPayments({ userIds });
                await cleanupAddonEndToEnd({
                    userIds,
                    providerIds: providerRows.map(({ provider_id }) => provider_id)
                });
                await cleanupArrearsRows({ userIds });
                await cleanupTestUsers(getDbPool(), userIds);
                if (destinationId) await deleteFeaturedDestination({ id: destinationId });
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                namespace = '';
                userIds = [];
                destinationId = '';
            }
        }
    });

    test('recurring boost appears first and marked, then withdrawal restores alphabetical order', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        const z = await createAccommodation({
            ownerId: owner.id,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            withTrial: false
        });
        await renameListing({ listingId: z.id, name: 'HOS-2138 Z boost' });
        const aOwner = await createUser({ role: 'HOST' });
        userIds.push(aOwner.id);
        await markProfileCompleted({ userId: aOwner.id });
        const a = await createAccommodation({
            ownerId: aOwner.id,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            withTrial: true
        });
        await renameListing({ listingId: a.id, name: 'HOS-2138 A baseline' });

        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: z.id, isFeatured: false }
        ]);
        const catalog = await ensureFeaturedBoostCatalog({
            kind: 'recurring',
            vertical: 'accommodation'
        });
        const purchase = await buyRecurringAddon({
            page,
            productId: catalog.productId,
            listingId: z.id,
            inspectSummary
        });
        const pending = await readAddonInstance({ instanceId: purchase.instanceId });
        await world.fakeServer.provider.approve({ authorizationId: pending.authorizationId });
        await deliverNotices({ fakeServer: world.fakeServer });
        await expect
            .poll(() =>
                readAddonInstance({ instanceId: purchase.instanceId }).then(({ status }) => status)
            )
            .toBe('ACTIVE');
        await expect.poll(() => readFeaturedFlag({ table: 'accommodations', id: z.id })).toBe(true);
        expect(await readFeaturedFlag({ table: 'accommodations', id: a.id })).toBe(false);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: z.id, isFeatured: true },
            { id: a.id, isFeatured: false }
        ]);

        await page.goto(`${WEB_URL}/es/alojamientos/?destinationIds=${destinationId}`);
        const cards = page.locator('.acc-card');
        await expect(cards).toHaveCount(2);
        await expect(cards.locator('.acc-card__name')).toHaveText([
            'HOS-2138 Z boost',
            'HOS-2138 A baseline'
        ]);
        await expect(page.locator('.featured-badge')).toHaveCount(1);
        await expect(cards.first().locator('.featured-badge')).toContainText(
            esHome.accommodations.badge.featured
        );

        await page.goto(`${WEB_URL}/es/mi-cuenta/complementos/?listing=${z.id}#recurring-addons`);
        const row = page.getByTestId(`recurring-addon-${purchase.instanceId}`);
        await expect(row).toBeVisible();
        await row.getByTestId(`recurring-addon-withdraw-${purchase.instanceId}`).click();
        await row
            .getByTestId('recurring-addon-withdraw-confirm')
            .getByRole('button', { name: esBilling.addonPurchase.recurringAddons.confirm })
            .click();
        await expect(page.getByTestId('recurring-addon-withdrawn')).toHaveText(
            esBilling.addonPurchase.recurringAddons.withdrawn
        );
        expect((await readAddonInstance({ instanceId: purchase.instanceId })).status).toBe(
            'CANCELLED'
        );
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: z.id }))
            .toBe(false);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: z.id, isFeatured: false }
        ]);
    });

    test('one-time boost expires after seven days and restores alphabetical order', async () => {
        if (!world) throw new Error('Expected case-local fake world.');
        const z = await createAccommodation({
            ownerId: owner.id,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            withTrial: false
        });
        await renameListing({ listingId: z.id, name: 'HOS-2138 Z boost' });
        const aOwner = await createUser({ role: 'HOST' });
        userIds.push(aOwner.id);
        const a = await createAccommodation({
            ownerId: aOwner.id,
            destinationId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            withTrial: true
        });
        await renameListing({ listingId: a.id, name: 'HOS-2138 A baseline' });
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: z.id, isFeatured: false }
        ]);

        const catalog = await ensureFeaturedBoostCatalog({
            kind: 'one-time',
            vertical: 'accommodation'
        });
        const response = await fetch(`${API_URL}/api/v1/protected/billing/addons/purchases`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: owner.sessionCookie },
            body: JSON.stringify({
                productId: catalog.productId,
                targetId: z.id,
                orderRequestId: `hos2138-${randomUUID()}`,
                addonVersionId: catalog.addonVersionId,
                payment: { token: 'hos2138-card', brand: 'visa', kind: 'credit' }
            })
        });
        expect(response.status).toBe(201);
        const result = zod
            .object({
                data: zod.object({
                    instanceId: zod.string().uuid(),
                    chargeKind: zod.literal('UNA_VEZ'),
                    processing: zod.literal(false),
                    order: zod.object({ outcome: zod.literal('ACTIVATED') })
                })
            })
            .parse(await response.json()).data;
        const times = await execSQL<{ status: string; starts_at: Date; ends_at: Date }>(
            'SELECT status, starts_at, ends_at FROM addon_instance WHERE id = $1',
            [result.instanceId]
        );
        const instance = times[0];
        expect(instance?.status).toBe('ACTIVE');
        if (!instance) throw new Error(`Missing one-time addon instance ${result.instanceId}.`);
        expect(instance.ends_at.getTime() - instance.starts_at.getTime()).toBe(7 * DAY_MS);
        await expect.poll(() => readFeaturedFlag({ table: 'accommodations', id: z.id })).toBe(true);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: z.id, isFeatured: true },
            { id: a.id, isFeatured: false }
        ]);
        await world.fakeServer.advanceClock({ ms: 8 * DAY_MS });
        await runCron({ jobName: 'subscription-window-expiry', adminCookie: admin.sessionCookie });
        expect(
            (
                await execSQL<{ status: string }>(
                    'SELECT status FROM addon_instance WHERE id = $1',
                    [result.instanceId]
                )
            )[0]?.status
        ).toBe('EXPIRED');
        await expect
            .poll(() => readFeaturedFlag({ table: 'accommodations', id: z.id }))
            .toBe(false);
        expect(await readPublicList({ vertical: 'accommodation', destinationId })).toEqual([
            { id: a.id, isFeatured: false },
            { id: z.id, isFeatured: false }
        ]);
    });
});
