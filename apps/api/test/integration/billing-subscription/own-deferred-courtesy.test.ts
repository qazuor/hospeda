import {
    billingOptions,
    courtesyGrants,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, NOW, routeClock } from './self-cancel-fixtures';

const listPath = '/api/v1/protected/billing-subscription/';
const clock = routeClock();
let app: ReturnType<typeof initApp>;
const created = {
    users: [] as string[],
    plans: [] as string[],
    planVersions: [] as string[],
    billingOptions: [] as string[],
    subscriptions: [] as string[],
    courtesyGrants: [] as string[]
};

async function seedUser(label: string): Promise<string> {
    const [row] = await getDb()
        .insert(users)
        .values({
            email: `hos1620-${label}-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1620 courtesy test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!row) throw new Error('Expected test user');
    created.users.push(row.id);
    return row.id;
}

async function seedPlan(vertical: VerticalEnum) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `hos1620-${crypto.randomUUID()}`,
            name: 'HOS-1620 test plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    created.plans.push(plan.id);
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    created.planVersions.push(version.id);
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    created.billingOptions.push(option.id);
    return { planVersionId: version.id, billingOptionId: option.id };
}

async function seedGrant(input: {
    readonly beneficiaryUserId: string;
    readonly plan: Awaited<ReturnType<typeof seedPlan>>;
    readonly vertical: VerticalEnum;
    readonly balanceMonths: number | null;
    readonly closed?: boolean;
}) {
    const db = getDb();
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: input.beneficiaryUserId,
            vertical: input.vertical,
            planVersionId: input.plan.planVersionId,
            billingOptionId: input.plan.billingOptionId,
            paymentMethod: 'CARD',
            status: 'CANCELLED',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected cancelled principal subscription');
    created.subscriptions.push(subscription.id);
    const [grant] = await db
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: input.beneficiaryUserId,
            grantedBy: input.beneficiaryUserId,
            subscriptionId: subscription.id,
            months: 6,
            startsAt: NOW,
            endsAt: new Date('2027-10-05T12:00:00.000Z'),
            reason: 'HOS-1620 deferred courtesy read test',
            balanceMonths: input.balanceMonths,
            balanceClosedAt: input.closed ? NOW : null,
            closeReason: input.closed ? 'VENTANA_DE_AUTORIZACION_VENCIDA' : null
        })
        .returning({ id: courtesyGrants.id });
    if (!grant) throw new Error('Expected courtesy grant');
    created.courtesyGrants.push(grant.id);
    return grant.id;
}

async function retireRows(): Promise<void> {
    const db = getDb();
    if (created.courtesyGrants.length)
        await db.delete(courtesyGrants).where(inArray(courtesyGrants.id, created.courtesyGrants));
    if (created.subscriptions.length)
        await db.delete(subscriptions).where(inArray(subscriptions.id, created.subscriptions));
    if (created.billingOptions.length)
        await db.delete(billingOptions).where(inArray(billingOptions.id, created.billingOptions));
    // Plan versions are immutable catalog rows; their fixture rows remain in the test database.
    if (created.users.length) await db.delete(users).where(inArray(users.id, created.users));
    Object.values(created).forEach((ids) => {
        ids.length = 0;
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock });
});
afterEach(retireRows);
afterAll(async () => {
    await retireRows();
    await testDb.teardown();
});

describe('TEST:1620:1 deferred courtesy list for Mi Suscripción', () => {
    it('returns only unclosed non-null balances for this beneficiary with each subscription vertical', async () => {
        clock.set(NOW);
        const ownerId = await seedUser('owner');
        const otherId = await seedUser('other');
        const accommodation = await seedPlan(VerticalEnum.ACCOMMODATION);
        const gastronomy = await seedPlan(VerticalEnum.VENUE);
        const visibleAccommodationId = await seedGrant({
            beneficiaryUserId: ownerId,
            plan: accommodation,
            vertical: VerticalEnum.ACCOMMODATION,
            balanceMonths: 3
        });
        const closedId = await seedGrant({
            beneficiaryUserId: ownerId,
            plan: accommodation,
            vertical: VerticalEnum.ACCOMMODATION,
            balanceMonths: 2,
            closed: true
        });
        const currentId = await seedGrant({
            beneficiaryUserId: ownerId,
            plan: accommodation,
            vertical: VerticalEnum.ACCOMMODATION,
            balanceMonths: null
        });
        const foreignId = await seedGrant({
            beneficiaryUserId: otherId,
            plan: accommodation,
            vertical: VerticalEnum.ACCOMMODATION,
            balanceMonths: 4
        });
        const visibleGastronomyId = await seedGrant({
            beneficiaryUserId: ownerId,
            plan: gastronomy,
            vertical: VerticalEnum.VENUE,
            balanceMonths: 5
        });

        const response = await app.request(listPath, {
            headers: actorHeaders({
                id: ownerId,
                role: 'USER',
                permissions: [PermissionEnum.BILLING_VIEW_OWN]
            })
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            data: {
                deferredCourtesies: Array<{
                    courtesyGrantId: string;
                    vertical: string;
                    balanceMonths: number;
                }>;
            };
        };
        expect(body.data.deferredCourtesies).toEqual([
            {
                courtesyGrantId: visibleAccommodationId,
                vertical: VerticalEnum.ACCOMMODATION,
                balanceMonths: 3
            },
            {
                courtesyGrantId: visibleGastronomyId,
                vertical: VerticalEnum.VENUE,
                balanceMonths: 5
            }
        ]);
        expect(body.data.deferredCourtesies.map((item) => item.courtesyGrantId)).not.toContain(
            closedId
        );
        expect(body.data.deferredCourtesies.map((item) => item.courtesyGrantId)).not.toContain(
            currentId
        );
        expect(body.data.deferredCourtesies.map((item) => item.courtesyGrantId)).not.toContain(
            foreignId
        );
    });

    it('requires a session', async () => {
        const response = await app.request(listPath, { headers: actorHeaders() });
        expect(response.status).toBe(401);
    });
});
