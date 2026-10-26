/** Preconditions: E2E DB has the 0144 billing catalog; built API and web use the fake provider, clock, and mail capture. */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    DAY_MS,
    deliverNotices,
    ensureDeadlineVersion,
    readCurrentGraceDays,
    recordCreditedCycle,
    runCron,
    type startFakeWorld,
    sweepFailedIds,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    attachSession,
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

type SubscriptionRow = {
    readonly id: string;
    readonly status: string;
    readonly plan_version_id: string;
    readonly grace_started_at: Date | null;
    readonly grace_ends_at: Date | null;
} & Record<string, unknown>;
type OutboxRow = { readonly status: string } & Record<string, unknown>;
type MarkRow = {
    readonly id: string;
    readonly reason: string;
    readonly lifted_at: Date | null;
} & Record<string, unknown>;

const MAIL_TIMEOUT_MS = 30_000;

test.describe('TEST:B7:17 AC:B7:29 the grace expires against the fake provider server @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);

    let world: Awaited<ReturnType<typeof startFakeWorld>> | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    let userIds: string[] = [];
    let subscriptionId = '';
    let authorizationId = '';

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B7:17 delivers the provider notices needed by the grace expiry flow.'
                    },
                    {
                        lie: 'M8',
                        why: 'TEST:B7:17 makes the credited cycle available to the API immediately.'
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
        subscriber = await createSubscriber();
        userIds = [subscriber.user.id, subscriber.admin.id];
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            try {
                await world?.mailCapture.close();
            } finally {
                await world?.fakeServer.close();
            }
        }
    });

    test('TEST:B7:17 the grace reaches suspension after ten days', async ({ page }) => {
        if (!world || !subscriber)
            throw new Error('TEST:B7:17 setup did not create its fake world and users.');
        const { fakeServer, mailCapture } = world;
        const { user, admin } = subscriber;
        await seedCookieConsent(page);

        await test.step('1. Create the card subscription through the web and activate it', async () => {
            const optionId = await monthlyOptionForSlug('owner-basico');
            await attachSession(page, user.sessionCookie);
            await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
            const confirmation = await confirmSignupCheckout({ page });
            subscriptionId = confirmation.subscriptionId;
            const links = await execSQL<{ provider_id: string }>(
                'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
                [subscriptionId]
            );
            authorizationId = links[0]?.provider_id ?? '';
            if (!authorizationId)
                throw new Error(
                    `Expected a provider authorization for ${subscriptionId}; saw none.`
                );
            await activateCardSubscription({ fakeServer, subscriptionId });
            const rows = await readSubscription();
            expect(
                rows[0]?.status,
                `Expected ACTIVE after approval; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('ACTIVE');
        });

        await test.step('2. Record one credited billing cycle', async () => {
            await recordCreditedCycle({ fakeServer, subscriptionId, authorizationId });
            const rows = await execSQL<{ id: string; status: string }>(
                `SELECT id, status FROM payment WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [subscriptionId]
            );
            expect(
                rows[0]?.status,
                `Expected a SUCCEEDED payment; reread payment was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('SUCCEEDED');
        });

        await test.step('3. Advance 31 days, reject the next charge, and enter grace for the configured duration', async () => {
            await fakeServer.advanceClock({ ms: 31 * DAY_MS });
            await fakeServer.provider.declineCharge({
                authorizationId,
                declineReason: 'cc_rejected_other_reason'
            });
            await deliverNotices({ fakeServer });
            const rows = await readSubscription();
            const row = rows[0];
            expect(
                row?.status,
                `Expected GRACE_PERIOD after the rejection; reread status was ${row?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');
            if (!row?.grace_started_at || !row.grace_ends_at) {
                throw new Error(
                    `Expected grace timestamps on row ${subscriptionId}; reread values were ${String(row?.grace_started_at)} and ${String(row?.grace_ends_at)}.`
                );
            }
            const graceDays = await readCurrentGraceDays({ planVersionId: row.plan_version_id });
            expect(
                row.grace_ends_at.getTime() - row.grace_started_at.getTime(),
                `Expected grace duration ${graceDays} days; reread duration was ${(row.grace_ends_at.getTime() - row.grace_started_at.getTime()) / DAY_MS} days.`
            ).toBe(graceDays * DAY_MS);
        });

        await test.step('4. At nine days, a reconciliation sweep leaves the subscription in grace', async () => {
            await fakeServer.advanceClock({ ms: 9 * DAY_MS });
            const data = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            const rows = await readSubscription();
            const cancellations = cancelRequestsFor({
                requests: fakeServer.requests(),
                authorizationId
            });
            expect(
                sweepFailedIds(data),
                `Expected this subscription absent from failed IDs; saw ${JSON.stringify(sweepFailedIds(data))}. Reread status: ${rows[0]?.status ?? 'missing'}.`
            ).not.toContain(subscriptionId);
            expect(
                rows[0]?.status,
                `Expected GRACE_PERIOD before expiry; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');
            expect(
                cancellations,
                `Expected no provider cancellation before expiry; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toHaveLength(0);
        });

        await test.step('5. At ten days and 60 seconds, notify first and suspend on the second sweep', async () => {
            await fakeServer.advanceClock({ ms: DAY_MS + 60_000 });
            const first = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            let rows = await readSubscription();
            expect(
                sweepFailedIds(first),
                `Expected no failure entry for the tested subscription; saw ${JSON.stringify(sweepFailedIds(first))}. Reread status: ${rows[0]?.status ?? 'missing'}.`
            ).not.toContain(subscriptionId);
            expect(
                rows[0]?.status,
                `Expected first sweep to defer in GRACE_PERIOD; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');
            const queued = await execSQL<OutboxRow>(
                `SELECT status FROM email_outbox WHERE recipient_user_id = $1 AND template = 'billing.arrears-suspension' ORDER BY created_at DESC LIMIT 1`,
                [user.id]
            );
            expect(
                queued[0]?.status,
                `Expected suspension notice pending after first sweep; reread outbox status was ${queued[0]?.status ?? 'missing'}.`
            ).toBe('pending');
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                `Expected no cancellation before sender; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toHaveLength(0);

            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            await mailCapture.waitForMail({
                to: user.email,
                subject: 'Tu suscripción se suspendió',
                timeoutMs: MAIL_TIMEOUT_MS
            });
            rows = await readSubscription();
            expect(
                rows[0]?.status,
                `Expected subscription still GRACE_PERIOD after notice delivery; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');

            const second = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            rows = await readSubscription();
            expect(
                sweepFailedIds(second),
                `Expected tested subscription absent from failed IDs; saw ${JSON.stringify(sweepFailedIds(second))}. Reread status: ${rows[0]?.status ?? 'missing'}.`
            ).not.toContain(subscriptionId);
            expect(
                rows[0]?.status,
                `Expected SUSPENDED after second sweep; reread status was ${rows[0]?.status ?? 'missing'}.`
            ).toBe('SUSPENDED');
            const authorization = await fakeServer.provider.readAuthorization({ authorizationId });
            expect(
                authorization.snapshot.status,
                `Expected fake authorization cancelled; reread provider status was ${authorization.snapshot.status}.`
            ).toBe('cancelled');
            const cancellations = cancelRequestsFor({
                requests: fakeServer.requests(),
                authorizationId
            });
            expect(
                cancellations,
                `Expected exactly one PUT cancellation; reread subscription status was ${rows[0]?.status ?? 'missing'}.`
            ).toHaveLength(1);
        });

        await test.step('6. The API and web use the fake transparently and the subscriber page remains available', async () => {
            const requests = fakeServer.requests();
            expect(
                requests.some(
                    (request) =>
                        request.method === 'GET' &&
                        (() => {
                            const requestUrl = new URL(request.path, 'http://fake.invalid');
                            return (
                                requestUrl.pathname === '/authorized_payments/search' &&
                                requestUrl.searchParams.get('preapproval_id') === authorizationId
                            );
                        })()
                ),
                `Expected period lookup against fake provider; reread subscription status was ${(await readSubscription())[0]?.status ?? 'missing'}.`
            ).toBe(true);
            await attachSession(page, user.sessionCookie);
            const response = await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
            expect(
                response,
                `Expected subscription page navigation to complete; reread status ${(await readSubscription())[0]?.status ?? 'missing'}.`
            ).not.toBeNull();
            expect(
                page.url(),
                'Expected authenticated subscription page without sign-in redirect.'
            ).not.toContain('/auth/signin');
            await expect(page.getByRole('heading', { name: 'Suscripción' })).toBeVisible();
        });
        await assertNoOpenUndeclaredTransitionMarks(subscriptionId);
    });

    async function assertNoOpenUndeclaredTransitionMarks(id: string): Promise<void> {
        const marks = await execSQL<MarkRow>(
            "SELECT id, reason, lifted_at FROM reconciliation_mark WHERE subscription_id = $1 AND reason = 'TRANSICION_NO_DECLARADA' AND lifted_at IS NULL ORDER BY placed_at",
            [id]
        );
        test.info().annotations.push({
            type: 'reconciliation-marks',
            description: JSON.stringify(marks)
        });
        expect(
            marks,
            `Expected no open TRANSICION_NO_DECLARADA marks for ${id}; found ${JSON.stringify(marks)}.`
        ).toHaveLength(0);
    }

    async function readSubscription(): Promise<SubscriptionRow[]> {
        return execSQL<SubscriptionRow>(
            `SELECT id, status, plan_version_id, grace_started_at, grace_ends_at FROM subscription WHERE id = $1`,
            [subscriptionId]
        );
    }
});
