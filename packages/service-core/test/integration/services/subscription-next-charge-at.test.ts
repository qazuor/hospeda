/**
 * HOS-2223: card subscriptions were activated with `next_charge_at` NULL, so every
 * downgrade answered CYCLE_END_PENDING until the nightly sweep copied the date.
 *
 * Two writers now fill it the same day (owner decision, option 1):
 * - S2 copies the date of the provider re-read that authorized the activation;
 * - P1 advances it to `chargeCreatedAt + cycle months` when a card charge is credited,
 *   and only forward, because right after authorizing the provider still reports the
 *   first-charge instant (PA-3).
 */
import {
    addonInstances,
    billingDeadlineVersions,
    eq,
    payments,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { billingDeadlineValues } from './support/payment-fixtures';
import { nextPlanVersionRank } from './support/plan-version-rank';
import { noTouristVip } from './support/tourist-vip';

afterEach(retirePurchaseFixtures);
afterAll(closeServiceTestPool);

const clock = { now: () => new Date('2026-10-01T03:00:00.000Z') };
const providerNextCharge = new Date('2026-10-17T03:00:00.000Z');

async function nextChargeAtOf(subscriptionId: string): Promise<Date | null | undefined> {
    const [row] = await getServiceTestDb()
        .select({ nextChargeAt: subscriptions.nextChargeAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.nextChargeAt;
}

async function setNextChargeAt(subscriptionId: string, nextChargeAt: Date | null): Promise<void> {
    await getServiceTestDb()
        .update(subscriptions)
        .set({ nextChargeAt })
        .where(eq(subscriptions.id, subscriptionId));
}

/** A real pending card principal on a monthly option, approved on the fake provider. */
async function approvedPendingPrincipal() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos-2223-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-2223',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('user missing');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos-2223-${crypto.randomUUID()}`, 'HOS-2223']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('plan missing');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, nextPlanVersionRank()]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('version missing');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('option missing');
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'HOS-2223 needs the authorization creation to land' }],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'HOS-2223 covers subscription billing' }]
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
    return { provider, started };
}

async function creditCardCharge(input: {
    readonly subscriptionId: string;
    readonly chargeCreatedAt: Date;
}): Promise<void> {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'MERCADO_PAGO',
            providerFactId: crypto.randomUUID(),
            factAt: input.chargeCreatedAt
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('payment missing');
    await creditPayment(
        { paymentId: payment.id, chargeCreatedAt: input.chargeCreatedAt },
        { clock }
    );
}

describe('HOS-2223 S2 copies the provider next charge date on activation', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'writes the re-read next_payment_date on a principal',
        async () => {
            // Arrange
            const { provider, started } = await approvedPendingPrincipal();
            provider.moveNextCharge({
                authorizationId: started.authorizationId,
                at: providerNextCharge
            });

            // Act
            const result = await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            });

            // Assert
            expect(result.activated).toBe(true);
            expect(await nextChargeAtOf(started.subscriptionId)).toEqual(providerNextCharge);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'writes the re-read next_payment_date on a complement activated by notice',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO', cycle: 'annual' });
            await payingPrincipal(f);
            const bought = await purchaseAddon(f.input(), f.ports);
            if (bought.outcome !== 'CREATED') throw new Error('purchase missing');
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            const complementId = instance?.complementSubscriptionId;
            if (!complementId) throw new Error('complement missing');
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, complementId));
            if (!link) throw new Error('link missing');
            await f.fake.approve({ authorizationId: link.providerId });
            const complementNextCharge = new Date('2027-01-15T03:00:00.000Z');
            f.fake.moveNextCharge({ authorizationId: link.providerId, at: complementNextCharge });
            const notice = encodeFakeNotice({
                notice: {
                    resourceKind: 'authorization',
                    resourceId: link.providerId,
                    version: '1'
                },
                format: 'json'
            });

            // Act
            const answer = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
                },
                {
                    provider: f.fake,
                    clock: f.ports.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    complements: f.ports
                }
            );

            // Assert
            expect(answer).toMatchObject({ ack: 'OK', outcome: 'APPLIED' });
            expect(await nextChargeAtOf(complementId)).toEqual(complementNextCharge);
        }
    );
});

