import type { Clock } from '@repo/billing-verticals-contract';
import {
    billingOptions,
    courtesyGrants,
    type DrizzleClient,
    eq,
    getDb,
    plans,
    planVersionLimits,
    planVersions,
    setDb,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { activateSubscription } from '../../../../../packages/service-core/src/services/billing/subscription/activate-subscription.service';
import { startSubscription } from '../../../../../packages/service-core/src/services/billing/subscription/start-subscription.service';
import { startSuccession } from '../../../../../packages/service-core/src/services/billing/subscription/start-succession.service';
import { seedOrphanInstance } from '../../../../../packages/service-core/test/integration/services/support/addon-orphan-fixtures';
import {
    seedCoveragePlanVersion,
    seedCoverageUser
} from '../../../../../packages/service-core/test/integration/services/support/coverage-fixtures';
import { noTouristVip } from '../../../../../packages/service-core/test/integration/services/support/tourist-vip';
import { testDb } from '../../e2e/setup/test-database';

/** Run a production composition root against seeded rows and roll every write back. */
export async function withCompositionRollback(
    run: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    const db = getDb();
    await testDb.withRollback(async (tx: DrizzleClient) => {
        setDb(tx);
        try {
            await run(tx);
        } finally {
            setDb(db);
        }
    });
}

/** Reach an ACTIVE card predecessor through S1 and S2, with a real catalog destination. */
export async function startPlanChangeScenario(
    tx: DrizzleClient,
    input: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly approve: (authorizationId: string) => Promise<void>;
        readonly direction?: 'UP' | 'DOWN';
    }
) {
    const user = await seedCoverageUser(tx);
    const source = await seedCoveragePlanVersion(tx, 'accommodation');
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `route-target-${crypto.randomUUID()}`,
            name: 'Route target'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Target plan missing');
    const [targetVersion] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!targetVersion) throw new Error('Target version missing');
    const [target] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: targetVersion.id,
            cycle: 'monthly',
            amount: 300000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!target) throw new Error('Target option missing');
    if (input.direction === 'DOWN')
        await tx.insert(planVersionLimits).values({
            planVersionId: source.planVersionId,
            key: PUBLICATION_LIMIT_KEYS.accommodation,
            value: 10
        });
    const ports = {
        provider: input.provider,
        clock: input.clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
    const started = await startSubscription(
        {
            userId: user.userId,
            billingOptionId: source.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        ports
    );
    await input.approve(started.authorizationId);
    const activated = await activateSubscription(started.subscriptionId, ports);
    if (!activated.activated)
        throw new Error('Plan change predecessor did not activate through S2');
    // The first successful recurring charge belongs to a later act; anchor its future cycle date for this route fixture.
    await tx
        .update(subscriptions)
        .set({
            nextChargeAt: new Date(input.clock.now().getTime() + 30 * 24 * 60 * 60 * 1000)
        })
        .where(eq(subscriptions.id, started.subscriptionId));
    return {
        userId: user.userId,
        subscriptionId: started.subscriptionId,
        authorizationId: started.authorizationId,
        sourceOptionId: source.billingOptionId,
        targetOptionId: target.id
    };
}

/** Build the API settlement scenario through the real S1 and S2 transitions. */
export async function startSettlementSuccession(
    tx: DrizzleClient,
    input: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly approve: (authorizationId: string) => Promise<void>;
        readonly complement?: boolean;
        readonly courtesy?: boolean;
    }
) {
    const user = await seedCoverageUser(tx);
    const option = await seedCoveragePlanVersion(tx, 'accommodation');
    const ports = {
        provider: input.provider,
        clock: input.clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
    const predecessorStart = await startSubscription(
        {
            userId: user.userId,
            billingOptionId: option.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        ports
    );
    await input.approve(predecessorStart.authorizationId);
    const activated = await activateSubscription(predecessorStart.subscriptionId, ports);
    if (!activated.activated) throw new Error('Fixture predecessor did not activate through S2');
    const successorStart = await startSuccession(
        {
            userId: user.userId,
            predecessorSubscriptionId: predecessorStart.subscriptionId,
            billingOptionId: option.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        ports
    );
    const [predecessor] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, predecessorStart.subscriptionId));
    const [successor] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, successorStart.subscriptionId));
    if (
        !predecessor ||
        !successor ||
        predecessor.status !== 'ACTIVE' ||
        successor.status !== 'PENDING_AUTHORIZATION' ||
        successor.succeedsId !== predecessor.id ||
        predecessor.succeededById !== successor.id
    )
        throw new Error('Fixture succession did not pass through S1/S2');
    let addonId: string | null = null;
    if (input.complement) {
        // No service creates an already active orphan-policy fixture addon without a checkout.
        const addon = await seedOrphanInstance(tx, {
            ownerId: user.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: predecessor.id
        });
        addonId = addon.instanceId;
    }
    let grantId: string | null = null;
    if (input.courtesy) {
        const startsAt = new Date('2026-10-01T12:00:00.000Z');
        const endsAt = new Date('2027-01-22T12:00:00.000Z');
        // No service creates this historical, already ended courtesy pause for a live predecessor.
        await tx.insert(subscriptionPauses).values({
            subscriptionId: predecessor.id,
            reason: 'COURTESY',
            startsAt,
            expectedEndAt: endsAt,
            actualEndAt: input.clock.now()
        });
        // No service issues the historical courtesy grant required to exercise S9 reissue.
        const [grant] = await tx
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: user.userId,
                grantedBy: user.userId,
                subscriptionId: predecessor.id,
                months: 4,
                startsAt,
                endsAt,
                reason: 'fixture'
            })
            .returning({ id: courtesyGrants.id });
        if (!grant) throw new Error('Fixture courtesy grant missing');
        grantId = grant.id;
    }
    return {
        predecessor,
        successor,
        addonId,
        grantId,
        redemptionId: null,
        paymentId: null,
        userId: user.userId,
        predecessorAuthorizationId: predecessorStart.authorizationId,
        successorAuthorizationId: successorStart.authorizationId
    };
}
