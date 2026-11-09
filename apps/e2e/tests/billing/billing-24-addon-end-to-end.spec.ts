import { expect, type Locator, type Page, test } from '@playwright/test';
import { PublicationStatusEnum } from '@repo/schemas';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json' with { type: 'json' };
import {
    addonProviderIds,
    buyRecurringAddon,
    cleanupAddonEndToEnd,
    countAddonCancellationPuts,
    readAddonInstance,
    startAddonWorld
} from '../../fixtures/addon-end-to-end.ts';
import { ensureAddonPurchaseCatalog } from '../../fixtures/addon-purchase-flow.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    cleanupArrearsRows,
    DAY_MS,
    deliverNotices,
    type FakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { triggerCron } from '../../fixtures/billing-signup-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { latestOutbox, signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { purgeOwnListing, renameListing } from '../../fixtures/listing-notices.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADDON_NAME = 'E2E listing boost recurring';
// The purchase summary renders whole pesos ("$ 2.500"); other surfaces may add cents.
const PURCHASE_PRICE = /\$\s?2\.500(?:,00)?(?!\d)/;
const MAIL_TIMEOUT_MS = 30_000;

/** Assert the catalog's name, cycle and price in the pre-confirmation summary. */
async function inspectSummary(summary: Locator): Promise<void> {
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading')).toHaveText(esBilling.addonPurchase.summary);
    await expect(summary).toContainText(ADDON_NAME);
    await expect(summary).toContainText(esBilling.addonPurchase.cycle.monthly);
    await expect(summary).toContainText(PURCHASE_PRICE);
}

/** Confirm a fresh listing addon through the screen; its catalog is seeded, its instance is not. */
async function buyOnListing(args: {
    readonly page: Page;
    readonly listingId: string;
}): Promise<string> {
    const catalog = await ensureAddonPurchaseCatalog();
    const purchase = await buyRecurringAddon({
        page: args.page,
        productId: catalog.recurringProductId,
        listingId: args.listingId,
        inspectSummary
    });
    return purchase.instanceId;
}

/** Assert the case's own notice is queued before any provider cancellation, then deliver and retry. */
async function sendMailThenCancel(args: {
    readonly world: FakeWorld;
    readonly owner: CreatedUser;
    readonly admin: CreatedUser;
    readonly authorizationId: string;
    readonly template: string;
    readonly subject: string;
    readonly bodyText: string;
}): Promise<void> {
    await expect
        .poll(
            async () =>
                (
                    await latestOutbox({
                        userId: args.owner.id,
                        template: args.template
                    })
                )?.status
        )
        .toBe('pending');
    expect(countAddonCancellationPuts(args)).toBe(0);
    await triggerCron({ jobName: 'email-outbox-sender', adminCookie: args.admin.sessionCookie });
    const mail = await args.world.mailCapture.waitForMail({
        to: args.owner.email,
        subject: args.subject,
        timeoutMs: MAIL_TIMEOUT_MS
    });
    expect(mail.html).toContain(args.bodyText);
    await triggerCron({
        jobName: 'billing-deferred-cancellation-retry',
        adminCookie: args.admin.sessionCookie
    });
    expect(countAddonCancellationPuts(args)).toBe(1);
}

