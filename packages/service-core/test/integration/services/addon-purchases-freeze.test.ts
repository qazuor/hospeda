import { addonInstances, eq } from '@repo/db';
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

describe('HOS-1749 addon purchase freeze', () => {
    it.skipIf(skip)(
        'blocks new rows and provider calls, while allowing an existing order replay',
        async () => {
            const fixture = await purchaseFixture({ chargeKind: 'PERIODICO', cycle: 'annual' });
            await principalFixture({ ownerId: fixture.ownerId, credited: true });
            const mutable = { frozen: false };
            const ports = {
                ...fixture.ports,
                addonPurchasesFreeze: { isFrozen: async () => mutable.frozen }
            };
            const originalInput = fixture.input();
            const created = await purchaseAddon(originalInput, ports);
            expect(created.outcome).toBe('CREATED');
            const authorize = vi.spyOn(fixture.fake, 'authorize');
            mutable.frozen = true;
            expect((await purchaseAddon(originalInput, ports)).outcome).toBe('EXISTING');
            const freshInput = fixture.input(crypto.randomUUID());
            await expect(purchaseAddon(freshInput, ports)).rejects.toMatchObject({
                code: 'ADDON_PURCHASES_FROZEN'
            });
            expect(authorize).not.toHaveBeenCalled();
            expect(
                await getServiceTestDb()
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.ownerId, fixture.ownerId))
            ).toHaveLength(1);
        }
    );
});
