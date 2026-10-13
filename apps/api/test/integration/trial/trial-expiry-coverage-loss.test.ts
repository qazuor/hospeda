/**
 * AC:B4:4 (HOS-1534, I-5): a trial that expires through the REAL trial machine
 * (`getTrialMachinePorts()`, T3) records its `(user, vertical)` coverage loss in
 * the SAME transaction as `markExpired`, so `retentionStopped` answers the
 * instant even when the post-commit notice is lost; with an ACTIVE subscription
 * still covering that vertical, nothing is recorded.
 *
 * Cleans only its own rows in `afterEach` (children first); never TRUNCATE. The
 * trial row cannot be deleted (`reject_trial_delete`), so it stays TERMINAL
 * (`TRIAL_EXPIRED`) with its user: no live trial is left behind.
 */
import {
    billingOptions,
    coverageLosses,
    emailOutbox,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptions,
    trials
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { expireTrial } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createTrial,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

const NOW = new Date('2026-11-20T12:00:00.000Z');
const clock = { now: () => NOW };

const createdUsers: string[] = [];
const createdSubscriptions: string[] = [];
const createdBillingOptions: string[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
    await ensureAccommodationCatalog();
});
afterEach(async () => {
    const db = getDb();
    const subscriptionIds = createdSubscriptions.splice(0);
    if (subscriptionIds.length > 0)
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    for (const id of createdBillingOptions.splice(0))
        await db.delete(billingOptions).where(eq(billingOptions.id, id));
    for (const id of createdUsers.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, id));
        await db.delete(coverageLosses).where(eq(coverageLosses.userId, id));
    }
});
afterAll(async () => testDb.teardown());

/** An owner with a TRIAL_ACTIVE accommodation trial already due at {@link NOW}. */
async function ownerWithDueTrial(): Promise<string> {
    const { id: userId } = await createOwner();
    createdUsers.push(userId);
    await createTrial({ userId, status: 'TRIAL_ACTIVE' });
    await getDb()
        .update(trials)
        .set({ endsAt: new Date(NOW.getTime() - 60 * 60 * 1000) })
        .where(eq(trials.userId, userId));
    return userId;
}

/** An ACTIVE accommodation PRINCIPAL subscription over a non-sellable, non-current version. */
async function activeSubscription(userId: string): Promise<void> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b43-trial-loss-${crypto.randomUUID()}`,
            name: 'B4.3 trial coverage loss'
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
    createdBillingOptions.push(option.id);
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    createdSubscriptions.push(row.id);
}

async function expire(userId: string) {
    const { unitOfWork, afterCommit } = getTrialMachinePorts();
    return expireTrial({
        unitOfWork,
        afterCommit,
        clock,
        input: { userId, vertical: VerticalEnum.ACCOMMODATION }
    });
}

async function lossesOf(userId: string) {
    return getDb()
        .select({ vertical: coverageLosses.vertical, lostAt: coverageLosses.lostAt })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, userId));
}

async function trialStatusOf(userId: string) {
    const [row] = await getDb()
        .select({ status: trials.status })
        .from(trials)
        .where(eq(trials.userId, userId));
    return row?.status;
}

describe('AC:B4:4 I-5 a trial that expires records its coverage loss in the same transaction', () => {
    it('writes coverage_loss with the expiry instant when no billing source is left', async () => {
        // Arrange
        const userId = await ownerWithDueTrial();

        // Act
        const result = await expire(userId);

        // Assert
        expect(result.expired).toBe(true);
        expect(await trialStatusOf(userId)).toBe('TRIAL_EXPIRED');
        expect(await lossesOf(userId)).toEqual([
            { vertical: VerticalEnum.ACCOMMODATION, lostAt: NOW }
        ]);
    });

    it('writes nothing while an ACTIVE subscription of that vertical still covers', async () => {
        // Arrange
        const userId = await ownerWithDueTrial();
        await activeSubscription(userId);

        // Act
        const result = await expire(userId);

        // Assert
        expect(result.expired).toBe(true);
        expect(await trialStatusOf(userId)).toBe('TRIAL_EXPIRED');
        expect(await lossesOf(userId)).toEqual([]);
    });
});
