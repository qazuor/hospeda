import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json' with { type: 'json' };
import { cleanupAddonEndToEnd } from '../../fixtures/addon-end-to-end.ts';
import { openAddonPurchase } from '../../fixtures/addon-purchase-flow.ts';
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
    type FakeWorld,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import {
    cleanupFeaturedAddonPayments,
    ensureFeaturedBoostCatalog
} from '../../fixtures/listing-featured.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { attachSession, seedActivePlanHolder } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/** The https origin the fake `init_point` advertises; the browser test forwards it (G10). */
const FAKE_SCREEN_ORIGIN = 'https://payments-fake.invalid';
const PURCHASE_PATH = '/api/v1/protected/billing/addons/purchases';
const ONE_TIME_PRICE = /\$\s?1\.500(?:,00)?(?!\d)/;

/**
 * A fake world whose lies are all ON: notices come late or never (M6), so the only way the
 * purchase is confirmed is the return re-read by id (HOS-2179 §5.3 path 2).
 */
async function startLyingWorld(): Promise<FakeWorld> {
    const clock = createAdjustableClock({ start: new Date() });
    const fakeServer = await startE2eFakeProvider({
        provider: new FakePaymentProvider({
            allowLocalHttpReturnUrl: true,
            clock,
            idNamespace: randomUUID()
        }),
        clock
    });
    try {
        return { clock, fakeServer, mailCapture: await startE2eMailCapture() };
    } catch (error) {
        await fakeServer.close();
        throw error;
    }
}

/**
 * Forward the advertised payment screen origin to the local fake server, keeping redirects
 * unfollowed so the approval's 302 back to the site reaches the browser.
 */
async function forwardFakeScreen(args: {
    readonly page: Page;
    readonly world: FakeWorld;
}): Promise<void> {
    await args.page.route(`${FAKE_SCREEN_ORIGIN}/**`, async (route) => {
        const advertised = new URL(route.request().url());
        const target = new URL(
            `${advertised.pathname}${advertised.search}`,
            args.world.fakeServer.url
        );
        const response = await route.fetch({ url: target.toString(), maxRedirects: 0 });
        await route.fulfill({ response });
    });
}

/** Confirm the one-time summary and follow its button to the fake payment screen. */
async function goToPaymentPage(args: {
    readonly page: Page;
    readonly productId: string;
    readonly listingId: string;
}): Promise<{ readonly orderRequestId: string }> {
    await openAddonPurchase(args);
    const summary = args.page.getByTestId('addon-purchase-summary');
    await expect(summary).toContainText('E2E HOS-2138 boost one-time accommodation');
    await expect(summary).toContainText(ONE_TIME_PRICE);
    await expect(args.page.getByTestId('addon-one-time-summary')).toHaveText(
        esBilling.addonPurchase.oneTimeSummary
    );
    await expect(args.page.getByTestId('addon-instant-methods')).toHaveText(
        esBilling.addonPurchase.instantMethodsOnly
    );
    // P-8 and §6.2: no card field and no payer email on a one-time purchase.
    await expect(summary.locator('input')).toHaveCount(0);
    const request = args.page.waitForRequest(
        (candidate) =>
            new URL(candidate.url()).pathname === PURCHASE_PATH && candidate.method() === 'POST'
    );
    const confirm = args.page.getByTestId('addon-purchase-confirm');
    await expect(confirm).toHaveText(esBilling.addonPurchase.payWithMercadoPago);
    await confirm.click();
    const body = (await request).postDataJSON() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
        ['addonVersionId', 'orderRequestId', 'productId', 'targetId'].sort()
    );
    await args.page.waitForURL((url) => url.origin === FAKE_SCREEN_ORIGIN);
    return { orderRequestId: String(body.orderRequestId) };
}

/** Read one purchase's stored status. */
async function purchaseStatus(orderRequestId: string): Promise<string | undefined> {
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM addon_instance WHERE order_request_id = $1',
        [orderRequestId]
    );
    return rows[0]?.status;
}

