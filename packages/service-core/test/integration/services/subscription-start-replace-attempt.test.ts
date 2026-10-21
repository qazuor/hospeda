import {
    billingDeadlineVersions,
    domainEvent,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service';
import { retryOurCancellation } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
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
async function ensureBillingDeadlineVersion1() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
}
beforeAll(ensureBillingDeadlineVersion1);
afterAll(closeServiceTestPool);

async function seedChoice() {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-replace-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 replacement user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-replace-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'quarterly', 250000, 'ARS') RETURNING id",
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { user, planVersionId, billingOptionId };
}
function ports(
    provider: ReturnType<typeof namespaceFake>,
    beforeCancel = vi.fn(async () => 'SENT' as const),
    injectedClock = clock
) {
    return {
        provider,
        clock: injectedClock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel },
        touristVipInheritance: noTouristVip
    };
}
async function rows(userId: string) {
    const all = await getDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
    const keys = await Promise.all(
        all.map((row) =>
            getDb().select().from(idempotencyKeys).where(eq(idempotencyKeys.subjectId, row.id))
        )
    );
    const links = await Promise.all(
        all.map((row) =>
            getDb().select().from(providerLinks).where(eq(providerLinks.subscriptionId, row.id))
        )
    );
    return { all, keys: keys.flat(), links: links.flat() };
}

describe('TEST:1732:1 TEST:1732:2 AC:1732:1 AC:1732:2 replaces the attempt and defers cancellation while notice is pending', () => {
    it('preserves the old link, records S39, and authorizes the new email once (AC:1732:1)', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const provider = namespaceFake(fake);
        const beforeCancel = vi
            .fn()
            .mockResolvedValueOnce('NOT_YET_SENT')
            .mockResolvedValueOnce('SENT');
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider, beforeCancel)
        );
        const authorize = vi.spyOn(fake, 'authorize');
        const cancel = vi.spyOn(fake, 'cancel');
        const second = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'second@example.test'
            },
            ports(provider, beforeCancel)
        );
        const persisted = await rows(choice.user.id);
        const decision = await getDb()
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, first.subscriptionId));
        expect(second.subscriptionId).not.toBe(first.subscriptionId);
        expect(persisted.all.map((row) => row.status).sort()).toEqual([
            'ABANDONED',
            'PENDING_AUTHORIZATION'
        ]);
        expect(persisted.links).toHaveLength(2);
        expect(persisted.keys).toHaveLength(2);
        expect(decision).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    reason: 'S39',
                    changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }]
                })
            ])
        );
        expect(authorize).toHaveBeenCalledOnce();
        expect(authorize.mock.calls[0]?.[0].payerEmail).toBe('second@example.test');
        expect(cancel).not.toHaveBeenCalled();
        expect(beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: first.subscriptionId,
                kind: 'ATTEMPT_REPLACED'
            })
        );
        expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
        const old = persisted.all.find((row) => row.id === first.subscriptionId);
        const oldLink = persisted.links.find(
            (link) => link.subscriptionId === first.subscriptionId
        );
        if (!old || !oldLink)
            throw new Error('Old replacement attempt is missing its retained link');
        const retry = await retryOurCancellation(
            {
                subscription: old,
                providerLink: oldLink,
                decision: { transition: 'S39', decidedAt: clock.now() },
                correlationId: crypto.randomUUID()
            },
            { provider, clock, beforeCancelNotice: { beforeCancel } }
        );
        expect(retry.outcome).toBe('CONFIRMED');
        expect(beforeCancel).toHaveBeenLastCalledWith(
            expect.objectContaining({
                subscriptionId: first.subscriptionId,
                kind: 'ATTEMPT_REPLACED'
            })
        );
        expect(cancel).toHaveBeenCalledOnce();
    });
});

