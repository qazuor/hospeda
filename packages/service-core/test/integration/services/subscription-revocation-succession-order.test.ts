// TEST:B5:18 — AC:B5:34 order contracts with RF1/S19 and S36 orphanhood.

import type { DrizzleClient } from '@repo/db';
import { addonInstances, eq, inArray, refunds, successionRetainedPayments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retireCommittedOrphanRows, seedOrphanInstance } from './support/addon-orphan-fixtures.js';
import {
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    seedSiblingPrincipal
} from './support/revocation-fixtures.js';
import { retainInOwnTransaction } from './support/succession-retention-fixtures.js';

const live = !isServiceTestDbAvailable();
const orphanInstanceIds: string[] = [];
afterEach(async () => {
    await retireCommittedOrphanRows();
    if (orphanInstanceIds.length > 0)
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(inArray(addonInstances.id, orphanInstanceIds.splice(0)));
    await retireRevocationRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(live)('TEST:B5:18 AC:B5:34 ordering', () => {
    it('calls S18 after RF1 exists and the S19 retention is closed', async () => {
        const f = await revocationFixture({ origin: 'GRACE_PERIOD' });
        if (!f.payment) throw new Error('fixture payment missing');
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        await retainInOwnTransaction({
            subscriptionId: f.subscriptionId,
            paymentId: f.payment.id,
            unpaidSince: f.day(2),
            now: f.day(8)
        });
        const observed: { refundCount: number; reason: string | null } = {
            refundCount: 0,
            reason: null
        };
        const ports = {
            ...f.ports,
            successionCloser: {
                closeSuccession: async ({
                    predecessorSubscriptionId,
                    tx
                }: {
                    predecessorSubscriptionId: string;
                    tx: DrizzleClient;
                }) => {
                    const refundRows = await tx
                        .select()
                        .from(refunds)
                        .where(eq(refunds.paymentId, f.payment!.id));
                    const [retention] = await tx
                        .select()
                        .from(successionRetainedPayments)
                        .where(eq(successionRetainedPayments.paymentId, f.payment!.id));
                    expect(predecessorSubscriptionId).toBe(f.subscriptionId);
                    observed.refundCount = refundRows.length;
                    observed.reason = retention?.releaseReason ?? null;
                }
            }
        };
        await revokeSubscription(
            { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
            ports
        );
        expect(observed).toEqual({ refundCount: 1, reason: 'REVOCATION_REFUNDED' });
    });

    it('calls S18 before the addon orphanhood policy runs', async () => {
        const f = await revocationFixture();
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        const { instanceId } = await seedOrphanInstance(getServiceTestDb(), {
            ownerId: f.userId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: 'ACTIVE',
            targetId: f.subscriptionId
        });
        orphanInstanceIds.push(instanceId);
        const sequence: string[] = [];
        const originalPolicy = f.ports.orphanhood.addonPolicy;
        const ports = {
            ...f.ports,
            successionCloser: {
                closeSuccession: async () => {
                    sequence.push('S18');
                }
            },
            orphanhood: {
                ...f.ports.orphanhood,
                addonPolicy: async (input: Parameters<typeof originalPolicy>[0]) => {
                    sequence.push('orphanhood');
                    return originalPolicy(input);
                }
            }
        };
        await revokeSubscription(
            { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
            ports
        );
        expect(sequence[0]).toBe('S18');
        expect(sequence).toContain('orphanhood');
    });
});
