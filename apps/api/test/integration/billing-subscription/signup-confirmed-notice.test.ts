import { createHmac } from 'node:crypto';
import {
    billingDeadlineVersions,
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';

const path = '/api/v1/protected/billing/subscriptions';
const webhookSecret = 'b3-signup-render-test-secret';
const clock = { now: () => new Date('2026-10-09T02:00:00.000Z') };
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

async function seedChoice() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-signup-api-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 signup API user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-signup-api-${crypto.randomUUID()}`,
            name: 'Plan del correo'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option');
    return { user, plan, option };
}

function signedHeaders(dataId: string) {
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(clock.now().getTime() / 1000));
    const canonicalId = /^[a-z\d]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const manifest = `id:${canonicalId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-request-id': requestId,
        'x-signature': `ts=${timestamp},v1=${signature}`
    };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
});

afterAll(async () => testDb.teardown());

describe('TEST:B3:34 signup confirmed notice', () => {
    it('starts through protected S1, activates through the signed receiver, and renders the outbox row', async () => {
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: deadlines })
            .onConflictDoNothing();
        const { user, option, plan } = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const created = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id })
        });
        const createdBody = (await created.json()) as {
            data: { authorizationId: string; subscriptionId: string };
        };
        const started = createdBody.data;
        expect(created.status).toBe(201);
        expect(started.subscriptionId).toBeTruthy();
        expect(authorize).toHaveBeenCalledOnce();
        const authorizeReason = authorize.mock.calls[0]?.[0].reason;
        expect(authorizeReason).toBe(plan.name);
        expect(authorizeReason).not.toContain(plan.id);
        expect(authorizeReason).not.toContain(plan.slug);

        await fake.approve({ authorizationId: started.authorizationId });
        const encoded = encodeFakeNotice({
            notice: {
                resourceKind: 'authorization',
                resourceId: started.authorizationId,
                version: '1'
            },
            format: 'json'
        });
        const delivery = await app.request(
            `/api/v1/webhooks/mercadopago?source_news=webhooks&data.id=${encodeURIComponent(started.authorizationId)}&type=subscription_preapproval`,
            {
                method: 'POST',
                headers: signedHeaders(started.authorizationId),
                body: encoded.body
            }
        );
        const deliveryBody = await delivery.json();
        expect(delivery.status).toBe(200);
        expect(deliveryBody).toMatchObject({ data: { received: true } });
        const [subscription] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        expect(subscription?.status).toBe('ACTIVE');

        const ownRows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        const signupNotice = ownRows.find((row) => row.template === 'billing.signup-confirmed');
        expect(ownRows.filter((row) => row.template === 'billing.signup-confirmed')).toHaveLength(
            1
        );
        expect(signupNotice?.payload).toMatchObject({
            subscriptionId: started.subscriptionId,
            vertical: 'accommodation',
            planName: plan.name,
            firstChargeDate: '2026-10-08'
        });
        const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });
        const rendered = await render({ row: signupNotice! });
        const { renderToStaticMarkup } = await import('react-dom/server');
        const html = renderToStaticMarkup(rendered.react);
        expect(html).toContain('Mercado Pago');
        expect(html).toContain('ya pagaste');
        expect(html).toContain('8 de octubre de 2026');
        expect(html).not.toContain(started.subscriptionId);
    });
});