describe('TEST:1732:7 AC:1732:7 simultaneous replacements serialize on the old row', () => {
    it('leaves one new live row and makes the losing signup retryable', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide applied authorizations' }]
        });
        const provider = namespaceFake(fake);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider)
        );
        const authorize = vi.spyOn(fake, 'authorize');
        const settled = await Promise.allSettled(
            ['second@example.test', 'third@example.test'].map((payerEmail) =>
                startSubscription(
                    {
                        userId: choice.user.id,
                        billingOptionId: choice.billingOptionId,
                        returnUrl: 'https://hospeda.example/account',
                        payerEmail
                    },
                    ports(provider)
                )
            )
        );
        const persisted = await rows(choice.user.id);
        expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const rejected = settled.find((result) => result.status === 'rejected');
        expect(rejected).toMatchObject({
            reason: { code: 'ALREADY_EXISTS', reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS' }
        });
        expect(persisted.all.map((row) => row.status).sort()).toEqual([
            'ABANDONED',
            'PENDING_AUTHORIZATION'
        ]);
        expect(persisted.all.find((row) => row.id === first.subscriptionId)?.status).toBe(
            'ABANDONED'
        );
        expect(authorize).toHaveBeenCalledOnce();
    });
});

describe('TEST:1732:3 AC:1732:3 provider re-read controls replacement', () => {
    it('does not replace an authorization that the provider now reports active', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const provider = namespaceFake(fake);
        const notices = vi.fn(async () => 'SENT' as const);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider, notices)
        );
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, first.subscriptionId));
        if (!link) throw new Error('Missing provider link');
        await fake.approve({ authorizationId: link.providerId.split(':').slice(1).join(':') });
        const authorize = vi.spyOn(fake, 'authorize');
        const cancel = vi.spyOn(fake, 'cancel');
        const before = await rows(choice.user.id);
        await expect(
            startSubscription(
                {
                    userId: choice.user.id,
                    billingOptionId: choice.billingOptionId,
                    returnUrl: 'https://hospeda.example/account',
                    payerEmail: 'second@example.test'
                },
                ports(provider, notices)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(await rows(choice.user.id)).toEqual(before);
        expect(authorize).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        expect(notices).not.toHaveBeenCalled();
    });

    it('replaces a provider-cancelled authorization without another cancel or notice', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide applied authorizations' }]
        });
        const provider = namespaceFake(fake);
        const notices = vi.fn(async () => 'SENT' as const);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider, notices)
        );
        await provider.cancel({ authorizationId: first.authorizationId });
        const authorize = vi.spyOn(fake, 'authorize');
        const cancel = vi.spyOn(fake, 'cancel');
        const second = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'second@example.test'
            },
            ports(provider, notices)
        );
        expect(second.subscriptionId).not.toBe(first.subscriptionId);
        expect(authorize).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
        expect(notices).not.toHaveBeenCalled();
    });
});

describe('TEST:1732:6 AC:1732:6 the authorization window precedes replacement', () => {
    it('does not replace an attempt after its window expires, even with another email', async () => {
        let now = new Date(clock.now());
        const mutableClock = { now: () => now };
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: mutableClock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const provider = namespaceFake(fake);
        const notices = vi.fn(async () => 'SENT' as const);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider, notices, mutableClock)
        );
        const before = await rows(choice.user.id);
        const deadline = before.all.find(
            (row) => row.id === first.subscriptionId
        )?.authorizationWindowEndsAt;
        if (!deadline) throw new Error('Missing authorization window');
        now = new Date(deadline.getTime() + 1);
        const authorize = vi.spyOn(fake, 'authorize');
        const cancel = vi.spyOn(fake, 'cancel');

        await expect(
            startSubscription(
                {
                    userId: choice.user.id,
                    billingOptionId: choice.billingOptionId,
                    returnUrl: 'https://hospeda.example/account',
                    payerEmail: 'second@example.test'
                },
                ports(provider, notices, mutableClock)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(await rows(choice.user.id)).toEqual(before);
        expect(authorize).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        expect(notices).not.toHaveBeenCalled();
    });
});

describe('TEST:1732:8 AC:1732:8 replaced provider authorization remains known', () => {
    it('recognizes the old authorization through its retained provider link', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide applied authorizations' }]
        });
        const provider = namespaceFake(fake);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider)
        );
        await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'second@example.test'
            },
            ports(provider)
        );
        await expect(
            handleUnknownAuthorization(
                {
                    authorizationId: first.authorizationId,
                    arrival: { kind: 'AUTHORIZATION' },
                    correlationId: crypto.randomUUID()
                },
                { provider, clock }
            )
        ).resolves.toEqual({ outcome: 'KNOWN', subscriptionId: first.subscriptionId });
    });
});
