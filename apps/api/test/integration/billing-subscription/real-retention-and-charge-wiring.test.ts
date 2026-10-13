/**
 * AC:B4:4, AC:B4:5 and US:B4:3 (HOS-1534), composition half: through the
 * production composition root (`getListingAccessPorts().billing`), the PB5
 * archiving and the reconciler read billing's REAL `retentionStopped`, and
 * action 24 reads its REAL `canCharge`. Before HOS-1534 both were the bootstrap
 * answers (`stopped: false` with no instants, `canCharge: false` for everyone),
 * so this file fails if `ports.ts` goes back to them.
 *
 * Cleans only its own rows in `afterEach` (children first); never TRUNCATE.
 */
import {
    billingOptions,
    coverageLosses,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { testDb } from '../../e2e/setup/test-database';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const LOST_AT = new Date('2026-09-30T08:15:00.000Z');

const createdUsers: string[] = [];
const createdSubscriptions: string[] = [];
const createdBillingOptions: string[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => NOW } });
});

afterEach(async () => {
    const db = getDb();
    const subscriptionIds = createdSubscriptions.splice(0);
    if (subscriptionIds.length > 0) {
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, subscriptionIds));
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    }
    for (const id of createdBillingOptions.splice(0))
        await db.delete(billingOptions).where(eq(billingOptions.id, id));
    for (const id of createdUsers.splice(0)) {
        await db.delete(coverageLosses).where(eq(coverageLosses.userId, id));
        await db.delete(users).where(eq(users.id, id));
    }
});

/** A fresh account, registered for cleanup. */
async function seedUser(): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b43-retention-${crypto.randomUUID()}@example.test`,
            displayName: 'B4.3 retention and charge',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    createdUsers.push(user.id);
    return user.id;
}

/** One accommodation PRINCIPAL subscription in `status`, over a non-sellable, non-current version. */
async function seedSubscription(input: {
    readonly userId: string;
    readonly status: string;
}): Promise<string> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b43-retention-${crypto.randomUUID()}`,
            name: 'B4.3 retention and charge'
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
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    createdBillingOptions.push(option.id);
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: input.status,
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    createdSubscriptions.push(row.id);
    return row.id;
}

describe('AC:B4:4 the composition root answers retentionStopped from billing (HOS-1534)', () => {
    it('answers stopped with an open CUSTOMER_REQUEST pause on a PAUSED subscription', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedSubscription({ userId, status: 'PAUSED' });
        await getDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt: new Date('2026-10-01T00:00:00.000Z'),
                expectedEndAt: new Date('2026-12-01T00:00:00.000Z')
            });

        // Act
        const response = await getListingAccessPorts().billing.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(response).toEqual({ stopped: true, pauseEndedAt: null, coverageLostAt: null });
    });

    it('answers coverageLostAt from the recorded coverage loss', async () => {
        // Arrange
        const userId = await seedUser();
        await getDb()
            .insert(coverageLosses)
            .values({ userId, vertical: VerticalEnum.ACCOMMODATION, lostAt: LOST_AT });

        // Act
        const response = await getListingAccessPorts().billing.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(response).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: LOST_AT });
    });
});

describe('AC:B4:5 US:B4:3 the composition root answers canCharge from billing (HOS-1534)', () => {
    it('answers no for an account without subscriptions', async () => {
        // Arrange
        const userId = await seedUser();

        // Act
        const response = await getListingAccessPorts().billing.canCharge({ userId });

        // Assert
        expect(response).toEqual({ canCharge: false });
    });

    it('answers yes for an account with an ACTIVE subscription', async () => {
        // Arrange
        const userId = await seedUser();
        await seedSubscription({ userId, status: 'ACTIVE' });

        // Act
        const response = await getListingAccessPorts().billing.canCharge({ userId });

        // Assert
        expect(response).toEqual({ canCharge: true });
    });
});
