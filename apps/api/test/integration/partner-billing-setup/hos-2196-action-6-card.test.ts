/** TEST:HOS-2196 — action 6 can open a recurring card subscription for a Partner. */
import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    domainEvent,
    eq,
    getDb,
    partners,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/manual-payment-route-fixtures';
import { ensureBillingDeadlineVersion1 } from '../helpers/billing-deadline-version.js';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

async function fixture(paymentMethods: ('CARD' | 'MANUAL')[]) {
    const db = getDb();
    const [owner] = await db
        .insert(users)
        .values({
            email: `hos2196-${randomUUID()}@example.test`,
            displayName: 'Partner card owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!owner) throw new Error('No owner');
    const [partner] = await db
        .insert(partners)
        .values({
            slug: `hos2196-${randomUUID()}`,
            name: 'Partner card',
            type: 'business',
            description: 'HOS-2196 fixture',
            ownerUserId: owner.id
        })
        .returning();
    if (!partner) throw new Error('No partner');
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'partner', slug: `hos2196-${randomUUID()}`, name: 'Partner Gold' })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'partner',
            rank: Math.floor(Math.random() * 100000000) + 1200000000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            paymentMethods
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 3000000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No option');
    return { owner, partner, option };
}

function act(
    app: ReturnType<typeof initApp>,
    input: { partnerId: string; billingOptionId: string; paymentMethod?: 'CARD' | 'MANUAL' }
) {
    return app.request(`/api/v1/admin/partners/${input.partnerId}/billing-setup`, {
        method: 'POST',
        headers: actorHeaders(randomUUID(), [PermissionEnum.PARTNER_CONFIGURE_BILLING]),
        body: JSON.stringify({
            billingOptionId: input.billingOptionId,
            ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
            reason: 'Alta con tarjeta acordada',
            confirm: true
        })
    });
}

describe('TEST:HOS-2196 action 6 with card', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(ensureBillingDeadlineVersion1);
    afterAll(async () => testDb.teardown());

    it('creates one pending card subscription, returns its link, audits it, and a retry reuses it', async () => {
        // Arrange
        const { owner, partner, option } = await fixture(['CARD', 'MANUAL']);
        const fake = new FakePaymentProvider({
            idNamespace: randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'inspect a healthy creation through the route' }]
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        // Act
        const first = await act(app, {
            partnerId: partner.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD'
        });
        const second = await act(app, {
            partnerId: partner.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD'
        });
        // Assert
        expect(first.status, await first.clone().text()).toBe(200);
        const one = (await first.json()).data;
        const two = (await second.json()).data;
        expect(one).toMatchObject({
            paymentMethod: 'CARD',
            manualPaymentId: null,
            periodStart: null,
            created: true
        });
        expect(one.checkoutUrl).toMatch(/^https:\/\//);
        expect(two).toMatchObject({
            subscriptionId: one.subscriptionId,
            checkoutUrl: one.checkoutUrl,
            created: false
        });
        expect(authorize).toHaveBeenCalledTimes(1);
        expect(authorize.mock.calls[0]?.[0].firstChargeAt).toBeUndefined();
        const rows = await getDb()
            .select({ status: subscriptions.status, method: subscriptions.paymentMethod })
            .from(subscriptions)
            .where(eq(subscriptions.userId, owner.id));
        expect(rows).toEqual([{ status: 'PENDING_AUTHORIZATION', method: 'CARD' }]);
        const events = await getDb()
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, partner.id));
        expect(events).toHaveLength(1);
        expect(JSON.stringify(events[0]?.changes)).toContain('CARD');
    });

    it('refuses card on a plan that does not accept it, and manual on a card-only plan', async () => {
        // Arrange
        const manualOnly = await fixture(['MANUAL']);
        const cardOnly = await fixture(['CARD']);
        const fake = new FakePaymentProvider({ idNamespace: randomUUID(), clock });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        // Act
        const card = await act(app, {
            partnerId: manualOnly.partner.id,
            billingOptionId: manualOnly.option.id,
            paymentMethod: 'CARD'
        });
        const manual = await act(app, {
            partnerId: cardOnly.partner.id,
            billingOptionId: cardOnly.option.id,
            paymentMethod: 'MANUAL'
        });
        // Assert
        expect(card.status).toBe(422);
        expect(await card.json()).toMatchObject({
            error: { reason: 'PAYMENT_METHOD_NOT_ACCEPTED' }
        });
        expect(manual.status).toBe(422);
        expect(await manual.json()).toMatchObject({
            error: { reason: 'PAYMENT_METHOD_NOT_ACCEPTED' }
        });
        expect(authorize).not.toHaveBeenCalled();
    });
});
