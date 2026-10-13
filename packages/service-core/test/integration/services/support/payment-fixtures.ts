import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { billingDeadlineVersions, eq, providerLinks, subscriptions, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { vi } from 'vitest';
import type {
    CoverageNotices,
    PromoChargePolicy,
    PromoExhaustion
} from '../../../../src/services/billing/payment/payment-ports.js';
import { activateSubscription } from '../../../../src/services/billing/subscription/activate-subscription.service.js';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';
import { noTouristVip } from './tourist-vip.js';

export const billingDeadlineValues = {
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

function adjustableClock() {
    const start = new Date('2026-10-01T03:00:00.000Z').getTime();
    let offset = 0;
    return {
        now: () => new Date(start + offset),
        advance: ({ ms }: { readonly ms: number }) => {
            offset += ms;
        }
    } satisfies Clock & { advance(input: { readonly ms: number }): void };
}

export async function paymentFixture({
    honestM8 = true,
    withoutRP12 = true,
    inheritsTouristVip = false,
    simulate
}: {
    readonly honestM8?: boolean;
    readonly withoutRP12?: boolean;
    /** Whether the seeded plan version inherits Tourist VIP (AC:B7:30); `false` by default. */
    readonly inheritsTouristVip?: boolean;
    readonly simulate?: readonly {
        readonly simulation: 'noticesOutOfOrder';
        readonly why: string;
    }[];
} = {}) {
    const clock = adjustableClock();
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `payment-${crypto.randomUUID()}@example.test`,
            displayName: 'Payment test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('payment fixture user missing');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `payment-${crypto.randomUUID()}`, 'Payment plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('payment fixture plan missing');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, $3) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000), inheritsTouristVip]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('payment fixture version missing');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('payment fixture option missing');

    const idNamespace = crypto.randomUUID();
    const provider = honestM8
        ? withoutRP12
            ? new FakePaymentProvider({
                  clock,
                  idNamespace,
                  honestAbout: [
                      { lie: 'M1', why: 'signup fixture needs the authorization creation to land' },
                      { lie: 'M8', why: 'the immediate charge case needs an approved charge' }
                  ],
                  withoutBehaviour: [
                      { behaviour: 'RP12', why: 'fixture covers subscription billing' }
                  ],
                  simulate
              })
            : new FakePaymentProvider({
                  clock,
                  idNamespace,
                  honestAbout: [
                      { lie: 'M1', why: 'signup fixture needs the authorization creation to land' },
                      { lie: 'M8', why: 'the immediate charge case needs an approved charge' }
                  ],
                  simulate
              })
        : withoutRP12
          ? new FakePaymentProvider({
                clock,
                idNamespace,
                honestAbout: [
                    { lie: 'M1', why: 'signup fixture needs the authorization creation to land' }
                ],
                withoutBehaviour: [
                    { behaviour: 'RP12', why: 'fixture covers subscription billing' }
                ],
                simulate
            })
          : new FakePaymentProvider({
                clock,
                idNamespace,
                honestAbout: [
                    { lie: 'M1', why: 'signup fixture needs the authorization creation to land' }
                ],
                simulate
            });
    const started = await startSubscription(
        { userId: user.id, billingOptionId: optionId, returnUrl: 'https://example.test/return' },
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
    await activateSubscription(started.subscriptionId, {
        provider,
        clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
        touristVipInheritance: noTouristVip
    });
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, started.subscriptionId));
    if (!link) throw new Error('payment fixture provider link missing');

    const coverageEvents: CoverageChangedEvent[] = [];
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            coverageEvents.push(event);
        })
    };
    const promoChargeCalls: unknown[] = [];
    const promoCharges: PromoChargePolicy = {
        chargedWithDiscount: vi.fn(async (input) => {
            promoChargeCalls.push(input);
            return true;
        })
    };
    const exhausted: unknown[] = [];
    const promoExhaustion: PromoExhaustion = {
        runS30: vi.fn(async (input) => {
            exhausted.push(input);
        })
    };
    return {
        clock,
        provider,
        started,
        user,
        link,
        coverageEvents,
        coverageNotices,
        promoChargeCalls,
        promoCharges,
        exhausted,
        promoExhaustion
    };
}

export async function setNextChargeAt(subscriptionId: string, nextChargeAt: Date) {
    await getServiceTestDb()
        .update(subscriptions)
        .set({ nextChargeAt })
        .where(eq(subscriptions.id, subscriptionId));
}
