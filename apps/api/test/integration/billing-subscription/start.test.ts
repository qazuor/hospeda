import {
    billingDeadlineVersions,
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    plans,
    planVersions,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { cancelInheritedTouristVips } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../../src/routes/billing-subscription/tourist-vip-inheritance';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

/**
 * The occupied commitment case below POSTs against a live commitment. Before
 * HOS-1723, it was answered by `resolve-live-commitment.ts:70-74` with 409 BEFORE
 * reading the reuse window, so this file does not strictly read
 * `values['10'].cardHours` yet. The seed is kept anyway so the file is
 * self-sufficient: `billing_deadline_version` is wiped by `testDb.clean()` and
 * by `billing-deadlines.test.ts`, all `hospeda-api` integration files share one
 * database and run in series, and any future case that completes a commitment
 * would read the window (`resolve-live-commitment.ts:76`). Idempotent via
 * `onConflictDoNothing`.
 */
const billingDeadlineVersion1Values = {
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

async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
}

async function fixture(sellable: boolean, current = true) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-route-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 route user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `b3-route-${crypto.randomUUID()}`,
            name: 'Básico'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable,
            current,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('No option');
    return { user, version, option };
}

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

describe('TEST:B3:2 and TEST:1723:1 protected S1 route rejections', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('orders auth, shape, missing id and plan policy before the provider, without creating a row', async () => {
        const { user, option } = await fixture(false);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const request = (body: Record<string, unknown>, authenticated = true) =>
            app.request(path, {
                method: 'POST',
                headers: authenticated
                    ? headers(user.id)
                    : { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ ...body, payerEmail: user.email })
            });
        expect((await request({ billingOptionId: option.id }, false)).status).toBe(401);
        expect((await request({ billingOptionId: 'invalid' })).status).toBe(400);
        expect(
            (await request({ billingOptionId: option.id, paymentToken: 'forbidden' })).status
        ).toBe(400);
        expect((await request({ billingOptionId: crypto.randomUUID() })).status).toBe(404);
        const retired = await request({ billingOptionId: option.id });
        expect(retired.status).toBe(422);
        expect((await retired.json()).error.reason).toBe('PLAN_NOT_FOR_SALE');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toEqual([]);
    });

    it('TEST:1723:1 returns retryable 409 for an unfinished same-option commitment', async () => {
        const { user, version, option } = await fixture(true);
        // TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
        await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: version.id,
            billingOptionId: option.id,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id, payerEmail: user.email })
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('PREVIOUS_ATTEMPT_IN_PROGRESS');
        expect(authorize).not.toHaveBeenCalled();
    });

    it('TEST:B3:29 rejects Tourist VIP while an inherited title is active, then admits it after cancellation', async () => {
        const { user } = await fixture(true);
        const vipPlan = await getDb()
            .insert(plans)
            .values({
                vertical: 'tourist',
                slug: `b3-vip-${crypto.randomUUID()}`,
                name: 'Tourist VIP'
            })
            .returning();
        const vipVersion = await getDb()
            .insert(planVersions)
            .values({
                planId: vipPlan[0]!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const vipOption = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion[0]!.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning();
        const lodgingPlan = await getDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `b3-inheritor-${crypto.randomUUID()}`,
                name: 'Inherited Basic'
            })
            .returning();
        const lodgingVersion = await getDb()
            .insert(planVersions)
            .values({
                planId: lodgingPlan[0]!.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false,
                inheritsTouristVip: true
            })
            .returning();
        const lodgingOption = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: lodgingVersion[0]!.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        const inherited = await getDb()
            .insert(subscriptions)
            .values({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: lodgingVersion[0]!.id,
                billingOptionId: lodgingOption[0]!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const request = (authenticated = true) =>
            app.request(path, {
                method: 'POST',
                headers: authenticated
                    ? headers(user.id)
                    : { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ billingOptionId: vipOption[0]!.id, payerEmail: user.email })
            });
        expect((await request(false)).status).toBe(401);
        const rejected = await request();
        expect(rejected.status).toBe(409);
        expect((await rejected.json()).error.reason).toBe('TOURIST_VIP_INHERITED');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toHaveLength(1);
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, inherited[0]!.id));
        const admitted = await request();
        expect(admitted.status).toBe(201);
        expect((await admitted.json()).data.checkoutUrl).toBeDefined();
        expect(authorize).toHaveBeenCalledTimes(1);
    });

    it('TEST:B3:28 keeps one pending outbox event and cancels only after that event is sent', async () => {
        const { user } = await fixture(true);
        const lodging = await getDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `b3-outbox-title-${crypto.randomUUID()}`,
                name: 'Inherited Basic'
            })
            .returning();
        const lodgingVersion = await getDb()
            .insert(planVersions)
            .values({
                planId: lodging[0]!.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false,
                inheritsTouristVip: true
            })
            .returning();
        const lodgingOption = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: lodgingVersion[0]!.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        await getDb().insert(subscriptions).values({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: lodgingVersion[0]!.id,
            billingOptionId: lodgingOption[0]!.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        });
        const tourist = await getDb()
            .insert(plans)
            .values({
                vertical: 'tourist',
                slug: `b3-outbox-vip-${crypto.randomUUID()}`,
                name: 'Tourist VIP'
            })
            .returning();
        const vipVersion = await getDb()
            .insert(planVersions)
            .values({
                planId: tourist[0]!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const vipOption = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: vipVersion[0]!.id,
                cycle: 'monthly',
                amount: 1000,
                currency: 'ARS'
            })
            .returning();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const vipAuth = await fake.authorize({
            reference: `vip-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'Tourist VIP',
            returnUrl: 'https://hospeda.example/account'
        });
        const vip = await getDb()
            .insert(subscriptions)
            .values({
                userId: user.id,
                vertical: 'tourist',
                planVersionId: vipVersion[0]!.id,
                billingOptionId: vipOption[0]!.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        await getDb().insert(providerLinks).values({
            subscriptionId: vip[0]!.id,
            provider: 'MERCADO_PAGO',
            providerId: vipAuth.authorizationId
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const ports = { provider: fake, clock, beforeCancelNotice, touristVipInheritance };
        expect(await cancelInheritedTouristVips({ userId: user.id }, ports)).toMatchObject({
            deferred: 1
        });
        expect(cancel).not.toHaveBeenCalled();
        const pending = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(pending).toHaveLength(1);
        expect(pending[0]?.template).toBe('billing.tourist-vip-inherited-cancel');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, pending[0]!.id));
        expect(await cancelInheritedTouristVips({ userId: user.id }, ports)).toMatchObject({
            cancelled: 1
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        const vipNotices = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(
            vipNotices.filter(
                (notice) => notice.template === 'billing.tourist-vip-inherited-cancel'
            )
        ).toHaveLength(1);
    });

    it('rejects a version that is no longer current before reaching the provider', async () => {
        const { user, option } = await fixture(true, false);
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id, payerEmail: user.email })
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error.reason).toBe('PLAN_NOT_FOR_SALE');
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toEqual([]);
    });

    it('TEST:B3:3 enqueues one before-cancel notice and reads its four delivery outcomes', async () => {
        const { user } = await fixture(true);
        const subscriptionId = crypto.randomUUID();
        const input = { subscriptionId, userId: user.id, kind: 'AUTHORIZATION_EXPIRED' as const };
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NOT_YET_SENT');
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NOT_YET_SENT');
        const rows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.template).toBe('billing.before-cancel');
        if (!rows[0]) throw new Error('Notice was not enqueued');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('SENT');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'failed', lastError: 'undeliverable:hard_bounce' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NO_RECIPIENT');
        await getDb()
            .update(emailOutbox)
            .set({ lastError: 'undeliverable:retries_exhausted' })
            .where(eq(emailOutbox.id, rows[0].id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('DELIVERY_EXHAUSTED');
        await getDb()
            .update(users)
            .set({ deletedAt: new Date('2026-10-08T20:00:00.000Z') })
            .where(eq(users.id, user.id));
        expect(
            await beforeCancelNotice.beforeCancel({
                subscriptionId: crypto.randomUUID(),
                userId: user.id,
                kind: 'AUTHORIZATION_EXPIRED'
            })
        ).toBe('NO_RECIPIENT');
        expect(
            await getDb().select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, user.id))
        ).toHaveLength(2);
    });
});
