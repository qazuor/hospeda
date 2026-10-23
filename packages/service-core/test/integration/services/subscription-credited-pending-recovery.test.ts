import * as db from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    activateCreditedPendingAuthorizations,
    expireAuthorizationWindows
} from '../../../src/services/billing/subscription/expire-authorization-windows.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
afterEach(() => {
    vi.restoreAllMocks();
    unregisterCaptureHook();
});

const now = new Date('2026-10-09T02:00:00.000Z');
const clock = { now: () => now };
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
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

beforeAll(async () => {
    await getServiceTestDb()
        .insert(db.billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
});

function newProvider(): FakePaymentProvider {
    return new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'HOS-1740 fixture' }]
    });
}

async function startPending(provider: PaymentProvider) {
    const database = getServiceTestDb();
    const [user] = await database
        .insert(db.users)
        .values({
            email: `hos1740-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1740',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Expected test user');
    const [plan] = await database
        .insert(db.plans)
        .values({
            vertical: 'accommodation',
            slug: `hos1740-${crypto.randomUUID()}`,
            name: 'Plan HOS-1740'
        })
        .returning();
    if (!plan) throw new Error('Expected plan');
    const [version] = await database
        .insert(db.planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 1e8) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Expected plan version');
    const [option] = await database
        .insert(db.billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Expected billing option');
    const started = await startSubscription(
        {
            userId: user.id,
            billingOptionId: option.id,
            returnUrl: 'https://hospeda.example/account'
        },
        {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice,
            touristVipInheritance: noTouristVip
        }
    );
    return { started, userId: user.id };
}

async function addSucceededPayment(subscriptionId: string) {
    await getServiceTestDb().insert(db.payments).values({
        subscriptionId,
        amount: 250000,
        currency: 'ARS',
        status: 'SUCCEEDED',
        provider: 'fake',
        providerFactId: crypto.randomUUID(),
        factAt: now
    });
}

async function onlyCredited(ids: string[]) {
    const original = db.findCreditedPendingAuthorizations;
    return vi
        .spyOn(db, 'findCreditedPendingAuthorizations')
        .mockImplementation(async (input) =>
            (await original(input)).filter((row) => ids.includes(row.subscription.id))
        );
}

async function expectConfirmed(subscriptionId: string) {
    const result = await getServiceTestDb()
        .select()
        .from(db.emailOutbox)
        .where(db.eq(db.emailOutbox.template, 'billing.signup-confirmed'));
    const matches = result.filter((row) => row.payload.subscriptionId === subscriptionId);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.payload).toMatchObject({
        subscriptionId,
        vertical: 'accommodation',
        planName: 'Plan HOS-1740',
        firstChargeDate: '2026-10-08'
    });
}

const ports = (provider: PaymentProvider, coverageNotices = { emitCoverageChanged: vi.fn() }) => ({
    provider,
    clock,
    beforeCancelNotice,
    touristVipInheritance: noTouristVip,
    coverageNotices
});

describe('HOS-1740 credited pending recovery', () => {
    it('TEST:1740:2 activates the paid pending signup through the existing path exactly once', async () => {
        const provider = newProvider();
        const { started, userId } = await startPending(provider);
        await addSucceededPayment(started.subscriptionId);
        await provider.approve({ authorizationId: started.authorizationId });
        await onlyCredited([started.subscriptionId]);
        const coverage = { emitCoverageChanged: vi.fn() };
        const first = await activateCreditedPendingAuthorizations(100, ports(provider, coverage));
        const second = await activateCreditedPendingAuthorizations(100, ports(provider, coverage));
        const [row] = await getServiceTestDb()
            .select()
            .from(db.subscriptions)
            .where(db.eq(db.subscriptions.id, started.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(first.activated).toBe(1);
        expect(second.activated).toBe(0);
        expect(coverage.emitCoverageChanged).toHaveBeenCalledWith(
            expect.objectContaining({
                userId,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'ADDED'
            })
        );
        await expectConfirmed(started.subscriptionId);
    });

    it('TEST:1740:3 does not read the provider without a SUCCEEDED payment', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await provider.approve({ authorizationId: started.authorizationId });
        const read = vi.spyOn(provider, 'readAuthorization');
        await onlyCredited([started.subscriptionId]);
        const result = await activateCreditedPendingAuthorizations(100, ports(provider));
        expect(result.candidates).toBe(0);
        expect(read).not.toHaveBeenCalledWith({ authorizationId: started.authorizationId });
        const [row] = await getServiceTestDb()
            .select()
            .from(db.subscriptions)
            .where(db.eq(db.subscriptions.id, started.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('TEST:1740:4 leaves a paid pending signup alone while provider is not active', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await addSucceededPayment(started.subscriptionId);
        const cancel = vi.spyOn(provider, 'cancel');
        await onlyCredited([started.subscriptionId]);
        const result = await activateCreditedPendingAuthorizations(100, ports(provider));
        const [row] = await getServiceTestDb()
            .select()
            .from(db.subscriptions)
            .where(db.eq(db.subscriptions.id, started.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
        expect(result.notActive).toBe(1);
        expect(cancel).not.toHaveBeenCalled();
        expect(
            (await getServiceTestDb().select().from(db.emailOutbox)).filter(
                (item) => item.payload.subscriptionId === started.subscriptionId
            )
        ).toHaveLength(0);
    });

    it('TEST:1740:5 captures one provider read failure and continues to the next paid row', async () => {
        const provider = newProvider();
        const first = await startPending(provider);
        const second = await startPending(provider);
        await Promise.all([
            addSucceededPayment(first.started.subscriptionId),
            addSucceededPayment(second.started.subscriptionId)
        ]);
        await provider.approve({ authorizationId: second.started.authorizationId });
        await onlyCredited([first.started.subscriptionId, second.started.subscriptionId]);
        const failure = new Error('first provider read failed');
        const originalRead = provider.readAuthorization.bind(provider);
        const read = vi.spyOn(provider, 'readAuthorization');
        read.mockImplementation(async (input) => {
            if (input.authorizationId === first.started.authorizationId) throw failure;
            return originalRead(input);
        });
        const captured: unknown[] = [];
        registerCaptureHook((error) => captured.push(error));
        const result = await activateCreditedPendingAuthorizations(100, ports(provider));
        const [row] = await getServiceTestDb()
            .select()
            .from(db.subscriptions)
            .where(db.eq(db.subscriptions.id, second.started.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(result).toMatchObject({ failed: 1, activated: 1 });
        expect(captured).toHaveLength(1);
        expect(captured[0]).toBe(failure);
    });

    it('TEST:1740:6 captures one expiry read failure and continues processing the next row', async () => {
        const provider = newProvider();
        const first = await startPending(provider);
        const second = await startPending(provider);
        await getServiceTestDb()
            .update(db.subscriptions)
            .set({ authorizationWindowEndsAt: new Date(now.getTime() - 1) })
            .where(db.eq(db.subscriptions.id, first.started.subscriptionId));
        await getServiceTestDb()
            .update(db.subscriptions)
            .set({ authorizationWindowEndsAt: new Date(now.getTime() - 1) })
            .where(db.eq(db.subscriptions.id, second.started.subscriptionId));
        await onlyCredited([]);
        const original = db.subscriptionModel.findExpiredAuthorizationWindows;
        vi.spyOn(db.subscriptionModel, 'findExpiredAuthorizationWindows').mockImplementation(
            async (input) =>
                (await original(input)).filter((row) =>
                    [first.started.subscriptionId, second.started.subscriptionId].includes(
                        row.subscription.id
                    )
                )
        );
        const failure = new Error('first expiry read failed');
        const originalRead = provider.readAuthorization.bind(provider);
        const read = vi.spyOn(provider, 'readAuthorization');
        read.mockImplementation(async (input) => {
            if (input.authorizationId === first.started.authorizationId) throw failure;
            return originalRead(input);
        });
        const captured: unknown[] = [];
        registerCaptureHook((error) => captured.push(error));
        const result = await expireAuthorizationWindows(100, ports(provider));
        const [row] = await getServiceTestDb()
            .select()
            .from(db.subscriptions)
            .where(db.eq(db.subscriptions.id, second.started.subscriptionId));
        expect(row?.status).toBe('ABANDONED');
        expect(result).toMatchObject({ failed: 1, abandoned: 1 });
        expect(captured).toHaveLength(1);
        expect(captured[0]).toBe(failure);
    });
});
