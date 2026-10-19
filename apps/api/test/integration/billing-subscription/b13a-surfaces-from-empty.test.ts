import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    billingDeadlineVersions,
    courtesyGrants,
    eq,
    getDb,
    promoRedemptions,
    sql,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import {
    type BillingDeadlineValues,
    OwnSubscriptionsResponseSchema,
    PermissionEnum,
    PricingSituationResponseSchema,
    PublicPlanCatalogResponseSchema,
    ReconciliationMarkListResponseSchema,
    SubscriptionCancellationPreviewResponseSchema
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    seedSelfActive,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = new FakePaymentProvider({ clock, idNamespace: randomUUID() });
const minePath = '/api/v1/protected/billing-subscription';
const pricingPath = `${minePath}/pricing-situation/accommodation`;
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;
const ensureBillingDeadlineVersion1 = async () => {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
};
const userHeaders = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
let app: ReturnType<typeof initApp>;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(async () => {
    clock.set(NOW);
    await ensureBillingDeadlineVersion1();
});
afterEach(async () => retireSelfCancelRows());
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

describe('TEST:B13a:16 — the B13a surfaces read on a database built from empty, with empty enumerations (AC:B13a:15)', () => {
    it('(a) the surface tables exist after the empty database migrations', async () => {
        const tableNames = [
            'subscription',
            'plan_version',
            'billing_option',
            'courtesy_grant',
            'addon_instance',
            'promo_redemption',
            'reconciliation_mark',
            'email_outbox'
        ];
        const relations = await Promise.all(
            tableNames.map(async (table) => {
                const result = await getDb().execute<{ relation: string | null }>(
                    sql`SELECT to_regclass(${`public.${table}`})::text AS relation`
                );
                return { table, relation: result.rows[0]?.relation ?? null };
            })
        );
        const present = relations
            .filter(({ relation }) => relation !== null)
            .map(({ table }) => table);
        const missing = relations
            .filter(({ relation }) => relation === null)
            .map(({ table }) => table);
        expect(present).toEqual(tableNames);
        expect(missing, `missing migrated tables: ${missing.join(', ')}`).toEqual([]);
    });

    it('(b) first use reads empty Mi Suscripción and pricing through their protected routes', async () => {
        const ownerId = await seedUser('b13a-empty-first-use');
        const mine = await app.request(minePath, { headers: userHeaders(ownerId) });
        expect(mine.status).toBe(200);
        const mineBody = OwnSubscriptionsResponseSchema.parse((await mine.json()).data);
        expect(mineBody.subscriptions).toEqual([]);
        expect(mineBody.deferredCourtesies).toEqual([]);

        const pricing = await app.request(pricingPath, { headers: userHeaders(ownerId) });
        expect(pricing.status).toBe(200);
        expect(PricingSituationResponseSchema.parse((await pricing.json()).data)).toEqual({
            situation: 'FIRST_USE',
            trialDays: 30
        });
    });

    it('(c) an active payer has no addons, courtesies or promos and reads cancellation preview', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const db = getDb();
        const [subscription] = await db
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(subscription).toEqual({ id: seeded.subscriptionId, status: 'ACTIVE' });

        const counts = await Promise.all([
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(addonInstances)
                .where(eq(addonInstances.ownerId, seeded.ownerId)),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(courtesyGrants)
                .where(eq(courtesyGrants.beneficiaryUserId, seeded.ownerId)),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.userId, seeded.ownerId))
        ]);
        const emptyCounts = [
            { table: 'addon_instance', count: counts[0][0]?.count ?? -1 },
            { table: 'courtesy_grant', count: counts[1][0]?.count ?? -1 },
            { table: 'promo_redemption', count: counts[2][0]?.count ?? -1 }
        ];
        expect(emptyCounts).toEqual([
            { table: 'addon_instance', count: 0 },
            { table: 'courtesy_grant', count: 0 },
            { table: 'promo_redemption', count: 0 }
        ]);

        const mine = await app.request(minePath, { headers: userHeaders(seeded.ownerId) });
        expect(mine.status).toBe(200);
        const mineBody = OwnSubscriptionsResponseSchema.parse((await mine.json()).data);
        expect(mineBody.subscriptions.map(({ id }) => id)).toEqual([seeded.subscriptionId]);
        expect(mineBody.deferredCourtesies).toEqual([]);

        const preview = await app.request(
            `${minePath}/${seeded.subscriptionId}/cancellation-preview`,
            {
                headers: userHeaders(seeded.ownerId)
            }
        );
        expect(preview.status).toBe(200);
        const previewBody = SubscriptionCancellationPreviewResponseSchema.parse(
            (await preview.json()).data
        );
        expect(previewBody.origin).toBe('ACTIVE');
        expect(previewBody.addons).toEqual([]);

        const pricing = await app.request(pricingPath, { headers: userHeaders(seeded.ownerId) });
        expect(pricing.status).toBe(200);
        expect(PricingSituationResponseSchema.parse((await pricing.json()).data)).toMatchObject({
            situation: 'SUBSCRIBED',
            status: 'ACTIVE',
            planVersionId: expect.any(String),
            billingOptionId: expect.any(String)
        });
    });

    it('(d) public pricing catalogs parse for all supported verticals without a session', async () => {
        for (const vertical of ['accommodation', 'gastronomy', 'experience', 'tourist'] as const) {
            const response = await app.request(`/api/v1/public/plan-catalog?vertical=${vertical}`, {
                headers: { 'user-agent': 'vitest' }
            });
            expect(response.status, await response.clone().text()).toBe(200);
            expect(
                PublicPlanCatalogResponseSchema.parse((await response.json()).data).vertical
            ).toBe(vertical);
        }
    });

    it('(e) the actionable list parses and has no marks for the seeded subject', async () => {
        const seeded = await seedSelfActive(fake, clock);
        const adminId = await seedUser('b13a-empty-inspect-admin');
        const response = await app.request(
            '/api/v1/admin/billing-reconciliation/marks?page=1&pageSize=50',
            {
                headers: actorHeaders({
                    id: adminId,
                    role: 'SUPER_ADMIN',
                    permissions: [
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                    ]
                })
            }
        );
        expect(response.status).toBe(200);
        const body = ReconciliationMarkListResponseSchema.parse((await response.json()).data);
        expect(typeof body.pagination.total).toBe('number');
        expect(body.items.filter(({ subject }) => subject.id === seeded.subscriptionId)).toEqual(
            []
        );
        expect(await dbSubscriptionExists(seeded.subscriptionId)).toBe(true);
    });
});

async function dbSubscriptionExists(subscriptionId: string): Promise<boolean> {
    const [row] = await getDb()
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.id === subscriptionId;
}
