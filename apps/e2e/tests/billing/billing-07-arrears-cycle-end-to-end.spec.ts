/**
 * Preconditions: the E2E database has the 0144 accommodation catalog and billing schema; Playwright
 * supplies built API, web, admin, fake Mercado Pago, adjustable clock, and captured email.
 * Manual payment (MP1–MP6, Phase 4) and succession (B8b/Z) are outside this cut and remain seeded tests.
 */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    type ArrearsSubscriber,
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    DAY_MS,
    decodeHtmlEntities,
    deliverNotices,
    ensureDeadlineVersion,
    expiryMinusPauseMargin,
    type FakeWorld,
    formatMarketDate,
    readCurrentGraceDays,
    recordCreditedCycle,
    runCron,
    sweepFailedIds,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    attachSession,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

const MAIL_TIMEOUT_MS = 30_000;
const SUSPENSION_SUBJECT = 'Tu suscripción se suspendió';
type SubscriptionRow = {
    readonly id: string;
    readonly status: string;
    readonly plan_version_id: string;
    readonly grace_started_at: Date | null;
    readonly grace_ends_at: Date | null;
} & Record<string, unknown>;
type OutboxRow = { readonly status: string } & Record<string, unknown>;
type PauseRow = { readonly id: string } & Record<string, unknown>;
type MarkRow = {
    readonly id: string;
    readonly reason: string;
    readonly lifted_at: Date | null;
} & Record<string, unknown>;

