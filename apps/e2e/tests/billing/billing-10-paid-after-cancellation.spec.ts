import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { buildEmailDedupKey, buildEventOccurrence } from '@repo/db';
import {
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    PAID_AFTER_CANCELLATION_TEMPLATE
} from '@repo/service-core';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    decodeHtmlEntities,
    deliverNotices,
    type FakeWorld,
    formatMarketDate,
    recordCreditedCycle,
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
            if (userIds.length > 0)
                await execSQL('DELETE FROM addon_instance WHERE owner_id = ANY($1::uuid[])', [
                    userIds
                ]);
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
            const { subscriptionId, authorizationId } = await createApiCardSubscription({
                user,
                billingOptionId
            });
            await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
            await recordCreditedCycle({
                fakeServer: world.fakeServer,
                subscriptionId,
                authorizationId
            });
            const serviceEndRows = await execSQL<{ service_ends_at: Date }>(
                `SELECT period_start + INTERVAL '1 month' AS service_ends_at
                 FROM covered_period WHERE subscription_id = $1 AND released_at IS NULL
                 ORDER BY period_start DESC LIMIT 1`,
                [subscriptionId]
            );
            const serviceEndsAt = serviceEndRows[0]?.service_ends_at;
            if (!serviceEndsAt) throw new Error('Expected the credited monthly period end.');
            const addonAuthorization = await world.fakeServer.provider.authorize({
                reference: `b13a18-addon-${subscriptionId}`,
                amount: { amountMinor: 2500, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Recurring addon for paid-after-cancellation e2e',
                returnUrl: 'https://example.test/billing/addon',
                payerEmail: user.email
            });
            await world.fakeServer.provider.approve({
                authorizationId: addonAuthorization.authorizationId
            });
            const addon = await seedRecurringAddon({
                ownerId: user.id,
                principalSubscriptionId: subscriptionId,
                authorizationId: addonAuthorization.authorizationId
            });
            if (arrival === 'R18 mirror') {
                await enqueueBeforeCancelNotice({
                    userId: user.id,
                    email: user.email,
                    subscriptionId
                });
                await world.fakeServer.provider.cancel({ authorizationId });
                await deliverNotices({ fakeServer: world.fakeServer });
                const scheduled = await execSQL<{ status: string; service_ends_at: Date }>(
                    'SELECT status, service_ends_at FROM subscription WHERE id = $1',
                    [subscriptionId]
                );
                expect(scheduled[0]?.status).toBe('CANCEL_SCHEDULED');
                expect(scheduled[0]?.service_ends_at.toISOString()).toBe(
                    serviceEndsAt.toISOString()
                );
            } else {
                await seedScheduledPaymentOutcome({
                    userId: user.id,
                    email: user.email,
                    subscriptionId,
                    serviceEndsAt,
                    complementSubscriptionId: addon.complementSubscriptionId
                });
            }
            const addonRows = await execSQL<{ status: string; service_ends_at: Date }>(
                'SELECT status, service_ends_at FROM subscription WHERE id = $1',
                [addon.complementSubscriptionId]
            );
            expect(addonRows[0]?.status).toBe('CANCEL_SCHEDULED');
            expect(addonRows[0]?.service_ends_at.toISOString()).toBe(serviceEndsAt.toISOString());
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

async function enqueueBeforeCancelNotice(args: {
    readonly userId: string;
    readonly email: string;
    readonly subscriptionId: string;
}): Promise<void> {
    const template = BEFORE_CANCEL_TEMPLATE_BY_KIND.ARREARS_SUSPENSION;
    const dedupKey = buildEmailDedupKey({
        recipient: args.userId,
        template,
        occurrence: buildEventOccurrence({ eventId: args.subscriptionId })
    });
    await execSQL(
        `INSERT INTO email_outbox (recipient_user_id, recipient_email, template, payload, dedup_key)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [
            args.userId,
            args.email,
            template,
            JSON.stringify({ subscriptionId: args.subscriptionId }),
            dedupKey
        ]
    );
}

async function seedScheduledPaymentOutcome(args: {
    readonly userId: string;
    readonly email: string;
    readonly subscriptionId: string;
    readonly serviceEndsAt: Date;
    readonly complementSubscriptionId: string;
}): Promise<void> {
    await execSQL(
        `UPDATE subscription
         SET status = 'CANCEL_SCHEDULED', service_ends_at = $2
         WHERE id = ANY($1::uuid[])`,
        [[args.subscriptionId, args.complementSubscriptionId], args.serviceEndsAt]
    );
    const template = PAID_AFTER_CANCELLATION_TEMPLATE;
    const payload = {
        subscriptionId: args.subscriptionId,
        vertical: 'accommodation',
        serviceEndsAt: args.serviceEndsAt.toISOString(),
        recurringAddonsCut: true
    };
    const dedupKey = buildEmailDedupKey({
        recipient: args.userId,
        template,
        occurrence: buildEventOccurrence({ eventId: args.subscriptionId })
    });
    await execSQL(
        `INSERT INTO email_outbox (recipient_user_id, recipient_email, template, payload, dedup_key)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [args.userId, args.email, template, JSON.stringify(payload), dedupKey]
    );
}

async function seedRecurringAddon(args: {
    readonly ownerId: string;
    readonly principalSubscriptionId: string;
    readonly authorizationId: string;
}): Promise<{ readonly complementSubscriptionId: string }> {
    const slug = `b13a18-${randomUUID()}`;
    const rows = await execSQL<{ complement_subscription_id: string }>(
        `WITH addon_row AS (
            INSERT INTO addon (slug, name, description)
            VALUES ($4, 'B13a.18 recurring addon', 'Paid-after-cancellation e2e fixture')
            RETURNING id
        ), version_row AS (
            INSERT INTO addon_version (addon_id, validity, validity_days, scope_type)
            SELECT id, 'WHILE_SUBSCRIPTION_ALIVE', NULL, 'VERTICAL_SUBSCRIPTION'
            FROM addon_row
            RETURNING id, addon_id
        ), product_row AS (
            INSERT INTO addon_product (
                addon_id, version_id, price, currency, charge_kind, cycle, compatible_verticals
            )
            SELECT addon_id, id, 2500, 'ARS', 'PERIODICO', 'monthly', ARRAY['accommodation']::varchar[]
            FROM version_row
            RETURNING id, version_id
        ), complement_row AS (
            INSERT INTO subscription (
                user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class
            )
            SELECT user_id, vertical, plan_version_id, billing_option_id, payment_method, 'ACTIVE', 'COMPLEMENTO'
            FROM subscription WHERE id = $2
            RETURNING id
        ), linked_row AS (
            INSERT INTO provider_link (subscription_id, provider, provider_id)
            SELECT id, 'MERCADO_PAGO', $3 FROM complement_row
            RETURNING subscription_id
        ), instance_row AS (
            INSERT INTO addon_instance (
                product_id, addon_version_id, owner_id, target_id, status, starts_at,
                complement_subscription_id
            )
            SELECT product_row.id, product_row.version_id, $1, $2, 'ACTIVE', NOW(), complement_row.id
            FROM product_row CROSS JOIN complement_row CROSS JOIN linked_row
            RETURNING complement_subscription_id
        )
        SELECT complement_subscription_id FROM instance_row`,
        [args.ownerId, args.principalSubscriptionId, args.authorizationId, slug]
    );
    const complementSubscriptionId = rows[0]?.complement_subscription_id;
    if (!complementSubscriptionId) throw new Error('Expected an authorized recurring addon.');
    return { complementSubscriptionId };
}
