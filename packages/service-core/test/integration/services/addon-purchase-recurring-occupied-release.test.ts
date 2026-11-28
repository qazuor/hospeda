/**
 * HOS-2668 (final round): what the owner's release of a pending recurring add-on purchase (A8)
 * does around the release itself. A credited payment blocks it, a committed release emits
 * `addon_checkout_abandoned` exactly once, a failed immediate cancel leaves the A8 decision for
 * the sweep, and the cancel trusts the decision's own read (as S39 does).
 */
import { payments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { addonFactSpy, addonFactSubjectOf } from './support/addon-fact-subject';
import {
    purchaseFixture,
    purchaseFixtureInstances,
    purchaseNow,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';
import {
    cancellationDecisions,
    pendingOccupant,
    statusOf
} from './support/addon-purchase-occupied-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

const OTHER_PAYER = 'Other.Payer@Example.test';

describe('HOS-2668 the owner release of a pending recurring add-on purchase (A8)', () => {
    it.skipIf(skip)(
        'releases nothing and cancels nothing when the complement already has a credited payment',
        async () => {
            // Arrange: the payment notice beat the authorization notice.
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: occupant.complementId,
                    amount: 5000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'fake',
                    providerFactId: `hos2668-${crypto.randomUUID()}`,
                    factAt: purchaseNow
                });
            const spy = addonFactSpy();
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: OTHER_PAYER },
                { ...f.ports, billingFacts: spy.sink }
            );

            // Assert
            expect(result).toEqual({
                outcome: 'PENDING_ELSEWHERE',
                instanceId: occupant.instance.id,
                chargeKind: 'PERIODICO'
            });
            expect(cancel).not.toHaveBeenCalled();
            expect(await statusOf(occupant)).toEqual({
                instance: 'PENDING_AUTHORIZATION',
                complement: 'PENDING_AUTHORIZATION'
            });
            expect(await cancellationDecisions(occupant.complementId)).toEqual([]);
            expect(spy.addonFacts()).toEqual([]);
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'emits addon_checkout_abandoned once, by the owner, when the release commits',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const before = await addonFactSubjectOf({ instanceId: occupant.instance.id });
            const releasedAt = new Date(before.instance.createdAt.getTime() + 90_000);
            f.advanceTo(releasedAt);
            const spy = addonFactSpy();

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: OTHER_PAYER },
                { ...f.ports, billingFacts: spy.sink }
            );

            // Assert
            expect(result.outcome).toBe('CREATED');
            expect(spy.addonFacts()).toEqual([
                {
                    kind: 'ADDON_CHECKOUT_ABANDONED',
                    ...before.subject,
                    actorKind: 'USER',
                    occurredAt: releasedAt,
                    reason: 'OWNER_WITHDREW',
                    secondsInPending: 90
                }
            ]);
        }
    );

    it.skipIf(skip)(
        'keeps the A8 decision for the sweep and still answers the new checkout when the immediate cancel fails',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const cancel = vi.spyOn(f.fake, 'cancel').mockRejectedValue(new Error('timeout'));

            // Act
            const result = await purchaseAddon({ ...f.input(), payerEmail: OTHER_PAYER }, f.ports);

            // Assert
            expect(result).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
            if (result.outcome !== 'CREATED') throw new Error('Expected a new purchase');
            expect(result.checkoutUrl).not.toBe(occupant.checkoutUrl);
            expect(cancel).toHaveBeenCalledWith({ authorizationId: occupant.authorizationId });
            expect(await statusOf(occupant)).toEqual({
                instance: 'ABANDONED',
                complement: 'ABANDONED'
            });
            expect(await cancellationDecisions(occupant.complementId)).toEqual([
                { reason: 'A8', actorType: 'owner' }
            ]);
            const read = await f.fake.readAuthorization({
                authorizationId: occupant.authorizationId
            });
            expect(read.snapshot.status).toBe('pending');
        }
    );

    it.skipIf(skip)(
        'cancels on the decision read without re-reading first, as S39 does',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const calls: string[] = [];
            const realRead = f.fake.readAuthorization.bind(f.fake);
            const realCancel = f.fake.cancel.bind(f.fake);
            vi.spyOn(f.fake, 'readAuthorization').mockImplementation(async (input) => {
                if (input.authorizationId === occupant.authorizationId) calls.push('read');
                return realRead(input);
            });
            vi.spyOn(f.fake, 'cancel').mockImplementation(async (input) => {
                if (input.authorizationId === occupant.authorizationId) calls.push('cancel');
                return realCancel(input);
            });

            // Act
            await purchaseAddon({ ...f.input(), payerEmail: OTHER_PAYER }, f.ports);

            // Assert: one decision read, the cancel, then only the confirming read.
            expect(calls).toEqual(['read', 'cancel', 'read']);
        }
    );
});
