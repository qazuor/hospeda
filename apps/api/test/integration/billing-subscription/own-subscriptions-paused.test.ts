import {
    eq,
    getDb,
    promoCodes,
    promoRedemptions,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
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
let app: ReturnType<typeof initApp>;
const cleanup: Array<() => Promise<void>> = [];
async function listed(id: string, ownerId: string) {
    const response = await app.request('/api/v1/protected/billing-subscription/', {
        headers: actorHeaders({
            id: ownerId,
            role: 'USER',
            permissions: [PermissionEnum.BILLING_VIEW_OWN]
        })
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const row = body.data.subscriptions.find((item: { id: string }) => item.id === id);
    if (!row) throw new Error('Expected own subscription');
    return row;
}
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => clock.set(NOW));
afterEach(async () => {
    for (const task of cleanup.splice(0).reverse()) await task();
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

describe('TEST:B8b:25 Mi Suscripción pause, promo and succession reads', () => {
    it('lists PAUSED with its open pause and no invented next charge', async () => {
        const seeded = await seedSelfState('PAUSED');
        const expectedEndAt = new Date('2026-11-14T12:00:00.000Z');
        const [pause] = await getDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: seeded.subscriptionId,
                reason: 'CUSTOMER_REQUEST',
                startsAt: NOW,
                expectedEndAt,
                requestedMonths: 1
            })
            .returning({ id: subscriptionPauses.id });
        if (!pause) throw new Error('Expected pause');
        cleanup.push(async () => {
            await getDb().delete(subscriptionPauses).where(eq(subscriptionPauses.id, pause.id));
            await getDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.subscriptionId));
        });
        const row = await listed(seeded.subscriptionId, seeded.ownerId);
        expect(row).toMatchObject({
            status: 'PAUSED',
            pause: { reason: 'CUSTOMER_REQUEST', expectedEndAt: expectedEndAt.toISOString() },
            nextCharge: null
        });
    });

    it('marks a live redeemed discount for its owner', async () => {
        const seeded = await seedSelfState('ACTIVE');
        const [code] = await getDb()
            .insert(promoCodes)
            .values({
                code: `HOS1580-${crypto.randomUUID()}`,
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
        if (!code) throw new Error('Expected promo code');
        const [redemption] = await getDb()
            .insert(promoRedemptions)
            .values({
                promoCodeId: code.id,
                userId: seeded.ownerId,
                subscriptionId: seeded.subscriptionId,
                redeemedAt: new Date(NOW.getTime() - 86400000),
                remainingCharges: 3
            })
            .returning({ id: promoRedemptions.id });
        if (!redemption) throw new Error('Expected promo redemption');
        cleanup.push(async () => {
            await getDb().delete(promoRedemptions).where(eq(promoRedemptions.id, redemption.id));
            await getDb().delete(promoCodes).where(eq(promoCodes.id, code.id));
            await getDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.subscriptionId));
        });
        expect((await listed(seeded.subscriptionId, seeded.ownerId)).promo).toEqual({
            endsAt: null
        });
    });

    it('marks an open successor checkout on the predecessor only', async () => {
        const seeded = await seedSelfState('ACTIVE');
        const [origin] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        if (!origin) throw new Error('Expected predecessor');
        const [successor] = await getDb()
            .insert(subscriptions)
            .values({
                userId: seeded.ownerId,
                vertical: origin.vertical,
                planVersionId: origin.planVersionId,
                billingOptionId: origin.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                succeedsId: origin.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('Expected successor');
        await getDb()
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, origin.id));
        cleanup.push(async () => {
            await getDb()
                .update(subscriptions)
                .set({ succeededById: null, status: 'CANCELLED' })
                .where(eq(subscriptions.id, origin.id));
            await getDb().delete(subscriptions).where(eq(subscriptions.id, successor.id));
        });
        expect((await listed(origin.id, seeded.ownerId)).succession).toEqual({
            checkoutOpen: true
        });
        await getDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, successor.id));
        expect((await listed(origin.id, seeded.ownerId)).succession).toBeNull();
    });
});