/** Full card arrears flow and provider-pause arrears flow (TEST:B7:20 / AC:B7:32). */
test.describe('TEST:B7:20 AC:B7:32 the arrears cycle end to end @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    let world: FakeWorld | null = null;
    let cardSubscriber: ArrearsSubscriber | null = null;
    let pauseSubscriber: ArrearsSubscriber | null = null;
    let userIds: string[] = [];

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
                        why: 'TEST:B7:20 delivers the provider notices needed by both arrears paths.'
                    },
                    {
                        lie: 'M8',
                        why: 'TEST:B7:20 makes the credited billing cycle visible immediately.'
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
        cardSubscriber = await createSubscriber();
        userIds = [cardSubscriber.user.id, cardSubscriber.admin.id];
        pauseSubscriber = await createSubscriber();
        userIds.push(pauseSubscriber.user.id, pauseSubscriber.admin.id);
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('TEST:B7:20 card rejection, grace, and suspension mail precede cancellation', async ({
        page
    }) => {
        test.setTimeout(300_000);
        if (!world || !cardSubscriber)
            throw new Error('Expected card arrears world and subscriber.');
        const { fakeServer, mailCapture } = world;
        const { user, admin } = cardSubscriber;
        let subscriptionId = '';
        let authorizationId = '';
        await seedCookieConsent(page);

        await test.step('web signup reaches ACTIVE and records a credited cycle', async () => {
            const optionId = await monthlyOptionForSlug('owner-basico');
            await attachSession(page, user.sessionCookie);
            await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
            await page.getByTestId('signup-checkout-confirm').click();
            const pending = page.getByTestId('signup-checkout-pending');
            await expect(
                pending,
                'Expected web checkout to create a pending card subscription.'
            ).toBeVisible();
            subscriptionId = (await pending.getAttribute('data-subscription-id')) ?? '';
            if (!subscriptionId)
                throw new Error('Expected checkout data-subscription-id; saw none.');
            const links = await execSQL<{ provider_id: string }>(
                'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
                [subscriptionId]
            );
            authorizationId = links[0]?.provider_id ?? '';
            if (!authorizationId)
                throw new Error(`Expected provider authorization for ${subscriptionId}.`);
            await activateCardSubscription({ fakeServer, subscriptionId });
            expect(
                (await readSubscription(subscriptionId))[0]?.status,
                'Expected ACTIVE after approval; reread subscription row was not ACTIVE.'
            ).toBe('ACTIVE');
            await recordCreditedCycle({ fakeServer, subscriptionId, authorizationId });
            const paid = await execSQL<{ status: string }>(
                "SELECT status FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED' ORDER BY created_at DESC LIMIT 1",
                [subscriptionId]
            );
            expect(
                paid[0]?.status,
                'Expected a reread SUCCEEDED payment row after credited cycle.'
            ).toBe('SUCCEEDED');
        });

        let graceEndsAt: Date;
        await test.step('rejected charge enters grace and captured grace email matches its row', async () => {
            await fakeServer.advanceClock({ ms: 31 * DAY_MS });
            await fakeServer.provider.declineCharge({
                authorizationId,
                declineReason: 'cc_rejected_other_reason'
            });
            await deliverNotices({ fakeServer });
            const row = (await readSubscription(subscriptionId))[0];
            expect(
                row?.status,
                `Expected GRACE_PERIOD after rejection; reread status was ${row?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');
            if (!row?.grace_started_at || !row.grace_ends_at)
                throw new Error(
                    `Expected grace timestamps; reread ${String(row?.grace_started_at)} / ${String(row?.grace_ends_at)}.`
                );
            graceEndsAt = row.grace_ends_at;
            const graceDays = await readCurrentGraceDays({ planVersionId: row.plan_version_id });
            expect(
                row.grace_ends_at.getTime() - row.grace_started_at.getTime(),
                `Expected grace duration ${graceDays} days from plan version.`
            ).toBe(graceDays * DAY_MS);
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: 'No pudimos cobrar tu suscripción',
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const html = decodeHtmlEntities(mail.html);
            expect(html, 'Expected grace email to show this subscriber grace end date.').toContain(
                formatMarketDate(graceEndsAt)
            );
            expect(html, 'Expected grace email to explain changing the card.').toContain(
                'Si cambiás la tarjeta'
            );
            expect(html, 'Expected grace email to explain resubscription.').toContain(
                'volver a suscribirte'
            );
        });

        let suspensionMailReceivedAt: Date;
        await test.step('first expiry sweep defers; captured suspension mail precedes second-sweep cancellation', async () => {
            const row = (await readSubscription(subscriptionId))[0];
            if (!row) throw new Error('Expected subscription row before grace expiry sweep.');
            const graceDays = await readCurrentGraceDays({ planVersionId: row.plan_version_id });
            await fakeServer.advanceClock({ ms: graceDays * DAY_MS + 60_000 });
            const first = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            let current = (await readSubscription(subscriptionId))[0];
            const outbox = await suspensionOutbox(user.id);
            expect(
                current?.status,
                `Expected first sweep to leave GRACE_PERIOD; reread status=${current?.status ?? 'missing'}.`
            ).toBe('GRACE_PERIOD');
            expect(
                outbox[0]?.status,
                `Expected suspension notice pending; reread=${outbox[0]?.status ?? 'missing'}.`
            ).toBe('pending');
            expect(
                sweepFailedIds(first),
                `Expected no failed subscription; details=${JSON.stringify(first.details)}.`
            ).not.toContain(subscriptionId);
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected zero cancellations before suspension mail delivery.'
            ).toHaveLength(0);
            test.info().annotations.push({
                type: 'sweep-details',
                description: JSON.stringify(first.details)
            });
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: SUSPENSION_SUBJECT,
                timeoutMs: MAIL_TIMEOUT_MS
            });
            suspensionMailReceivedAt = mail.receivedAt;
            const html = decodeHtmlEntities(mail.html);
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected zero cancellation while captured suspension mail is available.'
            ).toHaveLength(0);
            expect(
                html,
                'Expected card email to invite resubscription with a working card.'
            ).toContain('volvé a suscribirte con una tarjeta que funcione');
            expect(html, 'Expected card email to say billing stops.').toContain(
                'ya no se te va a cobrar'
            );
            expect(html, 'Expected inherited Tourist VIP loss in suspension email.').toContain(
                'También perdés los beneficios de Turista VIP'
            );
            expect(html, 'Expected no manual-payment instruction in card email.').not.toContain(
                'registrá el pago de la cuota adeudada'
            );
            expect(html, 'Expected no UUID identifiers in suspension email.').not.toMatch(
                /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
            );
            const secondSweepStartedAt = new Date();
            const second = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            current = (await readSubscription(subscriptionId))[0];
            expect(
                sweepFailedIds(second),
                `Expected no failed subscription; details=${JSON.stringify(second.details)}.`
            ).not.toContain(subscriptionId);
            expect(
                current?.status,
                `Expected SUSPENDED after second sweep; reread=${current?.status ?? 'missing'}.`
            ).toBe('SUSPENDED');
            expect(
                (await fakeServer.provider.readAuthorization({ authorizationId })).snapshot.status,
                'Expected fake authorization cancelled after second sweep.'
            ).toBe('cancelled');
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected exactly one cancellation after suspension mail.'
            ).toHaveLength(1);
            expect(
                suspensionMailReceivedAt.getTime(),
                'Expected mail captured before second-sweep invocation.'
            ).toBeLessThan(secondSweepStartedAt.getTime());
            test.info().annotations.push({
                type: 'sweep-details',
                description: JSON.stringify(second.details)
            });
        });
        await listReconciliationMarks(subscriptionId);
    });

    test('TEST:B7:20 provider pause while ACTIVE suspends after captured email', async () => {
        test.setTimeout(300_000);
        if (!world || !pauseSubscriber)
            throw new Error('Expected pause-flow world and subscriber.');
        const { fakeServer, mailCapture } = world;
        const { user, admin } = pauseSubscriber;
        let subscriptionId = '';
        let authorizationId = '';
        await test.step('API signup reaches ACTIVE and records a credited cycle', async () => {
            const billingOptionId = await monthlyOptionForSlug('owner-basico');
            ({ subscriptionId, authorizationId } = await createApiCardSubscription({
                user,
                billingOptionId
            }));
            await activateCardSubscription({ fakeServer, subscriptionId });
            expect(
                (await readSubscription(subscriptionId))[0]?.status,
                'Expected API-created subscription ACTIVE after approval.'
            ).toBe('ACTIVE');
            await recordCreditedCycle({ fakeServer, subscriptionId, authorizationId });
        });
        await test.step('provider pause is observed while database row remains ACTIVE', async () => {
            await fakeServer.advanceClock({ ms: 31 * DAY_MS });
            const failed = await fakeServer.provider.failChargeCycle({
                authorizationId,
                declineReason: 'cc_rejected_other_reason'
            });
            const discarded = fakeServer.mercadoPagoDeliveries();
            expect(
                discarded.deliveries.length,
                'Expected failed-charge provider notice to be discarded as lost.'
            ).toBeGreaterThan(0);
            const charge = await fakeServer.provider.readCharge({ chargeId: failed.chargeId });
            const expiresAt = new Date(charge.snapshot.expiresAt ?? '');
            await fakeServer.setClock({ at: expiryMinusPauseMargin({ expiresAt }) });
            expect(
                (await fakeServer.provider.readAuthorization({ authorizationId })).snapshot.status,
                'Expected provider authorization paused before expiry.'
            ).toBe('paused');
            expect(
                (await readSubscription(subscriptionId))[0]?.status,
                'Expected database subscription to remain ACTIVE after provider pause.'
            ).toBe('ACTIVE');
        });
        await test.step('first sweep queues notice; sender captures it; second sweep suspends without pause row', async () => {
            const first = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            const row = (await readSubscription(subscriptionId))[0];
            expect(
                row?.status,
                `Expected first pause sweep to leave ACTIVE; reread=${row?.status ?? 'missing'}.`
            ).toBe('ACTIVE');
            expect(
                (await suspensionOutbox(user.id))[0]?.status,
                'Expected arrears suspension notice pending after first pause sweep.'
            ).toBe('pending');
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected no cancellation before pause-flow email.'
            ).toHaveLength(0);
            expect(
                sweepFailedIds(first),
                `Expected no failed subscription; details=${JSON.stringify(first.details)}.`
            ).not.toContain(subscriptionId);
            test.info().annotations.push({
                type: 'sweep-details',
                description: JSON.stringify(first.details)
            });
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: SUSPENSION_SUBJECT,
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const html = decodeHtmlEntities(mail.html);
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected zero cancellation while pause-flow email is captured.'
            ).toHaveLength(0);
            expect(
                html,
                'Expected pause-flow suspension mail to invite card resubscription.'
            ).toContain('volvé a suscribirte con una tarjeta que funcione');
            expect(html, 'Expected pause-flow suspension mail to say billing stops.').toContain(
                'ya no se te va a cobrar'
            );
            const secondSweepStartedAt = new Date();
            const second = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            const suspended = (await readSubscription(subscriptionId))[0];
            expect(
                suspended?.status,
                `Expected SUSPENDED after second pause sweep; reread=${suspended?.status ?? 'missing'}.`
            ).toBe('SUSPENDED');
            expect(
                (await fakeServer.provider.readAuthorization({ authorizationId })).snapshot.status,
                'Expected paused authorization cancelled by S6.'
            ).toBe('cancelled');
            expect(
                cancelRequestsFor({ requests: fakeServer.requests(), authorizationId }),
                'Expected one pause-flow cancellation after captured mail.'
            ).toHaveLength(1);
            expect(
                mail.receivedAt.getTime(),
                'Expected pause-flow mail captured before second-sweep invocation.'
            ).toBeLessThan(secondSweepStartedAt.getTime());
            expect(
                await execSQL<PauseRow>(
                    'SELECT id FROM subscription_pause WHERE subscription_id = $1',
                    [subscriptionId]
                ),
                'Expected no subscription_pause row because this path does not enter S8.'
            ).toHaveLength(0);
            expect(
                sweepFailedIds(second),
                `Expected no failed subscription; details=${JSON.stringify(second.details)}.`
            ).not.toContain(subscriptionId);
            test.info().annotations.push({
                type: 'sweep-details',
                description: JSON.stringify(second.details)
            });
        });
        await listReconciliationMarks(subscriptionId);
    });

    async function readSubscription(subscriptionId: string): Promise<SubscriptionRow[]> {
        return execSQL<SubscriptionRow>(
            'SELECT id, status, plan_version_id, grace_started_at, grace_ends_at FROM subscription WHERE id = $1',
            [subscriptionId]
        );
    }
    async function suspensionOutbox(userId: string): Promise<OutboxRow[]> {
        return execSQL<OutboxRow>(
            "SELECT status FROM email_outbox WHERE recipient_user_id = $1 AND template = 'billing.arrears-suspension' ORDER BY created_at DESC LIMIT 1",
            [userId]
        );
    }
    async function listReconciliationMarks(subscriptionId: string): Promise<void> {
        const marks = await execSQL<MarkRow>(
            'SELECT id, reason, lifted_at FROM reconciliation_mark WHERE subscription_id = $1 ORDER BY placed_at',
            [subscriptionId]
        );
        test.info().annotations.push({
            type: 'reconciliation-marks',
            description: JSON.stringify(marks)
        });
    }
});
