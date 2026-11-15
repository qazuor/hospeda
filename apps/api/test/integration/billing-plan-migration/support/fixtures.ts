import {
    emailOutbox,
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    plans,
    planVersionLimits,
    planVersions,
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
import { restoreProductionPlanCatalog } from '../../plan-publication/plan-publication.helpers.js';

export const path = '/api/v1/admin/plan-migrations';
const migrations: string[] = [];
const customers: Array<{ userId: string; subscriptionId: string }> = [];
const actorIds: string[] = [];

/** Make the initial current version visible at the same time as its plan. */
async function insertCurrentPlan(args: {
    readonly slug: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly limit?: number;
}) {
    return getDb().transaction(async (tx) => {
        const [plan] = await tx
            .insert(plans)
            .values({ vertical: 'accommodation', slug: args.slug, name: `Plan ${args.slug}` })
            .returning({ id: plans.id });
        if (!plan) throw new Error('Missing plan');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: args.rank,
                sellable: args.sellable,
                current: true,
                trialDays: 0,
                graceDays: 5,
                allowsPause: true,
                inheritsTouristVip: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Missing initial version');
        if (args.limit !== undefined)
            await tx.insert(planVersionLimits).values({
                planVersionId: version.id,
                key: 'max_photos_per_accommodation',
                value: args.limit
            });
        return { planId: plan.id, versionId: version.id };
    });
}

/** Retire a plan without validating unrelated preserved catalog rows. */
async function insertRetiredVersion(args: {
    readonly planId: string;
    readonly previousVersionId: string;
    readonly rank: number;
}) {
    return getDb().transaction(async (tx) => {
        await tx
            .update(planVersions)
            .set({ current: false })
            .where(eq(planVersions.id, args.previousVersionId));
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: args.planId,
                vertical: 'accommodation',
                rank: args.rank,
                sellable: false,
                current: true,
                trialDays: 0,
                graceDays: 5,
                allowsPause: true,
                inheritsTouristVip: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Missing retired version');
        await tx.insert(planVersionLimits).values({
            planVersionId: version.id,
            key: 'max_photos_per_accommodation',
            value: 10
        });
        return version.id;
    });
}

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

/** Build the catalog directly, then exercise migration routes with real HTTP requests. */
export async function migrationCase(args: { readonly withUnresolved?: boolean } = {}) {
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
    const setPrice = async (planVersionId: string, amount: number, cycle = 'monthly') =>
        postAdmin(
            PRICE_PATH,
            {
                planVersionId,
                cycle,
                amount,
                expectedPreviousAmount: null,
                confirmed: true
            },
            200
        );
    const rankBase = 1_000_000_000 + Math.floor(Math.random() * 100_000_000) * 3;
    const source = await insertCurrentPlan({
        slug: `migration-source-${crypto.randomUUID()}`,
        rank: rankBase,
        sellable: true,
        limit: 10
    });
    const sourcePlanId = source.planId;
    const sourceId = source.versionId;
    const sourcePrice = await setPrice(sourceId, 250000);
    const annualPrice = args.withUnresolved
        ? await setPrice(sourceId, 3000000, 'annual')
        : undefined;
    const customer = await startPriceCustomer({
        billingOptionId: sourcePrice.billingOption.id,
        name: 'migration-route',
        activate: true
    });
    customers.push(customer);
    let unresolvedCustomer: typeof customer | undefined;
    if (annualPrice) {
        unresolvedCustomer = await startPriceCustomer({
            billingOptionId: annualPrice.billingOption.id,
            name: 'migration-unresolved',
            activate: true
        });
        customers.push(unresolvedCustomer);
    }
    const retiredId = await insertRetiredVersion({
        planId: sourcePlanId,
        previousVersionId: sourceId,
        rank: rankBase
    });
    const target = async (limit: number, amount: number, rank: number) => {
        const { versionId } = await insertCurrentPlan({
            slug: `migration-target-${crypto.randomUUID()}`,
            rank,
            sellable: true,
            limit
        });
        await setPrice(versionId, amount);
        return versionId;
    };
    const upId = await target(20, 300000, rankBase + 1);
    const downId = await target(5, 200000, rankBase + 2);
    return {
        actorId: actorUser.id,
        sourceId,
        retiredId,
        upId,
        downId,
        customer,
        unresolvedCustomer
    };
}

/** Announce a migration through the real preview and launch routes. */
export async function launchMigrationCase(args: {
    readonly actorId: string;
    readonly sourceId: string;
    readonly targetId: string;
}) {
    const app = initApp();
    const preview = await app.request(`${path}/preview`, {
        method: 'POST',
        headers: headers(args.actorId),
        body: JSON.stringify({
            sourcePlanVersionId: args.sourceId,
            targetPlanVersionId: args.targetId
        })
    });
    const previewPayload = await preview.json();
    if (preview.status !== 200) throw new Error(JSON.stringify(previewPayload));
    const launch = await app.request(path, {
        method: 'POST',
        headers: headers(args.actorId),
        body: JSON.stringify({
            sourcePlanVersionId: args.sourceId,
            targetPlanVersionId: args.targetId,
            cohortFingerprint: previewPayload.data.cohortFingerprint
        })
    });
    const launchPayload = await launch.json();
    if (launch.status !== 200) throw new Error(JSON.stringify(launchPayload));
    const id: string = launchPayload.data.planMigrationId;
    trackMigration(id);
    return id;
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
        await getDb().delete(emailOutbox).where(eq(emailOutbox.recipientUserId, customer.userId));
        await getDb()
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await getDb().delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await getDb().delete(users).where(eq(users.id, customer.userId));
    }
    for (const id of actorIds.splice(0)) await getDb().delete(users).where(eq(users.id, id));
    await restoreProductionPlanCatalog();
}
