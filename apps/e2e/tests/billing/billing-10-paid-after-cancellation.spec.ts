import { expect, test } from '@playwright/test';
import { buildEmailDedupKey, buildEventOccurrence } from '@repo/db';
import { PAID_AFTER_CANCELLATION_TEMPLATE } from '@repo/service-core';
import {
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    decodeHtmlEntities,
    type FakeWorld,
    formatMarketDate,
    runCron,
    startFakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { attachSession, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';

test.describe('TEST:B13a:18 AC:B13a:17 paid after cancellation does not renew @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    let world: FakeWorld | null = null;
    const userIds: string[] = [];
    test.beforeAll(async () => {
        world = await startFakeWorld();
    });
    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    for (const arrival of ['R18 mirror', 'S7 from SUSPENDED'] as const) {
        test(`TEST:B13a:18 ${arrival} row displays the paid-after-cancellation notice`, async ({
            page
        }) => {
            if (!world) throw new Error('Expected fake billing world.');
            const subscriber = await createSubscriber();
            userIds.push(subscriber.user.id, subscriber.admin.id);
            const { user, admin } = subscriber;
            const billingOptionId = await monthlyOptionForSlug('owner-basico');
            const { subscriptionId } = await createApiCardSubscription({ user, billingOptionId });
            const serviceEndsAt = new Date('2026-11-05T12:00:00.000Z');
            await execSQL(
                `UPDATE subscription SET status = 'CANCEL_SCHEDULED', service_ends_at = $2 WHERE id = $1`,
                [subscriptionId, serviceEndsAt]
            );
            const template = PAID_AFTER_CANCELLATION_TEMPLATE;
            const payload = {
                subscriptionId,
                vertical: 'accommodation',
                serviceEndsAt: serviceEndsAt.toISOString(),
                recurringAddonsCut: true
            };
            const dedupKey = buildEmailDedupKey({
                recipient: user.id,
                template,
                occurrence: buildEventOccurrence({ eventId: subscriptionId })
            });
            await execSQL(
                `INSERT INTO email_outbox (recipient_user_id, recipient_email, template, payload, dedup_key)
                 VALUES ($1, $2, $3, $4::jsonb, $5)`,
                [user.id, user.email, template, JSON.stringify(payload), dedupKey]
            );
            await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
            const mail = await world.mailCapture.waitForMail({
                to: user.email,
                subject: 'Tu pago entró, pero tu suscripción no se renueva',
                timeoutMs: 30_000
            });
            const marketDate = formatMarketDate(serviceEndsAt);
            const html = decodeHtmlEntities(mail.html);
            expect(html).toContain('Tu pago entró y tenés servicio hasta');
            expect(html).toContain(marketDate);
            expect(html).toContain('no se renueva');
            expect(html).toContain('El cobro de tus complementos recurrentes');
            await attachSession(page, user.sessionCookie);
            await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
            const row = page.locator(
                `article[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
            );
            await expect(row).toHaveAttribute('data-renewal', 'NOT_RENEWING_AFTER_PAYMENT');
            await expect(row).toContainText('Tu pago entró y tenés servicio hasta');
            await expect(row).toContainText(marketDate);
            await expect(row).toContainText('no se renueva');
            await expect(row).toContainText('El cobro de tus complementos recurrentes');
        });
    }
});
