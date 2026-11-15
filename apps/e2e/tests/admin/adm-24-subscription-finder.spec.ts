import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import esBilling from '../../../../packages/i18n/src/locales/es/admin-billing.json' with {
    type: 'json'
};
import esMenu from '../../../../packages/i18n/src/locales/es/admin-menu.json' with { type: 'json' };
import {
    type CreatedUser,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { useAdminSession } from '../../fixtures/revocation-flow.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const copy = esBilling.subscriptionAdmin;

/** Case-local fake provider plus its adjustable clock. */
interface FinderWorld {
    readonly clock: ReturnType<typeof createAdjustableClock>;
    readonly fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>>;
}

/** Builds the admin list URL, where the finder lives. */
const listUrl = `${ADMIN_URL}/billing/subscriptions`;
/** Builds the admin detail URL for one subscription. */
const detailUrl = (subscriptionId: string): string =>
    `${ADMIN_URL}/billing/subscriptions/${subscriptionId}`;
/** Matches the detail pathname with or without its trailing slash. */
const detailPattern = (subscriptionId: string): RegExp =>
    new RegExp(`/billing/subscriptions/${subscriptionId}/?$`);
/** Matches the pause action pathname. */
const pausePattern = (subscriptionId: string): RegExp =>
    new RegExp(`/billing/subscriptions/${subscriptionId}/pause$`);

/**
 * Requires the suite's `owner-basico` catalog, the E2E API and admin builds,
 * and the case-local fake payment provider. Every row is created by the test:
 * it signs up an owner and a SUPER_ADMIN, opens a real monthly card checkout
 * through the fake provider and activates it, and (in the ADMIN case) signs up
 * a plain ADMIN. Cleanup runs by id and asserts the reconciliation sweep sees
 * no terminal candidate for those accounts. Playwright is not run locally: the
 * `E2E P0` CI job executes it.
 */
test.describe('HOS-2081 CA-1 CA-2 CA-3 encontrar una suscripción por email y llegar a sus acciones @p0 @admin @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FinderWorld | null = null;
    let providerNamespace: string | null = null;
    let userIds: string[] = [];
    let dialogs: string[] = [];

    test.beforeEach(async ({ page }) => {
        dialogs = [];
        page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });
        const clock = createAdjustableClock({ start: new Date() });
        providerNamespace = randomUUID();
        const provider = new FakePaymentProvider({
            clock,
            idNamespace: providerNamespace,
            honestAbout: [
                {
                    lie: 'M6',
                    why: 'HOS-2081 activates the card authorization so the finder sees an ACTIVE subscription.'
                },
                {
                    lie: 'M8',
                    why: 'HOS-2081 reads active billing state from the finder detail.'
                }
            ]
        });
        world = {
            clock,
            fakeServer: await startE2eFakeProvider({ provider, clock })
        };
    });

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
            const providerIds =
                userIds.length > 0
                    ? (
                          await execSQL<{ provider_id: string }>(
                              `SELECT provider_id FROM provider_link
                                WHERE subscription_id IN
                                  (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
                              [userIds]
                          )
                      ).map(({ provider_id }) => provider_id)
                    : [];
            await cleanupArrearsRows({ userIds });
            const candidates = await describeSweepCandidates({
                includeUserIds: userIds,
                includeProviderIds: providerIds
            });
            // biome-ignore lint/suspicious/noConsole: The CI log records cleanup evidence.
            console.log(`[sweep-candidates] HOS-2081 ${JSON.stringify(candidates)}`);
            expect(candidates).toEqual([]);
        } finally {
            world = null;
            providerNamespace = null;
            userIds = [];
            expect(dialogs, 'native dialogs are forbidden').toEqual([]);
        }
    });

    test('HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID; CA-2 desde el detalle llega a cada acción para la que tiene permiso; CA-3 el breadcrumb de las acciones enlaza al detalle', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await monthlyOptionForSlug('owner-basico')
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        await seedCookieConsent(page);
        await useAdminSession({ page, admin: subscriber.admin, adminUrl: ADMIN_URL });

        // CA-1: reach the list directly and search by the OWNER email, never by id.
        await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('subscriptions-list')).toBeVisible();
        await page.getByTestId('subscriptions-search').fill(subscriber.user.email);
        await expect(page.getByTestId('subscriptions-row')).toHaveCount(1);
        await expect(page.getByTestId('subscriptions-row')).toContainText(subscriber.user.email);

        // CA-2: the row opens the detail, which shows the localized ACTIVE label.
        await page.getByTestId('subscriptions-row').click();
        await expect(page).toHaveURL(detailPattern(card.subscriptionId));
        await expect(page.getByTestId('subscription-detail')).toBeVisible();
        await expect(page.getByTestId('subscription-detail')).toContainText(copy.statuses.ACTIVE);
        const actionLinks = page.getByTestId('subscription-action-links');
        await expect(actionLinks.getByRole('link')).toHaveCount(5);
        await page.getByTestId('subscription-action-pause').click();
        await expect(page).toHaveURL(pausePattern(card.subscriptionId));
        await expect(page.getByTestId('billing-pause-screen')).toBeVisible();

        // CA-3: the breadcrumb crumb for the detail links back to it.
        const detailCrumb = page.getByRole('link', {
            name: esMenu.billing.subscription,
            exact: true
        });
        await expect(detailCrumb).toHaveAttribute(
            'href',
            `/billing/subscriptions/${card.subscriptionId}`
        );
        await detailCrumb.click();
        await expect(page).toHaveURL(detailPattern(card.subscriptionId));
        await expect(page.getByTestId('subscription-detail')).toBeVisible();
    });

    test('HOS-2081 CA-2 desde el detalle llega a cada acción para la que tiene permiso; las que no puede ejecutar no se muestran', async ({
        browser
    }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const subscriber = await createSubscriber();
        const admin: CreatedUser = await createUser({ role: 'ADMIN' }, { apiBaseUrl: API_URL });
        await markProfileCompleted({ userId: admin.id });
        await markAdminToursSeen({ userId: admin.id });
        userIds.push(subscriber.user.id, subscriber.admin.id, admin.id);
        // The E2E database does not give the ADMIN role INSPECT, so grant it explicitly
        // (same as adm-13) and leave every action permission absent.
        const inspectGrant = await fetch(`${API_URL}/api/v1/admin/users/${admin.id}/permissions`, {
            method: 'POST',
            headers: {
                cookie: subscriber.admin.sessionCookie,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ permission: 'billing.subscription.inspect', effect: 'grant' })
        });
        expect(inspectGrant.ok).toBe(true);
        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await monthlyOptionForSlug('owner-basico')
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });

        const context = await browser.newContext();
        try {
            const adminPage = await context.newPage();
            adminPage.on('dialog', async (dialog) => {
                dialogs.push(dialog.message());
                await dialog.dismiss();
            });
            await seedCookieConsent(adminPage);
            await useAdminSession({ page: adminPage, admin, adminUrl: ADMIN_URL });

            // The ADMIN holds INSPECT only, so the detail renders with no action.
            await adminPage.goto(detailUrl(card.subscriptionId), {
                waitUntil: 'domcontentloaded'
            });
            await expect(adminPage.getByTestId('subscription-detail')).toBeVisible();
            const actionLinks = adminPage.getByTestId('subscription-action-links');
            await expect(actionLinks).toBeVisible();
            await expect(actionLinks.getByRole('link')).toHaveCount(0);
            await expect(actionLinks).toContainText(copy.actions.noPermissions);
        } finally {
            await context.close();
        }
    });
});
