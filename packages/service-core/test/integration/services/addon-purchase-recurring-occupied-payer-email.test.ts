/**
 * HOS-2680: the payer email of a recurring add-on purchase recreated after the owner's release
 * (A8). The return screen's «Reintentar el pago» sends no payer email, so that it reuses the
 * pending checkout. When the occupant can no longer be reused (the provider cancelled its
 * preapproval, or its window ended), the recreated purchase keeps the occupant's declared payer
 * email instead of losing it; an email the request declares still wins.
 */
import { addonInstances, eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { pendingOccupant, statusOf } from './support/addon-purchase-occupied-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** The payer email declared on the COMPLEMENTO of a purchase instance. */
async function declaredPayerEmailOf(instanceId: string): Promise<string | null | undefined> {
    const [row] = await getServiceTestDb()
        .select({ email: subscriptions.declaredPayerEmail })
        .from(addonInstances)
        .innerJoin(subscriptions, eq(subscriptions.id, addonInstances.complementSubscriptionId))
        .where(eq(addonInstances.id, instanceId));
    return row?.email;
}

type Fixture = Awaited<ReturnType<typeof purchaseFixture>>;
type Occupant = Awaited<ReturnType<typeof pendingOccupant>>;

const unusable: readonly {
    readonly name: string;
    readonly make: (f: Fixture, occupant: Occupant) => Promise<void>;
}[] = [
    {
        name: 'the provider already cancelled the preapproval',
        make: async (f, occupant) => {
            await f.fake.cancel({ authorizationId: occupant.authorizationId });
        }
    },
    {
        name: 'the authorization window ended',
        make: async (f, occupant) => {
            const [complement] = await getServiceTestDb()
                .select({ endsAt: subscriptions.authorizationWindowEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, occupant.complementId));
            if (!complement?.endsAt) throw new Error('Window missing');
            f.advanceTo(new Date(complement.endsAt.getTime() + 1_000));
        }
    }
];

describe('HOS-2680 the payer email of a purchase recreated after a release', () => {
    for (const { name, make } of unusable) {
        it.skipIf(skip)(
            `keeps the occupant's declared payer email when ${name} and the request declares none`,
            async () => {
                // Arrange
                const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
                const occupant = await pendingOccupant(f);
                const declared = await declaredPayerEmailOf(occupant.instance.id);
                expect(declared).toBe('payer@example.test');
                await make(f, occupant);
                const authorize = vi.spyOn(f.fake, 'authorize');
                const { payerEmail: _omitted, ...retry } = f.input();

                // Act
                const result = await purchaseAddon(retry, f.ports);

                // Assert
                expect(result).toMatchObject({
                    outcome: 'CREATED',
                    checkoutUrl: expect.any(String)
                });
                if (result.outcome !== 'CREATED') throw new Error('Expected a new purchase');
                expect(await statusOf(occupant)).toEqual({
                    instance: 'ABANDONED',
                    complement: 'ABANDONED'
                });
                expect(await declaredPayerEmailOf(result.instanceId)).toBe(declared);
                expect(authorize).toHaveBeenCalledTimes(1);
                expect(authorize.mock.calls[0]?.[0]).toMatchObject({ payerEmail: declared });
            }
        );
    }

    it.skipIf(skip)('an email the request declares wins over the occupant one', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const occupant = await pendingOccupant(f);
        await f.fake.cancel({ authorizationId: occupant.authorizationId });

        // Act
        const result = await purchaseAddon(
            { ...f.input(), payerEmail: 'other.payer@example.test' },
            f.ports
        );

        // Assert
        if (result.outcome !== 'CREATED') throw new Error('Expected a new purchase');
        expect(await declaredPayerEmailOf(result.instanceId)).toBe('other.payer@example.test');
    });
});
