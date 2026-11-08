import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { addCalendarMonths } from '@repo/utils';
import esBilling from '../../../../packages/i18n/src/locales/es/admin-billing.json' with {
    type: 'json'
};
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    type FakeWorld,
    formatMarketDate
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupPermanentGrantE2eRows } from '../../fixtures/permanent-grant-flow.ts';
import { useAdminSession } from '../../fixtures/revocation-flow.ts';
import { annualOptionForSlug, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const copy = esBilling.temporaryCourtesy;
const uiDate = (date: Date) =>
    new Intl.DateTimeFormat('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(date);

async function openCourtesy(page: Page, subscriptionId: string): Promise<void> {
    await page.goto(`${ADMIN_URL}/billing/subscriptions/${subscriptionId}/courtesy`);
    await expect(page.getByTestId('temporary-courtesy-screen')).toBeVisible();
}

async function grantThroughScreen(page: Page, months: string, reason: string): Promise<void> {
    await page.getByLabel(copy.months).selectOption(months);
    await page.getByLabel(copy.reason).fill(reason);
    await page.getByRole('button', { name: copy.review }).click();
    await expect(page.getByTestId('courtesy-grant-confirmation')).toBeVisible();
    const responsePromise = page.waitForResponse(
        (response) =>
            response.url().includes('/courtesy/grant') && response.request().method() === 'POST'
    );
    await page
        .getByTestId('courtesy-grant-confirmation')
        .getByRole('button', {
            name: copy.confirm
        })
        .click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
}

test.describe('TEST:B9b:13 — the temporary courtesy confirmations say what happens (AC:B9b:14) @p0 @admin @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace: string | null = null;
    let userIds: string[] = [];
    let dialogs: string[] = [];

    test.beforeEach(async ({ page }, testInfo) => {
        dialogs = [];
        page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });
        const clock = createAdjustableClock({ start: new Date() });
        providerNamespace = randomUUID();
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    ...(testInfo.title.startsWith('annual plan')
                        ? [
                              {
                                  lie: 'M1' as const,
                                  why: 'TEST:B9b:13 annual authorization must retain its requested yearly cadence for the annual refusal screen.'
                              }
                          ]
                        : []),
                    { lie: 'M6', why: 'TEST:B9b:13 activates the card authorization.' },
                    { lie: 'M8', why: 'TEST:B9b:13 reads active billing state.' }
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
    });

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
            const providerIds = providerNamespace
                ? (
                      await execSQL<{ provider_id: string }>(
                          'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                          [`fake-auth-${providerNamespace}-%`]
                      )
                  ).map(({ provider_id }) => provider_id)
                : [];
            try {
                await cleanupPermanentGrantE2eRows({ userIds, providerIds });
            } finally {
                await cleanupArrearsRows({ userIds });
            }
            const candidates = await describeSweepCandidates({
                includeUserIds: userIds,
                includeProviderIds: providerIds
            });
            // biome-ignore lint/suspicious/noConsole: The CI log records cleanup evidence.
            console.log(`[sweep-candidates] TEST:B9b:13 ${JSON.stringify(candidates)}`);
            expect(candidates).toEqual([]);
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            world = null;
            providerNamespace = null;
            userIds = [];
            expect(dialogs, 'native dialogs are forbidden').toEqual([]);
        }
    });

    test('annual plan explains unavailability and both alternatives', async ({ page }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await annualOptionForSlug('owner-basico')
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        await seedCookieConsent(page);
        await useAdminSession({ page, admin: subscriber.admin, adminUrl: ADMIN_URL });
        await openCourtesy(page, card.subscriptionId);
        await expect(page.getByTestId('temporary-courtesy-screen')).toContainText(copy.rule);
        await expect(page.getByTestId('courtesy-unavailable')).toContainText('No disponible');
        await expect(page.getByTestId('courtesy-unavailable')).toContainText(
            copy.unavailableReason.replace('{reason}', 'NOT_MONTHLY')
        );
        await expect(page.getByTestId('courtesy-unavailable')).toContainText(copy.alternatives);
        await expect(page.getByTestId('courtesy-grant-review')).toHaveCount(0);
        const grants = await execSQL<{ id: string }>(
            'SELECT id FROM courtesy_grant WHERE beneficiary_user_id = $1',
            [subscriber.user.id]
        );
        expect(grants).toHaveLength(0);
    });

    test('an existing monthly courtesy adds two calendar months and confirms the new end', async ({
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
        await openCourtesy(page, card.subscriptionId);
        await grantThroughScreen(page, '1', 'TEST:B9b:13 grant');
        await expect(page.getByTestId('courtesy-result')).toContainText('Cortesía otorgada');
        const [initial] = await execSQL<{ id: string; ends_at: Date }>(
            'SELECT id, ends_at FROM courtesy_grant WHERE beneficiary_user_id = $1',
            [subscriber.user.id]
        );
        if (!initial) throw new Error('Expected courtesy granted through screen.');
        const nextEnd = addCalendarMonths({
            from: initial.ends_at,
            months: 2,
            dayOverflow: 'clamp'
        });
        await openCourtesy(page, card.subscriptionId);
        await page.getByLabel(copy.months).selectOption('2');
        await page.getByLabel(copy.reason).fill('TEST:B9b:13 extend');
        await page.getByRole('button', { name: copy.review }).click();
        await expect(page.getByTestId('courtesy-grant-confirmation')).toContainText(
            'Se suman 2 meses'
        );
        await expect(page.getByTestId('courtesy-grant-confirmation')).toContainText(
            uiDate(initial.ends_at)
        );
        await expect(page.getByTestId('courtesy-grant-confirmation')).toContainText(
            uiDate(nextEnd)
        );
        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().includes('/courtesy/grant') && response.request().method() === 'POST'
        );
        await page
            .getByTestId('courtesy-grant-confirmation')
            .getByRole('button', { name: copy.confirm })
            .click();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as { readonly data: { readonly outcome: string } };
        expect(body.data.outcome).toBe('EXTENDED');
        const [extended] = await execSQL<{ ends_at: Date }>(
            'SELECT ends_at FROM courtesy_grant WHERE id = $1',
            [initial.id]
        );
        expect(extended?.ends_at).toEqual(nextEnd);
        await expect(page.getByTestId('courtesy-result')).toContainText(uiDate(nextEnd));
    });

    test('revocation explains the loss, refund, ACTIVE and charge day', async ({ page }) => {
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
        await openCourtesy(page, card.subscriptionId);
        await grantThroughScreen(page, '1', 'TEST:B9b:13 revoke setup');
        const [grant] = await execSQL<{ id: string; ends_at: Date }>(
            'SELECT id, ends_at FROM courtesy_grant WHERE beneficiary_user_id = $1',
            [subscriber.user.id]
        );
        if (!grant) throw new Error('Expected courtesy granted through screen.');
        await openCourtesy(page, card.subscriptionId);
        const previewResponse = await page.request.get(
            `${API_URL}/api/v1/admin/billing-subscription/${card.subscriptionId}/courtesy/revoke-preview`
        );
        expect(previewResponse.status()).toBe(200);
        const preview = (await previewResponse.json()) as {
            readonly data: { readonly predictedNextChargeAt: string | null };
        };
        if (!preview.data.predictedNextChargeAt) throw new Error('Expected predicted next charge.');
        const chargeDay = new Date(preview.data.predictedNextChargeAt);
        await page.getByRole('button', { name: copy.reviewRevoke }).click();
        const confirmation = page.getByTestId('courtesy-revoke-confirmation');
        await expect(confirmation).toContainText('pierde la cortesía que le quedaba');
        await expect(confirmation).toContainText(uiDate(grant.ends_at));
        await expect(confirmation).toContainText('sin reembolso');
        await expect(confirmation).toContainText('ACTIVE');
        await expect(
            confirmation,
            `predicted charge: ${formatMarketDate(chargeDay)}`
        ).toContainText(uiDate(chargeDay));
        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().includes('/courtesy/revoke') &&
                response.request().method() === 'POST'
        );
        await confirmation.getByRole('button', { name: copy.confirm }).click();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        const [state] = await execSQL<{ status: string }>(
            `SELECT s.status
             FROM subscription s JOIN courtesy_grant cg ON cg.beneficiary_user_id = s.user_id
             WHERE s.id = $1 AND cg.id = $2`,
            [card.subscriptionId, grant.id]
        );
        expect(state?.status).toBe('ACTIVE');
        const revocationClock = world.clock;
        await expect
            .poll(async () => {
                const [current] = await execSQL<{ ends_at: Date }>(
                    'SELECT ends_at FROM courtesy_grant WHERE id = $1',
                    [grant.id]
                );
                return current !== undefined && current.ends_at <= revocationClock.now();
            })
            .toBe(true);
        const body = (await response.json()) as {
            readonly data: { readonly nextCharge: { readonly at: string } | null };
        };
        if (!body.data.nextCharge) throw new Error('Expected confirmed charge day.');
        await expect(page.getByTestId('courtesy-result')).toContainText(
            uiDate(new Date(body.data.nextCharge.at))
        );
    });
});
