import {
    billingDeadlineVersions,
    emailOutbox,
    eq,
    providerLinks,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
const base = new Date('2026-10-01T03:00:00.000Z');
let millis = 0;
const clock = { now: () => new Date(base.getTime() + millis) };
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const values = {
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

async function setup() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `notice-dupe-${crypto.randomUUID()}@example.test`,
            displayName: 'Notice',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `notice-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('missing plan');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('missing version');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('missing option');
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'fixture signup must succeed' }]
    });
    const started = await startSubscription(
        { userId: user.id, billingOptionId: optionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    return { provider, started, userId: user.id };
}
function notice(resourceId: string) {
    return {
        headers: { 'content-type': 'application/json' },
        body: encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId, version: '7' },
            format: 'json'
        }).body
    };
}

describe('TEST:B3:20 provider notice duplicates', () => {
    it('TEST:B3:20 preserves the result in all three delivery orders', async () => {
        const orders = [
            ['W', 'W', 'I'],
            ['W', 'I', 'W'],
            ['I', 'W', 'W']
        ] as const;
        for (const order of orders) {
            const { provider, started, userId } = await setup();
            const read = vi.spyOn(provider, 'readAuthorization');
            const decode = vi.spyOn(provider, 'decodeNotice');
            const token = crypto.randomUUID();
            const webhooksUrl = `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`;
            const ipnUrl = `https://api.example.test/api/v1/webhooks/mercadopago?topic=payment&t=${token}`;
            const outcomes = [];
            const outboxBefore = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, userId));
            let firstWebhookXmins:
                | { readonly subscription: string | undefined; readonly link: string | undefined }
                | undefined;
            for (const item of order) {
                if (item === 'W') millis += 500;
                outcomes.push(
                    await receiveProviderDelivery(
                        {
                            url: item === 'W' ? webhooksUrl : ipnUrl,
                            delivery: notice(started.authorizationId)
                        },
                        { provider, clock, beforeCancelNotice }
                    )
                );
                if (item === 'W' && firstWebhookXmins === undefined) {
                    const [subscription] = await getServiceTestPool()
                        .query<{ xmin: string }>(
                            'SELECT xmin::text FROM subscription WHERE id = $1',
                            [started.subscriptionId]
                        )
                        .then((result) => result.rows);
                    const [link] = await getServiceTestPool()
                        .query<{ xmin: string }>(
                            'SELECT xmin::text FROM provider_link WHERE subscription_id = $1',
                            [started.subscriptionId]
                        )
                        .then((result) => result.rows);
                    firstWebhookXmins = {
                        subscription: subscription?.xmin,
                        link: link?.xmin
                    };
                }
            }
            expect(
                outcomes.filter((result) => result.outcome === 'DISCARDED_OLD_VERSION')
            ).toHaveLength(1);
            expect(
                outcomes.filter((result) => result.outcome === 'IPN_NOT_PROCESSED')
            ).toHaveLength(1);
            expect(read).toHaveBeenCalledTimes(1);
            expect(decode).toHaveBeenCalledTimes(2);
            const finalSubscriptionXmin = (
                await getServiceTestPool().query<{ xmin: string }>(
                    'SELECT xmin::text FROM subscription WHERE id = $1',
                    [started.subscriptionId]
                )
            ).rows[0]?.xmin;
            const finalLinkXmin = (
                await getServiceTestPool().query<{ xmin: string }>(
                    'SELECT xmin::text FROM provider_link WHERE subscription_id = $1',
                    [started.subscriptionId]
                )
            ).rows[0]?.xmin;
            expect(firstWebhookXmins?.subscription).toBe(finalSubscriptionXmin);
            expect(firstWebhookXmins?.link).toBe(finalLinkXmin);
            const outboxAfter = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, userId));
            expect(
                outboxAfter.filter((row) => row.template !== 'billing.signup-confirmed')
            ).toHaveLength(
                outboxBefore.filter((row) => row.template !== 'billing.signup-confirmed').length
            );
            expect(
                outboxAfter.filter(
                    (row) =>
                        row.template === 'billing.signup-confirmed' &&
                        (row.payload as { subscriptionId?: string }).subscriptionId ===
                            started.subscriptionId
                )
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, started.subscriptionId))
            ).toHaveLength(0);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, started.subscriptionId))
                )[0]?.status
            ).toBe('ACTIVE');
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(providerLinks)
                        .where(eq(providerLinks.subscriptionId, started.subscriptionId))
                )[0]?.lastAppliedVersion
            ).toBe('7');
        }
    });

    it('TEST:B3:20 applies repeated webhook deliveries once and keeps IPN outside the cross', async () => {
        const { provider, started, userId } = await setup();
        const read = vi.spyOn(provider, 'readAuthorization');
        const decode = vi.spyOn(provider, 'decodeNotice');
        const token = crypto.randomUUID();
        const webhookUrl = `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`;
        const ipnUrl = `https://api.example.test/api/v1/webhooks/mercadopago?topic=payment&t=${token}`;
        const ports = { provider, clock, beforeCancelNotice };
        const outboxBefore = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, userId));
        const first = await receiveProviderDelivery(
            { url: webhookUrl, delivery: notice(started.authorizationId) },
            ports
        );
        const [afterFirst] = await getServiceTestPool()
            .query<{ xmin: string }>('SELECT xmin::text FROM subscription WHERE id = $1', [
                started.subscriptionId
            ])
            .then((result) => result.rows);
        millis += 500;
        const duplicate = await receiveProviderDelivery(
            { url: webhookUrl, delivery: notice(started.authorizationId) },
            ports
        );
        const [linkAfterFirst] = await getServiceTestPool()
            .query<{ xmin: string }>(
                'SELECT xmin::text FROM provider_link WHERE subscription_id = $1',
                [started.subscriptionId]
            )
            .then((result) => result.rows);
        const ipn = await receiveProviderDelivery(
            { url: ipnUrl, delivery: notice(started.authorizationId) },
            ports
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        const finalXmin = (
            await getServiceTestPool().query<{ xmin: string }>(
                'SELECT xmin::text FROM subscription WHERE id = $1',
                [started.subscriptionId]
            )
        ).rows[0]?.xmin;
        const linkFinalXmin = (
            await getServiceTestPool().query<{ xmin: string }>(
                'SELECT xmin::text FROM provider_link WHERE subscription_id = $1',
                [started.subscriptionId]
            )
        ).rows[0]?.xmin;
        const outboxAfter = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, userId));
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, started.subscriptionId));
        expect(first.ack).toBe('OK');
        expect(duplicate.outcome).toBe('DISCARDED_OLD_VERSION');
        expect(ipn.outcome).toBe('IPN_NOT_PROCESSED');
        expect(row?.status).toBe('ACTIVE');
        expect(link?.lastAppliedVersion).toBe('7');
        expect(afterFirst?.xmin).toBe(finalXmin);
        expect(linkAfterFirst?.xmin).toBe(linkFinalXmin);
        expect(read).toHaveBeenCalledTimes(1);
        expect(decode).toHaveBeenCalledTimes(2);
        expect(
            outboxAfter.filter((outboxRow) => outboxRow.template !== 'billing.signup-confirmed')
        ).toHaveLength(
            outboxBefore.filter((outboxRow) => outboxRow.template !== 'billing.signup-confirmed')
                .length
        );
        expect(
            outboxAfter.filter(
                (outboxRow) =>
                    outboxRow.template === 'billing.signup-confirmed' &&
                    (outboxRow.payload as { subscriptionId?: string }).subscriptionId ===
                        started.subscriptionId
            )
        ).toHaveLength(1);
        expect(marks).toHaveLength(0);
    });

    it('TEST:B3:20 accepts the concurrent duplicate deliveries', async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const { provider, started } = await setup();
            const token = crypto.randomUUID();
            const url = `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`;
            const original = provider.readAuthorization.bind(provider);
            let readers = 0;
            let release: () => void = () => undefined;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const read = vi
                .spyOn(provider, 'readAuthorization')
                .mockImplementation(async (input) => {
                    readers++;
                    if (readers === 2) release();
                    await Promise.race([
                        gate,
                        new Promise<void>((resolve) => setTimeout(resolve, 2000))
                    ]);
                    return original(input);
                });
            const delivery = notice(started.authorizationId);
            const outcomes = await Promise.all(
                [1, 2].map(() =>
                    receiveProviderDelivery(
                        { url, delivery },
                        { provider, clock, beforeCancelNotice }
                    )
                )
            );
            expect(outcomes.every((result) => result.ack === 'OK')).toBe(true);
            expect(read).toHaveBeenCalledTimes(2);
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(subscriptions)
                        .where(eq(subscriptions.id, started.subscriptionId))
                )[0]?.status
            ).toBe('ACTIVE');
            expect(
                (
                    await getServiceTestDb()
                        .select()
                        .from(providerLinks)
                        .where(eq(providerLinks.subscriptionId, started.subscriptionId))
                )[0]?.lastAppliedVersion
            ).toBe('7');
        }
    });
});
