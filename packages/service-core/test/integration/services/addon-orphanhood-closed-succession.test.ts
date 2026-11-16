import type { DrizzleClient } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { isAddonInstanceOrphaned } from '../../../src/services/billing/addon/addon-orphanhood';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    closedSuccessionFixture,
    principalFixture,
    purchaseFixture,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(retirePurchaseFixtures);
afterAll(closeServiceTestPool);

/** Evaluates a USER instance of the fixture owner over `accommodation` (B/16 §4.2). */
async function userInstanceOrphaned(f: Awaited<ReturnType<typeof purchaseFixture>>) {
    return getServiceTestDb().transaction(async (raw) =>
        isAddonInstanceOrphaned(
            {
                tx: raw as DrizzleClient,
                instance: {
                    id: crypto.randomUUID(),
                    ownerId: f.ownerId,
                    targetId: null,
                    compatibleVerticals: ['accommodation']
                },
                scopeType: 'USER'
            },
            {
                addonPolicy: f.ports.addonPolicy,
                listing: f.ports.listing,
                liveAnchors: f.ports.liveAnchors
            }
        )
    );
}

describe('HOS-2224 USER/GLOBAL orphanhood after a closed succession', () => {
    it.skipIf(skip)(
        'keeps the instance of a successor in credit of a paying predecessor',
        async () => {
            const f = await purchaseFixture();
            // The dead paying predecessor and the successor with no payment of its own are seeded
            // directly, with the links a closed succession leaves (AC:B8b:10).
            const predecessorId = await principalFixture({
                ownerId: f.ownerId,
                status: 'CANCELLED',
                credited: true
            });
            const successorId = await principalFixture({ ownerId: f.ownerId });
            await closedSuccessionFixture({ predecessorId, successorId });
            expect(await userInstanceOrphaned(f)).toBe(false);
        }
    );

    it.skipIf(skip)('orphans it when the closed predecessor was not paying', async () => {
        const f = await purchaseFixture();
        // Same closed succession, without any credited payment.
        const predecessorId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
        const successorId = await principalFixture({ ownerId: f.ownerId });
        await closedSuccessionFixture({ predecessorId, successorId });
        expect(await userInstanceOrphaned(f)).toBe(true);
    });
});
