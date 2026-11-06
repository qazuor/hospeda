import type { Clock } from '@repo/billing-verticals-contract';
import {
    courtesyGrants,
    type DrizzleClient,
    eq,
    getDb,
    setDb,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
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
