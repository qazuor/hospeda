import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { z } from 'zod';
import {
    createSubscriber,
    DAY_MS,
    decodeHtmlEntities,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    readCurrentGraceDays,
    runCron,
    startFakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupPartnerBillingSetupRows } from '../../fixtures/partner-billing-setup.ts';
import { attachSession, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const SUBJECT = 'Tenés una cuota para pagar en Hospeda';
const INTRO_FIRST =
    'Ya configuramos tu suscripción de Partner. Este es el detalle de tu primera cuota.';
const INTRO_RENEWAL = 'Se abrió la cuota de un nuevo período de tu suscripción de Partner.';
const HOW_TO_PAY =
    'Se paga por transferencia bancaria. El equipo de Hospeda te manda por correo los datos para transferir. Cuando registremos el pago, tu suscripción queda al día.';
const APPROVED =
    'Tu contenido está aprobado. El equipo de Hospeda arma tu suscripción y te escribe para coordinar el pago por transferencia.';

const Action6PreviewSchema = z.object({
    data: z.object({
        options: z.array(z.object({ billingOptionId: z.string(), planSlug: z.string() }))
    })
});
const Action6SetupSchema = z.object({
    data: z.object({ subscriptionId: z.string(), manualPaymentId: z.string() })
});

function norm(value: string): string {
    return value
        .replace(/[\u00a0\u202f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function mailText(html: string): string {
    return norm(decodeHtmlEntities(html).replace(/<[^>]+>/g, ' '));
}

function expectedAmount(amountMinor: number): string {
    return norm(
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            ...(amountMinor % 100 === 0
                ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                : {})
        }).format(amountMinor / 100)
    );
}

async function readCard(page: Page) {
    await page.goto(`${WEB_URL}/es/mi-cuenta/partner/`);
    return page.getByTestId('partner-installment');
}

test.describe('TEST:HOS-2137 partner manual installment: card, mail and renewal @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });

    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    const userIds: string[] = [];
    const partnerIds: string[] = [];
    let optionId = '';
    let amount = 0;
    let planName = '';
    let subscriptionId = '';
    let firstInstallmentId = '';
    let renewalInstallmentId = '';
    let nextChargeAt = new Date(0);
    let graceEndsAt = new Date(0);

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        world = await startFakeWorld();
        subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        optionId = await monthlyOptionForSlug('partner-silver');

        const partnerId = randomUUID();
        partnerIds.push(partnerId);
        const suffix = randomUUID();
        await execSQL(
            `INSERT INTO partners (id, owner_user_id, slug, name, type, description, content_approved_at, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'business', 'HOS-2137 fixture', now(), now(), now())`,
            [partnerId, subscriber.user.id, `hos2137-${suffix}`, `HOS-2137 ${suffix}`]
        );

        const optionRows = await execSQL<{ amount: number; currency: string }>(
            'SELECT amount, currency FROM billing_option WHERE id = $1',
            [optionId]
        );
        const option = optionRows[0];
        if (!option) throw new Error('Expected the Partner billing option row.');
        expect(option.currency).toBe('ARS');
        amount = option.amount;

        const planRows = await execSQL<{ name: string }>(
            `SELECT p.name
                   FROM billing_option bo
                   JOIN plan_version pv ON pv.id = bo.plan_version_id
                   JOIN plan p ON p.id = pv.plan_id
                  WHERE bo.id = $1`,
            [optionId]
        );
        planName = planRows[0]?.name ?? '';
        if (!planName) throw new Error('Expected the Partner plan name.');
    });

    test.afterAll(async () => {
        try {
            await cleanupPartnerBillingSetupRows({ userIds, partnerIds });
            await cleanupTestUsers(getDbPool(), userIds);
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('covers opening, registering and renewing a manual installment', async ({ page }) => {
        test.setTimeout(300_000);
        const activeWorld = world;
        if (!activeWorld || !subscriber)
            throw new Error('Expected the Partner billing test world.');
        const actors = subscriber;
        const partnerId = partnerIds[0];
        if (!partnerId) throw new Error('Expected the Partner fixture id.');

        await test.step('Point 1: action 6 opens the card and sends its email', async () => {
            const headers = {
                cookie: actors.admin.sessionCookie,
                'content-type': 'application/json'
            };
            const previewResponse = await fetch(
                `${API_URL}/api/v1/admin/partners/${partnerId}/billing-setup`,
                { headers }
            );
            expect(previewResponse.status).toBe(200);
            const preview = Action6PreviewSchema.parse(await previewResponse.json());
            const option = preview.data.options.find(
                (entry) => entry.planSlug === 'partner-silver' && entry.billingOptionId === optionId
            );
            if (!option) throw new Error('Action 6 did not offer the current Silver option.');

            const setupResponse = await fetch(
                `${API_URL}/api/v1/admin/partners/${partnerId}/billing-setup`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        billingOptionId: option.billingOptionId,
                        reason: `HOS-2137 ${randomUUID()}`,
                        confirm: true
                    })
                }
            );
            expect(setupResponse.status).toBe(200);
            const setup = Action6SetupSchema.parse(await setupResponse.json());
            subscriptionId = setup.data.subscriptionId;
            firstInstallmentId = setup.data.manualPaymentId;

            const subscriptionRows = await execSQL<{
                status: string;
                payment_method: string;
                authorization_window_ends_at: Date;
            }>(
                'SELECT status, payment_method, authorization_window_ends_at FROM subscription WHERE id = $1',
                [subscriptionId]
            );
            expect(subscriptionRows).toHaveLength(1);
            expect(subscriptionRows[0]?.status).toBe('PENDING_AUTHORIZATION');
            expect(subscriptionRows[0]?.payment_method).toBe('MANUAL');
            const authorizationEndsAt = subscriptionRows[0]?.authorization_window_ends_at;
            if (!authorizationEndsAt) throw new Error('Expected authorization window end.');
            const installmentRows = await execSQL<{ status: string }>(
                'SELECT status FROM manual_payment WHERE id = $1',
                [firstInstallmentId]
            );
            expect(installmentRows).toEqual([{ status: 'AWAITING' }]);

            await seedCookieConsent(page);
            await attachSession(page, actors.user.sessionCookie);
            const card = await readCard(page);
            await expect(card.locator('h2')).toHaveText('Tu cuota a pagar');
            await expect(card.locator('p').nth(0)).toHaveText('Plan: Silver');
            const cardAmount = norm(
                (await card.getByTestId('partner-installment-amount').textContent()) ?? ''
            );
            expect(cardAmount).toBe(`Monto: ${expectedAmount(amount)}`);
            const firstDue = norm(
                (await card.getByTestId('partner-installment-due').textContent()) ?? ''
            );
            expect(firstDue).toBe(norm(`Vence el ${formatMarketDate(authorizationEndsAt)}`));
            await expect(card.locator('p').nth(3)).toHaveText(HOW_TO_PAY);
            await expect(page.getByText(APPROVED, { exact: true })).toHaveCount(1);
            await expect(page.getByText('link de pago')).toHaveCount(0);

            await runCron({
                jobName: 'email-outbox-sender',
                adminCookie: actors.admin.sessionCookie
            });
            const firstMail = await activeWorld.mailCapture.waitForMail({
                to: actors.user.email,
                subject: SUBJECT,
                timeoutMs: 30_000
            });
            const firstText = mailText(firstMail.html);
            expect(firstMail.subject).toBe(SUBJECT);
            expect(firstText).toContain(INTRO_FIRST);
            expect(firstText).toContain('Plan: Silver');
            const mailAmount = `Monto: ${expectedAmount(amount)}`;
            expect(firstText).toContain(mailAmount);
            expect(mailAmount).toBe(cardAmount);
            expect(firstText).toContain(norm(`Vence el ${formatMarketDate(authorizationEndsAt)}`));
            expect(firstText).toContain(HOW_TO_PAY);
            expect(firstText).toContain('Ver mi cuota');
            expect(firstText).not.toContain(INTRO_RENEWAL);
            expect(firstMail.html).toContain('/es/mi-cuenta/partner/"');

            const outboxRows = await execSQL<{ payload: unknown }>(
                `SELECT payload FROM email_outbox
                      WHERE recipient_user_id = $1 AND template = 'billing.manual-installment-opened'`,
                [actors.user.id]
            );
            expect(outboxRows).toHaveLength(1);
            expect(outboxRows[0]?.payload).toEqual({
                manualPaymentId: firstInstallmentId,
                subscriptionId,
                locale: 'es',
                planSlug: 'partner-silver',
                planName,
                amountMinor: amount,
                currency: 'ARS',
                dueAt: authorizationEndsAt.toISOString(),
                firstInstallment: true
            });
        });

        await test.step('Point 2: registering the payment removes the card', async () => {
            const registerResponse = await fetch(
                `${API_URL}/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${firstInstallmentId}/register`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        cookie: actors.admin.sessionCookie
                    },
                    body: JSON.stringify({ proofRef: `hos2137-${randomUUID()}` })
                }
            );
            expect(registerResponse.status).toBe(200);

            const subscriptionRows = await execSQL<{
                status: string;
                next_charge_at: Date | null;
            }>('SELECT status, next_charge_at FROM subscription WHERE id = $1', [subscriptionId]);
            expect(subscriptionRows).toHaveLength(1);
            expect(subscriptionRows[0]?.status).toBe('ACTIVE');
            nextChargeAt = subscriptionRows[0]?.next_charge_at ?? new Date(0);
            expect(nextChargeAt.getTime()).toBeGreaterThan(0);
            const installmentRows = await execSQL<{ status: string }>(
                'SELECT status FROM manual_payment WHERE id = $1',
                [firstInstallmentId]
            );
            expect(installmentRows).toEqual([{ status: 'REGISTERED' }]);
            const receiptRows = await execSQL<{ count: number }>(
                'SELECT count(*)::int AS count FROM receipt WHERE manual_payment_id = $1',
                [firstInstallmentId]
            );
            expect(receiptRows).toEqual([{ count: 1 }]);

            const card = await readCard(page);
            await expect(card).toHaveCount(0);
            await expect(page.getByText(APPROVED, { exact: true })).toHaveCount(1);
        });

        await test.step('Point 3: renewal opens one installment and sends one email', async () => {
            await activeWorld.fakeServer.setClock({ at: nextChargeAt });
            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const renewalRows = await execSQL<{
                id: string;
                status: string;
                subscription_status: string;
                plan_version_id: string;
                grace_started_at: Date;
                grace_ends_at: Date;
                grace_days: number;
                count: number;
            }>(
                `SELECT mp.id, mp.status, s.status AS subscription_status, s.plan_version_id,
                            s.grace_started_at, s.grace_ends_at, pv.grace_days,
                            (SELECT count(*)::int FROM manual_payment period_mp
                              WHERE period_mp.subscription_id = s.id AND period_mp.period_start = $2) AS count
                       FROM subscription s
                       JOIN plan_version pv ON pv.id = s.plan_version_id
                       JOIN manual_payment mp ON mp.subscription_id = s.id AND mp.period_start = $2
                      WHERE s.id = $1`,
                [subscriptionId, nextChargeAt]
            );
            expect(renewalRows).toHaveLength(1);
            const renewal = renewalRows[0];
            if (!renewal) throw new Error('Expected the renewal installment row.');
            renewalInstallmentId = renewal.id;
            expect(renewalInstallmentId).not.toBe(firstInstallmentId);
            expect(renewal.status).toBe('AWAITING');
            expect(renewal.count).toBe(1);
            expect(renewal.subscription_status).toBe('GRACE_PERIOD');
            const graceStartedAt = new Date(renewal.grace_started_at);
            graceEndsAt = new Date(renewal.grace_ends_at);
            const graceDays = await readCurrentGraceDays({
                planVersionId: renewal.plan_version_id
            });
            expect(graceEndsAt.getTime() - graceStartedAt.getTime()).toBe(graceDays * DAY_MS);
            expect(renewal.grace_days).toBe(graceDays);

            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const samePeriodRows = await execSQL<{ id: string }>(
                'SELECT id FROM manual_payment WHERE subscription_id = $1 AND period_start = $2',
                [subscriptionId, nextChargeAt]
            );
            expect(samePeriodRows).toEqual([{ id: renewalInstallmentId }]);

            await runCron({
                jobName: 'email-outbox-sender',
                adminCookie: actors.admin.sessionCookie
            });
            await runCron({
                jobName: 'email-outbox-sender',
                adminCookie: actors.admin.sessionCookie
            });
            const mailsToUser = () =>
                activeWorld.mailCapture
                    .mailsTo({ to: actors.user.email })
                    .filter((mail) => mail.subject === SUBJECT);
            await expect.poll(() => mailsToUser().length, { timeout: 30_000 }).toBe(2);
            await new Promise((resolve) => setTimeout(resolve, 2_000));
            expect(mailsToUser().length).toBe(2);
            const renewalMail = mailsToUser()[1];
            if (!renewalMail) throw new Error('Expected the second installment email.');
            const renewalText = mailText(renewalMail.html);
            expect(renewalText).toContain(INTRO_RENEWAL);
            expect(renewalText).toContain('Plan: Silver');
            expect(renewalText).toContain(`Monto: ${expectedAmount(amount)}`);
            expect(renewalText).toContain(norm(`Vence el ${formatMarketDate(graceEndsAt)}`));
            expect(renewalText).toContain(HOW_TO_PAY);
            expect(renewalText).not.toContain(INTRO_FIRST);

            const groupedOutboxRows = await execSQL<{ id: string; n: number }>(
                `SELECT payload->>'manualPaymentId' AS id, count(*)::int AS n
                       FROM email_outbox
                      WHERE recipient_user_id = $1 AND template = 'billing.manual-installment-opened'
                      GROUP BY 1 ORDER BY min(created_at)`,
                [actors.user.id]
            );
            expect(groupedOutboxRows).toEqual([
                { id: firstInstallmentId, n: 1 },
                { id: renewalInstallmentId, n: 1 }
            ]);
            const secondPayloadRows = await execSQL<{ payload: unknown }>(
                `SELECT payload FROM email_outbox
                      WHERE recipient_user_id = $1 AND template = 'billing.manual-installment-opened'
                        AND payload->>'manualPaymentId' = $2`,
                [actors.user.id, renewalInstallmentId]
            );
            expect(secondPayloadRows).toHaveLength(1);
            expect(secondPayloadRows[0]?.payload).toEqual({
                manualPaymentId: renewalInstallmentId,
                subscriptionId,
                locale: 'es',
                planSlug: 'partner-silver',
                planName,
                amountMinor: amount,
                currency: 'ARS',
                dueAt: graceEndsAt.toISOString(),
                firstInstallment: false
            });

            const card = await readCard(page);
            await expect(card.locator('h2')).toHaveText('Tu cuota a pagar');
            await expect(card.locator('p').nth(0)).toHaveText('Plan: Silver');
            await expect(card.getByTestId('partner-installment-amount')).toHaveText(
                `Monto: ${expectedAmount(amount)}`
            );
            const renewalDue = norm(
                (await card.getByTestId('partner-installment-due').textContent()) ?? ''
            );
            expect(renewalDue).toBe(norm(`Vence el ${formatMarketDate(graceEndsAt)}`));
            await expect(card.locator('p').nth(3)).toHaveText(HOW_TO_PAY);
            expect(activeWorld.fakeServer.requests()).toHaveLength(0);
        });
    });
});
