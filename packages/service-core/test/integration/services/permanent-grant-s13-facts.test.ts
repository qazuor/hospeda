import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { SinkFact } from '../../../src/services/billing/facts/billing-fact-sink.js';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant,
    resumePermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-14T12:00:00.000Z');
const userIds: string[] = [];
const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.VENUE;
afterEach(async () => retirePermanentGrantRows(userIds.splice(0)));

/** Seeds a beneficiary, an admin signer and the grant floor plan for one vertical. */
async function seedBeneficiary(vertical = V) {
    return getServiceTestDb().transaction(async (tx) => {
        const { userId } = await seedCoverageUser(tx);
        const { userId: adminId } = await seedCoverageUser(tx);
        userIds.push(userId, adminId);
        const anchor = await seedGrantPlan(tx, vertical);
        return { userId, adminId, anchor };
    });
}

/** Seeds one live PRINCIPAL row for an existing beneficiary in a vertical. */
async function seedPrincipal(userId: string, vertical: string, status = 'ACTIVE') {
    return getServiceTestDb().transaction(async (tx) => {
        const plan = await seedCoveragePlanVersion(tx, vertical);
        return seedCoverageSubscription(tx, { userId, vertical, ...plan, status });
    });
}

/** Ports that collect every billing fact the act emits. */
function ports(facts: SinkFact[]) {
    const clock = { now: () => now };
    return {
        planPolicy: currentFloorPolicy,
        clock,
        provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
        billingFacts: {
            emit: (fact: SinkFact) => {
                facts.push(fact);
            }
        },
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing addon seeded');
            }
        }
    };
}

/** The exact fact S13 emits for one cancelled principal (path INHERITED_BY_PLAN, actor ADMIN). */
function s13CancelledFact(input: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly subscriptionId: string;
    readonly wasScheduled: boolean;
}): SinkFact {
    return {
        kind: 'SUBSCRIPTION_CANCELLED',
        userId: input.userId,
        vertical: input.vertical,
        subscriptionId: input.subscriptionId,
        subscriptionClass: 'PRINCIPAL',
        actorKind: 'ADMIN',
        cancelledBy: 'ADMIN',
        path: 'INHERITED_BY_PLAN',
        wasScheduled: input.wasScheduled,
        occurredAt: now
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:1 — S13 analytics facts: every committing act emits its exact subscription-cancelled fact',
    () => {
        it('a — grantPermanentGrant emits one fact for the principal it cancels', async () => {
            const seeded = await seedBeneficiary();
            const row = await seedPrincipal(seeded.userId, V, 'ACTIVE');
            const facts: SinkFact[] = [];
            await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    actor: grantSignerActor(seeded.adminId),
                    reason: 'S13 grant fact',
                    includesAddons: false,
                    anchors: [{ vertical: V, ...seeded.anchor }]
                },
                ports(facts)
            );
            expect(facts).toEqual([
                s13CancelledFact({
                    userId: seeded.userId,
                    vertical: V,
                    subscriptionId: row.subscriptionId,
                    wasScheduled: false
                })
            ]);
        });

        it('b — anchorPermanentGrantVertical emits one fact for the anchored vertical row', async () => {
            const seeded = await seedBeneficiary();
            const facts: SinkFact[] = [];
            const factPorts = ports(facts);
            const granted = await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    actor: grantSignerActor(seeded.adminId),
                    reason: 'S13 anchor fact',
                    includesAddons: false,
                    anchors: [{ vertical: V, ...seeded.anchor }]
                },
                factPorts
            );
            const row = await seedPrincipal(seeded.userId, W, 'ACTIVE');
            const anchorW = await getServiceTestDb().transaction((tx) => seedGrantPlan(tx, W));
            await anchorPermanentGrantVertical(
                {
                    permanentGrantId: granted.permanentGrantId,
                    actor: grantSignerActor(seeded.adminId),
                    vertical: W,
                    ...anchorW
                },
                factPorts
            );
            expect(facts).toEqual([
                s13CancelledFact({
                    userId: seeded.userId,
                    vertical: W,
                    subscriptionId: row.subscriptionId,
                    wasScheduled: false
                })
            ]);
        });

        it('c — resumePermanentGrant emits one fact for the row it cancels', async () => {
            const seeded = await seedBeneficiary();
            const facts: SinkFact[] = [];
            const factPorts = ports(facts);
            const granted = await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    actor: grantSignerActor(seeded.adminId),
                    reason: 'S13 resume fact',
                    includesAddons: false,
                    anchors: [{ vertical: V, ...seeded.anchor }]
                },
                factPorts
            );
            const row = await seedPrincipal(seeded.userId, V, 'ACTIVE');
            await resumePermanentGrant(
                {
                    permanentGrantId: granted.permanentGrantId,
                    actor: grantSignerActor(seeded.adminId)
                },
                factPorts
            );
            expect(facts).toEqual([
                s13CancelledFact({
                    userId: seeded.userId,
                    vertical: V,
                    subscriptionId: row.subscriptionId,
                    wasScheduled: false
                })
            ]);
        });

        it('d — a PENDING_AUTHORIZATION row is cancelled locally but emits no fact', async () => {
            const seeded = await seedBeneficiary();
            const row = await seedPrincipal(seeded.userId, V, 'PENDING_AUTHORIZATION');
            const facts: SinkFact[] = [];
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    actor: grantSignerActor(seeded.adminId),
                    reason: 'S13 pending-authorization fact',
                    includesAddons: false,
                    anchors: [{ vertical: V, ...seeded.anchor }]
                },
                ports(facts)
            );
            expect(result.cancelledSubscriptionIds).toContain(row.subscriptionId);
            const [cancelled] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(cancelled?.status).toBe('CANCELLED');
            expect(facts).toEqual([]);
        });
    }
);
