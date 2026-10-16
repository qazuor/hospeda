import { randomUUID } from 'node:crypto';
import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import {
    billingOptions,
    courtesyGrants,
    getDb,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    plans,
    planVersions,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import type { GrantCoverageCaseHarness } from './grant-coverage-case-set';

const FIXTURE_NOW = new Date('2026-10-12T12:00:00.000Z');
const createdUsers: string[] = [];
const createdSubscriptionIds: string[] = [];
const createdGrantIds: string[] = [];
const createdBillingOptionIds: string[] = [];

async function seedUser(): Promise<string> {
    const [row] = await getDb()
        .insert(users)
        .values({
            email: `b9a-grant-coverage-${randomUUID()}@example.test`,
            displayName: 'B9a coverage fixture',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!row) throw new Error('B9a fixture user insert returned no row');
    createdUsers.push(row.id);
    return row.id;
}

async function seedPlan(vertical: VerticalEnum) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `b9a-coverage-${randomUUID()}`,
            name: 'B9a coverage fixture'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('B9a fixture plan insert returned no row');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('B9a fixture version insert returned no row');
    return { planId: plan.id, planVersionId: version.id };
}

/** Builds committed rows because the API coverage composition reads on its own connection. */
export async function makeGrantCoverageHarness(input: {
    readonly subject: Pick<BillingForVerticals, 'coverage'>;
}): Promise<GrantCoverageCaseHarness> {
    const userIds = [await seedUser(), await seedUser()];
    const signerId = userIds[1];
    if (!signerId) throw new Error('B9a fixture signer missing');
    return {
        subject: input.subject,
        newUserId: () => {
            const id = userIds.shift();
            if (!id) throw new Error('B9a fixture user queue exhausted');
            return id;
        },
        arrange: {
            liveGrant: async (userId, vertical) => {
                const plan = await seedPlan(vertical);
                const [grant] = await getDb()
                    .insert(permanentGrants)
                    .values({
                        beneficiaryUserId: userId,
                        grantedBy: signerId,
                        includesAddons: false,
                        reason: 'B9a coverage test',
                        affectedSubscriptionIds: []
                    })
                    .returning({ id: permanentGrants.id });
                if (!grant) throw new Error('B9a fixture grant insert returned no row');
                createdGrantIds.push(grant.id);
                const [anchor] = await getDb()
                    .insert(permanentGrantVerticals)
                    .values({
                        permanentGrantId: grant.id,
                        vertical,
                        planId: plan.planId,
                        floorPlanVersionId: plan.planVersionId
                    })
                    .returning({ createdAt: permanentGrantVerticals.createdAt });
                if (!anchor) throw new Error('B9a fixture grant anchor insert returned no row');
                return { floor: plan.planVersionId, since: anchor.createdAt };
            },
            courtesy: async (userId) => {
                const db = getDb();
                const plan = await seedPlan(VerticalEnum.ACCOMMODATION);
                const [option] = await db
                    .insert(billingOptions)
                    .values({
                        planVersionId: plan.planVersionId,
                        cycle: 'monthly',
                        amount: 250000,
                        currency: 'ARS'
                    })
                    .returning({ id: billingOptions.id });
                if (!option) throw new Error('B9a fixture billing option insert returned no row');
                createdBillingOptionIds.push(option.id);
                const [subscription] = await db
                    .insert(subscriptions)
                    .values({
                        userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        planVersionId: plan.planVersionId,
                        billingOptionId: option.id,
                        paymentMethod: 'CARD',
                        status: 'PAUSED',
                        class: 'PRINCIPAL',
                        createdAt: FIXTURE_NOW
                    })
                    .returning({ id: subscriptions.id });
                if (!subscription)
                    throw new Error('B9a fixture subscription insert returned no row');
                createdSubscriptionIds.push(subscription.id);
                const startsAt = new Date('2026-10-01T00:00:00.000Z');
                const endsAt = new Date('2026-11-01T00:00:00.000Z');
                await db.insert(subscriptionPauses).values({
                    subscriptionId: subscription.id,
                    reason: 'COURTESY',
                    startsAt
                });
                await db.insert(courtesyGrants).values({
                    beneficiaryUserId: userId,
                    grantedBy: signerId,
                    subscriptionId: subscription.id,
                    months: 1,
                    startsAt,
                    endsAt,
                    reason: 'B9a coverage test'
                });
                return { planVersionId: plan.planVersionId, startsAt, endsAt };
            }
        }
    };
}

/** Deletes fixture children before subscriptions and their users; catalog rows are immutable. */
export async function cleanGrantCoverageFixtures(): Promise<void> {
    const db = getDb();
    if (createdSubscriptionIds.length) {
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, createdSubscriptionIds));
        await db
            .delete(courtesyGrants)
            .where(inArray(courtesyGrants.subscriptionId, createdSubscriptionIds));
    }
    if (createdGrantIds.length)
        await db
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, createdGrantIds));
    if (createdUsers.length)
        await db
            .delete(permanentGrants)
            .where(inArray(permanentGrants.beneficiaryUserId, createdUsers));
    if (createdSubscriptionIds.length)
        await db.delete(subscriptions).where(inArray(subscriptions.id, createdSubscriptionIds));
    if (createdBillingOptionIds.length)
        await db.delete(billingOptions).where(inArray(billingOptions.id, createdBillingOptionIds));
    if (createdUsers.length) await db.delete(users).where(inArray(users.id, createdUsers));
    createdSubscriptionIds.length = 0;
    createdGrantIds.length = 0;
    createdBillingOptionIds.length = 0;
    createdUsers.length = 0;
}
