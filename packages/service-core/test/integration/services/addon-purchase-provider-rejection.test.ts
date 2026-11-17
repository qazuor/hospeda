import { addonInstances, eq, idempotencyKeys, subscriptions } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    principalFixture,
    purchaseFixture,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

function providerFailure(input: {
    readonly code: 'REJECTED' | 'UNAVAILABLE';
    readonly rateLimited?: boolean;
}) {
    return new PaymentProviderError({
        capability: 'authorize',
        code: input.code,
        message: 'Failed by fake provider',
        ...(input.rateLimited ? { transient: { kind: 'RATE_LIMITED' as const } } : {})
    });
}

async function state(ownerId: string) {
    const db = getServiceTestDb();
    const instances = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.ownerId, ownerId));
    const complements = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ownerId));
    return {
        instances,
        complements: complements.filter(({ class: kind }) => kind === 'COMPLEMENTO')
    };
}

describe('HOS-2321 recurring addon purchase rejected by the provider', () => {
    it.skipIf(skip)('leaves nothing pending and lets a retry reach a fresh checkout', async () => {
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        // The paying principal and payment are seeded directly.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        vi.spyOn(f.fake, 'authorize').mockRejectedValueOnce(providerFailure({ code: 'REJECTED' }));

        await expect(purchaseAddon(f.input(), f.ports)).rejects.toMatchObject({ code: 'REJECTED' });

        const afterRejection = await state(f.ownerId);
        expect(afterRejection.instances).toMatchObject([{ status: 'ABANDONED' }]);
        expect(afterRejection.complements).toMatchObject([{ status: 'ABANDONED' }]);
        const keys = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, afterRejection.complements[0]!.id));
        expect(keys).toMatchObject([{ completedAt: expect.any(Date) }]);

        const retry = await purchaseAddon(f.input(), f.ports);
        expect(retry).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
        const afterRetry = await state(f.ownerId);
        expect(afterRetry.instances.map(({ status }) => status).sort()).toEqual([
            'ABANDONED',
            'PENDING_AUTHORIZATION'
        ]);
    });

    it.skipIf(skip)('also releases the row when the provider throttles the creation', async () => {
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        // The paying principal and payment are seeded directly.
        await principalFixture({ ownerId: f.ownerId, credited: true });
        vi.spyOn(f.fake, 'authorize').mockRejectedValueOnce(
            providerFailure({ code: 'UNAVAILABLE', rateLimited: true })
        );
        await expect(purchaseAddon(f.input(), f.ports)).rejects.toBeInstanceOf(
            PaymentProviderError
        );
        expect((await state(f.ownerId)).instances).toMatchObject([{ status: 'ABANDONED' }]);
        expect(await purchaseAddon(f.input(), f.ports)).toMatchObject({ outcome: 'CREATED' });
    });

    it.skipIf(skip)(
        'keeps the pending row when the outcome at the provider is unknown',
        async () => {
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            // The paying principal and payment are seeded directly.
            await principalFixture({ ownerId: f.ownerId, credited: true });
            vi.spyOn(f.fake, 'authorize').mockRejectedValueOnce(
                providerFailure({ code: 'UNAVAILABLE' })
            );
            await expect(purchaseAddon(f.input(), f.ports)).rejects.toBeInstanceOf(
                PaymentProviderError
            );
            expect((await state(f.ownerId)).instances).toMatchObject([
                { status: 'PENDING_AUTHORIZATION' }
            ]);
        }
    );
});
