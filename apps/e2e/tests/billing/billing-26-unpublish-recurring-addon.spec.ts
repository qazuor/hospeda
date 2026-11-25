import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PublicationStatusEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import esHost from '../../../../packages/i18n/src/locales/es/host.json' with { type: 'json' };
import { cleanupAddonPurchaseRows } from '../../fixtures/addon-purchase-flow.ts';
import {
    type CreatedUser,
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cleanupArrearsRows,
    type FakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { signUpCardSubscriber } from '../../fixtures/cancellation-flow.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { ALL_PROPERTY_LISTS } from '../../fixtures/owner-lists.ts';
import { openPropertyCardConfirm } from '../../fixtures/property-card-actions.ts';
import { createRecurringAddonLive } from '../../fixtures/recurring-addon-live.ts';
import { attachSession } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

/** TEST:B13b:2 checks the inline owner confirmation after the real subscription setup. */
test.describe('TEST:B13b:2 AC:B13b:2 AC:B13b:4 unpublishing a listing with a live recurring feature @p0 @host @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let namespace = '';
    let owner: CreatedUser | null = null;

    test.beforeEach(async ({ page }) => {
        namespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                allowLocalHttpReturnUrl: true,
                clock,
                idNamespace: namespace,
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B13b:2 needs the principal credited before add-on purchase.'
                    },
                    { lie: 'M8', why: 'TEST:B13b:2 needs the paid principal cycle in the API.' }
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
        await markProfileCompleted({ userId: owner.id });
        await attachSession(page, owner.sessionCookie);
    });

    test.afterEach(async () => {
        const ids = owner ? [owner.id] : [];
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
                namespace = '';
            }
        }
    });

    test('the confirmation names the recurring feature and its continuing charge and offers withdrawal', async ({
        page
    }) => {
        if (!world || !owner) throw new Error('Expected case-local owner and fake world.');
        const live = await createRecurringAddonLive({ page, world, owner });
        await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
        // HOS-2483: the card is a list item of «Mis propiedades»; Despublicar
        // lives in its «Más acciones» menu and confirms in a dialog.
        const card = page
            .getByRole('list', { name: ALL_PROPERTY_LISTS })
            .getByRole('listitem')
            .filter({ has: page.getByRole('heading', { level: 3 }) });
        await expect(card).toHaveCount(1);
        const confirm = await openPropertyCardConfirm({
            page,
            card,
            action: esHost.properties.card.actions.unpublish
        });
        await expect(confirm.getByTestId('unpublish-recurring-addon')).toHaveText(live.addonName);
        await expect(confirm.getByTestId('unpublish-recurring-note')).toHaveText(
            esHost.properties.card.unpublishRecurringNote_one.replace('{{count}}', '1')
        );
        await expect(confirm.getByTestId('unpublish-recurring-withdraw-link')).toHaveText(
            esHost.properties.card.recurringWithdrawLink
        );
        await expect(confirm.getByTestId('unpublish-recurring-withdraw-link')).toHaveAttribute(
            'href',
            `/es/mi-cuenta/complementos/?listing=${live.listingId}#recurring-addons`
        );
    });

    test('without recurring features the confirmation shows no feature, charge note, or withdrawal link', async ({
        page
    }) => {
        if (!world || !owner) throw new Error('Expected case-local owner and fake world.');
        await signUpCardSubscriber({ page, world, user: owner, slug: 'owner-basico' });
        // E2E setup seeds only the PUBLISHED listing; no add-on purchase occurs.
        await createAccommodation({
            ownerId: owner.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            slugPrefix: 'b13b-unpublish-none'
        });
        await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
        // HOS-2483: the card is a list item of «Mis propiedades»; Despublicar
        // lives in its «Más acciones» menu and confirms in a dialog.
        const card = page
            .getByRole('list', { name: ALL_PROPERTY_LISTS })
            .getByRole('listitem')
            .filter({ has: page.getByRole('heading', { level: 3 }) });
        await expect(card).toHaveCount(1);
        const confirm = await openPropertyCardConfirm({
            page,
            card,
            action: esHost.properties.card.actions.unpublish
        });
        await expect(confirm.getByTestId('unpublish-recurring-addon')).toHaveCount(0);
        await expect(confirm.getByTestId('unpublish-recurring-note')).toHaveCount(0);
        await expect(confirm.getByTestId('unpublish-recurring-withdraw-link')).toHaveCount(0);
    });
});
