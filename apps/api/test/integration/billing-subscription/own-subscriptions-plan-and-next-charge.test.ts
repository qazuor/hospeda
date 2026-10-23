import {
    and,
    billingOptions,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    promoCodes,
    promoRedemptions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfState
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const path = '/api/v1/protected/billing-subscription/';
const optionAmount = 10000;
const extraOptions: string[] = [];
const promoIds: string[] = [];
const redemptionIds: string[] = [];
const changeIds: string[] = [];
const ownSubscriptionIds: string[] = [];
let app: ReturnType<typeof initApp>;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => {
    const db = getDb();
    if (changeIds.length)
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.id, changeIds.splice(0)));
    if (redemptionIds.length)
        await db
            .delete(promoRedemptions)
            .where(inArray(promoRedemptions.id, redemptionIds.splice(0)));
    if (promoIds.length)
        await db.delete(promoCodes).where(inArray(promoCodes.id, promoIds.splice(0)));
    if (ownSubscriptionIds.length)
        await db
            .delete(subscriptions)
            .where(inArray(subscriptions.id, ownSubscriptionIds.splice(0)));
    if (extraOptions.length)
        await db.delete(billingOptions).where(inArray(billingOptions.id, extraOptions.splice(0)));
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

async function seedStatus(status: Parameters<typeof seedSelfState>[0]) {
    const seeded = await seedSelfState(status);
    ownSubscriptionIds.push(seeded.subscriptionId);
    return seeded;
}

async function listedRow(ownerId: string, id: string): Promise<Record<string, unknown>> {
    const response = await app.request(path, {
        headers: actorHeaders({
            id: ownerId,
            role: 'USER',
            permissions: [PermissionEnum.BILLING_VIEW_OWN]
        })
    });
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const data = (body as { data: { subscriptions: Array<Record<string, unknown>> } }).data;
    const row = data.subscriptions.find((item) => item.id === id);
    if (!row) throw new Error(`Expected own subscription ${id}`);
    return row;
}

async function setNextCharge(id: string, at: Date | null) {
    await getDb().update(subscriptions).set({ nextChargeAt: at }).where(eq(subscriptions.id, id));
}

async function extraOption(input: {
    readonly planId: string;
    readonly cycle?: string;
    readonly amount: number;
    readonly current?: boolean;
    readonly sellable?: boolean;
}) {
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: input.planId,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            current: input.current ?? false,
            sellable: input.sellable ?? false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected extra plan version');
    const [option] = await getDb()
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: input.cycle ?? 'monthly',
            amount: input.amount,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected extra billing option');
    extraOptions.push(option.id);
    return { planVersionId: version.id, optionId: option.id };
}

describe('TEST:1755:1 anchored plan in own subscriptions', () => {
    it('returns the anchored plan fields and preserves the existing row fields', async () => {
        const seeded = await seedStatus('ACTIVE');
        const [anchor] = await getDb()
            .select({ planId: planVersions.planId, option: billingOptions, plan: plans })
            .from(subscriptions)
            .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .innerJoin(plans, eq(plans.id, planVersions.planId))
            .innerJoin(
                billingOptions,
                and(
                    eq(billingOptions.id, subscriptions.billingOptionId),
                    eq(billingOptions.planVersionId, subscriptions.planVersionId)
                )
            )
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!anchor) throw new Error('Expected seeded anchor');
        await extraOption({ planId: anchor.planId, amount: 25000, current: true, sellable: false });
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.plan).toEqual({
            slug: anchor.plan.slug,
            name: anchor.plan.name,
            amount: optionAmount,
            currency: 'ARS',
            cycle: 'monthly'
        });
        expect(listed).toMatchObject({
            id: seeded.subscriptionId,
            vertical: 'accommodation',
            status: 'ACTIVE',
            paymentMethod: 'CARD',
            serviceEndsAt: null,
            graceEndsAt: null,
            createdAt: expect.any(String),
            paidAfterCancellation: null
        });
    });
});

