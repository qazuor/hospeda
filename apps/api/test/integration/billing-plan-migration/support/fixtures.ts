import {
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { initApp } from '../../../../src/app.js';
import {
    actorHeaders,
    PRICE_PATH,
    startPriceCustomer
} from '../../billing-price/cycle-price-fixtures.js';
import { ensureBillingDeadlineVersion1 } from '../../helpers/billing-deadline-version.js';
import {
    insertPlan,
    insertVersion,
    publishBody,
    publishUrl,
    restoreProductionPlanCatalog
} from '../../plan-publication/plan-publication.helpers.js';

export const path = '/api/v1/admin/plan-migrations';
const migrations: string[] = [];
const customers: Array<{ userId: string; subscriptionId: string }> = [];
const actorIds: string[] = [];

/** Headers for the real seeded actor under the API mock-auth bridge. */
export function headers(actorId: string, allowed = true) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': allowed ? 'SUPER_ADMIN' : 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(
            allowed
                ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_MIGRATE_PLAN]
                : [PermissionEnum.ACCESS_PANEL_ADMIN]
        )
    };
}

/** Build the starting catalog manually, then use actions 18 and 19 for its transitions. */
export async function migrationCase() {
    await ensureBillingDeadlineVersion1();
    const app = initApp();
    const [actorUser] = await getDb()
        .insert(users)
        .values({
            email: `migration-route-${crypto.randomUUID()}@example.test`,
            displayName: 'Migration actor',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!actorUser) throw new Error('Missing actor');
    actorIds.push(actorUser.id);
    const postAdmin = async (
        url: string,
        body: Record<string, unknown>,
        expectedStatus: number
    ) => {
        const response = await app.request(url, {
            method: 'POST',
            headers: actorHeaders(actorUser.id),
            body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (response.status !== expectedStatus) throw new Error(JSON.stringify(payload));
        return payload.data;
    };
    const publish = async (planId: string, content: Record<string, unknown>) =>
        postAdmin(publishUrl({ planId }), JSON.parse(publishBody({ overrides: content })), 201);
    const setPrice = async (planVersionId: string, amount: number) =>
        postAdmin(
            PRICE_PATH,
            {
                planVersionId,
                cycle: 'monthly',
                amount,
                expectedPreviousAmount: null,
                confirmed: true
            },
            200
        );
    const rankBase = 1_000_000_000 + Math.floor(Math.random() * 100_000_000) * 3;
    const sourcePlanId = await insertPlan({
        vertical: 'accommodation',
        slug: `migration-source-${crypto.randomUUID()}`
    });
    const sourceId = await insertVersion({
        planId: sourcePlanId,
        vertical: 'accommodation',
        rank: rankBase,
        sellable: true,
        current: true,
        limits: [{ key: 'max_photos_per_accommodation', value: 10 }]
    });
    const sourcePrice = await setPrice(sourceId, 250000);
    const customer = await startPriceCustomer({
        billingOptionId: sourcePrice.billingOption.id,
        name: 'migration-route',
        activate: true
    });
    customers.push(customer);
    const retired = await publish(sourcePlanId, {
        rank: rankBase,
        sellable: false,
        trialDays: 0,
        graceDays: 5,
        allowsPause: true,
        inheritsTouristVip: false,
        entitlements: [],
        limits: [{ key: 'max_photos_per_accommodation', value: 10 }]
    });
    const target = async (limit: number, amount: number, rank: number) => {
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: `migration-target-${crypto.randomUUID()}`
        });
        // The seed is a starting catalog row; action 18 publishes the saleable destination.
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank,
            sellable: false,
            current: true
        });
        const version = await publish(planId, {
            rank,
            sellable: true,
            trialDays: 0,
            graceDays: 5,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [],
            limits: [{ key: 'max_photos_per_accommodation', value: limit }]
        });
        await setPrice(version.id, amount);
        return version.id;
    };
    const upId = await target(20, 300000, rankBase + 1);
    const downId = await target(5, 200000, rankBase + 2);
    return { actorId: actorUser.id, sourceId, retiredId: retired.id, upId, downId, customer };
}

/** Remember a launch for ID-scoped cleanup. */
export function trackMigration(id: string) {
    migrations.push(id);
}

/** Remove the case's rows and restore the migration-owned catalog. */
export async function cleanup() {
    for (const id of migrations.splice(0)) {
        await getDb()
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await getDb().delete(planMigrations).where(eq(planMigrations.id, id));
    }
    for (const customer of customers.splice(0)) {
        await getDb()
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await getDb().delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await getDb().delete(users).where(eq(users.id, customer.userId));
    }
    for (const id of actorIds.splice(0)) await getDb().delete(users).where(eq(users.id, id));
    await restoreProductionPlanCatalog();
}
