import { billingDeadlineVersions, users } from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
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
} as const satisfies BillingDeadlineValues;

afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);

describe('TEST:1737:8 provider notice failure cause', () => {
    it('returns ERROR and captures the provider read error', async () => {
        await getServiceTestDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values })
            .onConflictDoNothing();
        const user = (
            await getServiceTestDb()
                .insert(users)
                .values({
                    email: `notice-failure-${crypto.randomUUID()}@example.test`,
                    displayName: 'Notice',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                })
                .returning()
        )[0];
        if (!user) throw new Error('missing user');
        const planId = (
            await getServiceTestPool().query<{ id: string }>(
                'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                ['accommodation', `notice-failure-${crypto.randomUUID()}`, 'Plan']
            )
        ).rows[0]?.id;
        if (!planId) throw new Error('missing plan');
        const planVersionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
                [planId, Math.floor(Math.random() * 1_000_000_000)]
            )
        ).rows[0]?.id;
        if (!planVersionId) throw new Error('missing version');
        const billingOptionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
                [planVersionId]
            )
        ).rows[0]?.id;
        if (!billingOptionId) throw new Error('missing option');
        const fake = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [{ lie: 'M1', why: 'seeded signup' }]
        });
        const started = await startSubscription(
            { userId: user.id, billingOptionId, returnUrl: 'https://example.test' },
            {
                provider: fake,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            }
        );
        const failure = new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'read',
            message: 'Mercado Pago request failed (429)'
        });
        const provider = new Proxy(fake as unknown as PaymentProvider, {
            get(target, key, receiver) {
                if (key === 'readAuthorization')
                    return async () => {
                        throw failure;
                    };
                const value = Reflect.get(target, key, receiver) as unknown;
                return typeof value === 'function' ? value.bind(fake) : value;
            }
        });
        const captured: { error: unknown; extra: Record<string, unknown> }[] = [];
        registerCaptureHook((error, extra) => captured.push({ error, extra }));
        const encoded = encodeFakeNotice({
            notice: {
                resourceKind: 'authorization',
                resourceId: started.authorizationId,
                version: '1'
            },
            format: 'json'
        });
        const result = await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': encoded.contentType }, body: encoded.body }
            },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' }
            }
        );
        expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
        expect(captured).toHaveLength(1);
        const firstCapture = captured[0];
        if (!firstCapture) throw new Error('Expected provider failure to be captured');
        expect(firstCapture.error).toBe(failure);
        expect(firstCapture.extra.label).toContain('WEBHOOKS');
    });
});
