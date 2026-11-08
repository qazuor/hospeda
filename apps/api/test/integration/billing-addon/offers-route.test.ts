import {
    addonInstances,
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
import { testDb } from '../../e2e/setup/test-database';
import {
    makePayingPrincipal,
    ownerHeaders,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes
} from './support/addon-purchase-route-fixtures';

const offersPath = '/api/v1/protected/billing/addons/offers';
const purchasesPath = '/api/v1/protected/billing/addons/purchases';
const grants: string[] = [];
const admins: string[] = [];
const owners: string[] = [];

async function addGrant(input: {
    readonly ownerId: string;
    readonly fake: ReturnType<typeof purchaseApp>['fake'];
    readonly includesAddons: boolean;
}): Promise<void> {
    const db = getDb();
    const [admin] = await db
        .insert(users)
        .values({
            email: `offers-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Offers grant signer',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!admin) throw new Error('Missing admin');
    admins.push(admin.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `offers-${crypto.randomUUID()}`,
            name: 'Offers floor'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Missing plan');
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
    if (!version) throw new Error('Missing version');
    const result = await grantPermanentGrant(
        {
            beneficiaryUserId: input.ownerId,
            actor: {
                id: admin.id,
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            },
            reason: 'Offers route fixture',
            includesAddons: input.includesAddons,
            anchors: [
                {
                    vertical: VerticalEnum.ACCOMMODATION,
                    planId: plan.id,
                    floorPlanVersionId: version.id
                }
            ]
        },
        {
            planPolicy: async () => ({
                graceDays: 0,
                allowsPause: false,
                current: true,
                sellable: false
            }),
            clock: { now: () => new Date() },
            provider: input.fake,
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
        }
    );
    grants.push(result.permanentGrantId);
    owners.push(input.ownerId);
}

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

describe('AC:B10:11 TEST:B10:13 owner addon offers and return URL', () => {
    it('requires a session for offers', async () => {
        const { app } = purchaseApp();
        const response = await app.request(offersPath, { headers: { 'user-agent': 'vitest' } });
        expect(response.status).toBe(401);
    });

    it.each([
        true,
        false
    ])('reads policy and includes-addons=%s for the seeded owner', async (includesAddons) => {
        // The immutable addon version is seeded; the grant is created by the real service.
        const fixture = await purchaseCatalog({ scopeType: 'LISTING' });
        const { app, fake } = purchaseApp();
        await addGrant({ ownerId: fixture.ownerId, fake, includesAddons });
        const response = await app.request(offersPath, { headers: ownerHeaders(fixture.ownerId) });
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data.items).toContainEqual(
            expect.objectContaining({
                productId: fixture.productId,
                addonVersionId: fixture.versionId,
                name: 'Route addon',
                scopeType: 'LISTING',
                validity: 'FIXED_DAYS',
                validityDays: 30,
                freeUnderGrantVerticals: includesAddons ? ['accommodation'] : []
            })
        );
    });

    it('has no free vertical without a grant', async () => {
        const fixture = await purchaseCatalog({});
        const { app } = purchaseApp();
        const response = await app.request(offersPath, { headers: ownerHeaders(fixture.ownerId) });
        expect(response.status).toBe(200);
        expect((await response.json()).data.items).toContainEqual(
            expect.objectContaining({
                productId: fixture.productId,
                freeUnderGrantVerticals: []
            })
        );
    });

    it('never reads another owner grant as a free choice', async () => {
        const granted = await purchaseCatalog({});
        const other = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await addGrant({ ownerId: granted.ownerId, fake, includesAddons: true });
        const response = await app.request(offersPath, { headers: ownerHeaders(other.ownerId) });
        expect(response.status).toBe(200);
        expect((await response.json()).data.items).toContainEqual(
            expect.objectContaining({
                productId: other.productId,
                freeUnderGrantVerticals: []
            })
        );
    });

    it('sends the English return URL to the fake recurring authorization', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const body = fixture.request();
        const response = await app.request(purchasesPath, {
            method: 'POST',
            headers: { ...ownerHeaders(fixture.ownerId), 'X-Client-Locale': 'en' },
            body: JSON.stringify(body)
        });
        expect(response.status).toBe(201);
        expect(authorize).toHaveBeenCalledWith(
            expect.objectContaining({
                returnUrl: expect.stringMatching(
                    new RegExp(`/en/mi-cuenta/complementos/\\?compra=${body.orderRequestId}$`)
                )
            })
        );
    });
});
