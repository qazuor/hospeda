import {
    billingDeadlineVersions,
    eq,
    getDb,
    idempotencyKeys,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    authorizePendingSubscription,
    type BeforeCancelNotice,
    type StartSubscriptionPorts,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

afterAll(closeServiceTestPool);

const billingDeadlineVersion1Values = {
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
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
});

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';

async function seedChoice(cycle = 'quarterly') {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, $2, 250000, 'ARS') RETURNING id`,
            [planVersionId, cycle]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { user, planVersionId, billingOptionId };
}

function ports(
    provider: PaymentProvider,
    notice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' }
): StartSubscriptionPorts {
    return {
        provider,
        clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: notice,
        touristVipInheritance: noTouristVip
    };
}

describe('TEST:1730:2 and TEST:1730:3b declared payer email on S1', () => {
    it('sends and stores the declared email without changing the account email', async () => {
        const choice = await seedChoice('monthly');
        const accountEmail = choice.user.email;
        const declaredEmail = 'Different.Case+mp@example.test';
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const authorize = vi.spyOn(fake, 'authorize');
        const result = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl,
                payerEmail: declaredEmail
            },
            ports(namespaceFake(fake))
        );
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        const [account] = await getDb().select().from(users).where(eq(users.id, choice.user.id));
        expect(authorize.mock.calls[0]?.[0].payerEmail).toBe(declaredEmail);
        expect(row?.declaredPayerEmail).toBe(declaredEmail);
        expect(account?.email).toBe(accountEmail);
    });
});

describe('TEST:1730:6 pending reuse keeps the first attempt email', () => {
    it('returns the stored checkout with the same normalized email (AC:1732:4)', async () => {
        const choice = await seedChoice('monthly');
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const provider = namespaceFake(fake);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl,
                payerEmail: 'first@example.test'
            },
            ports(provider)
        );
        const authorize = vi.spyOn(fake, 'authorize');
        const retry = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl,
                payerEmail: '  FIRST@example.test '
            },
            ports(provider)
        );
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, first.subscriptionId));
        expect(retry).toEqual(first);
        expect(authorize).not.toHaveBeenCalled();
        expect(row?.declaredPayerEmail).toBe('first@example.test');
    });
});

describe('TEST:B3:44 M1 M9 RP1 creation defenses', () => {
    it('detects M1 without exposing a link, then accepts M1 disabled by name', async () => {
        const choice = await seedChoice();
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const lying = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const lyingProvider = namespaceFake(lying);
        await expect(
            authorizePendingSubscription({
                pending,
                provider: lyingProvider,
                clock,
                reason: 'Básico',
                returnUrl
            })
        ).rejects.toMatchObject({ reason: 'CREATION_NOT_APPLIED' });
        const [key] = await getDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.key, pending.idempotencyKey));
        expect(key?.result).toMatchObject({ applied: false, fields: ['cadence'] });
        expect(JSON.stringify(key?.result)).not.toContain('checkoutUrl');
        const other = await seedChoice();
        const healthy = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'M1 disabled by name' }]
        });
        const healthyProvider = namespaceFake(healthy);
        await expect(
            startSubscription(
                { userId: other.user.id, billingOptionId: other.billingOptionId, returnUrl },
                ports(healthyProvider)
            )
        ).resolves.toHaveProperty('checkoutUrl');
    });

    it('first proves M9 invented a free period, then ignores it; disabling M9 by name leaves none', async () => {
        const firstChargeAt = '2026-11-08T20:00:00.000Z';
        const choice = await seedChoice();
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: choice.user.id,
            vertical: 'accommodation',
            planVersionId: choice.planVersionId,
            billingOptionId: choice.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const lying = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'retain the sent date so M9 is isolated' }]
        });
        const lyingProvider = namespaceFake(lying);
        const result = await authorizePendingSubscription({
            pending,
            provider: lyingProvider,
            clock,
            reason: 'Básico',
            returnUrl,
            firstChargeAt
        });
        const { snapshot } = await lyingProvider.readAuthorization({
            authorizationId: result.authorizationId
        });
        expect(snapshot.freePeriodDays).toBeGreaterThan(0);
        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
        expect(row?.firstChargeAt).toBeNull();
        const other = await seedChoice();
        const otherPending = await subscriptionModel.createPendingAuthorization({
            userId: other.user.id,
            vertical: 'accommodation',
            planVersionId: other.planVersionId,
            billingOptionId: other.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const honest = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [
                { lie: 'M1', why: 'retain requested fields' },
                { lie: 'M9', why: 'M9 disabled by name' }
            ]
        });
        const honestProvider = namespaceFake(honest);
        const healthy = await authorizePendingSubscription({
            pending: otherPending,
            provider: honestProvider,
            clock,
            reason: 'Básico',
            returnUrl,
            firstChargeAt
        });
        expect(
            (await honestProvider.readAuthorization({ authorizationId: healthy.authorizationId }))
                .snapshot.freePeriodDays
        ).toBeNull();
    });

    it('never retries the same one-use payment token after a rejected second call', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'exercise RP1 without divergent fields' }]
        });
        const provider = namespaceFake(fake);
        const first = await seedChoice();
        const second = await seedChoice();
        const a = await subscriptionModel.createPendingAuthorization({
            userId: first.user.id,
            vertical: 'accommodation',
            planVersionId: first.planVersionId,
            billingOptionId: first.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const b = await subscriptionModel.createPendingAuthorization({
            userId: second.user.id,
            vertical: 'accommodation',
            planVersionId: second.planVersionId,
            billingOptionId: second.billingOptionId,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const authorize = vi.spyOn(fake, 'authorize');
        await authorizePendingSubscription({
            pending: a,
            provider,
            clock,
            reason: 'Básico',
            returnUrl,
            paymentToken: 'once-only'
        });
        await expect(
            authorizePendingSubscription({
                pending: b,
                provider,
                clock,
                reason: 'Básico',
                returnUrl,
                paymentToken: 'once-only'
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        expect(authorize).toHaveBeenCalledTimes(2);
    });
});
