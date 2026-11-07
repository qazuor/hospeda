import { billingDeadlineVersions, plans, planVersions, users } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { type BillingDeadlineValues, PermissionEnum } from '@repo/schemas';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { namespaceFake } from './payment-provider.js';
import { noTouristVip } from './tourist-vip.js';

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

/** Seed the billing deadline baseline required by the real subscription transition. */
export async function seedCyclePriceDeadlines(): Promise<void> {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
}

/** A fresh catalog version with no customers or billing options. */
export async function seedCyclePriceVersion(graceDays = 10) {
    const db = getServiceTestDb();
    const [admin] = await db
        .insert(users)
        .values({
            email: `cycle-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Cycle price admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `cycle-${crypto.randomUUID()}`,
            name: 'Básico'
        })
        .returning();
    if (!admin || !plan) throw new Error('Cycle price fixture insert failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 1_000_000_000) + 1000,
            sellable: true,
            current: true,
            graceDays,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Cycle price version insert failed');
    return {
        actor: { id: admin.id, roles: [], permissions: [PermissionEnum.BILLING_SET_CYCLE_PRICE] },
        planVersionId: version.id
    };
}

/** Open a real pending subscription against an option produced by action 19. */
export async function startCyclePriceCustomer(billingOptionId: string): Promise<{
    subscriptionId: string;
    provider: PaymentProvider;
    fake: FakePaymentProvider;
    authorizationId: string;
}> {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `cycle-juan-${crypto.randomUUID()}@example.test`,
            displayName: 'Juan',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Cycle price customer insert failed');
    const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy subscription fixture' }]
    });
    const provider = namespaceFake(fake);
    const started = await startSubscription(
        { userId: user.id, billingOptionId, returnUrl: 'https://hospeda.example/account' },
        {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        }
    );
    return {
        subscriptionId: started.subscriptionId,
        provider,
        fake,
        authorizationId: started.authorizationId
    };
}
