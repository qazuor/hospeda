import {
    billingDeadlineVersions,
    eq,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import type { MirrorDelegates } from '../../../../src/services/billing/notice/provider-notice-ports';
import { getServiceTestDb, getServiceTestPool } from '../helpers';
import { noTouristVip } from './tourist-vip';

export const successionClock = { now: () => new Date('2026-10-11T13:00:00.000Z') };
export const successionReturnUrl = 'https://hospeda.example/account';

const deadlineValues = {
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

export async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlineValues })
        .onConflictDoNothing();
}

export async function seedSuccessionChoice(options: { readonly sellable?: boolean } = {}) {
    await ensureBillingDeadlineVersion1();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `succession-${crypto.randomUUID()}@example.test`,
            displayName: 'Succession test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Could not seed succession user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `succession-${crypto.randomUUID()}`, 'Succession plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('Could not seed succession plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, $4, true, 0, false) RETURNING id',
            [
                planId,
                'accommodation',
                Math.floor(Math.random() * 100000000) + 1,
                options.sellable ?? true
            ]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('Could not seed succession plan version');
    const billingOptionIds = await Promise.all(
        ['monthly', 'quarterly'].map(async (cycle) => {
            const id = (
                await getServiceTestPool().query<{ id: string }>(
                    'INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, $2, 250000, $3) RETURNING id',
                    [planVersionId, cycle, 'ARS']
                )
            ).rows[0]?.id;
            if (!id) throw new Error('Could not seed succession billing option');
            return id;
        })
    );
    return {
        user,
        planId,
        planVersionId,
        predecessorBillingOptionId: billingOptionIds[0]!,
        targetBillingOptionId: billingOptionIds[1]!
    };
}

export function successionPorts(provider: PaymentProvider, mirror?: MirrorDelegates) {
    return {
        provider,
        clock: successionClock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip,
        mirror
    };
}

export async function seedPredecessor(input: {
    readonly userId: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly status: string;
    readonly paymentMethod?: 'CARD' | 'MANUAL';
    readonly providerState?: 'active' | 'paused' | 'cancelled';
    readonly honestAboutM1?: boolean;
}) {
    let fake: FakePaymentProvider;
    if (input.honestAboutM1) {
        fake = new FakePaymentProvider({
            clock: successionClock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [{ lie: 'M1', why: 'create a healthy predecessor for succession' }]
        });
    } else {
        fake = new FakePaymentProvider({
            clock: successionClock,
            idNamespace: crypto.randomUUID()
        });
    }
    const provider: PaymentProvider = fake;
    const { startSubscription } = await import(
        '../../../../src/services/billing/subscription/start-subscription.service'
    );
    const started = await startSubscription(
        {
            userId: input.userId,
            billingOptionId: input.billingOptionId,
            returnUrl: successionReturnUrl
        },
        successionPorts(provider)
    );
    await fake.approve({ authorizationId: started.authorizationId });
    if (input.providerState === 'paused')
        await fake.pause({ authorizationId: started.authorizationId });
    if (input.providerState === 'cancelled')
        await fake.cancel({ authorizationId: started.authorizationId });
    const activated = await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: successionClock.now()
    });
    if (!activated) throw new Error('Could not activate seeded predecessor');
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: input.status, paymentMethod: input.paymentMethod ?? 'CARD' })
        .where(eq(subscriptions.id, started.subscriptionId));
    const [predecessor] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    const [providerLink] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, started.subscriptionId));
    if (!predecessor || !providerLink)
        throw new Error('Seeded predecessor is missing its provider link');
    return { fake, provider, started, predecessor };
}
