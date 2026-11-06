import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { createSuccessionCloser } from '../../../src/services/billing/subscription/succession-closer.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { closePorts } from './support/succession-close-fixtures.js';
import {
    retireDiesAloneCase,
    seedDiesAloneCase
} from './support/succession-dies-alone-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const owned: Awaited<ReturnType<typeof seedDiesAloneCase>>[] = [];
afterEach(async () => {
    for (const ids of owned.splice(0)) await retireDiesAloneCase(ids);
});
afterAll(closeServiceTestPool);

function postgresConstraint(error: unknown): { code?: string; constraint?: string } | undefined {
    const seen = new Set<object>();
    let current: unknown = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
        if (typeof value.code === 'string')
            return {
                code: value.code,
                constraint: typeof value.constraint === 'string' ? value.constraint : undefined
            };
        current = value.cause;
    }
    return undefined;
}

async function rejectNewOrigin(ids: Awaited<ReturnType<typeof seedDiesAloneCase>>) {
    let result: unknown;
    try {
        await getServiceTestDb().transaction(async (tx) =>
            tx.transaction(async (savepoint) => {
                const [successor] = await savepoint
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, ids.successorId));
                if (!successor) throw new Error('Successor missing');
                await savepoint.insert(subscriptions).values({
                    userId: ids.userId,
                    vertical: 'accommodation',
                    planVersionId: successor.planVersionId,
                    billingOptionId: successor.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'ACTIVE'
                });
            })
        );
    } catch (error) {
        result = postgresConstraint(error);
    }
    expect(result).toEqual({ code: '23505', constraint: 'uq_subscription_commitment_origin' });
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:11 first-charge predecessor death', () => {
    it('(a) closes the succession in S16 and leaves the pending successor as the unique origin', async () => {
        const ids = await seedDiesAloneCase();
        owned.push(ids);
        const result = await declineFirstCharge(
            { chargeId: ids.chargeId },
            {
                provider: ids.provider,
                clock: ids.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                successionCloser: createSuccessionCloser(closePorts),
                coverageNotices: { emitCoverageChanged: async () => undefined }
            }
        );
        expect(result).toMatchObject({ outcome: 'DECLINED', successionClosed: true });
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, ids.predecessorId));
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, ids.successorId));
        expect(predecessor).toMatchObject({
            status: 'CHARGE_DECLINED',
            succeededById: ids.successorId
        });
        expect(successor).toMatchObject({ status: 'PENDING_AUTHORIZATION', succeedsId: null });
        await rejectNewOrigin(ids);
        const before = ids.authorizationCreations();
        const reused = await startSubscription(
            {
                userId: ids.userId,
                billingOptionId: ids.billingOptionId,
                returnUrl: 'https://example.test/return'
            },
            {
                provider: ids.provider,
                clock: ids.clock,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                }),
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            }
        );
        expect(reused).toMatchObject({
            subscriptionId: ids.successorId,
            authorizationId: ids.successorAuthorizationId
        });
        expect(ids.authorizationCreations()).toBe(before);
    });

    it('(b) rolls S16 back when the real act reaches a failing succession closer', async () => {
        const ids = await seedDiesAloneCase();
        owned.push(ids);
        await expect(
            declineFirstCharge(
                { chargeId: ids.chargeId },
                {
                    provider: ids.provider,
                    clock: ids.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    successionCloser: {
                        async closeSuccession() {
                            throw new Error('closer failed');
                        }
                    },
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            )
        ).rejects.toThrow('closer failed');
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, ids.predecessorId));
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, ids.successorId));
        expect(predecessor?.status).toBe('ACTIVE');
        expect(predecessor?.succeededById).toBe(ids.successorId);
        expect(successor?.succeedsId).toBe(ids.predecessorId);
    });
});
