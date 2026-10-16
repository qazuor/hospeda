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
import { ErrorResponseSchema, RedeemPromoCodeResponseSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/promo-codes/redeem';
const now = new Date('2026-10-11T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const usersOwned: string[] = [];
const optionsOwned: string[] = [];
const subscriptionsOwned: string[] = [];
const promosOwned: string[] = [];
const linksOwned: string[] = [];

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

async function fixture(input: { totalQuota?: number; validFrom?: Date; validUntil?: Date } = {}) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `promo-availability-${crypto.randomUUID()}@example.test`,
            displayName: 'Promo availability',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    usersOwned.push(user.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `promo-${crypto.randomUUID()}`,
            name: 'Promo availability'
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
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option');
    optionsOwned.push(option.id);
    const pending = await subscriptionModel.createPendingAuthorization({
        userId: user.id,
        vertical: 'accommodation',
        planVersionId: version.id,
        billingOptionId: option.id,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00.000Z')
    });
    subscriptionsOwned.push(pending.subscription.id);
    await db
        .update(subscriptions)
        .set({ status: 'ACTIVE', paymentMethod: 'CARD' })
        .where(eq(subscriptions.id, pending.subscription.id));
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const authorization = await fake.authorize({
        reference: pending.subscription.id,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'promo availability',
        returnUrl: 'https://example.test/return'
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    const [link] = await db
        .insert(providerLinks)
        .values({
            subscriptionId: pending.subscription.id,
            provider: 'MERCADO_PAGO',
            providerId: authorization.authorizationId
        })
        .returning();
    if (link) linksOwned.push(link.id);
    const [promo] = await db
        .insert(promoCodes)
        .values({
            code: `AVAIL-${crypto.randomUUID()}`,
            discountKind: 'FIXED',
            value: 1000,
            allVerticals: true,
            verticals: null,
            totalQuota: input.totalQuota ?? 10,
            validFrom: input.validFrom ?? new Date('2026-01-01T00:00:00Z'),
            validUntil: input.validUntil ?? new Date('2027-01-01T00:00:00Z'),
            stackable: true,
            usableWithAnotherActive: true,
            durationKind: 'N_CHARGES',
            durationCharges: 2
        })
        .returning();
    if (!promo) throw new Error('No promo');
    promosOwned.push(promo.id);
    return { user, promo, fake, subscriptionId: pending.subscription.id };
}

async function cleanup() {
    const promoIds = promosOwned.splice(0);
    for (const promoCodeId of promoIds)
        await getDb().delete(promoRedemptions).where(eq(promoRedemptions.promoCodeId, promoCodeId));
    for (const id of linksOwned.splice(0))
        await getDb().delete(providerLinks).where(eq(providerLinks.id, id));
    for (const id of subscriptionsOwned.splice(0))
        await getDb().delete(subscriptions).where(eq(subscriptions.id, id));
    for (const id of promoIds) await getDb().delete(promoCodes).where(eq(promoCodes.id, id));
    for (const id of optionsOwned.splice(0))
        await getDb().delete(billingOptions).where(eq(billingOptions.id, id));
    // Plan versions are immutable and must remain with their parent plans.
    for (const id of usersOwned.splice(0)) await getDb().delete(users).where(eq(users.id, id));
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(cleanup);
afterAll(async () => {
    await cleanup();
    await testDb.teardown();
});

describe('TEST:B9b:3 AC:B9b:3 promo availability route errors', () => {
    it('(a) returns a contract-valid 422 for exhausted quota', async () => {
        const value = await fixture({ totalQuota: 1 });
        const [priorUser] = await getDb()
            .insert(users)
            .values({
                email: `promo-prior-${crypto.randomUUID()}@example.test`,
                displayName: 'Promo prior',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        if (!priorUser) throw new Error('No prior user');
        usersOwned.push(priorUser.id);
        await getDb().insert(promoRedemptions).values({
            promoCodeId: value.promo.id,
            userId: priorUser.id,
            subscriptionId: null,
            remainingCharges: null,
            redeemedAt: now
        });
        injectPaymentProvider({ provider: value.fake });
        const response = await initApp({ clock, paymentProvider: value.fake }).request(path, {
            method: 'POST',
            headers: headers(value.user.id),
            body: JSON.stringify({ code: value.promo.code, vertical: 'accommodation' })
        });
        expect(response.status).toBe(422);
        const body = await response.json();
        expect(body.error.reason).toBe('PROMO_CODE_NOT_AVAILABLE');
        expect(ErrorResponseSchema.safeParse(body).success).toBe(true);
    });

    it('(b) returns 422 outside the validity window and (c) 409 for a second use', async () => {
        const outside = await fixture({ validUntil: new Date(now.getTime()) });
        injectPaymentProvider({ provider: outside.fake });
        const app = initApp({ clock, paymentProvider: outside.fake });
        const expired = await app.request(path, {
            method: 'POST',
            headers: headers(outside.user.id),
            body: JSON.stringify({ code: outside.promo.code, vertical: 'accommodation' })
        });
        expect(expired.status).toBe(422);
        expect((await expired.json()).error.reason).toBe('PROMO_CODE_NOT_AVAILABLE');
        const available = await fixture();
        injectPaymentProvider({ provider: available.fake });
        const redeem = () =>
            initApp({ clock, paymentProvider: available.fake }).request(path, {
                method: 'POST',
                headers: headers(available.user.id),
                body: JSON.stringify({ code: available.promo.code, vertical: 'accommodation' })
            });
        const first = await redeem();
        expect(first.status).toBe(200);
        const firstBody = await first.json();
        expect(RedeemPromoCodeResponseSchema.safeParse(firstBody.data).success).toBe(true);
        const second = await redeem();
        expect(second.status).toBe(409);
        expect((await second.json()).error.reason).toBe('PROMO_CODE_ALREADY_REDEEMED');
    });
});
