// TEST:B3:42 — cancellation observations are sent through the internal port only.
import { billingDeadlineVersions, eq, subscriptionModel, subscriptions, users } from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import type { AuthorizationSnapshot, PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
afterEach(() => unregisterHook('cancellation-seen-test'));
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
} satisfies BillingDeadlineValues;

async function setup() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `cancel-seen-${crypto.randomUUID()}@example.test`,
            displayName: 'Cancellation seen',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `cancel-seen-${crypto.randomUUID()}`, 'Plan']
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
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [
            { lie: 'M1', why: 'fixture signup' },
            { lie: 'M6', why: 'single notice delivery' }
        ]
    });
    const started = await startSubscription(
        { userId: user.id, billingOptionId: optionId, returnUrl: 'https://example.test' },
        {
            provider,
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
    await provider.approve({ authorizationId: started.authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    const charge = await provider.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'issuer_declined'
    });
    return { provider, started, chargeId: charge.chargeId };
}

function proxyProvider(
    fake: FakePaymentProvider,
    status: AuthorizationSnapshot['status'] | (() => AuthorizationSnapshot['status']),
    cancelImpl?: PaymentProvider['cancel']
): PaymentProvider {
    return new Proxy(fake, {
        get(target, property) {
            if (property === 'readAuthorization')
                return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                    const read = await fake.readAuthorization(input);
                    return {
                        ...read,
                        snapshot: {
                            ...read.snapshot,
                            status: typeof status === 'function' ? status() : status
                        }
                    };
                };
            if (property === 'cancel' && cancelImpl) return cancelImpl;
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
}

function annotator() {
    return {
        annotateCancellationSeen: vi.fn(
            async (_input: { readonly subscriptionId: string; readonly seenAt: Date }) => undefined
        )
    } satisfies CancellationSeenAnnotator;
}
async function rowStatus(id: string) {
    return (
        await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, id))
    )[0]?.status;
}
async function authDelivery(fake: FakePaymentProvider) {
    for (const delivery of fake.takeDeliveries().deliveries) {
        if ((await fake.decodeNotice(delivery)).resourceKind === 'authorization') return delivery;
    }
    throw new Error('missing authorization notice');
}

describe('TEST:B3:42 cancellation seen is annotated by the handler and S16', () => {
    it('H1 annotates a cancelled authorization read by the handler exactly once', async () => {
        const own = await setup();
        await own.provider.cancel({ authorizationId: own.started.authorizationId });
        const delivery = await authDelivery(own.provider);
        const seen = annotator();
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider: own.provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                payments: { hasCreditedPayment: async () => true },
                cancellationSeen: seen
            }
        );
        expect(result.ack).toBe('OK');
        expect(seen.annotateCancellationSeen).toHaveBeenCalledTimes(1);
        expect(seen.annotateCancellationSeen).toHaveBeenCalledWith({
            subscriptionId: own.started.subscriptionId,
            seenAt: now
        });
    });

    it.each([
        'active',
        'pending',
        'paused'
    ] as const)('H2 does not annotate handler state %s', async (status) => {
        const own = await setup();
        await own.provider.cancel({ authorizationId: own.started.authorizationId });
        const delivery = await authDelivery(own.provider);
        const seen = annotator();
        const delegates = { delegate: vi.fn(async () => undefined) };
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider: proxyProvider(own.provider, status),
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                payments: { hasCreditedPayment: async () => true },
                cancellationSeen: seen,
                delegates
            }
        );
        expect(result.ack).toBe('OK');
        expect(seen.annotateCancellationSeen).not.toHaveBeenCalled();
    });

    it('S1 annotates the prior cancelled read and does not send cancel', async () => {
        const own = await setup();
        await own.provider.cancel({ authorizationId: own.started.authorizationId });
        const provider = proxyProvider(own.provider, 'cancelled');
        const cancel = vi.spyOn(provider, 'cancel');
        const seen = annotator();
        const result = await declineFirstCharge(
            { chargeId: own.chargeId },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: seen
            }
        );
        expect(result).toMatchObject({ outcome: 'DECLINED', cancelCall: 'NOT_NEEDED' });
        expect(cancel).not.toHaveBeenCalled();
        expect(seen.annotateCancellationSeen).toHaveBeenCalledTimes(1);
        expect(await rowStatus(own.started.subscriptionId)).toBe('CHARGE_DECLINED');
    });

    it('S2 annotates the cancellation confirmation after sending cancel', async () => {
        const own = await setup();
        let cancelled = false;
        const provider = proxyProvider(
            own.provider,
            () => (cancelled ? 'cancelled' : 'active'),
            async (input) => {
                const ack = await own.provider.cancel(input);
                cancelled = true;
                return ack;
            }
        );
        const seen = annotator();
        const cancel = vi.spyOn(provider, 'cancel');
        // The underlying fake applies cancel; subsequent read therefore observes cancelled.
        const result = await declineFirstCharge(
            { chargeId: own.chargeId },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: seen
            }
        );
        expect(result).toMatchObject({ outcome: 'DECLINED', cancelCall: 'SENT' });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(seen.annotateCancellationSeen).toHaveBeenCalledTimes(1);
        expect(await rowStatus(own.started.subscriptionId)).toBe('CHARGE_DECLINED');
    });

    it('S3 leaves a live confirmation unannotated while declining the row', async () => {
        const own = await setup();
        const provider = proxyProvider(own.provider, 'active', async () => ({
            accepted: true,
            resourceId: own.started.authorizationId
        }));
        const seen = annotator();
        const result = await declineFirstCharge(
            { chargeId: own.chargeId },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: seen
            }
        );
        expect(result).toMatchObject({ outcome: 'DECLINED', cancelCall: 'SENT' });
        expect(seen.annotateCancellationSeen).not.toHaveBeenCalled();
        expect(await rowStatus(own.started.subscriptionId)).toBe('CHARGE_DECLINED');
    });

    it('S4 swallows annotation errors in S16 and handler and logs them', async () => {
        const own = await setup();
        await own.provider.cancel({ authorizationId: own.started.authorizationId });
        const seen = {
            annotateCancellationSeen: vi.fn(async () => {
                throw new Error('annotator failure');
            })
        };
        const errors: LogEntry[] = [];
        registerHook('cancellation-seen-test', (entry) => {
            if (entry.level === 'ERROR' && entry.category === 'cancellation-seen')
                errors.push(entry);
        });
        const delivery = await authDelivery(own.provider);
        const noticeResult = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider: own.provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                payments: { hasCreditedPayment: async () => true },
                cancellationSeen: seen
            }
        );
        expect(noticeResult.ack).toBe('OK');
        // Separate live fixture drives the S16 prior-read annotation path.
        const second = await setup();
        await second.provider.cancel({ authorizationId: second.started.authorizationId });
        const declineResult = await declineFirstCharge(
            { chargeId: second.chargeId },
            {
                provider: proxyProvider(second.provider, 'cancelled'),
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: seen
            }
        );
        expect(declineResult).toMatchObject({ outcome: 'DECLINED', cancelCall: 'NOT_NEEDED' });
        expect(await rowStatus(second.started.subscriptionId)).toBe('CHARGE_DECLINED');
        expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('S5 default annotator leaves processing successful without relying on B4 storage', async () => {
        const own = await setup();
        await own.provider.cancel({ authorizationId: own.started.authorizationId });
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: await authDelivery(own.provider) },
            {
                provider: own.provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                payments: { hasCreditedPayment: async () => true }
            }
        );
        expect(result.ack).toBe('OK');
    });
});
