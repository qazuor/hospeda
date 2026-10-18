import { randomUUID } from 'node:crypto';
import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { type BillingDeadlineValues, PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const situationPath = '/api/v1/protected/billing-subscription/pricing-situation';
const startPath = '/api/v1/protected/billing/subscriptions';
const refundPath = '/api/v1/admin/billing-refunds/external';
const chargePath = '/api/v1/admin/billing-refunds/external-charge';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const deadlineValues = {
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
const madeVersions: string[] = [];

async function seedUser() {
    const [row] = await getDb()
        .insert(users)
        .values({
            email: `hidden-operation-${randomUUID()}@example.test`,
            displayName: 'Hidden operation test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!row) throw new Error('Expected test user');
    return row.id;
}

async function seedOption(vertical: 'accommodation' | 'tourist', inheritsTouristVip = false) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `hidden-operation-${randomUUID()}`,
            name: 'Hidden operation plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: true,
            current: true,
            trialDays: 14,
            allowsPause: false,
            inheritsTouristVip
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected version');
    madeVersions.push(version.id);
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected option');
    return { planVersionId: version.id, billingOptionId: option.id };
}

function actorHeaders(actor: { id: string; role: string; permissions?: readonly string[] }) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions ?? [])
    };
}

function userHeaders(id: string) {
    return actorHeaders({ id, role: 'USER' });
}

const fake = new FakePaymentProvider({ clock, idNamespace: randomUUID() });
const app = initApp({ clock, paymentProvider: fake });

async function readSituation(userId: string, vertical: string) {
    const response = await app.request(`${situationPath}/${vertical}`, {
        headers: userHeaders(userId)
    });
    return { response, body: await response.json() };
}

async function postSignup(userId: string, billingOptionId: string) {
    return app.request(startPath, {
        method: 'POST',
        headers: userHeaders(userId),
        body: JSON.stringify({ billingOptionId })
    });
}

describe('TEST:B13a:12 hidden pricing and action 14 operations are rejected by the API', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await getDb()
            .insert(billingDeadlineVersions)
            .values({ version: 1, values: deadlineValues })
            .onConflictDoNothing();
    });

    afterAll(async () => {
        if (madeVersions.length) {
            await getDb()
                .update(planVersions)
                .set({ current: false })
                .where(inArray(planVersions.id, madeVersions));
        }
        await testDb.clean();
        await testDb.teardown();
    });

    it('TEST:B13a:12 (a) matches the hidden plan-change button with S1 COMMITMENT_TAKEN', async () => {
        const userId = await seedUser();
        const current = await seedOption('accommodation');
        const other = await seedOption('accommodation');
        await getDb().insert(subscriptions).values({
            userId,
            vertical: 'accommodation',
            planVersionId: current.planVersionId,
            billingOptionId: current.billingOptionId,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        });

        const visibleState = await readSituation(userId, 'accommodation');
        expect(visibleState.body.data).toMatchObject({
            situation: 'SUBSCRIBED',
            planVersionId: current.planVersionId
        });
        const hiddenOperation = await postSignup(userId, other.billingOptionId);
        expect(hiddenOperation.status).toBe(409);
        expect((await hiddenOperation.json()).error.reason).toBe('COMMITMENT_TAKEN');
    });

    it('TEST:B13a:12 (b) mirrors inherited VIP and admits the purchase after title cancellation', async () => {
        const userId = await seedUser();
        const title = await seedOption('accommodation', true);
        const vip = await seedOption('tourist');
        const [titleRow] = await getDb()
            .insert(subscriptions)
            .values({
                userId,
                vertical: 'accommodation',
                planVersionId: title.planVersionId,
                billingOptionId: title.billingOptionId,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        if (!titleRow) throw new Error('Expected inheriting title');

        const blockedState = await readSituation(userId, 'tourist');
        expect(blockedState.body.data).toEqual({ situation: 'TOURIST_VIP_INHERITED' });
        const blockedPurchase = await postSignup(userId, vip.billingOptionId);
        expect(blockedPurchase.status).toBe(409);
        expect((await blockedPurchase.json()).error.reason).toBe('TOURIST_VIP_INHERITED');

        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, titleRow.id));
        expect((await readSituation(userId, 'tourist')).body.data).toEqual({
            situation: 'CHECKOUT'
        });
        const allowedPurchase = await postSignup(userId, vip.billingOptionId);
        expect(allowedPurchase.status).toBe(201);
    });

    it('TEST:B13a:12 (c) requires the action 14 permission at both endpoints', async () => {
        const userId = await seedUser();
        const refundBody = {
            paymentId: randomUUID(),
            amount: 10000,
            channel: 'BANK_TRANSFER',
            reference: 'EXTERNAL-TEST-REFUND',
            reason: 'OUT_OF_FLOW_REFUND'
        };
        const chargeBody = { chargeId: `missing-${randomUUID()}` };
        const admin = actorHeaders({ id: userId, role: 'ADMIN' });
        const deniedRefund = await app.request(refundPath, {
            method: 'POST',
            headers: admin,
            body: JSON.stringify(refundBody)
        });
        expect(deniedRefund.status).toBe(403);
        expect((await deniedRefund.json()).error.code).toBe('FORBIDDEN');
        const deniedCharge = await app.request(chargePath, {
            method: 'POST',
            headers: admin,
            body: JSON.stringify(chargeBody)
        });
        expect(deniedCharge.status).toBe(403);
        expect((await deniedCharge.json()).error.code).toBe('FORBIDDEN');

        const superAdmin = actorHeaders({
            id: userId,
            role: 'SUPER_ADMIN',
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SETTLE_EXTERNAL]
        });
        const passedRefundGate = await app.request(refundPath, {
            method: 'POST',
            headers: superAdmin,
            body: JSON.stringify(refundBody)
        });
        expect(passedRefundGate.status).toBe(404);
        const passedChargeGate = await app.request(chargePath, {
            method: 'POST',
            headers: superAdmin,
            body: JSON.stringify(chargeBody)
        });
        expect(passedChargeGate.status).toBe(404);
    });
});
