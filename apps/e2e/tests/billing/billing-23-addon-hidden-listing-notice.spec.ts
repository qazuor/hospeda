import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import esBilling from '../../../../packages/i18n/src/locales/es/billing.json';
import {
    cleanupAddonPurchaseRows,
    ensureAddonPurchaseCatalog,
    openAddonPurchase
} from '../../fixtures/addon-purchase-flow.ts';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { cleanupArrearsRows, type FakeWorld } from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

type ProductClass = 'ONE_TIME' | 'RECURRING';
const cases = [
    { status: PublicationStatusEnum.DRAFT, productClass: 'ONE_TIME' },
    { status: PublicationStatusEnum.DRAFT, productClass: 'RECURRING' },
    { status: PublicationStatusEnum.ARCHIVED, productClass: 'ONE_TIME' },
    { status: PublicationStatusEnum.ARCHIVED, productClass: 'RECURRING' },
    { status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING, productClass: 'ONE_TIME' },
    { status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING, productClass: 'RECURRING' },
    { status: PublicationStatusEnum.PUBLISHED, productClass: 'ONE_TIME' },
    { status: PublicationStatusEnum.PUBLISHED, productClass: 'RECURRING' }
] as const satisfies ReadonlyArray<{
    readonly status: PublicationStatusEnum;
    readonly productClass: ProductClass;
}>;

/**
 * TEST:B10:13 AC:B10:11. Preconditions: E2E seed with owner-basico billing
 * option, local fake provider and mail capture, and the immutable fixture
 * catalog created by ensureAddonPurchaseCatalog. Each case owns its host,
 * paying principal and listing. No purchase is confirmed.
 */
test.describe('TEST:B10:13 AC:B10:11 the hidden-listing notice before buying a feature @p0 @host @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let userIds: string[] = [];

    test.beforeEach(async ({ page }) => {
        providerNamespace = randomUUID();
        userIds = [];
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B10:13 needs the credited principal before the addon offer read.'
                    },
                    {
                        lie: 'M8',
                        why: 'TEST:B10:13 records the principal paid cycle before opening the screen.'
                    }
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
        const user = await createUser({ role: 'HOST' });
        userIds.push(user.id);
        await markProfileCompleted({ userId: user.id });
        await seedCookieConsent(page);
        await signUpCardSubscriber({ page, world, user, slug: 'owner-basico' });
    });

    test.afterEach(async () => {
        const providerIds = providerNamespace
            ? (
                  await execSQL<{ provider_id: string }>(
                      'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                      [`fake-auth-${providerNamespace}-%`]
                  )
              ).map((row) => row.provider_id)
            : [];
        try {
            console.info(
                'TEST:B10:13 sweep candidates before cleanup:',
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
                    await cleanupAddonPurchaseRows({ userIds, providerIds });
                    await cleanupArrearsRows({ userIds });
                    await cleanupTestUsers(getDbPool(), userIds);
                } finally {
                    await world?.mailCapture.close().catch(() => undefined);
                    world = null;
                    providerNamespace = '';
                    userIds = [];
                }
            }
        }
    });

    for (const { status, productClass } of cases) {
        test(`${status} ${productClass}: summary and correct pre-confirmation notice`, async ({
            page
        }) => {
            if (!world || userIds.length !== 1) throw new Error('Expected case-local paid host.');
            const catalog = await ensureAddonPurchaseCatalog();
            const productId =
                productClass === 'ONE_TIME' ? catalog.oneTimeProductId : catalog.recurringProductId;
            const listing = await createAccommodation({
                ownerId: userIds[0]!,
                publicationStatus: status
            });
            await openAddonPurchase({ page, productId, listingId: listing.id });
            const summary = page.getByTestId('addon-purchase-summary');
            await expect(summary).toBeVisible();
            const notice = summary.getByTestId('addon-hidden-listing-notice');
            if (status === PublicationStatusEnum.PUBLISHED) {
                await expect(notice).toHaveCount(0);
            } else {
                const kind = productClass === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING';
                const copy =
                    productClass === 'ONE_TIME'
                        ? esBilling.addonPurchase.hiddenListingOneTime
                        : esBilling.addonPurchase.hiddenListingRecurring;
                await expect(notice).toBeVisible();
                await expect(notice).toHaveAttribute('data-notice-kind', kind);
                await expect(notice).toHaveText(copy);
            }
            await expect(summary.getByTestId('addon-purchase-confirm')).toBeVisible();
        });
    }
});
