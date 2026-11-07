import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermanentGrantCreateResponseSchema } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import esBilling from '../../../../packages/i18n/src/locales/es/admin-billing.json' with {
    type: 'json'
};
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    type FakeWorld,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    cleanupPermanentGrantE2eRows,
    deferCurrentCourtesy,
    openPermanentGrantsScreen,
    seedCurrentCourtesy,
    seedDeferredCourtesy,
    seedTwoComplements
} from '../../fixtures/permanent-grant-flow.ts';
import { cancellationRequestsFor, useAdminSession } from '../../fixtures/revocation-flow.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const GRANT_CANCEL_SUBJECT = 'Tu suscripción ya no se cobra';
const ADDON_CANCEL_SUBJECT = 'Tu addon ya no se cobra';
const copy = esBilling.permanentGrants;
const marketDay = (date: Date) =>
    new Intl.DateTimeFormat('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(date);

async function previewGrant(page: Page, vertical: string, includesAddons: boolean): Promise<void> {
    await page.getByTestId('permanent-grant-grant-action').click();
    await page.getByTestId('permanent-grant-vertical').selectOption(vertical);
    await expect(page.getByTestId('permanent-grant-plan').locator('option')).not.toHaveCount(1);
    await page.getByTestId('permanent-grant-plan').selectOption({ index: 1 });
    if (includesAddons) await page.getByTestId('permanent-grant-includes-addons').check();
    await page.getByTestId('permanent-grant-reason').fill('TEST:B13a:5 grant');
    await page.getByTestId('permanent-grant-preview-submit').click();
    await expect(page.getByTestId('permanent-grant-confirmation')).toBeVisible();
}

test.describe('TEST:B13a:5 — the permanent grant confirmations say what happens (AC:B13a:6) @p0 @admin @billing @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let userIds: string[] = [];
    let dialogs: string[] = [];

    async function logForeignSweepCandidates(stage: string): Promise<void> {
        // biome-ignore lint/suspicious/noConsole: The CI log is the runtime evidence for this sweep.
        console.log(
            `[sweep-candidates] ${stage} ${JSON.stringify(
                await describeSweepCandidates({ excludeUserIds: userIds })
            )}`
        );
    }

    test.beforeAll(async () => {
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B13a:5 activates the card authorization via its notice.'
                    },
                    { lie: 'M8', why: 'TEST:B13a:5 reads active billing state.' }
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
            await cleanupPermanentGrantE2eRows({ userIds });
        } finally {
            try {
                await cleanupArrearsRows({ userIds });
            } finally {
                userIds = [];
                expect(dialogs, 'native dialogs are forbidden').toEqual([]);
            }
        }
    });

    test.afterAll(async () => {
        await world?.mailCapture.close().catch(() => undefined);
        await world?.fakeServer.close().catch(() => undefined);
    });

    test.beforeEach(async ({ page }) => {
        dialogs = [];
        page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });
    });

    test('current courtesy ends; no addons are listed; revocation requires and stores a reason', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const fakeServer = world.fakeServer;
        const mailCapture = world.mailCapture;
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
        const endsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        await seedCurrentCourtesy({ ...card, fakeServer: world.fakeServer, endsAt });
        await seedCookieConsent(page);
        await useAdminSession({ page, admin: subscriber.admin, adminUrl: ADMIN_URL });
        await openPermanentGrantsScreen({ page, adminUrl: ADMIN_URL, userId: subscriber.user.id });
        await previewGrant(page, 'accommodation', false);
        const confirmation = page.getByTestId('permanent-grant-confirmation');
        await expect(confirmation.getByTestId('permanent-grant-ending-courtesies')).toContainText(
            copy.endingCourtesy
                .replace('{{vertical}}', copy.verticals.accommodation)
                .replace('{{date}}', marketDay(endsAt))
        );
        await expect(confirmation.getByTestId('permanent-grant-ending-courtesies')).toContainText(
            copy.providerEmail
        );
        await expect(confirmation.getByTestId('permanent-grant-converted-addons')).toContainText(
            copy.noneAddons
        );
        await confirmation.getByTestId('permanent-grant-confirm-submit').click();
        await expect(page.getByTestId('permanent-grant-result')).toContainText(
            copy.resultGrant.split('{{id}}')[0]!
        );
        expect(
            cancellationRequestsFor({
                requests: world.fakeServer.requests(),
                authorizationId: card.authorizationId
            })
        ).toHaveLength(0);
        expect(
            (
                await world.fakeServer.provider.readAuthorization({
                    authorizationId: card.authorizationId
                })
            ).snapshot.status
        ).toBe('paused');
        const [notice] = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.permanent-grant-cancel'
             ORDER BY created_at DESC LIMIT 1`,
            [subscriber.user.id]
        );
        expect(notice?.status).toBe('pending');
        await logForeignSweepCandidates('before email-outbox-sender');
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: subscriber.admin.sessionCookie
        });
        await mailCapture.waitForMail({
            to: subscriber.user.email,
            subject: GRANT_CANCEL_SUBJECT,
            timeoutMs: 30_000
        });
        await expect
            .poll(async () => {
                const [sent] = await execSQL<{ status: string }>(
                    `SELECT status FROM email_outbox
                 WHERE recipient_user_id = $1 AND template = 'billing.permanent-grant-cancel'
                 ORDER BY created_at DESC LIMIT 1`,
                    [subscriber.user.id]
                );
                return sent?.status;
            })
            .toBe('sent');
        await logForeignSweepCandidates('after email-outbox-sender');
        await runCron({
            jobName: 'billing-deferred-cancellation-retry',
            adminCookie: subscriber.admin.sessionCookie
        });
        await logForeignSweepCandidates('after billing-deferred-cancellation-retry');
        await expect
            .poll(
                () =>
                    cancellationRequestsFor({
                        requests: fakeServer.requests(),
                        authorizationId: card.authorizationId
                    }).length
            )
            .toBe(1);
        await expect(page.getByTestId('permanent-grant-live')).toBeVisible();
        const [grant] = await execSQL<{ id: string }>(
            'SELECT id FROM permanent_grant WHERE beneficiary_user_id = $1 AND revoked_at IS NULL',
            [subscriber.user.id]
        );
        if (!grant) throw new Error('Grant was not persisted.');
        await page.getByTestId('permanent-grant-revoke-action').click();
        const revocation = page.getByTestId('permanent-grant-revocation-confirmation');
        await expect(revocation).toContainText(copy.revocationTitle);
        await expect(revocation).toContainText(copy.addonsOff);
        await expect(revocation).toContainText(copy.trialNoReturn);
        await expect(revocation).toContainText(copy.oldDebitNoResume);
        const reason = revocation.getByTestId('permanent-grant-revocation-reason');
        const submit = revocation.getByTestId('permanent-grant-revocation-submit');
        await expect(submit).toBeDisabled();
        await reason.fill('   ');
        await expect(submit).toBeDisabled();
        await reason.fill('  TEST:B13a:5 audit reason  ');
        await submit.click();
        await expect(page.getByTestId('permanent-grant-result')).toContainText(
            copy.resultRevoke.split('{{date}}')[0]!
        );
        const [stored] = await execSQL<{ revocation_reason: string | null }>(
            'SELECT revocation_reason FROM permanent_grant WHERE id = $1',
            [grant.id]
        );
        expect(stored?.revocation_reason).toBe('TEST:B13a:5 audit reason');
    });

    test('grant closes the deferred courtesy balance and names its months', async ({ page }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const billingOptionId = await monthlyOptionForSlug('owner-basico');
        const card = await createApiCardSubscription({ user: subscriber.user, billingOptionId });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        await seedCurrentCourtesy({
            ...card,
            fakeServer: world.fakeServer,
            endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        });
        const { courtesyGrantId, balanceMonths } = await deferCurrentCourtesy({
            subscriptionId: card.subscriptionId,
            successorBillingOptionId: billingOptionId
        });
        expect(balanceMonths).toBeGreaterThan(0);

        await seedCookieConsent(page);
        await useAdminSession({ page, admin: subscriber.admin, adminUrl: ADMIN_URL });
        await openPermanentGrantsScreen({ page, adminUrl: ADMIN_URL, userId: subscriber.user.id });
        await previewGrant(page, 'accommodation', false);
        const confirmation = page.getByTestId('permanent-grant-confirmation');
        await expect(confirmation.getByTestId('permanent-grant-closed-balances')).toContainText(
            (balanceMonths === 1 ? copy.closedBalance_one : copy.closedBalance_other)
                .replace('{{vertical}}', copy.verticals.accommodation)
                .replace('{{count}}', String(balanceMonths))
        );
        const grantResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith('/api/v1/admin/billing-permanent-grants')
        );
        await confirmation.getByTestId('permanent-grant-confirm-submit').click();
        const grantResponse = await grantResponsePromise;
        expect(grantResponse.status()).toBe(201);
        const grantResult = PermanentGrantCreateResponseSchema.parse(
            ((await grantResponse.json()) as { data: unknown }).data
        );
        expect(grantResult.closedCourtesyIds).toContain(courtesyGrantId);
        await expect(page.getByTestId('permanent-grant-result')).toContainText(
            copy.resultGrant.split('{{id}}')[0]!
        );
        const [closed] = await execSQL<{
            balance_months: number | null;
            balance_closed_at: Date | null;
            close_reason: string | null;
        }>(
            'SELECT balance_months, balance_closed_at, close_reason FROM courtesy_grant WHERE id = $1',
            [courtesyGrantId]
        );
        expect(closed).toMatchObject({
            balance_months: balanceMonths,
            balance_closed_at: expect.any(Date),
            close_reason: 'GRANT_PERMANENTE_OTORGADO'
        });
    });

    test('anchoring closes three deferred months and names provider mail per preapproval', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const fakeServer = world.fakeServer;
        const mailCapture = world.mailCapture;
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        await useAdminSession({ page, admin: subscriber.admin, adminUrl: ADMIN_URL });
        await openPermanentGrantsScreen({ page, adminUrl: ADMIN_URL, userId: subscriber.user.id });
        await previewGrant(page, 'tourist', true);
        await page.getByTestId('permanent-grant-confirm-submit').click();
        await expect(page.getByTestId('permanent-grant-result')).toBeVisible();

        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await monthlyOptionForSlug('owner-basico')
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        const endsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        await seedCurrentCourtesy({ ...card, fakeServer: world.fakeServer, endsAt });
        const deferredId = await seedDeferredCourtesy({
            userId: subscriber.user.id,
            vertical: 'accommodation',
            balanceMonths: 3
        });
        const complements = await seedTwoComplements({
            userId: subscriber.user.id,
            vertical: 'accommodation',
            fakeServer: world.fakeServer
        });
        await page.getByTestId('permanent-grant-anchor-action').click();
        await page.getByTestId('permanent-grant-vertical').selectOption('accommodation');
        await expect(page.getByTestId('permanent-grant-plan').locator('option')).not.toHaveCount(1);
        await page.getByTestId('permanent-grant-plan').selectOption({ index: 1 });
        await page.getByTestId('permanent-grant-preview-submit').click();
        const confirmation = page.getByTestId('permanent-grant-confirmation');
        await expect(confirmation).toBeVisible();
        await expect(confirmation.getByTestId('permanent-grant-stopped-charges')).toContainText(
            copy.stoppedCharge
                .replace('{{id}}', card.subscriptionId)
                .replace('{{vertical}}', copy.verticals.accommodation)
        );
        await expect(confirmation.getByTestId('permanent-grant-ending-courtesies')).toContainText(
            copy.endingCourtesyAnchor
                .replace('{{vertical}}', copy.verticals.accommodation)
                .replace('{{date}}', marketDay(endsAt))
        );
        await expect(confirmation.getByTestId('permanent-grant-closed-balances')).toContainText(
            copy.closedBalance_other
                .replace('{{vertical}}', copy.verticals.accommodation)
                .replace('{{count}}', '3')
        );
        const addons = confirmation.getByTestId('permanent-grant-converted-addons');
        await expect(addons).toContainText(copy.convertedAddons);
        await expect(
            addons.getByText(copy.providerEmailPerPreapproval, { exact: false })
        ).toHaveCount(2);
        await confirmation.getByTestId('permanent-grant-confirm-submit').click();
        await expect(page.getByTestId('permanent-grant-result')).toContainText(
            copy.resultAnchor.split('{{id}}')[0]!
        );
        const [deferred] = await execSQL<{ balance_closed_at: Date | null }>(
            'SELECT balance_closed_at FROM courtesy_grant WHERE id = $1',
            [deferredId]
        );
        expect(deferred?.balance_closed_at).not.toBeNull();
        for (const complement of complements)
            expect(
                cancellationRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: complement.authorizationId
                })
            ).toHaveLength(0);
        expect(
            cancellationRequestsFor({
                requests: world.fakeServer.requests(),
                authorizationId: card.authorizationId
            })
        ).toHaveLength(0);
        const pendingNotices = await execSQL<{ template: string; status: string }>(
            `SELECT template, status FROM email_outbox
             WHERE recipient_user_id = $1 AND template IN
               ('billing.permanent-grant-cancel', 'billing.permanent-grant-addon-cancel')`,
            [subscriber.user.id]
        );
        expect(
            pendingNotices.filter(({ template }) => template === 'billing.permanent-grant-cancel')
        ).toEqual([{ template: 'billing.permanent-grant-cancel', status: 'pending' }]);
        expect(
            pendingNotices.filter(
                ({ template }) => template === 'billing.permanent-grant-addon-cancel'
            )
        ).toHaveLength(complements.length);
        expect(pendingNotices.every(({ status }) => status === 'pending')).toBe(true);
        await logForeignSweepCandidates('before email-outbox-sender');
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: subscriber.admin.sessionCookie
        });
        await expect
            .poll(() => {
                const mails = mailCapture.mailsTo({ to: subscriber.user.email });
                return {
                    principal: mails.filter(({ subject }) => subject === GRANT_CANCEL_SUBJECT)
                        .length,
                    addons: mails.filter(({ subject }) => subject === ADDON_CANCEL_SUBJECT).length
                };
            })
            .toEqual({ principal: 1, addons: complements.length });
        await expect
            .poll(async () => {
                const notices = await execSQL<{ status: string }>(
                    `SELECT status FROM email_outbox
                 WHERE recipient_user_id = $1 AND template IN
                   ('billing.permanent-grant-cancel', 'billing.permanent-grant-addon-cancel')`,
                    [subscriber.user.id]
                );
                return notices.filter(({ status }) => status === 'sent').length;
            })
            .toBe(1 + complements.length);
        await logForeignSweepCandidates('after email-outbox-sender');
        await runCron({
            jobName: 'billing-deferred-cancellation-retry',
            adminCookie: subscriber.admin.sessionCookie
        });
        await logForeignSweepCandidates('after billing-deferred-cancellation-retry');
        await expect
            .poll(
                () =>
                    cancellationRequestsFor({
                        requests: fakeServer.requests(),
                        authorizationId: card.authorizationId
                    }).length
            )
            .toBe(1);
        for (const complement of complements)
            await expect
                .poll(
                    () =>
                        cancellationRequestsFor({
                            requests: fakeServer.requests(),
                            authorizationId: complement.authorizationId
                        }).length
                )
                .toBe(1);
    });
});
