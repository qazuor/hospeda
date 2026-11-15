import { addonInstances, addonProducts, eq } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import {
    readAddonProductRetirement,
    retireAddonProduct,
    unretireAddonProduct
} from '../../../src/services/billing/addon-catalog/addon-product-retirement.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';

const actor = {
    id: crypto.randomUUID(),
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
};
const admin = { id: crypto.randomUUID(), roles: [RoleEnum.ADMIN], permissions: [] };

afterEach(retireWithdrawalFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B13b:3 AC:B13b:3 retiring an addon stops selling it and keeps what was bought',
    () => {
        it('retirement preserves every live instance field, refuses another purchase, and restoration sells again', async () => {
            const s = await withdrawalFixture();
            const before = await s.readInstance();
            expect(before?.status).toBe('ACTIVE');
            const productBefore = await readAddonProductRetirement({
                actor,
                productId: s.f.productId
            });
            expect(productBefore).toEqual({ productId: s.f.productId, retiredAt: null });

            const retired = await retireAddonProduct({ actor, productId: s.f.productId });
            expect(retired).toEqual({ productId: s.f.productId, retiredAt: expect.any(Date) });
            expect(await retireAddonProduct({ actor, productId: s.f.productId })).toEqual(retired);
            expect(await s.readInstance()).toEqual(before);

            const rejected = await purchaseAddon(s.f.input(), s.f.ports);
            expect(rejected).toEqual({ outcome: 'REFUSED', reason: 'PRODUCT_NOT_FOUND' });
            expect(await s.readInstance()).toEqual(before);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.ownerId, s.f.ownerId))
            ).toEqual([before]);

            expect(await unretireAddonProduct({ actor, productId: s.f.productId })).toEqual({
                productId: s.f.productId,
                retiredAt: null
            });
            expect(await unretireAddonProduct({ actor, productId: s.f.productId })).toEqual({
                productId: s.f.productId,
                retiredAt: null
            });
            const restored = await getServiceTestDb()
                .select({ retiredAt: addonProducts.retiredAt })
                .from(addonProducts)
                .where(eq(addonProducts.id, s.f.productId));
            expect(restored).toEqual([{ retiredAt: null }]);
            expect(await s.readInstance()).toEqual(before);
        });

        it('ADMIN without action 20 permission cannot retire or restore a product', async () => {
            const s = await withdrawalFixture();
            await expect(
                retireAddonProduct({ actor: admin, productId: s.f.productId })
            ).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN,
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expect(
                unretireAddonProduct({ actor: admin, productId: s.f.productId })
            ).rejects.toMatchObject({
                code: ServiceErrorCode.FORBIDDEN,
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            expect(await readAddonProductRetirement({ actor, productId: s.f.productId })).toEqual({
                productId: s.f.productId,
                retiredAt: null
            });
        });
    }
);
