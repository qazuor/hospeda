import { addonProducts, addons, addonVersions, eq, getDb, users } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';

const base = '/api/v1/admin/billing-addon-products';
const actors: string[] = [];
const products: string[] = [];
let app: ReturnType<typeof initApp>;

function headers(input: { readonly id: string; readonly allowed: boolean }) {
    return {
        'user-agent': 'vitest',
        'x-mock-actor-id': input.id,
        'x-mock-actor-role': input.allowed ? 'SUPER_ADMIN' : 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(
            input.allowed
                ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
                : [PermissionEnum.ACCESS_PANEL_ADMIN]
        )
    };
}

async function actorId() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `addon-retire-${crypto.randomUUID()}@example.test`,
            displayName: 'Retirement actor',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Actor missing');
    actors.push(user.id);
    return user.id;
}

async function productId() {
    // Catalog rows are seeded because the action 20 route is the subject of this test.
    const [addon] = await getDb()
        .insert(addons)
        .values({
            slug: `retire-${crypto.randomUUID()}`,
            name: 'Retirement feature'
        })
        .returning({ id: addons.id });
    if (!addon) throw new Error('Addon missing');
    const [version] = await getDb()
        .insert(addonVersions)
        .values({
            addonId: addon.id,
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'USER'
        })
        .returning({ id: addonVersions.id });
    if (!version) throw new Error('Version missing');
    const [product] = await getDb()
        .insert(addonProducts)
        .values({
            addonId: addon.id,
            versionId: version.id,
            price: 5000,
            currency: 'ARS',
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            compatibleVerticals: ['accommodation']
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('Product missing');
    products.push(product.id);
    return product.id;
}

describe('TEST:B13b:3 AC:B13b:3 retiring an addon product through action 20', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(async () => {
        for (const id of products.splice(0))
            await getDb().delete(addonProducts).where(eq(addonProducts.id, id));
        for (const id of actors.splice(0)) await getDb().delete(users).where(eq(users.id, id));
    });
    afterAll(async () => testDb.teardown());

    it('returns 403 to ADMIN and 200 to SUPER_ADMIN for retirement and restoration', async () => {
        const id = await productId();
        const allowed = await actorId();
        const denied = await actorId();
        const path = `${base}/${id}/retirement`;
        for (const method of ['POST', 'DELETE'] as const) {
            const forbidden = await app.request(path, {
                method,
                headers: headers({ id: denied, allowed: false })
            });
            expect(forbidden.status).toBe(403);
            expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
        }
        const retired = await app.request(path, {
            method: 'POST',
            headers: headers({ id: allowed, allowed: true })
        });
        expect(retired.status).toBe(200);
        expect((await retired.json()).data).toEqual({
            productId: id,
            retiredAt: expect.any(String)
        });
        const read = await app.request(path, { headers: headers({ id: allowed, allowed: true }) });
        expect((await read.json()).data).toEqual({ productId: id, retiredAt: expect.any(String) });
        const restored = await app.request(path, {
            method: 'DELETE',
            headers: headers({ id: allowed, allowed: true })
        });
        expect(restored.status).toBe(200);
        expect((await restored.json()).data).toEqual({ productId: id, retiredAt: null });
    });
});
