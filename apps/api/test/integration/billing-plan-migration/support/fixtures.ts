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
import { publishPlanVersion, setCyclePrice } from '@repo/service-core';
import { startPriceCustomer } from '../../billing-price/cycle-price-fixtures.js';
import { ensureBillingDeadlineVersion1 } from '../../helpers/billing-deadline-version.js';
import { insertPlan, insertVersion } from '../../plan-publication/plan-publication.helpers.js';

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
    const actor = {
        id: actorUser.id,
        roles: [],
        permissions: [
            PermissionEnum.BILLING_MIGRATE_PLAN,
            PermissionEnum.BILLING_SET_CYCLE_PRICE,
            PermissionEnum.MAINTENANCE_MODE_WRITE
        ]
    };
    const sourcePlanId = await insertPlan({
        vertical: 'accommodation',
        slug: `migration-source-${crypto.randomUUID()}`
    });
    const sourceId = await insertVersion({
        planId: sourcePlanId,
        vertical: 'accommodation',
        rank: 100,
        sellable: true,
        current: true,
        limits: [{ key: 'max_photos_per_accommodation', value: 10 }]
    });
    const sourcePrice = await setCyclePrice({
        actor,
        input: {
            planVersionId: sourceId,
            cycle: 'monthly',
            amount: 250000,
            expectedPreviousAmount: null,
            confirmed: true
        },
        correlationId: crypto.randomUUID()
    });
    const customer = await startPriceCustomer({
        billingOptionId: sourcePrice.billingOption.id,
        name: 'migration-route',
        activate: true
    });
    customers.push(customer);
    const retired = await publishPlanVersion({
        actor,
        planId: sourcePlanId,
        content: {
            rank: 100,
            sellable: false,
            trialDays: 0,
            graceDays: 5,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [],
            limits: [{ key: 'max_photos_per_accommodation', value: 10 }]
        }
    });
    const target = async (limit: number, amount: number) => {
        const planId = await insertPlan({
            vertical: 'accommodation',
            slug: `migration-target-${crypto.randomUUID()}`
        });
        const rank = Math.floor(Math.random() * 1_000_000_000) + 1000;
        // The seed is a starting catalog row; action 18 publishes the saleable destination.
        await insertVersion({
            planId,
            vertical: 'accommodation',
            rank,
            sellable: false,
            current: true
        });
        const version = await publishPlanVersion({
            actor,
            planId,
            content: {
                rank,
                sellable: true,
                trialDays: 0,
                graceDays: 5,
                allowsPause: true,
                inheritsTouristVip: false,
                entitlements: [],
                limits: [{ key: 'max_photos_per_accommodation', value: limit }]
            }
        });
        await setCyclePrice({
            actor,
            input: {
                planVersionId: version.id,
                cycle: 'monthly',
                amount,
                expectedPreviousAmount: null,
                confirmed: true
            },
            correlationId: crypto.randomUUID()
        });
        return version.id;
    };
    const upId = await target(20, 300000);
    const downId = await target(5, 200000);
    return { actorId: actor.id, sourceId, retiredId: retired.id, upId, downId, customer };
}

/** Remember a launch for ID-scoped cleanup. */
export function trackMigration(id: string) {
    migrations.push(id);
}

/** Remove mutable rows by ID; immutable catalog versions remain. */
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
}
