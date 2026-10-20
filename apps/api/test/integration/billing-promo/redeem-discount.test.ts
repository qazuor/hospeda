import {
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { RedeemPromoCodeResponseSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/promo-codes/redeem';
const clock = { now: () => new Date('2026-10-11T12:00:00.000Z') };
const userIds: string[] = [];
const optionIds: string[] = [];

async function cleanupFixtures() {
    for (const id of subscriptionIds) {
        await getDb().delete(promoRedemptions).where(eq(promoRedemptions.subscriptionId, id));
        await getDb().delete(providerLinks).where(eq(providerLinks.subscriptionId, id));
        await getDb().delete(subscriptions).where(eq(subscriptions.id, id));
    }
    subscriptionIds.length = 0;
    for (const id of promoIds) await getDb().delete(promoCodes).where(eq(promoCodes.id, id));
    promoIds.length = 0;
    for (const id of userIds) await getDb().delete(users).where(eq(users.id, id));
    userIds.length = 0;
    for (const id of optionIds)
        await getDb().delete(billingOptions).where(eq(billingOptions.id, id));
    optionIds.length = 0;
}
const subscriptionIds: string[] = [];
const promoIds: string[] = [];

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

async function fixture(amount: number, fixedDiscount: number) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `promo-route-${crypto.randomUUID()}@example.test`,
            displayName: 'Promo route',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    userIds.push(user.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `promo-route-${crypto.randomUUID()}`,
            name: 'Promo route'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option');
    optionIds.push(option.id);
    const pending = await subscriptionModel.createPendingAuthorization({
        userId: user.id,
        vertical: 'accommodation',
        planVersionId: version.id,
        billingOptionId: option.id,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00.000Z')
    });
    subscriptionIds.push(pending.subscription.id);
    await db
        .update(subscriptions)
        .set({ status: 'ACTIVE', paymentMethod: 'CARD' })
        .where(eq(subscriptions.id, pending.subscription.id));
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const authorization = await fake.authorize({
        reference: pending.subscription.id,
        amount: { amountMinor: amount, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'promo fixture',
        returnUrl: 'https://example.test/return'
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    await db.insert(providerLinks).values({
        subscriptionId: pending.subscription.id,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    const [promo] = await db
        .insert(promoCodes)
        .values({
            code: `ROUTE-${crypto.randomUUID()}`,
            discountKind: 'FIXED',
            value: fixedDiscount,
            allVerticals: true,
            verticals: null,
            totalQuota: 10,
            validFrom: new Date('2026-01-01T00:00:00Z'),
            validUntil: new Date('2027-01-01T00:00:00Z'),
            stackable: true,
            usableWithAnotherActive: true,
            durationKind: 'N_CHARGES',
            durationCharges: 2
        })
        .returning();
    if (!promo) throw new Error('No promo');
    promoIds.push(promo.id);
    return { user, promo, fake };
}

describe('TEST:B9b:2 AC:B9b:2 the redeem route reports the provider floor safely', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(cleanupFixtures);
    afterAll(async () => {
        await cleanupFixtures();
        await testDb.teardown();
    });

    it('returns 401 and 400 before business rules, then 404 for an unknown code', async () => {
        const app = initApp({ clock });
        expect(
            (
                await app.request(path, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                    body: JSON.stringify({ code: 'x', vertical: 'accommodation' })
                })
            ).status
        ).toBe(401);
        const userId = crypto.randomUUID();
        expect(
            (
                await app.request(path, {
                    method: 'POST',
                    headers: headers(userId),
                    body: JSON.stringify({ code: 'x', vertical: 'invalid' })
                })
            ).status
        ).toBe(400);
        const missing = await app.request(path, {
            method: 'POST',
            headers: headers(userId),
            body: JSON.stringify({ code: 'missing', vertical: 'accommodation' })
        });
        expect(missing.status).toBe(404);
    });

    it('returns 422 below ARS 15 without provider mutation or a redemption, and validates the success response', async () => {
        const rejected = await fixture(5_000, 3_600);
        injectPaymentProvider({ provider: rejected.fake });
        const app = initApp({ clock, paymentProvider: rejected.fake });
        const mutation = vi.spyOn(rejected.fake, 'changeAmount');
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(rejected.user.id),
            body: JSON.stringify({ code: rejected.promo.code, vertical: 'accommodation' })
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error.reason).toBe('PROMO_BELOW_PROVIDER_MINIMUM');
        expect(mutation).not.toHaveBeenCalled();
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, rejected.promo.id))
        ).toHaveLength(0);
        const foreign = await app.request(path, {
            method: 'POST',
            headers: headers(crypto.randomUUID()),
            body: JSON.stringify({ code: rejected.promo.code, vertical: 'accommodation' })
        });
        expect(foreign.status).toBe(422);
        expect((await foreign.json()).error.reason).toBe('PROMO_NO_ELIGIBLE_SUBSCRIPTION');

        const accepted = await fixture(5_000, 3_000);
        injectPaymentProvider({ provider: accepted.fake });
        const ok = await initApp({ clock, paymentProvider: accepted.fake }).request(path, {
            method: 'POST',
            headers: headers(accepted.user.id),
            body: JSON.stringify({ code: accepted.promo.code, vertical: 'accommodation' })
        });
        expect(ok.status).toBe(200);
        const payload = await ok.json();
        expect(RedeemPromoCodeResponseSchema.safeParse(payload.data).success).toBe(true);
    });
});
