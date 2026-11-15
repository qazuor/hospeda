import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import esAdmin from '../../../../packages/i18n/src/locales/es/admin-entities.json' with {
    type: 'json'
};
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json' with { type: 'json' };
import esListing from '../../../../packages/i18n/src/locales/es/listing.json' with { type: 'json' };
import { cleanupAddonPurchaseRows } from '../../fixtures/addon-purchase-flow.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cancelRequestsFor,
    cleanupArrearsRows,
    type FakeWorld,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { createRecurringAddonLive } from '../../fixtures/recurring-addon-live.ts';
import { attachSession } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18300';

async function useAdminSession(page: Page, cookie: string): Promise<void> {
    await page.context().addCookies(
        cookie.split('; ').map((part) => {
            const [name, ...value] = part.split('=');
            return { name: name ?? '', value: value.join('='), url: ADMIN_URL };
        })
    );
}

/** TEST:B13b:1 starts from a real paid principal and a protected API add-on purchase. */
test.describe('TEST:B13b:1 AC:B13b:1 AC:B13b:4 moderating a listing with a live recurring feature @p0 @admin @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let owner: CreatedUser | null = null;
    let admin: CreatedUser | null = null;

    test.beforeEach(async ({ page }) => {
        namespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: namespace,
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B13b:1 needs the principal credited before add-on purchase.'
                    },
                    { lie: 'M8', why: 'TEST:B13b:1 needs the paid principal cycle in the API.' }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
        owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        await markAdminToursSeen({ userId: admin.id });
        await markProfileCompleted({ userId: owner.id });
        await attachSession(page, owner.sessionCookie);
    });

    test.afterEach(async () => {
        const ids = [owner?.id, admin?.id].filter((id): id is string => Boolean(id));
        const providerIds = namespace
            ? (
                  await execSQL<{ provider_id: string }>(
                      'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                      [`fake-auth-${namespace}-%`]
                  )
              ).map((row) => row.provider_id)
            : [];
        try {
            await world?.fakeServer.close();
        } finally {
            try {
                await cleanupAddonPurchaseRows({ userIds: ids, providerIds });
                await cleanupArrearsRows({ userIds: ids });
                await cleanupTestUsers(getDbPool(), ids);
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                owner = null;
                admin = null;
                namespace = '';
            }
        }
    });

    test('the moderation notice names the charged recurring feature, offers withdrawal, and withdrawal cancels it', async ({
        page,
        browser
    }) => {
        if (!world || !owner || !admin)
            throw new Error('Expected case-local actors and fake world.');
        const live = await createRecurringAddonLive({ page, world, owner });
        const adminContext = await browser.newContext();
        try {
            const adminPage = await adminContext.newPage();
            await useAdminSession(adminPage, admin.sessionCookie);
            await adminPage.goto(`${ADMIN_URL}/accommodations/${live.listingId}`);
            const card = adminPage.getByTestId('listing-moderation');
            await expect(card.getByTestId('listing-moderation-action-TAKE_DOWN')).toBeVisible();
            await card.getByTestId('listing-moderation-action-TAKE_DOWN').click();
            const dialog = adminPage.getByTestId('listing-moderation-dialog');
            await expect(dialog.getByTestId('moderation-recurring-addon')).toHaveText(
                live.addonName
            );
            await expect(dialog).toContainText(
                esAdmin.listingModeration.dialog.takeDown.recurringChargeNotice
            );
            await dialog.getByTestId('listing-moderation-reason').fill('Fotos incorrectas');
            await dialog.getByTestId('listing-moderation-confirm').click();
            await expect
                .poll(
                    async () =>
                        (
                            await execSQL<{ publication_status: string }>(
                                'SELECT publication_status FROM accommodations WHERE id = $1',
                                [live.listingId]
                            )
                        )[0]?.publication_status
                )
                .toBe('MODERATED');

            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            await expect
                .poll(
                    () =>
                        world?.mailCapture
                            .mailsTo({ to: owner!.email })
                            .filter((mail) => mail.html.includes(live.addonName)).length
                )
                .toBe(1);
            const mail = world.mailCapture
                .mailsTo({ to: owner.email })
                .find((item) => item.html.includes(live.addonName));
            expect(mail?.html).toContain(
                `/es/mi-cuenta/complementos/?listing=${live.listingId}#recurring-addons`
            );

            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            const notice = page
                .getByTestId('listing-notice')
                .filter({ hasText: esListing.notices.moderated.title });
            await expect(notice.getByTestId('listing-notice-recurring-addon')).toHaveText(
                live.addonName
            );
            await expect(notice.getByTestId('listing-notice-withdraw-link')).toHaveText(
                esListing.notices.moderated.withdrawLink
            );
            await notice.getByTestId('listing-notice-withdraw-link').click();
            const row = page.getByTestId(`recurring-addon-${live.instanceId}`);
            await expect(row).toBeVisible();
            await expect(row).toContainText(live.addonName);
            await row.getByTestId(`recurring-addon-withdraw-${live.instanceId}`).click();
            await expect(row.getByTestId('recurring-addon-withdraw-confirm')).toContainText(
                esBilling.addonPurchase.recurringAddons.confirmText
            );
            await row
                .getByTestId('recurring-addon-withdraw-confirm')
                .getByRole('button', { name: esBilling.addonPurchase.recurringAddons.confirm })
                .click();
            await expect(page.getByTestId('recurring-addon-withdrawn')).toHaveText(
                esBilling.addonPurchase.recurringAddons.withdrawn
            );
            const [instance] = await execSQL<{ status: string }>(
                'SELECT status FROM addon_instance WHERE id = $1',
                [live.instanceId]
            );
            expect(instance?.status).toBe('CANCELLED');
            const outbox = await execSQL<{ status: string; template: string }>(
                `SELECT status, template FROM email_outbox WHERE recipient_user_id = $1
                 AND template = 'billing.addon-cancelled' AND payload->>'subscriptionId' = $2`,
                [owner.id, live.complementSubscriptionId]
            );
            expect(outbox).toEqual([{ status: 'pending', template: 'billing.addon-cancelled' }]);
            expect(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: live.addonAuthorizationId
                })
            ).toHaveLength(0);
            const mailsBeforeCancellation = world.mailCapture.mailsTo({ to: owner.email }).length;
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const deliveredOutbox = await execSQL<{ status: string; template: string }>(
                `SELECT status, template FROM email_outbox WHERE recipient_user_id = $1
                 AND template = 'billing.addon-cancelled' AND payload->>'subscriptionId' = $2`,
                [owner.id, live.complementSubscriptionId]
            );
            expect(deliveredOutbox).toEqual([
                { status: 'sent', template: 'billing.addon-cancelled' }
            ]);
            expect(world.mailCapture.mailsTo({ to: owner.email })).toHaveLength(
                mailsBeforeCancellation + 1
            );
            expect(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: live.addonAuthorizationId
                })
            ).toHaveLength(0);
            await runCron({
                jobName: 'billing-deferred-cancellation-retry',
                adminCookie: admin.sessionCookie
            });
            expect(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: live.addonAuthorizationId
                })
            ).toHaveLength(1);
            expect(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: live.principalAuthorizationId
                })
            ).toHaveLength(0);
        } finally {
            await adminContext.close();
        }
    });

    test('without recurring features the moderation dialog and owner notice show none', async ({
        page,
        browser
    }) => {
        if (!world || !owner || !admin)
            throw new Error('Expected case-local actors and fake world.');
        await signUpCardSubscriber({ page, world, user: owner, slug: 'owner-basico' });
        // E2E setup seeds only the PUBLISHED listing; this case makes no add-on purchase.
        const listing = await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'b13b-none'
        });
        const adminContext = await browser.newContext();
        try {
            const adminPage = await adminContext.newPage();
            await useAdminSession(adminPage, admin.sessionCookie);
            await adminPage.goto(`${ADMIN_URL}/accommodations/${listing.id}`);
            const card = adminPage.getByTestId('listing-moderation');
            await expect(card.getByTestId('listing-moderation-action-TAKE_DOWN')).toBeVisible();
            await card.getByTestId('listing-moderation-action-TAKE_DOWN').click();
            const dialog = adminPage.getByTestId('listing-moderation-dialog');
            await expect(dialog.getByTestId('moderation-recurring-addon')).toHaveCount(0);
            await dialog.getByTestId('listing-moderation-reason').fill('Fotos incorrectas');
            await dialog.getByTestId('listing-moderation-confirm').click();
            await expect
                .poll(
                    async () =>
                        (
                            await execSQL<{ publication_status: string }>(
                                'SELECT publication_status FROM accommodations WHERE id = $1',
                                [listing.id]
                            )
                        )[0]?.publication_status
                )
                .toBe('MODERATED');
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            const notice = page
                .getByTestId('listing-notice')
                .filter({ hasText: esListing.notices.moderated.title });
            await expect(notice).toBeVisible();
            await expect(notice.getByTestId('listing-notice-recurring-addon')).toHaveCount(0);
            await expect(notice.getByTestId('listing-notice-withdraw-link')).toHaveCount(0);
        } finally {
            await adminContext.close();
        }
    });
});
