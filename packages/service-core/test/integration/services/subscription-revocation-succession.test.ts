// TEST:B5:18 — AC:B5:34: S36 calls the S18 interface for a seeded live predecessor.

import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireRevocationRows,
    revocationFixture,
    seedRevocationActor,
    seedSiblingPrincipal,
    untouchedState
} from './support/revocation-fixtures.js';

const live = !isServiceTestDbAvailable();
afterEach(retireRevocationRows);
afterAll(closeServiceTestPool);

describe.skipIf(live)('TEST:B5:18 AC:B5:34 S36 calls S18', () => {
    it.each([
        'ACTIVE',
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED',
        'PAUSED'
    ] as const)('calls once for a live successor when the predecessor starts in %s', async (origin) => {
        const f = await revocationFixture({ origin });
        if (origin === 'PAUSED') f.at(f.day(5));
        await seedSiblingPrincipal({
            like: f,
            status: 'PENDING_AUTHORIZATION',
            succeedsId: f.subscriptionId
        });
        const actor = await seedRevocationActor();
        await revokeSubscription({ actor, subscriptionId: f.subscriptionId }, f.ports);
        expect(f.succession.closer.closeSuccession).toHaveBeenCalledTimes(1);
        expect(f.succession.seen[0]).toMatchObject({
            predecessorSubscriptionId: f.subscriptionId,
            predecessorStatusInTx: 'CANCELLED',
            predecessorStatusCommitted: origin
        });
    });

    it('calls for an ACTIVE successor too', async () => {
        const f = await revocationFixture();
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        await revokeSubscription(
            { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
            f.ports
        );
        expect(f.succession.closer.closeSuccession).toHaveBeenCalledTimes(1);
        expect(f.succession.seen[0]?.predecessorSubscriptionId).toBe(f.subscriptionId);
    });

    it.each([
        ['without a successor', undefined],
        ['with an ABANDONED successor', 'ABANDONED'],
        ['with a CANCELLED successor', 'CANCELLED']
    ] as const)('does not call for a predecessor %s', async (_label, status) => {
        const f = await revocationFixture();
        if (status) await seedSiblingPrincipal({ like: f, status, succeedsId: f.subscriptionId });
        await revokeSubscription(
            { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
            f.ports
        );
        expect(f.succession.closer.closeSuccession).not.toHaveBeenCalled();
        const [row] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, f.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
    });

    it('fails closed when the registered closer throws', async () => {
        const f = await revocationFixture();
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        const actor = await seedRevocationActor();
        const before = await untouchedState(f);
        const error = new Error('S18 unavailable');
        const ports = {
            ...f.ports,
            successionCloser: {
                closeSuccession: async () => {
                    throw error;
                }
            }
        };
        await expect(
            revokeSubscription({ actor, subscriptionId: f.subscriptionId }, ports)
        ).rejects.toBe(error);
        expect(await untouchedState(f)).toEqual(before);
    });

    it('fails closed with the unregistered default when a live successor exists', async () => {
        const f = await revocationFixture();
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        const actor = await seedRevocationActor();
        const before = await untouchedState(f);
        const { successionCloser: _closer, ...ports } = f.ports;
        await expect(
            revokeSubscription({ actor, subscriptionId: f.subscriptionId }, ports)
        ).rejects.toMatchObject({ reason: 'SUCCESSION_CLOSER_NOT_REGISTERED' });
        expect(await untouchedState(f)).toEqual(before);
    });

    it('rejects outside the 10-day window without calling S18', async () => {
        const f = await revocationFixture();
        await seedSiblingPrincipal({ like: f, status: 'ACTIVE', succeedsId: f.subscriptionId });
        f.at(f.day(11));
        await expect(
            revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'REVOCATION_WINDOW_CLOSED' });
        expect(f.succession.closer.closeSuccession).not.toHaveBeenCalled();
    });
});
