import { randomUUID } from 'node:crypto';
import {
    and,
    billingOptions,
    domainEventModel,
    emailOutbox,
    eq,
    getDb,
    inArray,
    manualPayments,
    partners,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/manual-payment-route-fixtures';

const app = initApp();
const db = getDb;
const ownerIds: string[] = [];
const partnerIds: string[] = [];
let optionId = '';
let planVersionId = '';
let planSlug = '';
let planName = '';

async function seedCatalog() {
    const [plan] = await db()
        .insert(plans)
        .values({
            vertical: VerticalEnum.PARTNER,
            slug: `action-6-plan-${randomUUID()}`,
            name: 'Action 6 plan'
        })
        .returning();
    if (!plan) throw new Error('Plan seed failed');
    const [version] = await db()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.PARTNER,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Plan version seed failed');
    planVersionId = version.id;
    const [option] = await db()
        .insert(billingOptions)
        .values({ planVersionId, cycle: 'monthly', amount: 25_000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('Billing option seed failed');
    optionId = option.id;
    return { optionId, planVersionId, planSlug: plan.slug, planName: plan.name };
}

async function createOwner() {
    const [owner] = await db()
        .insert(users)
        .values({
            email: `action-6-notice-${randomUUID()}@example.test`,
            displayName: 'Action 6 owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!owner) throw new Error('Owner seed failed');
    ownerIds.push(owner.id);
    return owner;
}

async function createPartner(ownerId: string) {
    const [partner] = await db()
        .insert(partners)
        .values({
            slug: `action-6-notice-${randomUUID()}`,
            name: 'Action 6 Partner',
            type: 'business',
            description: 'Action 6 installment mail fixture',
            ownerUserId: ownerId
        })
        .returning();
    if (!partner) throw new Error('Partner seed failed');
    partnerIds.push(partner.id);
    return partner;
}

async function configure(partnerId: string, actorId: string) {
    return app.request(`/api/v1/admin/partners/${partnerId}/billing-setup`, {
        method: 'POST',
        headers: actorHeaders(actorId, [PermissionEnum.PARTNER_CONFIGURE_BILLING]),
        body: JSON.stringify({
            billingOptionId: optionId,
            reason: 'Approved billing setup',
            confirm: true
        })
    });
}

const responseSchema = z.object({
    data: z.object({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        authorizationWindowEndsAt: z.string(),
        created: z.boolean()
    })
});

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    const seeded = await seedCatalog();
    planSlug = seeded.planSlug;
    planName = seeded.planName;
});

afterEach(async () => {
    const connection = db();
    if (ownerIds.length > 0) {
        const owned = await connection
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(inArray(subscriptions.userId, ownerIds));
        const subscriptionIds = owned.map((row) => row.id);
        await connection
            .delete(emailOutbox)
            .where(
                and(
                    inArray(emailOutbox.recipientUserId, ownerIds),
                    eq(emailOutbox.template, 'billing.manual-installment-opened')
                )
            );
        if (subscriptionIds.length > 0) {
            await connection
                .delete(manualPayments)
                .where(inArray(manualPayments.subscriptionId, subscriptionIds));
            await connection
                .delete(subscriptions)
                .where(inArray(subscriptions.id, subscriptionIds));
        }
        await connection.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ownerIds));
        await connection.delete(users).where(inArray(users.id, ownerIds.splice(0)));
    }
    if (partnerIds.length > 0) {
        await connection.delete(partners).where(inArray(partners.id, partnerIds.splice(0)));
    }
});

afterAll(async () => {
    if (optionId) await db().delete(billingOptions).where(eq(billingOptions.id, optionId));
    await testDb.teardown();
});

describe('HOS-2130 action 6 installment mail integration', () => {
    it("action 6 enqueues the partner's installment mail in its transaction", async () => {
        // Arrange
        const owner = await createOwner();
        const partner = await createPartner(owner.id);
        const actorId = randomUUID();
        // Act
        const response = await configure(partner.id, actorId);
        const body = responseSchema.parse(await response.json()).data;
        const rows = await db()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, owner.id),
                    eq(emailOutbox.template, 'billing.manual-installment-opened')
                )
            );
        const retry = await configure(partner.id, actorId);
        // Assert
        expect(response.status).toBe(200);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.payload).toEqual({
            manualPaymentId: body.manualPaymentId,
            subscriptionId: body.subscriptionId,
            locale: 'es',
            planSlug,
            planName,
            amountMinor: 25_000,
            currency: 'ARS',
            dueAt: body.authorizationWindowEndsAt,
            firstInstallment: true
        });
        expect(retry.status).toBe(200);
        expect(
            await db()
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, owner.id),
                        eq(emailOutbox.template, 'billing.manual-installment-opened')
                    )
                )
        ).toHaveLength(1);
    });

    it('a failed action 6 leaves no partner mail', async () => {
        // Arrange
        const owner = await createOwner();
        const partner = await createPartner(owner.id);
        const actorId = randomUUID();
        const insert = vi.spyOn(domainEventModel, 'insert');
        const originalInsert = domainEventModel.insert.bind(domainEventModel);
        insert.mockImplementation(async (input) => {
            if (input.eventType === 'partner.billing_configured') throw new Error('event failure');
            return originalInsert(input);
        });
        // Act
        let response: Response;
        try {
            response = await configure(partner.id, actorId);
        } finally {
            insert.mockRestore();
        }
        const rows = await db()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, owner.id),
                    eq(emailOutbox.template, 'billing.manual-installment-opened')
                )
            );
        const owned = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, owner.id));
        // Assert
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(rows).toEqual([]);
        expect(owned).toEqual([]);
    });
});