describe('TEST:1755:2 next charge amount and predicate', () => {
    it('TEST:1755:2a returns the amount from the policy without a promo', async () => {
        const seeded = await seedStatus('ACTIVE');
        const at = new Date(NOW.getTime() + 10 * 86_400_000);
        await setNextCharge(seeded.subscriptionId, at);
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.nextCharge).toEqual({
            at: at.toISOString(),
            amount: optionAmount,
            currency: 'ARS'
        });
    });

    it('TEST:1755:2b composes a live promo for nextCharge while plan keeps list price', async () => {
        const seeded = await seedStatus('ACTIVE');
        const at = new Date(NOW.getTime() + 10 * 86_400_000);
        await setNextCharge(seeded.subscriptionId, at);
        const [promo] = await getDb()
            .insert(promoCodes)
            .values({
                code: `HOS1755-${crypto.randomUUID()}`,
                effectKind: 'DISCOUNT',
                discountKind: 'PERCENTAGE',
                value: 20,
                allVerticals: true,
                verticals: null,
                stackable: false,
                usableWithAnotherActive: false,
                durationKind: 'N_CHARGES',
                durationCharges: 3
            })
            .returning({ id: promoCodes.id });
        if (!promo) throw new Error('Expected promo');
        promoIds.push(promo.id);
        const [redemption] = await getDb()
            .insert(promoRedemptions)
            .values({
                promoCodeId: promo.id,
                userId: seeded.ownerId,
                subscriptionId: seeded.subscriptionId,
                redeemedAt: new Date(NOW.getTime() - 86_400_000),
                remainingCharges: 3
            })
            .returning({ id: promoRedemptions.id });
        if (!redemption) throw new Error('Expected promo redemption');
        redemptionIds.push(redemption.id);
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.plan).toEqual({
            slug: expect.any(String),
            name: expect.any(String),
            amount: optionAmount,
            currency: 'ARS',
            cycle: 'monthly'
        });
        expect(listed.nextCharge).toEqual({ at: at.toISOString(), amount: 8000, currency: 'ARS' });
    });

    it('TEST:1755:2c hides the next charge for MANUAL subscriptions', async () => {
        const seeded = await seedStatus('ACTIVE');
        await getDb()
            .update(subscriptions)
            .set({ paymentMethod: 'MANUAL' })
            .where(eq(subscriptions.id, seeded.subscriptionId));
        await setNextCharge(seeded.subscriptionId, new Date(NOW.getTime() + 10 * 86_400_000));
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.nextCharge).toBeNull();
        expect(listed.plan).toEqual({
            slug: expect.any(String),
            name: expect.any(String),
            amount: optionAmount,
            currency: 'ARS',
            cycle: 'monthly'
        });
    });

    it.each([
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED',
        'SUSPENDED'
    ] as const)('TEST:1755:2d hides the next charge for %s', async (status) => {
        const seeded = await seedStatus(status);
        await setNextCharge(seeded.subscriptionId, new Date(NOW.getTime() + 10 * 86_400_000));
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.nextCharge).toBeNull();
        expect(listed.plan).toEqual({
            slug: expect.any(String),
            name: expect.any(String),
            amount: optionAmount,
            currency: 'ARS',
            cycle: 'monthly'
        });
    });

    it.each([
        null,
        new Date(NOW.getTime() - 60 * 60_000)
    ])('TEST:1755:2e hides null or expired next charge %s', async (at) => {
        const seeded = await seedStatus('ACTIVE');
        await setNextCharge(seeded.subscriptionId, at);
        expect((await listedRow(seeded.ownerId, seeded.subscriptionId)).nextCharge).toBeNull();
    });

    it.each([
        20, 5
    ])('TEST:1755:2f applies a scheduled option only when effective by next charge (%s days)', async (effectiveDays) => {
        const seeded = await seedStatus('ACTIVE');
        const [anchor] = await getDb()
            .select({ planId: planVersions.planId })
            .from(subscriptions)
            .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!anchor) throw new Error('Expected anchor plan');
        const target = await extraOption({ planId: anchor.planId, amount: 30000 });
        const chargeAt = new Date(NOW.getTime() + 10 * 86_400_000);
        await setNextCharge(seeded.subscriptionId, chargeAt);
        const [change] = await getDb()
            .insert(subscriptionScheduledChanges)
            .values({
                subscriptionId: seeded.subscriptionId,
                targetPlanVersionId: target.planVersionId,
                targetBillingOptionId: target.optionId,
                effectiveAt: new Date(NOW.getTime() + effectiveDays * 86_400_000),
                planMigrationSubscriptionId: null
            })
            .returning({ id: subscriptionScheduledChanges.id });
        if (!change) throw new Error('Expected scheduled change');
        changeIds.push(change.id);
        const listed = await listedRow(seeded.ownerId, seeded.subscriptionId);
        expect(listed.nextCharge).toEqual({
            at: chargeAt.toISOString(),
            amount: effectiveDays === 5 ? 30000 : optionAmount,
            currency: 'ARS'
        });
    });
});
