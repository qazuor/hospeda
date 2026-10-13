/**
 * TEST:B4:2 (AC:B4:2, AC:B4:3), composition half: the coverage notice billing
 * emits after the commit of the first credited payment (P1) reaches a listener
 * registered through the production composition root
 * (`getListingAccessPorts().billing.onCoverageChanged`), and that listener,
 * re-reading the REAL `coverage()`, already sees `charged: true`. The trial
 * machine emits into the SAME registry: one registry for the whole process.
 *
 * No `vi.mock` of `listing-access/ports`: the composition is what is tested.
 * Cleans only its own rows in `afterEach`; never TRUNCATE.
 */
import type { CoverageChangedEvent, CoverageSource } from '@repo/billing-verticals-contract';
import {
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    payments,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { creditPayment } from '@repo/service-core';
import { sql } from 'drizzle-orm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildMercadoPagoNoticePorts } from '../../../src/routes/webhooks/mercadopago-ports';
import { getClock, injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { defaultPaymentProvider, injectPaymentProvider } from '../../../src/utils/payment-provider';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';

const now = new Date('2026-10-12T12:00:00.000Z');

/** The rows one case created, deleted in `afterEach` (children first). */
interface Created {
    userId?: string;
    billingOptionId?: string;
}

const created: Created[] = [];
const unsubscribes: (() => void)[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    // `buildMercadoPagoNoticePorts()` reads the provider; P1 never calls it.
    injectPaymentProvider({ provider: defaultPaymentProvider({ clock: getClock().clock }) });
});

afterEach(async () => {
    for (const stop of unsubscribes.splice(0)) stop();
    const db = getDb();
    for (const rows of created.splice(0)) {
        if (rows.userId) {
            const subscriptionIds = sql`(SELECT id FROM subscription WHERE user_id = ${rows.userId})`;
            await db.execute(
                sql`DELETE FROM covered_period WHERE subscription_id IN ${subscriptionIds}`
            );
            await db.execute(
                sql`DELETE FROM receipt WHERE payment_id IN (SELECT id FROM payment WHERE subscription_id IN ${subscriptionIds})`
            );
            await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, rows.userId));
            await db.execute(sql`DELETE FROM payment WHERE subscription_id IN ${subscriptionIds}`);
            await db.delete(subscriptions).where(eq(subscriptions.userId, rows.userId));
        }
        if (rows.billingOptionId) {
            await db.delete(billingOptions).where(eq(billingOptions.id, rows.billingOptionId));
        }
        if (rows.userId) await db.delete(users).where(eq(users.id, rows.userId));
    }
});

/**
 * A fresh owner with an `ACTIVE` PRINCIPAL subscription in accommodation (over
 * its own plan version, neither current nor sellable) and one `PENDING`
 * provider payment of it.
 */
async function seedActiveWithPendingPayment(): Promise<{
    readonly userId: string;
    readonly paymentId: string;
}> {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b4-notice-wiring-${crypto.randomUUID()}@example.test`,
            displayName: 'B4 notice wiring',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    const rows: Created = { userId: user.id };
    created.push(rows);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b4-notice-wiring-${crypto.randomUUID()}`,
            name: 'B4 notice wiring'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    rows.billingOptionId = option.id;
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: subscription.id,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'fake',
            providerFactId: `b4-notice-wiring-${crypto.randomUUID()}`,
            factAt: new Date('2026-10-12T11:00:00.000Z')
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Expected payment');
    return { userId: user.id, paymentId: payment.id };
}

/** The `charged` bit of the SUBSCRIPTION sources the REAL coverage answers. */
async function chargedBits(userId: string): Promise<(boolean | null)[]> {
    const response = await getListingAccessPorts().billing.coverage({
        userId,
        vertical: VerticalEnum.ACCOMMODATION
    });
    return response.sources
        .filter((source: CoverageSource) => source.type === 'SUBSCRIPTION')
        .map((source: CoverageSource) => source.charged);
}

describe('TEST:B4:2 — the first credited payment notice reaches the composition root listener (AC:B4:2, AC:B4:3)', () => {
    it('delivers exactly one SUBSCRIPTION CHANGED after commit, and the listener re-reads charged: true', async () => {
        // Arrange
        const { userId, paymentId } = await seedActiveWithPendingPayment();
        const received: { event: CoverageChangedEvent; charged: (boolean | null)[] }[] = [];
        unsubscribes.push(
            getListingAccessPorts().billing.onCoverageChanged(async (event) => {
                if (event.userId !== userId) return;
                received.push({ event, charged: await chargedBits(userId) });
            })
        );
        const before = await chargedBits(userId);

        // Act
        const result = await creditPayment(
            { paymentId, chargeCreatedAt: new Date('2026-10-12T11:00:00.000Z') },
            {
                clock: getClock().clock,
                coverageNotices: buildMercadoPagoNoticePorts().coverageNotices
            }
        );

        // Assert
        expect(before).toEqual([false]);
        expect(result.outcome).toBe('CREDITED');
        expect(received).toEqual([
            {
                event: {
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                charged: [true]
            }
        ]);
        const outbox = await getDb()
            .select({ template: emailOutbox.template })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, userId));
        expect(outbox).toEqual([{ template: 'billing.payment-credited' }]);
    });

    it('delivers what the trial machine emits to the SAME listener (one registry)', async () => {
        // Arrange
        const userId = crypto.randomUUID();
        const received: CoverageChangedEvent[] = [];
        unsubscribes.push(
            getListingAccessPorts().billing.onCoverageChanged((event) => {
                if (event.userId === userId) received.push(event);
            })
        );
        const event: CoverageChangedEvent = {
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'TRIAL',
            change: 'REMOVED'
        };

        // Act
        await getTrialMachinePorts().afterCommit.emitCoverageChanged(event);

        // Assert
        expect(received).toEqual([event]);
    });
});
