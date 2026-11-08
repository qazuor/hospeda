import {
    addonInstances,
    eq,
    getDb,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    plans,
    planVersions,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { grantPermanentGrant } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { injectAddonPurchaseListingForTests } from '../../../src/routes/billing-addon/purchase-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    ownerHeaders,
    ownerInstances,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes
} from './support/addon-purchase-route-fixtures';

const path = '/api/v1/protected/billing/addons/free-choices';
const admins: string[] = [];
const grants: string[] = [];
const owners: string[] = [];

async function grant(
    ownerId: string,
    fake: ReturnType<typeof purchaseApp>['fake'],
    includesAddons = true
) {
    const db = getDb();
    const [admin] = await db
        .insert(users)
        .values({
            email: `free-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Grant signer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!admin) throw new Error('Admin fixture missing');
    admins.push(admin.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `free-${crypto.randomUUID()}`,
            name: 'Free floor'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Plan fixture missing');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: false,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Version fixture missing');
    const ports = {
        planPolicy: async () => ({
            graceDays: 0,
            allowsPause: false,
            current: true,
            sellable: false
        }),
        clock: { now: () => new Date() },
        provider: fake,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: async () => {
                throw new Error('No existing addon');
            },
            listing: async () => {
                throw new Error('No listing');
            }
        }
    };
    const result = await grantPermanentGrant(
        {
            beneficiaryUserId: ownerId,
            actor: {
                id: admin.id,
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            },
            reason: 'Free route fixture',
            includesAddons,
            anchors: [
                {
                    vertical: VerticalEnum.ACCOMMODATION,
                    planId: plan.id,
                    floorPlanVersionId: version.id
                }
            ]
        },
        ports
    );
    grants.push(result.permanentGrantId);
    owners.push(ownerId);
    return result;
}

const post = (app: ReturnType<typeof purchaseApp>['app'], ownerId: string, body: object) =>
    app.request(path, {
        method: 'POST',
        headers: ownerHeaders(ownerId),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
afterEach(async () => {
    await retirePurchaseRoutes();
    if (owners.length) {
        await getDb().delete(addonInstances).where(inArray(addonInstances.ownerId, owners));
        owners.length = 0;
    }
    if (grants.length) {
        await getDb()
            .delete(permanentGrantVerticals)
            .where(inArray(permanentGrantVerticals.permanentGrantId, grants));
        await getDb().delete(permanentGrants).where(inArray(permanentGrants.id, grants));
        grants.length = 0;
    }
    if (admins.length) {
        await getDb().delete(users).where(inArray(users.id, admins));
        admins.length = 0;
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:B10:14 TEST:B10:15 protected free choice route', () => {
    it('returns 201 ACTIVE, then 200 EXISTING with the same id and no provider authorization', async () => {
        const f = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await grant(f.ownerId, fake);
        const authorize = vi.spyOn(fake, 'authorize');
        const body = {
            productId: f.productId,
            addonVersionId: f.versionId,
            targetId: null,
            orderRequestId: crypto.randomUUID()
        };
        const created = await post(app, f.ownerId, body);
        expect(created.status).toBe(201);
        const data = (await created.json()).data;
        expect(data).toMatchObject({ outcome: 'CREATED', status: 'ACTIVE' });
        const replay = await post(app, f.ownerId, body);
        expect(replay.status).toBe(200);
        expect((await replay.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: data.instanceId
        });
        const differentOrder = await post(app, f.ownerId, {
            ...body,
            orderRequestId: crypto.randomUUID()
        });
        expect(differentOrder.status).toBe(200);
        expect((await differentOrder.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: data.instanceId
        });
        expect(await ownerInstances(f.ownerId)).toHaveLength(1);
        expect(authorize).toHaveBeenCalledTimes(0);
    });

    it('returns 401 without session and 409 without a free title', async () => {
        const f = await purchaseCatalog({});
        const { app } = purchaseApp();
        const body = {
            productId: f.productId,
            addonVersionId: f.versionId,
            targetId: null,
            orderRequestId: crypto.randomUUID()
        };
        const guest = await app.request(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });
        expect(guest.status).toBe(401);
        const refused = await post(app, f.ownerId, body);
        expect(refused.status).toBe(409);
        expect(await refused.json()).toMatchObject({ error: { code: 'ADDON_NO_FREE_TITLE' } });
    });

    it('returns 404 for another owner listing and creates no instance', async () => {
        const f = await purchaseCatalog({ scopeType: 'LISTING' });
        const { app, fake } = purchaseApp();
        await grant(f.ownerId, fake);
        injectAddonPurchaseListingForTests({
            listing: async () => ({
                ownerId: crypto.randomUUID(),
                vertical: VerticalEnum.ACCOMMODATION,
                acceptsFeature: true
            })
        });
        const body = {
            productId: f.productId,
            addonVersionId: f.versionId,
            targetId: crypto.randomUUID(),
            orderRequestId: crypto.randomUUID()
        };
        const response = await post(app, f.ownerId, body);
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ error: { code: 'ADDON_TARGET_NOT_FOUND' } });
        expect(await ownerInstances(f.ownerId)).toHaveLength(0);
    });

    it('paid purchase refuses FREE_UNDER_GRANT before opening an order', async () => {
        const f = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await grant(f.ownerId, fake);
        const authorize = vi.spyOn(fake, 'authorize');
        const response = await post(app, f.ownerId, f.request());
        expect(response.status).toBe(400);
        const paid = await app.request('/api/v1/protected/billing/addons/purchases', {
            method: 'POST',
            headers: ownerHeaders(f.ownerId),
            body: JSON.stringify(f.request())
        });
        expect(paid.status).toBe(409);
        expect(await paid.json()).toMatchObject({ error: { code: 'ADDON_FREE_UNDER_GRANT' } });
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(
            await getDb().select().from(addonInstances).where(eq(addonInstances.ownerId, f.ownerId))
        ).toHaveLength(0);
    });
});
