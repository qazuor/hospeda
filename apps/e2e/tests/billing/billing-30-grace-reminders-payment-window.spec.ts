/** Preconditions: E2E DB has the 0178 billing deadlines; API uses the fake provider, clock, and mail capture. */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    cleanupArrearsRows,
    createSubscriber,
    DAY_MS,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    readCurrentGraceDays,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { driveToGrace } from '../../fixtures/cancellation-flow.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { openActivePlanCase } from '../../fixtures/plan-change-e2e.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { outboxCountFor, outboxRowsFor } from './helpers/notice-outbox.ts';
import { mailText, waitForMailCount } from './helpers/plan-migration-timeline.ts';

type SubscriptionDetails = {
    readonly id: string;
    readonly status: string;
    readonly plan_version_id: string;
    readonly grace_started_at: Date | null;
    readonly grace_ends_at: Date | null;
} & Record<string, unknown>;
type PaymentDetails = {
    readonly id: string;
    readonly status: string;
    readonly provider_fact_id: string;
    readonly version: number;
} & Record<string, unknown>;
type DeadlineDetails = { readonly version: number; readonly reminder: unknown } & Record<
    string,
    unknown
>;
type TargetPlanDetails = { readonly plan_version_id: string } & Record<string, unknown>;

const MAIL_TIMEOUT_MS = 30_000;
const scheduledLine = (effectiveAt: Date) =>
    `Tu cambio al plan Básico, programado para el ${formatMarketDate(effectiveAt)}, sigue en pie.`;
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();

