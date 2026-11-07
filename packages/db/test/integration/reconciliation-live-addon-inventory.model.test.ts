import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationInventoryModel } from '../../src/models/reconciliation-inventory/reconciliation-inventory.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { addons, addonVersions } from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import {
    addonInstances,
    addonProducts
} from '../../src/schemas/vertical/addon-product.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('live addon instance inventory', () => {
    it('returns only pending and active ids, ordered and limited by an exclusive cursor', async () => {
        await withTestTransaction(async (tx) => {
            const fixtureId = crypto.randomUUID();
            const [owner] = await tx
                .insert(users)
                .values({
                    slug: `addon-inventory-${fixtureId}`,
                    email: `addon-inventory-${fixtureId}@example.test`
                })
                .returning({ id: users.id });
            const [addon] = await tx
                .insert(addons)
                .values({
                    slug: `addon-inventory-${fixtureId}`,
                    name: 'Inventory fixture'
                })
                .returning({ id: addons.id });
            if (!owner || !addon) throw new Error('Missing addon inventory fixture anchors');
            const [version] = await tx
                .insert(addonVersions)
                .values({
                    addonId: addon.id,
                    validity: 'WHILE_SUBSCRIPTION_ALIVE',
                    scopeType: 'USER'
                })
                .returning({ id: addonVersions.id });
            if (!version) throw new Error('Missing addon version');
            const [product] = await tx
                .insert(addonProducts)
                .values({
                    addonId: addon.id,
                    versionId: version.id,
                    price: 100,
                    currency: 'ARS',
                    chargeKind: 'UNA_VEZ',
                    compatibleVerticals: ['accommodation']
                })
                .returning({ id: addonProducts.id });
            if (!product) throw new Error('Missing addon product');

            const ownIds: string[] = [];
            const liveIds: string[] = [];
            for (const status of [
                'PENDING_AUTHORIZATION',
                'ACTIVE',
                'ABANDONED',
                'EXPIRED',
                'CANCELLED'
            ]) {
                const [instance] = await tx
                    .insert(addonInstances)
                    .values({
                        productId: product.id,
                        addonVersionId: version.id,
                        ownerId: owner.id,
                        status,
                        orderRequestId: crypto.randomUUID()
                    })
                    .returning({ id: addonInstances.id });
                if (!instance) throw new Error('Missing addon instance');
                ownIds.push(instance.id);
                if (status === 'PENDING_AUTHORIZATION' || status === 'ACTIVE')
                    liveIds.push(instance.id);
            }

            const own = new Set(ownIds);
            const page = await reconciliationInventoryModel.listLiveAddonInstanceIdsPage({
                limit: 10_000,
                tx
            });
            expect(page.filter(({ id }) => own.has(id))).toEqual(
                liveIds.sort().map((id) => ({ id }))
            );

            const cursor = liveIds[0];
            if (!cursor) throw new Error('Missing live instance');
            const after = await reconciliationInventoryModel.listLiveAddonInstanceIdsPage({
                afterInstanceId: cursor,
                limit: 10_000,
                tx
            });
            expect(after.filter(({ id }) => own.has(id))).toEqual([{ id: liveIds[1] }]);
            expect(
                (await reconciliationInventoryModel.listLiveAddonInstanceIdsPage({ limit: 1, tx }))
                    .length
            ).toBe(1);
        });
    });
});
