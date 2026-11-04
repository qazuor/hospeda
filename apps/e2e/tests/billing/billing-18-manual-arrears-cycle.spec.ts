import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
    createSubscriber,
    DAY_MS,
    decodeHtmlEntities,
    ensureDeadlineVersion,
    type FakeWorld,
    runCron,
    startFakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { cleanupManualArrearsRows } from '../../fixtures/manual-arrears.ts';
import { attachSession, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const MAIL_TIMEOUT_MS = 30_000;

test.describe('TEST:B7:20 AC:B7:32 manual payer arrears cycle @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    let userIds: string[] = [];
    let subscriptionId = '';
    let overdueInstallmentId = '';
    let nextChargeAt = new Date();
    let graceEndsAt = new Date();

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        world = await startFakeWorld();
        subscriber = await createSubscriber();
        userIds = [subscriber.user.id, subscriber.admin.id];
        const optionId = await monthlyOptionForSlug('partner-silver');
        const start = world.clock.now();
        nextChargeAt = new Date(start.getTime() + 30 * DAY_MS);
        const rows = await execSQL<{ id: string; installment_id: string }>(
            `WITH created AS (
                INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class, next_charge_at)
                SELECT $1, 'partner', pv.id, $2, 'MANUAL', 'ACTIVE', 'PRINCIPAL', $3
                  FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id
                 WHERE bo.id = $2 AND pv.current = true
                RETURNING id, plan_version_id
             ), first_payment AS (
                INSERT INTO manual_payment (subscription_id, period_start, status, registered_by, registered_at)
                SELECT created.id, $4, 'REGISTERED', $1, $5 FROM created
                RETURNING id, subscription_id
             ), initial_coverage AS (
                INSERT INTO covered_period (subscription_id, period_start, manual_payment_id, credited_at)
                SELECT subscription_id, $4, id, $5 FROM first_payment
             )
             SELECT created.id, first_payment.id AS installment_id FROM created CROSS JOIN first_payment`,
            [subscriber.user.id, optionId, nextChargeAt, start, start]
        );
        subscriptionId = rows[0]?.id ?? '';
        overdueInstallmentId = rows[0]?.installment_id ?? '';
        if (!subscriptionId || !overdueInstallmentId)
            throw new Error('Manual subscription fixture failed');
    });

    test.afterAll(async () => {
        try {
            await cleanupManualArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('TEST:B7:20 manual installment, clock suspension email, and MP4 S7', async ({ page }) => {
        test.setTimeout(300_000);
        if (!world || !subscriber) throw new Error('Expected manual arrears world and subscriber.');
        const { fakeServer, mailCapture } = world;
        const actors = subscriber;
        await seedCookieConsent(page);
        await attachSession(page, actors.user.sessionCookie);
        const showStatus = async (status: string) => {
            await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
            const card = page.locator(
                `[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
            );
            await expect(card).toContainText(status);
            return card;
        };

        await test.step('MP5 opens the unpaid installment and starts the ten-day grace', async () => {
            await fakeServer.setClock({ at: nextChargeAt });
            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const rows = await execSQL<{
                status: string;
                grace_started_at: Date;
                grace_ends_at: Date;
                count: number;
            }>(
                `SELECT s.status, s.grace_started_at, s.grace_ends_at,
                        (SELECT count(*)::int FROM manual_payment mp WHERE mp.subscription_id = s.id AND mp.period_start = $2) AS count
                   FROM subscription s WHERE s.id = $1`,
                [subscriptionId, nextChargeAt]
            );
            expect(rows[0]?.status).toBe('GRACE_PERIOD');
            expect(rows[0]?.count).toBe(1);
            graceEndsAt = new Date(rows[0]?.grace_ends_at ?? 0);
            expect(graceEndsAt.getTime() - new Date(rows[0]?.grace_started_at ?? 0).getTime()).toBe(
                10 * DAY_MS
            );
            const card = await showStatus('Pago pendiente');
            await expect(card.getByTestId('my-subscription-grace')).toHaveCount(0);
        });

        let suspensionMailReceivedAt: Date | null = null;
        await test.step('MP3 expires grace by clock and mails the payer before MP4', async () => {
            await fakeServer.setClock({ at: new Date(graceEndsAt.getTime() + 1000) });
            await runCron({
                jobName: 'manual-grace-expiry',
                adminCookie: actors.admin.sessionCookie
            });
            const rows = await execSQL<{ status: string }>(
                `SELECT mp.status FROM manual_payment mp WHERE mp.subscription_id = $1 AND mp.period_start = $2`,
                [subscriptionId, nextChargeAt]
            );
            expect(rows[0]?.status).toBe('DECLARED_UNPAID');
            const captured = await (async () => {
                await runCron({
                    jobName: 'email-outbox-sender',
                    adminCookie: actors.admin.sessionCookie
                });
                return mailCapture.waitForMail({
                    to: actors.user.email,
                    subject: 'Tu suscripción se suspendió',
                    timeoutMs: MAIL_TIMEOUT_MS
                });
            })();
            suspensionMailReceivedAt = captured.receivedAt;
            const html = decodeHtmlEntities(captured.html).toLowerCase();
            expect(html).toContain('registrá el pago de la cuota adeudada');
            expect(html).not.toContain('tarjeta');
            await showStatus('Suspendida');
        });

        await test.step('MP4 registers the late installment through S7 and returns to active', async () => {
            if (!suspensionMailReceivedAt) throw new Error('Expected suspension mail before MP4.');
            const response = await fetch(
                `${API_URL}/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${overdueInstallmentId}/register-late`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        cookie: actors.admin.sessionCookie
                    },
                    body: JSON.stringify({ proofRef: `e2e-${randomUUID()}` })
                }
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                data?: { effect?: string; reimputedFrom?: string | null };
            };
            expect(body.data).toMatchObject({ effect: 'S7', reimputedFrom: null });
            const rows = await execSQL<{
                status: string;
                grace_started_at: Date | null;
                grace_ends_at: Date | null;
                installment_status: string;
                covered: number;
                receipts: number;
            }>(
                `SELECT s.status, s.grace_started_at, s.grace_ends_at, mp.status AS installment_status,
                        (SELECT count(*)::int FROM covered_period cp WHERE cp.manual_payment_id = mp.id AND cp.released_at IS NULL) AS covered,
                        (SELECT count(*)::int FROM receipt r WHERE r.manual_payment_id = mp.id) AS receipts
                   FROM subscription s JOIN manual_payment mp ON mp.subscription_id = s.id
                  WHERE s.id = $1 AND mp.id = $2`,
                [subscriptionId, overdueInstallmentId]
            );
            expect(rows[0]).toMatchObject({
                status: 'ACTIVE',
                grace_started_at: null,
                grace_ends_at: null,
                installment_status: 'REGISTERED',
                covered: 1,
                receipts: 1
            });
            await showStatus('Activa');
            expect(fakeServer.requests()).toHaveLength(0);
            expect(suspensionMailReceivedAt.getTime()).toBeLessThan(Date.now());
        });
    });
});
