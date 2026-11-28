/**
 * HOS-2668: a recurring add-on purchase stuck in `PENDING_AUTHORIZATION` no longer answers
 * `PENDING_ELSEWHERE` for the whole authorization window. A new request reads the occupant's
 * preapproval and, like a plan signup, reuses its checkout, releases it and starts again once,
 * or refuses an authorized one. A transient provider failure decides nothing.
 */
import { addonInstances, eq, subscriptions } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { releasePendingComplement } from '../../../src/services/billing/addon/release-pending-complement';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    purchaseFixture,
    purchaseFixtureInstances,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';
import {
    abandonEvents,
    cancellationDecisions,
    pendingOccupant,
    statusOf
} from './support/addon-purchase-occupied-fixtures';

vi.mock(
    '../../../src/services/billing/addon/release-pending-complement',
    async (importOriginal) => {
        const original =
            await importOriginal<
                typeof import('../../../src/services/billing/addon/release-pending-complement')
            >();
        return {
            ...original,
            releasePendingComplement: vi.fn(original.releasePendingComplement)
        };
    }
);

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

describe('HOS-2668 a new request over a pending recurring add-on purchase', () => {
    it.skipIf(skip)(
        'reuses the stored checkout when the payer email is the same and the window is open',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const authorize = vi.spyOn(f.fake, 'authorize');
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(f.input(), f.ports);

            // Assert
            expect(result).toEqual({
                outcome: 'EXISTING',
                instanceId: occupant.instance.id,
                chargeKind: 'PERIODICO',
                checkoutUrl: occupant.checkoutUrl
            });
            expect(authorize).not.toHaveBeenCalled();
            expect(cancel).not.toHaveBeenCalled();
            expect(await statusOf(occupant)).toEqual({
                instance: 'PENDING_AUTHORIZATION',
                complement: 'PENDING_AUTHORIZATION'
            });
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'reuses the checkout when the new request declares no payer email',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const { payerEmail: _omitted, ...withoutEmail } = f.input();

            // Act
            const result = await purchaseAddon(withoutEmail, f.ports);

            // Assert
            expect(result).toEqual({
                outcome: 'EXISTING',
                instanceId: occupant.instance.id,
                chargeKind: 'PERIODICO',
                checkoutUrl: occupant.checkoutUrl
            });
        }
    );

    it.skipIf(skip)(
        'releases the pair, cancels its preapproval and opens a fresh checkout when the payer email changed',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const cancel = vi.spyOn(f.fake, 'cancel');
            const authorize = vi.spyOn(f.fake, 'authorize');

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: 'Other.Payer@Example.test' },
                f.ports
            );

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREATED',
                chargeKind: 'PERIODICO',
                checkoutUrl: expect.any(String)
            });
            if (result.outcome !== 'CREATED') throw new Error('Expected a new purchase');
            expect(result.instanceId).not.toBe(occupant.instance.id);
            expect(result.checkoutUrl).not.toBe(occupant.checkoutUrl);
            expect(await statusOf(occupant)).toEqual({
                instance: 'ABANDONED',
                complement: 'ABANDONED'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(cancel).toHaveBeenCalledWith({ authorizationId: occupant.authorizationId });
            const read = await f.fake.readAuthorization({
                authorizationId: occupant.authorizationId
            });
            expect(read.snapshot.status).toBe('cancelled');
            expect(authorize).toHaveBeenCalledTimes(1);
            expect(await cancellationDecisions(occupant.complementId)).toEqual([
                { reason: 'A8', actorType: 'owner' }
            ]);
            expect(await abandonEvents(occupant.instance.id)).toEqual([
                {
                    actorType: 'owner',
                    changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }]
                }
            ]);
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(2);
        }
    );

    it.skipIf(skip)(
        'releases the pair without a cancel call when the provider already cancelled the preapproval',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            await f.fake.cancel({ authorizationId: occupant.authorizationId });
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(f.input(), f.ports);

            // Assert
            expect(result).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
            expect(await statusOf(occupant)).toEqual({
                instance: 'ABANDONED',
                complement: 'ABANDONED'
            });
            expect(cancel).not.toHaveBeenCalled();
            // Nothing is left for the sweep to retry: the preapproval is already cancelled.
            expect(await cancellationDecisions(occupant.complementId)).toEqual([]);
        }
    );

    it.skipIf(skip)(
        'releases the pair and cancels its preapproval when the authorization window ended',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const [complement] = await getServiceTestDb()
                .select({ endsAt: subscriptions.authorizationWindowEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, occupant.complementId));
            if (!complement?.endsAt) throw new Error('Window missing');
            f.advanceTo(new Date(complement.endsAt.getTime() + 1_000));
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(f.input(), f.ports);

            // Assert
            expect(result).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
            expect(await statusOf(occupant)).toEqual({
                instance: 'ABANDONED',
                complement: 'ABANDONED'
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(cancel).toHaveBeenCalledWith({ authorizationId: occupant.authorizationId });
        }
    );

    it.skipIf(skip)(
        'refuses as already active and releases nothing when the provider reads the preapproval authorized',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            await f.fake.approve({ authorizationId: occupant.authorizationId });
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: 'other.payer@example.test' },
                f.ports
            );

            // Assert
            expect(result).toEqual({ outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' });
            expect(cancel).not.toHaveBeenCalled();
            expect(await statusOf(occupant)).toEqual({
                instance: 'PENDING_AUTHORIZATION',
                complement: 'PENDING_AUTHORIZATION'
            });
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'writes nothing and answers a retryable provider failure when the read is unavailable',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            vi.spyOn(f.fake, 'readAuthorization').mockRejectedValueOnce(
                new PaymentProviderError({
                    capability: 'read',
                    code: 'UNAVAILABLE',
                    message: 'Timed out by fake provider',
                    transient: { kind: 'UNAVAILABLE' }
                })
            );
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const attempt = purchaseAddon(
                { ...f.input(), payerEmail: 'other.payer@example.test' },
                f.ports
            );

            // Assert
            await expect(attempt).rejects.toBeInstanceOf(PaymentProviderError);
            await expect(attempt).rejects.toMatchObject({
                capability: 'authorize',
                code: 'UNAVAILABLE',
                transient: { kind: 'UNAVAILABLE' }
            });
            expect(cancel).not.toHaveBeenCalled();
            expect(await statusOf(occupant)).toEqual({
                instance: 'PENDING_AUTHORIZATION',
                complement: 'PENDING_AUTHORIZATION'
            });
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'starts again at most once when the release does not free the identity',
        async () => {
            // Arrange: the release loses its race, so the retry meets the same occupant.
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            vi.mocked(releasePendingComplement).mockResolvedValueOnce({ released: false });
            const read = vi.spyOn(f.fake, 'readAuthorization');
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: 'other.payer@example.test' },
                f.ports
            );

            // Assert
            expect(result).toEqual({
                outcome: 'PENDING_ELSEWHERE',
                instanceId: occupant.instance.id,
                chargeKind: 'PERIODICO'
            });
            expect(read).toHaveBeenCalledTimes(1);
            expect(releasePendingComplement).toHaveBeenCalledTimes(1);
            expect(cancel).not.toHaveBeenCalled();
        }
    );

    it.skipIf(skip)(
        'answers PENDING_ELSEWHERE, never a server error, when the provider refuses the read',
        async () => {
            // Arrange: a 404 on the read is not transient, so nothing can be decided.
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const occupant = await pendingOccupant(f);
            const before = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, occupant.instance.id));
            vi.spyOn(f.fake, 'readAuthorization').mockRejectedValueOnce(
                new PaymentProviderError({
                    capability: 'read',
                    code: 'NOT_FOUND',
                    message: 'Not found by fake provider'
                })
            );
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await purchaseAddon(
                { ...f.input(), payerEmail: 'other.payer@example.test' },
                f.ports
            );

            // Assert
            expect(result).toEqual({
                outcome: 'PENDING_ELSEWHERE',
                instanceId: occupant.instance.id,
                chargeKind: 'PERIODICO'
            });
            expect(cancel).not.toHaveBeenCalled();
            expect(
                await getServiceTestDb()
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.id, occupant.instance.id))
            ).toEqual(before);
            expect(await purchaseFixtureInstances(f.ownerId)).toHaveLength(1);
        }
    );
});
