/** Preconditions: E2E DB has the billing catalog and deadline versions; API uses fake clock and mail capture. */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { getLocalDateString } from '@repo/utils';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    DAY_MS,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    recordCreditedCycle,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupManualArrearsRows } from '../../fixtures/manual-arrears.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { outboxRowsFor } from './helpers/notice-outbox.ts';
import { mailText, waitForMailCount } from './helpers/plan-migration-timeline.ts';

type SubscriptionRow = {
    readonly next_charge_at: Date | null;
    readonly renewal_notice_charge_at: Date | null;
    readonly renewal_notice_deadline_version: number | null;
} & Record<string, unknown>;
type DeadlineRow = { readonly version: number } & Record<string, unknown>;
type ManualSubscriptionRow = { readonly id: string; readonly manual_payment_id: string } & Record<
    string,
    unknown
>;

const MAIL_TIMEOUT_MS = 30_000;
const SUBJECT = 'Tu suscripción se renueva pronto';
const TEMPLATE = 'billing.renewal-upcoming';
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();

test.describe('HOS-2136 TEST:B13a:13 AC:B13a:13 renewal notice at five and one day @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });

    let world: FakeWorld | null = null;
    let cardSubscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    let cardSubscriptionId = '';
    let userIds: string[] = [];
    let manualUserIds: string[] = [];

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
                        why: 'HOS-2136 delivers provider notices to activate the card subscription.'
                    },
                    {
                        lie: 'M8',
                        why: 'HOS-2136 makes the credited cycle visible to reconciliation.'
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
    });

    test.afterAll(async () => {
        try {
            await cleanupManualArrearsRows({ userIds: manualUserIds });
            await cleanupArrearsRows({ userIds });
        } finally {
            try {
                await world?.mailCapture.close();
            } finally {
                await world?.fakeServer.close();
            }
        }
    });

    test('TEST:B13a:13 card renewal notice at 5 and 1 days, once each', async () => {
        test.setTimeout(300_000);
        if (!world || !cardSubscriber)
            throw new Error('HOS-2136 card renewal setup did not create its fake world.');
        const currentWorld = world;
        const { user, admin } = cardSubscriber;
        const { fakeServer, mailCapture } = currentWorld;
        let authorizationId = '';
        let nextChargeAt: Date;
        let sealedVersion: number;

        await test.step('1. Create and reconcile an active Básico card subscription', async () => {
            const billingOptionId = await monthlyOptionForSlug('owner-basico');
            const created = await createApiCardSubscription({ user, billingOptionId });
            cardSubscriptionId = created.subscriptionId;
            authorizationId = created.authorizationId;
            await activateCardSubscription({ fakeServer, subscriptionId: cardSubscriptionId });
            await recordCreditedCycle({
                fakeServer,
                subscriptionId: cardSubscriptionId,
                authorizationId
            });
            const reconciliation = await runCron({
                jobName: 'billing-reconciliation-sweep',
                adminCookie: admin.sessionCookie
            });
            if (!reconciliation.success)
                throw new Error('HOS-2136 billing reconciliation did not succeed.');
            const [row] = await execSQL<SubscriptionRow>(
                'SELECT next_charge_at, renewal_notice_charge_at, renewal_notice_deadline_version FROM subscription WHERE id = $1',
                [cardSubscriptionId]
            );
            const authorization = await fakeServer.provider.readAuthorization({
                authorizationId
            });
            const providerNextChargeAt = authorization.snapshot.nextChargeAt;
            if (!row?.next_charge_at || !providerNextChargeAt)
                throw new Error('HOS-2136 expected the reconciled next charge on both records.');
            nextChargeAt = row.next_charge_at;
            expect(nextChargeAt.toISOString()).toBe(new Date(providerNextChargeAt).toISOString());
            expect(nextChargeAt.getTime()).toBeGreaterThan(currentWorld.clock.now().getTime());
        });

        await test.step('2. Before the notice window, seal the cycle without enqueueing mail', async () => {
            await runCron({
                jobName: 'subscription-renewal-notice',
                adminCookie: admin.sessionCookie
            });
            const rows = await outboxRowsFor({ userId: user.id, template: TEMPLATE });
            expect(rows).toHaveLength(0);
            const [row] = await execSQL<SubscriptionRow>(
                'SELECT next_charge_at, renewal_notice_charge_at, renewal_notice_deadline_version FROM subscription WHERE id = $1',
                [cardSubscriptionId]
            );
            const [currentDeadline] = await execSQL<DeadlineRow>(
                'SELECT max(version)::int AS version FROM billing_deadline_version'
            );
            if (
                !row?.next_charge_at ||
                !row.renewal_notice_charge_at ||
                !row.renewal_notice_deadline_version ||
                !currentDeadline
            )
                throw new Error(
                    'HOS-2136 expected the cycle deadline version and charge date to be sealed.'
                );
            expect(row.renewal_notice_charge_at.toISOString()).toBe(nextChargeAt.toISOString());
            expect(row.renewal_notice_deadline_version).toBe(currentDeadline.version);
            sealedVersion = row.renewal_notice_deadline_version;
        });

        await test.step('3. Five days before charge, enqueue once and send the card notice', async () => {
            await fakeServer.setClock({ at: new Date(nextChargeAt.getTime() - 5 * DAY_MS) });
            for (let attempt = 0; attempt < 2; attempt += 1)
                await runCron({
                    jobName: 'subscription-renewal-notice',
                    adminCookie: admin.sessionCookie
                });
            const rows = await outboxRowsFor({ userId: user.id, template: TEMPLATE });
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('pending');
            expect(rows[0]?.payload.daysBefore).toBe(5);
            expect(rows[0]?.payload.renewalDate).toBe(
                getLocalDateString({ instant: nextChargeAt })
            );
            expect(rows[0]?.payload.planName).toBe('Básico');
            expect(rows[0]?.payload.paymentMethod).toBe('CARD');
            expect(rows[0]?.payload.deadlinesVersion).toBe(sealedVersion);
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: SUBJECT,
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const text = mailText(mail.html);
            expect(mail.subject).toBe(SUBJECT);
            expect(normalized(text)).toContain(
                normalized(`Tu plan Básico se renueva el ${formatMarketDate(nextChargeAt)}.`)
            );
            expect(normalized(text)).toContain(
                normalized(
                    'Ese día Mercado Pago te va a cobrar la cuota con el medio de pago que autorizaste. No tenés que hacer nada.'
                )
            );
            expect(normalized(text)).toContain(
                normalized(
                    'Si no querés renovar, podés darte de baja desde Mi Suscripción antes de esa fecha.'
                )
            );
            expect(text.toLowerCase().indexOf('transferencia')).toBe(-1);
        });

        await test.step('4. Three days before charge, do not enqueue a duplicate', async () => {
            await fakeServer.setClock({ at: new Date(nextChargeAt.getTime() - 3 * DAY_MS) });
            await runCron({
                jobName: 'subscription-renewal-notice',
                adminCookie: admin.sessionCookie
            });
            expect(await outboxRowsFor({ userId: user.id, template: TEMPLATE })).toHaveLength(1);
        });

        await test.step('5. One day before charge, enqueue the second notice exactly once', async () => {
            await fakeServer.setClock({ at: new Date(nextChargeAt.getTime() - DAY_MS) });
            for (let attempt = 0; attempt < 2; attempt += 1)
                await runCron({
                    jobName: 'subscription-renewal-notice',
                    adminCookie: admin.sessionCookie
                });
            const rows = await outboxRowsFor({ userId: user.id, template: TEMPLATE });
            expect(rows).toHaveLength(2);
            expect(rows[1]?.payload.daysBefore).toBe(1);
            expect(rows[1]?.payload.renewalDate).toBe(
                getLocalDateString({ instant: nextChargeAt })
            );
            expect(rows[1]?.payload.planName).toBe('Básico');
            expect(rows[1]?.payload.paymentMethod).toBe('CARD');
            expect(rows[1]?.payload.deadlinesVersion).toBe(sealedVersion);
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mails = await waitForMailCount({
                world: currentWorld,
                to: user.email,
                subject: SUBJECT,
                count: 2
            });
            expect(mails).toHaveLength(2);
            expect(mails[1]?.subject).toBe(SUBJECT);
            expect(normalized(mailText(mails[1]?.html ?? ''))).toContain(
                normalized(`Tu plan Básico se renueva el ${formatMarketDate(nextChargeAt)}.`)
            );
            expect(
                mailCapture.mailsTo({ to: user.email }).filter(({ subject }) => subject === SUBJECT)
            ).toHaveLength(2);
        });
    });

    test('TEST:B13a:13 manual payer renewal notice asks for the transfer', async () => {
        test.setTimeout(300_000);
        if (!world) throw new Error('HOS-2136 manual renewal setup did not create its fake world.');
        const { clock, fakeServer, mailCapture } = world;
        const subscriber = await createSubscriber();
        manualUserIds = [subscriber.user.id, subscriber.admin.id];
        const optionId = await monthlyOptionForSlug('partner-silver');
        const start = clock.now();
        const [period] = await execSQL<{ next_charge_at: Date } & Record<string, unknown>>(
            "SELECT $1::timestamptz + interval '1 month' AS next_charge_at",
            [start]
        );
        if (!period) throw new Error('HOS-2136 could not calculate the manual billing period.');
        const [created] = await execSQL<ManualSubscriptionRow>(
            `WITH created AS (
                    INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id,
                        payment_method, status, class, next_charge_at)
                    SELECT $1, 'partner', pv.id, $2, 'MANUAL', 'ACTIVE', 'PRINCIPAL', $3
                      FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id
                     WHERE bo.id = $2 AND pv.current = true
                    RETURNING id
                 ), first_payment AS (
                    INSERT INTO manual_payment (subscription_id, period_start, status, registered_by, registered_at)
                    SELECT id, $4, 'REGISTERED', $1, $5 FROM created
                    RETURNING id, subscription_id
                 ), initial_coverage AS (
                    INSERT INTO covered_period (subscription_id, period_start, manual_payment_id, credited_at)
                    SELECT subscription_id, $4, id, $5 FROM first_payment
                 )
                 SELECT created.id, first_payment.id AS manual_payment_id
                   FROM created CROSS JOIN first_payment`,
            [subscriber.user.id, optionId, period.next_charge_at, start, start]
        );
        if (!created?.id || !created.manual_payment_id)
            throw new Error('HOS-2136 manual subscription fixture failed.');
        const nextChargeAt = period.next_charge_at;

        await test.step('1. Five days before the manual charge, enqueue and send transfer instructions', async () => {
            await fakeServer.setClock({ at: new Date(nextChargeAt.getTime() - 5 * DAY_MS) });
            await runCron({
                jobName: 'subscription-renewal-notice',
                adminCookie: subscriber.admin.sessionCookie
            });
            const rows = await outboxRowsFor({ userId: subscriber.user.id, template: TEMPLATE });
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe('pending');
            expect(rows[0]?.payload.daysBefore).toBe(5);
            expect(rows[0]?.payload.renewalDate).toBe(
                getLocalDateString({ instant: nextChargeAt })
            );
            expect(rows[0]?.payload.planName).toBe('Silver');
            expect(rows[0]?.payload.paymentMethod).toBe('MANUAL');
            const [subscription] = await execSQL<SubscriptionRow>(
                'SELECT next_charge_at, renewal_notice_charge_at, renewal_notice_deadline_version FROM subscription WHERE id = $1',
                [created.id]
            );
            if (
                !subscription?.next_charge_at ||
                !subscription.renewal_notice_charge_at ||
                !subscription.renewal_notice_deadline_version
            )
                throw new Error('HOS-2136 expected the manual cycle deadline to be sealed.');
            expect(subscription.renewal_notice_charge_at.toISOString()).toBe(
                nextChargeAt.toISOString()
            );
            expect(rows[0]?.payload.deadlinesVersion).toBe(
                subscription.renewal_notice_deadline_version
            );
            await runCron({
                jobName: 'email-outbox-sender',
                adminCookie: subscriber.admin.sessionCookie
            });
            const mail = await mailCapture.waitForMail({
                to: subscriber.user.email,
                subject: SUBJECT,
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const text = mailText(mail.html);
            expect(mail.subject).toBe(SUBJECT);
            expect(normalized(text)).toContain(
                normalized(`Tu plan Silver se renueva el ${formatMarketDate(nextChargeAt)}.`)
            );
            expect(normalized(text)).toContain(
                normalized(
                    `Registrá/realizá la transferencia antes del ${formatMarketDate(nextChargeAt)}.`
                )
            );
            expect(normalized(text)).toContain(
                normalized(
                    'Si no querés renovar, podés darte de baja desde Mi Suscripción antes de esa fecha.'
                )
            );
            expect(text.indexOf('Mercado Pago te va a cobrar')).toBe(-1);
            expect(
                mailCapture
                    .mailsTo({ to: subscriber.user.email })
                    .filter(({ subject }) => subject === SUBJECT)
            ).toHaveLength(1);
        });
    });
});