test.describe('HOS-2136 grace reminders, scheduled change and payment window @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);

    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
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
                        why: 'HOS-2136 delivers the provider notices needed to enter grace.'
                    },
                    { lie: 'M8', why: 'HOS-2136 makes the credited cycle immediately visible.' }
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
            await execSQL(
                `DELETE FROM subscription_scheduled_change
                 WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
                [userIds]
            );
            await cleanupArrearsRows({ userIds });
        } finally {
            try {
                await world?.mailCapture.close();
            } finally {
                await world?.fakeServer.close();
            }
        }
    });

    test('TEST:HOS-2136:1 TEST:HOS-2136:4 TEST:B5:4 grace notices name the scheduled change and P2 closes the payment', async ({
        page
    }) => {
        if (!world || !subscriber) throw new Error('HOS-2136 setup did not create its fake world.');
        const currentWorld = world;
        const { fakeServer, mailCapture } = currentWorld;
        const { user, admin } = subscriber;
        let subscriptionId = '';
        let authorizationId = '';
        let graceStartedAt: Date;
        let graceEndsAt: Date;
        let effectiveAt: Date;
        let deadlineVersion = 0;
        let payment: PaymentDetails;
        await seedCookieConsent(page);

        await test.step('1. Create an active Premium card subscription', async () => {
            const active = await openActivePlanCase({
                page,
                world: currentWorld,
                user,
                admin,
                slug: 'owner-premium'
            });
            subscriptionId = active.subscriptionId;
            authorizationId = active.authorizationId;
            const [row] = await execSQL<{ status: string } & Record<string, unknown>>(
                'SELECT status FROM subscription WHERE id = $1',
                [subscriptionId]
            );
            expect(row?.status).toBe('ACTIVE');
        });

        await test.step('2. Queue a change to Básico after the grace period', async () => {
            const targetOptionId = await monthlyOptionForSlug('owner-basico');
            const [target] = await execSQL<TargetPlanDetails>(
                `SELECT plan_version_id FROM billing_option WHERE id = $1`,
                [targetOptionId]
            );
            if (!target) throw new Error('HOS-2136 could not resolve the Básico plan version.');
            effectiveAt = new Date(currentWorld.clock.now().getTime() + 50 * DAY_MS);
            await execSQL(
                `INSERT INTO subscription_scheduled_change
                 (subscription_id, target_plan_version_id, target_billing_option_id, effective_at)
                 VALUES ($1, $2, $3, $4)`,
                [subscriptionId, target.plan_version_id, targetOptionId, effectiveAt]
            );
        });

        await test.step('3. Reject the charge and read the grace, deadline version, and pending payment', async () => {
            await driveToGrace({ world: currentWorld, subscriptionId, authorizationId });
            const [row] = await execSQL<SubscriptionDetails>(
                `SELECT id, status, plan_version_id, grace_started_at, grace_ends_at
                 FROM subscription WHERE id = $1`,
                [subscriptionId]
            );
            expect(row?.status).toBe('GRACE_PERIOD');
            if (!row?.grace_started_at || !row.grace_ends_at)
                throw new Error('HOS-2136 expected grace timestamps on the subscription.');
            graceStartedAt = row.grace_started_at;
            graceEndsAt = row.grace_ends_at;
            expect(
                await readCurrentGraceDays({ planVersionId: row.plan_version_id })
            ).toBeGreaterThanOrEqual(4);
            const [deadline] = await execSQL<DeadlineDetails>(
                `SELECT version, "values"->'20' AS reminder FROM billing_deadline_version
                 WHERE created_at <= $1 ORDER BY version DESC LIMIT 1`,
                [graceStartedAt]
            );
            if (!deadline) throw new Error('HOS-2136 expected a grace deadline version.');
            deadlineVersion = deadline.version;
            expect(deadline.reminder).toEqual({ daysBefore: [3, 1] });
            const [pending] = await execSQL<PaymentDetails>(
                `SELECT id, status, provider_fact_id, version FROM payment
                 WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [subscriptionId]
            );
            if (!pending) throw new Error('HOS-2136 expected a payment row.');
            payment = pending;
            expect(payment.status).toBe('PENDING');
        });

        await test.step('4. Send the grace-start email with the scheduled change', async () => {
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: 'No pudimos cobrar tu suscripción',
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const text = mailText(mail.html);
            expect(normalized(text)).toContain(normalized(scheduledLine(effectiveAt)));
            expect(text.indexOf('Premium')).toBe(-1);
            expect(normalized(text)).toContain(
                normalized(`Tu servicio sigue activo hasta el ${formatMarketDate(graceEndsAt)}.`)
            );
            const started = await outboxRowsFor({
                userId: user.id,
                template: 'billing.grace-started'
            });
            expect(started).toHaveLength(1);
            expect(started[0]?.payload.scheduledChange).toEqual({
                planName: 'Básico',
                effectiveAt: effectiveAt.toISOString()
            });
        });

        await test.step('5. Send no reminder on the local day grace starts', async () => {
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            expect(
                await outboxRowsFor({ userId: user.id, template: 'billing.grace-reminder' })
            ).toHaveLength(0);
        });

        await test.step('6. Three days before grace ends, enqueue and send exactly one reminder', async () => {
            const at = new Date(graceEndsAt.getTime() - 3 * DAY_MS);
            if (at <= currentWorld.clock.now())
                throw new Error('HOS-2136 three-day moment is not in the future.');
            await fakeServer.setClock({ at });
            await runCron({ jobName: 'payment-window-expiry', adminCookie: admin.sessionCookie });
            const [stillPending] = await execSQL<PaymentDetails>(
                'SELECT id, status, provider_fact_id, version FROM payment WHERE id = $1',
                [payment.id]
            );
            expect(stillPending?.status).toBe('PENDING');
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            const reminders = await outboxRowsFor({
                userId: user.id,
                template: 'billing.grace-reminder'
            });
            expect(reminders).toHaveLength(1);
            expect(reminders[0]?.payload.daysBefore).toBe(3);
            expect(reminders[0]?.payload.deadlinesVersion).toBe(deadlineVersion);
            expect(reminders[0]?.payload.scheduledChange).toEqual({
                planName: 'Básico',
                effectiveAt: effectiveAt.toISOString()
            });
            expect(reminders[0]?.payload.paymentMethod).toBe('CARD');
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await mailCapture.waitForMail({
                to: user.email,
                subject: 'Tu suscripción sigue en período de gracia',
                timeoutMs: MAIL_TIMEOUT_MS
            });
            const text = mailText(mail.html);
            expect(normalized(text)).toContain(
                normalized(
                    `Tu suscripción de Alojamiento sigue en período de gracia. Faltan 3 días para el ${formatMarketDate(graceEndsAt)}, cuando termina este período.`
                )
            );
            expect(text).toContain(
                'Si cambiás la tarjeta en Mercado Pago, el cobro se reintenta en el momento.'
            );
            expect(normalized(text)).toContain(normalized(scheduledLine(effectiveAt)));
        });

        await test.step('7. Two days before grace ends, the reminder is not duplicated', async () => {
            const at = new Date(graceEndsAt.getTime() - 2 * DAY_MS);
            if (at <= currentWorld.clock.now())
                throw new Error('HOS-2136 two-day moment is not in the future.');
            await fakeServer.setClock({ at });
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            expect(
                await outboxRowsFor({ userId: user.id, template: 'billing.grace-reminder' })
            ).toHaveLength(1);
        });

        await test.step('8. One day before grace ends, enqueue and send the second reminder', async () => {
            const at = new Date(graceEndsAt.getTime() - DAY_MS);
            if (at <= currentWorld.clock.now())
                throw new Error('HOS-2136 one-day moment is not in the future.');
            await fakeServer.setClock({ at });
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            const reminders = await outboxRowsFor({
                userId: user.id,
                template: 'billing.grace-reminder'
            });
            expect(reminders).toHaveLength(2);
            expect(reminders[1]?.payload.daysBefore).toBe(1);
            expect(reminders[1]?.payload.deadlinesVersion).toBe(deadlineVersion);
            expect(reminders[1]?.payload.scheduledChange).toEqual({
                planName: 'Básico',
                effectiveAt: effectiveAt.toISOString()
            });
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mails = await waitForMailCount({
                world: currentWorld,
                to: user.email,
                subject: 'Tu suscripción sigue en período de gracia',
                count: 2
            });
            const text = mailText(mails[1]?.html ?? '');
            expect(normalized(text)).toContain(
                normalized(
                    `1 día para el ${formatMarketDate(graceEndsAt)}, cuando termina este período.`
                )
            );
            expect(normalized(text)).toContain(normalized(scheduledLine(effectiveAt)));
            expect(
                mailCapture
                    .mailsTo({ to: user.email })
                    .filter(
                        ({ subject }) => subject === 'Tu suscripción sigue en período de gracia'
                    )
            ).toHaveLength(2);
        });

        await test.step('9. After grace ends, no additional reminder is queued', async () => {
            const at = new Date(graceEndsAt.getTime() + 60_000);
            if (at <= currentWorld.clock.now())
                throw new Error('HOS-2136 post-grace moment is not in the future.');
            await fakeServer.setClock({ at });
            await runCron({
                jobName: 'subscription-grace-reminder',
                adminCookie: admin.sessionCookie
            });
            expect(
                await outboxRowsFor({ userId: user.id, template: 'billing.grace-reminder' })
            ).toHaveLength(2);
        });

        await test.step('10. Expire the provider payment window with P2 and verify idempotence', async () => {
            const charge = await fakeServer.provider.readCharge({
                chargeId: payment.provider_fact_id
            });
            const expiresAt = charge.snapshot.expiresAt;
            if (!expiresAt) throw new Error('HOS-2136 rejected charge has no retry-window expiry.');
            const expiresAtDate = new Date(expiresAt);
            const before = await outboxCountFor({ userId: user.id });
            const at = new Date(expiresAtDate.getTime() + 60_000);
            if (at <= currentWorld.clock.now())
                throw new Error('HOS-2136 payment expiry moment is not in the future.');
            await fakeServer.setClock({ at });
            await runCron({ jobName: 'payment-window-expiry', adminCookie: admin.sessionCookie });
            const [failed] = await execSQL<PaymentDetails>(
                'SELECT id, status, provider_fact_id, version FROM payment WHERE id = $1',
                [payment.id]
            );
            expect(failed?.status).toBe('FAILED');
            expect(failed?.version).toBe(payment.version + 1);
            const [subscription] = await execSQL<SubscriptionDetails>(
                `SELECT id, status, plan_version_id, grace_started_at, grace_ends_at
                 FROM subscription WHERE id = $1`,
                [subscriptionId]
            );
            expect(subscription?.status).toBe('GRACE_PERIOD');
            expect(subscription?.grace_started_at?.toISOString()).toBe(
                graceStartedAt.toISOString()
            );
            expect(await outboxCountFor({ userId: user.id })).toBe(before);
            await runCron({ jobName: 'payment-window-expiry', adminCookie: admin.sessionCookie });
            const [repeated] = await execSQL<PaymentDetails>(
                'SELECT id, status, provider_fact_id, version FROM payment WHERE id = $1',
                [payment.id]
            );
            expect(repeated?.status).toBe('FAILED');
            expect(repeated?.version).toBe(payment.version + 1);
        });
    });
});