/** HOS-2179 T-6 sells a one-time addon through the fake payment page with every lie ON. */
test.describe('HOS-2179 T-6 one-time addon on the payment page @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let owner: CreatedUser;
    let admin: CreatedUser;
    let userIds: string[] = [];
    let listingId = '';
    let catalog: { readonly productId: string; readonly addonVersionId: string };

    test.beforeEach(async ({ page }) => {
        world = await startLyingWorld();
        userIds = [];
        owner = await createUser({ role: 'HOST' });
        userIds.push(owner.id);
        await markProfileCompleted({ userId: owner.id });
        admin = await createUser({ role: 'SUPER_ADMIN' });
        userIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        // The principal is seeded, not bought: buying it would need the notices M6 withholds.
        await seedActivePlanHolder({ userId: owner.id, slug: 'owner-basico' });
        listingId = (
            await createAccommodation({
                ownerId: owner.id,
                publicationStatus: PublicationStatusEnum.PUBLISHED
            })
        ).id;
        catalog = await ensureFeaturedBoostCatalog({ kind: 'one-time', vertical: 'accommodation' });
        await seedCookieConsent(page);
        await attachSession(page, owner.sessionCookie);
        await forwardFakeScreen({ page, world });
    });

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
        } finally {
            try {
                await cleanupFeaturedAddonPayments({ userIds });
                await cleanupAddonEndToEnd({ userIds, providerIds: [] });
                await cleanupArrearsRows({ userIds });
                await cleanupTestUsers(getDbPool(), userIds);
            } finally {
                await world?.mailCapture.close().catch(() => undefined);
                world = null;
                userIds = [];
            }
        }
    });

    test('an approved payment activates the addon when the owner comes back', async ({ page }) => {
        const { orderRequestId } = await goToPaymentPage({
            page,
            productId: catalog.productId,
            listingId
        });
        await page.getByRole('button', { name: 'Aprobar pago' }).click();
        await page.waitForURL(
            (url) => url.origin === WEB_URL && url.searchParams.get('compra') === orderRequestId
        );
        // No notice arrives (M6): the screen's read re-reads the payment by id and activates it.
        await expect(page.getByTestId('addon-purchase-active')).toHaveText(
            esBilling.addonPurchase.active
        );
        expect(await purchaseStatus(orderRequestId)).toBe('ACTIVE');
    });

    test('a rejected payment keeps the purchase waiting, and a retry on the page activates it', async ({
        page
    }) => {
        const { orderRequestId } = await goToPaymentPage({
            page,
            productId: catalog.productId,
            listingId
        });
        const paymentPage = page.url();
        await page.getByRole('button', { name: 'Rechazar pago' }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await page.getByRole('link', { name: 'Volver al sitio' }).click();
        await page.waitForURL((url) => url.origin === WEB_URL);
        // `status=rejected` in the return URL is never read: the purchase is still waiting.
        await expect(page.getByTestId('addon-purchase-processing')).toHaveText(
            esBilling.addonPurchase.waitingPayment
        );
        expect(await purchaseStatus(orderRequestId)).toBe('PENDING_AUTHORIZATION');
        await page.goto(paymentPage);
        await page.getByRole('button', { name: 'Aprobar pago' }).click();
        await page.waitForURL(
            (url) => url.origin === WEB_URL && url.searchParams.get('compra') === orderRequestId
        );
        await expect(page.getByTestId('addon-purchase-active')).toHaveText(
            esBilling.addonPurchase.active
        );
        expect(await purchaseStatus(orderRequestId)).toBe('ACTIVE');
    });

    test('an unpaid page expires, and coming back says so', async ({ page }) => {
        if (!world) throw new Error('Expected case-local fake world.');
        const { orderRequestId } = await goToPaymentPage({
            page,
            productId: catalog.productId,
            listingId
        });
        // Past the page duration plus its margin (PLAZO:21), A3 searches, finds no payment and
        // abandons the purchase.
        await world.fakeServer.advanceClock({ ms: 3 * DAY_MS });
        await runCron({ jobName: 'subscription-window-expiry', adminCookie: admin.sessionCookie });
        expect(await purchaseStatus(orderRequestId)).toBe('ABANDONED');
        await page.goto(`${WEB_URL}/es/mi-cuenta/complementos/?compra=${orderRequestId}`);
        await expect(page.getByTestId('addon-purchase-closed')).toHaveText(
            esBilling.addonPurchase.pageExpired
        );
    });
});