describe('HOS-2223 P1 advances next_charge_at when a card charge is credited', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'writes chargeCreatedAt plus the option cycle on a principal with no date',
        async () => {
            // Arrange
            const { provider, started } = await approvedPendingPrincipal();
            await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            });
            await setNextChargeAt(started.subscriptionId, null);

            // Act
            await creditCardCharge({
                subscriptionId: started.subscriptionId,
                chargeCreatedAt: new Date('2026-10-31T10:00:00.000Z')
            });

            // Assert: monthly, day clamped to the end of November.
            expect(await nextChargeAtOf(started.subscriptionId)).toEqual(
                new Date('2026-11-30T10:00:00.000Z')
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'replaces the first-charge instant the provider reported at activation (PA-3)',
        async () => {
            // Arrange: S2 copied the first-charge instant, as production reports it.
            const { provider, started } = await approvedPendingPrincipal();
            await activateSubscription(started.subscriptionId, {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            });
            expect(await nextChargeAtOf(started.subscriptionId)).toEqual(clock.now());

            // Act
            await creditCardCharge({
                subscriptionId: started.subscriptionId,
                chargeCreatedAt: new Date('2026-10-01T03:26:00.000Z')
            });

            // Assert
            expect(await nextChargeAtOf(started.subscriptionId)).toEqual(
                new Date('2026-11-01T03:26:00.000Z')
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('never moves the date backwards', async () => {
        // Arrange
        const { provider, started } = await approvedPendingPrincipal();
        await activateSubscription(started.subscriptionId, {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        });
        const later = new Date('2027-01-01T00:00:00.000Z');
        await setNextChargeAt(started.subscriptionId, later);

        // Act
        await creditCardCharge({
            subscriptionId: started.subscriptionId,
            chargeCreatedAt: new Date('2026-10-01T03:26:00.000Z')
        });

        // Assert
        expect(await nextChargeAtOf(started.subscriptionId)).toEqual(later);
    });

    it.skipIf(!isServiceTestDbAvailable())(
        'uses the addon product cycle on a complement',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO', cycle: 'annual' });
            await payingPrincipal(f);
            const bought = await purchaseAddon(f.input(), f.ports);
            if (bought.outcome !== 'CREATED') throw new Error('purchase missing');
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            const complementId = instance?.complementSubscriptionId;
            if (!complementId) throw new Error('complement missing');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE', nextChargeAt: null })
                .where(eq(subscriptions.id, complementId));

            // Act
            await creditCardCharge({
                subscriptionId: complementId,
                chargeCreatedAt: new Date('2026-10-01T03:26:00.000Z')
            });

            // Assert
            expect(await nextChargeAtOf(complementId)).toEqual(
                new Date('2027-10-01T03:26:00.000Z')
            );
        }
    );
});

describe('HOS-2223 the sweep never restores a stale provider date over P1', () => {
    async function chargedPrincipal(): Promise<string> {
        const { provider, started } = await approvedPendingPrincipal();
        await activateSubscription(started.subscriptionId, {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        });
        await creditCardCharge({
            subscriptionId: started.subscriptionId,
            chargeCreatedAt: new Date('2026-10-01T03:26:00.000Z')
        });
        return started.subscriptionId;
    }

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps the P1 date when the provider still reports the elapsed first-charge instant',
        async () => {
            // Arrange: P1 moved the date to 2026-11-01T03:26Z.
            const subscriptionId = await chargedPrincipal();

            // Act: a later sweep read still carries the PA-3 instant, already elapsed.
            const wrote = await subscriptionModel.syncNextChargeAt({
                subscriptionId,
                nextChargeAt: clock.now(),
                now: new Date('2026-10-02T02:10:00.000Z')
            });

            // Assert
            expect(wrote).toBe(false);
            expect(await nextChargeAtOf(subscriptionId)).toEqual(
                new Date('2026-11-01T03:26:00.000Z')
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'still takes an earlier provider date that is in the future',
        async () => {
            // Arrange
            const subscriptionId = await chargedPrincipal();
            const providerDate = new Date('2026-11-01T03:00:00.000Z');

            // Act: MP's own anchor is minutes earlier than the local derivation.
            const wrote = await subscriptionModel.syncNextChargeAt({
                subscriptionId,
                nextChargeAt: providerDate,
                now: new Date('2026-10-02T02:10:00.000Z')
            });

            // Assert
            expect(wrote).toBe(true);
            expect(await nextChargeAtOf(subscriptionId)).toEqual(providerDate);
        }
    );
});
