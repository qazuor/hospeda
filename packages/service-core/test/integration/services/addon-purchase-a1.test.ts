import { addonInstances, domainEventModel, eq } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import { isPayingPrincipal } from '../../../src/services/billing/subscription/paying-predecessor-successor';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    closedSuccessionFixture,
    principalFixture,
    purchaseFixture,
    retirePurchaseFixtures,
    trialFixture
} from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(retirePurchaseFixtures);
afterAll(closeServiceTestPool);

async function instances(ownerId: string) {
    return getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.ownerId, ownerId));
}

describe('TEST:B10:1 AC:B10:1 addon purchase eligibility', () => {
    it.skipIf(skip)('refuses a running trial without a principal or anchor', async () => {
        const f = await purchaseFixture();
        // The running trial is seeded directly; A1 must never treat it as a paying title.
        await trialFixture({ ownerId: f.ownerId });
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_VALID_TITLE'
        });
        expect(await instances(f.ownerId)).toHaveLength(0);
    });

    it.skipIf(skip)('refuses an ACTIVE principal with no credited payment', async () => {
        const f = await purchaseFixture();
        // The ACTIVE principal is seeded directly without a payment.
        await principalFixture({ ownerId: f.ownerId });
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_VALID_TITLE'
        });
        expect(await instances(f.ownerId)).toHaveLength(0);
    });

    it.skipIf(skip)('creates a pending instance after a credited principal payment', async () => {
        const f = await purchaseFixture();
        // The paying principal and payment are seeded directly.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        const result = await purchaseAddon(f.input(), f.ports);
        expect(result).toMatchObject({ outcome: 'CREATED', chargeKind: 'UNA_VEZ' });
        const rows = await instances(f.ownerId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            addonVersionId: f.versionId
        });
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: rows[0]!.id
        });
        expect(
            events.find(({ eventType }) => eventType === 'addon_instance.status_changed')
        ).toMatchObject({
            actorType: 'owner',
            actorId: f.ownerId,
            changes: [{ field: 'status', old: null, new: 'PENDING_AUTHORIZATION' }]
        });
    });

    it.skipIf(skip)('accepts a paying predecessor of an ACTIVE successor', async () => {
        const f = await purchaseFixture();
        // The predecessor, its payment, and successor are seeded directly.
        const predecessorId = await principalFixture({
            ownerId: f.ownerId,
            status: 'CANCELLED',
            credited: true
        });
        await principalFixture({ ownerId: f.ownerId, predecessorId });
        expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
    });

    it.skipIf(skip)(
        'HOS-2224: accepts the successor of a paying predecessor once the succession closed',
        async () => {
            const f = await purchaseFixture();
            // The dead paying predecessor, its credited payment and the successor in credit
            // (no payment of its own) are seeded directly, with the closed-succession links.
            const predecessorId = await principalFixture({
                ownerId: f.ownerId,
                status: 'CANCELLED',
                credited: true
            });
            const successorId = await principalFixture({ ownerId: f.ownerId });
            await closedSuccessionFixture({ predecessorId, successorId });
            expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        }
    );

    it.skipIf(skip)(
        'HOS-2224: refuses the successor of a non-paying predecessor once the succession closed',
        async () => {
            const f = await purchaseFixture();
            // Same closed succession, but the predecessor never had a credited payment.
            const predecessorId = await principalFixture({
                ownerId: f.ownerId,
                status: 'CANCELLED'
            });
            const successorId = await principalFixture({ ownerId: f.ownerId });
            await closedSuccessionFixture({ predecessorId, successorId });
            expect(await purchaseAddon(f.input(), f.ports)).toEqual({
                outcome: 'REFUSED',
                reason: 'NO_VALID_TITLE'
            });
        }
    );

    it.skipIf(skip)(
        'HOS-2224: accepts a successor two closed hops in credit away from the paying row',
        async () => {
            const f = await purchaseFixture();
            // The staging chain: a paying root, a middle successor in credit that never charged,
            // and the current successor in credit, with BOTH successions closed (INV:D15).
            const rootId = await principalFixture({
                ownerId: f.ownerId,
                status: 'CANCELLED',
                credited: true
            });
            const middleId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            const successorId = await principalFixture({ ownerId: f.ownerId });
            await closedSuccessionFixture({ predecessorId: rootId, successorId: middleId });
            await closedSuccessionFixture({ predecessorId: middleId, successorId });
            expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        }
    );

    it.skipIf(skip)(
        'HOS-2224: follows an in-progress last succession and a closed first one to the paying row',
        async () => {
            const f = await purchaseFixture();
            // The current successor still names the middle by its own `succeeds_id`.
            const rootId = await principalFixture({
                ownerId: f.ownerId,
                status: 'CANCELLED',
                credited: true
            });
            const middleId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            await closedSuccessionFixture({ predecessorId: rootId, successorId: middleId });
            await principalFixture({ ownerId: f.ownerId, predecessorId: middleId });
            expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        }
    );

    it.skipIf(skip)(
        'HOS-2224: refuses a two-hop chain in which no row ever had a credited payment',
        async () => {
            const f = await purchaseFixture();
            const rootId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            const middleId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            const successorId = await principalFixture({ ownerId: f.ownerId });
            await closedSuccessionFixture({ predecessorId: rootId, successorId: middleId });
            await closedSuccessionFixture({ predecessorId: middleId, successorId });
            expect(await purchaseAddon(f.input(), f.ports)).toEqual({
                outcome: 'REFUSED',
                reason: 'NO_VALID_TITLE'
            });
        }
    );

    it.skipIf(skip)(
        'HOS-2224: a cycle in the succession links is thrown, never read as paying or not',
        async () => {
            const f = await purchaseFixture();
            // Corrupt links: each row names the other as its successor.
            const aId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            const bId = await principalFixture({ ownerId: f.ownerId, status: 'CANCELLED' });
            await closedSuccessionFixture({ predecessorId: aId, successorId: bId });
            await closedSuccessionFixture({ predecessorId: bId, successorId: aId });
            await expect(
                isPayingPrincipal({
                    principal: { id: aId, predecessorId: null },
                    payments: creditedPaymentsFromLedger
                })
            ).rejects.toThrow(/cycle/i);
        }
    );

    it.skipIf(skip)('refuses a paying principal in GRACE_PERIOD', async () => {
        const f = await purchaseFixture();
        // The GRACE_PERIOD principal and payment are seeded directly.
        await principalFixture({ ownerId: f.ownerId, status: 'GRACE_PERIOD', credited: true });
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_VALID_TITLE'
        });
    });

    it.skipIf(skip)('refuses a compatible listing whose vertical has only a trial', async () => {
        const f = await purchaseFixture({ scopeType: 'LISTING' });
        // The listing contract response and running trial are seeded directly.
        await trialFixture({ ownerId: f.ownerId });
        const listingId = crypto.randomUUID();
        f.setListing(listingId, {
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: f.ownerId,
            acceptsFeature: true
        });
        expect(await purchaseAddon(f.input(crypto.randomUUID(), listingId), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_VALID_TITLE'
        });
    });

    it.skipIf(skip)('hides a feature-ineligible, foreign, or missing listing', async () => {
        const f = await purchaseFixture({ scopeType: 'LISTING' });
        // The paying principal and two listing contract responses are seeded directly.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        const featureOff = crypto.randomUUID();
        const foreign = crypto.randomUUID();
        f.setListing(featureOff, {
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: f.ownerId,
            acceptsFeature: false
        });
        f.setListing(foreign, {
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: crypto.randomUUID(),
            acceptsFeature: true
        });
        for (const listingId of [featureOff, foreign, crypto.randomUUID()])
            expect(await purchaseAddon(f.input(crypto.randomUUID(), listingId), f.ports)).toEqual({
                outcome: 'REFUSED',
                reason: 'TARGET_NOT_FOUND'
            });
    });

    it.skipIf(skip)('hides a listing in an incompatible vertical', async () => {
        const f = await purchaseFixture({ scopeType: 'LISTING' });
        // The listing contract response is seeded directly in a different vertical.
        const listingId = crypto.randomUUID();
        f.setListing(listingId, {
            vertical: VerticalEnum.VENUE,
            ownerId: f.ownerId,
            acceptsFeature: true
        });
        expect(await purchaseAddon(f.input(crypto.randomUUID(), listingId), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'TARGET_NOT_FOUND'
        });
    });

    it.skipIf(skip)(
        'requires a principal target owned by the buyer for VERTICAL_SUBSCRIPTION',
        async () => {
            const f = await purchaseFixture({ scopeType: 'VERTICAL_SUBSCRIPTION' });
            const other = await purchaseFixture();
            // Both principal rows and their payments are seeded directly.
            const ownTarget = await principalFixture({ ownerId: f.ownerId, credited: true });
            const foreignTarget = await principalFixture({
                ownerId: other.ownerId,
                credited: true
            });
            expect(
                await purchaseAddon(f.input(crypto.randomUUID(), foreignTarget), f.ports)
            ).toEqual({ outcome: 'REFUSED', reason: 'TARGET_NOT_FOUND' });
            expect(
                await purchaseAddon(f.input(crypto.randomUUID(), ownTarget), f.ports)
            ).toMatchObject({ outcome: 'CREATED' });
        }
    );

    it.skipIf(skip)('accepts a live anchor without a principal', async () => {
        const f = await purchaseFixture();
        // The in-memory live anchor is programmed directly.
        f.anchor('accommodation');
        expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
    });

    it.skipIf(skip)('ignores an anchor in another vertical', async () => {
        const f = await purchaseFixture();
        // The in-memory anchor is for a vertical outside this product.
        f.anchor('venue');
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_VALID_TITLE'
        });
    });

    it.skipIf(skip)(
        'buys USER in a second compatible vertical when the first has only a trial',
        async () => {
            const f = await purchaseFixture({ verticals: ['accommodation', 'venue'] });
            // The first vertical has only a trial; the second principal and payment are seeded directly.
            await trialFixture({ ownerId: f.ownerId });
            await principalFixture({ ownerId: f.ownerId, vertical: 'venue', credited: true });
            expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
        }
    );
});