/** TEST:B10:16 exercises acquired recurring instances against built web and API with a local fake. */
test.describe('TEST:B10:16 AC:B10:14 the addon end to end @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let owner: CreatedUser;
    let admin: CreatedUser;
    let principalAuthorizationId = '';
    let principalAmount: unknown = null;
    let userIds: string[] = [];

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
        await seedCookieConsent(page);
        const principal = await signUpCardSubscriber({
            page,
            world,
            user: owner,
            slug: 'owner-basico'
        });
        principalAuthorizationId = principal.authorizationId;
        principalAmount = (
            await world.fakeServer.provider.readAuthorization({
                authorizationId: principal.authorizationId
            })
        ).snapshot.amount;
    });

    test.afterEach(async () => {
        const providerIds = namespace ? await addonProviderIds({ namespace }) : [];
        try {
            console.info(
                'TEST:B10:16 sweep candidates before cleanup:',
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                })
            );
        } finally {
            try {
                await world?.fakeServer.close();
            } finally {
                try {
                    await cleanupAddonEndToEnd({ userIds, providerIds });
                    await cleanupArrearsRows({ userIds });
                    await cleanupTestUsers(getDbPool(), userIds);
                } finally {
                    await world?.mailCapture.close().catch(() => undefined);
                    world = null;
                    namespace = '';
                    userIds = [];
                }
            }
        }
    });

    test('recurring addon bought from the screen is authorized on its own preapproval', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        // Only the immutable addon catalog is inserted; A1 creates the acquired instance.
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const instanceId = await buyOnListing({ page, listingId: listing.id });
        const pending = await readAddonInstance({ instanceId });
        expect(new Set([pending.authorizationId, principalAuthorizationId]).size).toBe(2);
        await world.fakeServer.provider.approve({ authorizationId: pending.authorizationId });
        await deliverNotices({ fakeServer: world.fakeServer });
        await expect
            .poll(async () => (await readAddonInstance({ instanceId })).status)
            .toBe('ACTIVE');
        const active = await readAddonInstance({ instanceId });
        expect({ instance: active.status, complement: active.complementStatus }).toEqual({
            instance: 'ACTIVE',
            complement: 'ACTIVE'
        });
        expect(
            (
                await world.fakeServer.provider.readAuthorization({
                    authorizationId: principalAuthorizationId
                })
            ).snapshot.amount
        ).toEqual(principalAmount);
    });

    test('abandoned recurring checkout: our mail first, then exactly one cancellation', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const instanceId = await buyOnListing({ page, listingId: listing.id });
        const pending = await readAddonInstance({ instanceId });
        await world.fakeServer.advanceClock({ ms: 4 * DAY_MS });
        await triggerCron({
            jobName: 'subscription-window-expiry',
            adminCookie: admin.sessionCookie
        });
        await sendMailThenCancel({
            world,
            owner,
            admin,
            authorizationId: pending.authorizationId,
            template: 'billing.addon-authorization-expired-cancel',
            subject: 'Venció la autorización de tu addon',
            bodyText: 'No se te cobró nada.'
        });
        const abandoned = await readAddonInstance({ instanceId });
        expect({ instance: abandoned.status, complement: abandoned.complementStatus }).toEqual({
            instance: 'ABANDONED',
            complement: 'ABANDONED'
        });
    });

    test('deleting the listing names the addon and its price, then A6 mails before cancelling', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const listingName = `TEST:B10:16 listing ${listing.id.slice(0, 8)}`;
        await renameListing({ listingId: listing.id, name: listingName });
        const instanceId = await buyOnListing({ page, listingId: listing.id });
        const pending = await readAddonInstance({ instanceId });
        await world.fakeServer.provider.approve({ authorizationId: pending.authorizationId });
        await deliverNotices({ fakeServer: world.fakeServer });
        await expect
            .poll(async () => (await readAddonInstance({ instanceId })).status)
            .toBe('ACTIVE');

        await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
        const card = page
            .getByRole('list', { name: 'Mis propiedades' })
            .getByRole('listitem')
            .filter({ hasText: listingName });
        await expect(card).toHaveCount(1);
        await card.getByRole('button', { name: 'Eliminar', exact: true }).click();
        await expect(card.getByTestId('purge-lost-addons')).toHaveAttribute('data-count', '1');
        const lost = card.getByTestId('purge-lost-addon');
        await expect(lost).toHaveCount(1);
        await expect(lost).toContainText(ADDON_NAME);
        await expect(lost).toContainText(PURCHASE_PRICE);

        await purgeOwnListing({ ownerCookie: owner.sessionCookie, listingId: listing.id });
        await sendMailThenCancel({
            world,
            owner,
            admin,
            authorizationId: pending.authorizationId,
            template: 'billing.addon-listing-purged-cancel',
            subject: 'Cancelamos el cobro del addon de una ficha que borraste',
            bodyText: 'El addon se consumió con la ficha'
        });
        const cancelled = await readAddonInstance({ instanceId });
        expect({ instance: cancelled.status, complement: cancelled.complementStatus }).toEqual({
            instance: 'CANCELLED',
            complement: 'CANCELLED'
        });
    });
});
