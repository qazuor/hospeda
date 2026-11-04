/** TEST:V7:13 — public Partner presence follows its own entitlement key and live moderation bit. */
import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    eq,
    getDb,
    partners,
    payments,
    plans,
    planVersionEntitlements,
    planVersions,
    subscriptions
} from '@repo/db';
import { EntitlementKeyEnum, PartnerPublicSchema, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { invalidateCacheByPathPrefix } from '../../../src/middlewares/cache';
import { invalidateEffectiveSetsForUser } from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner } from '../listing-publication/publication-routes.helpers';

const app = initApp();
const db = getDb;
const publicPartnerCache = () =>
    invalidateCacheByPathPrefix({ pathPrefix: '/api/v1/public/partners' });
const createdUserIds: string[] = [];
const createdPartnerIds: string[] = [];
type Tier = 'GOLD' | 'SILVER';
type Owner = Awaited<ReturnType<typeof createOwner>>;
const keySet: Record<Tier, EntitlementKeyEnum[]> = {
    GOLD: [EntitlementKeyEnum.PARTNER_PUBLIC_PAGE, EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE],
    SILVER: [EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE]
};

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    const connection = db();
    if (createdPartnerIds.length) {
        for (const id of createdPartnerIds.splice(0)) {
            await connection.delete(partners).where(eq(partners.id, id));
        }
    }
    for (const userId of createdUserIds.splice(0)) {
        await connection.execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await connection.delete(subscriptions).where(eq(subscriptions.userId, userId));
        await connection.execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
    // Catalog plans, versions, entitlements and billing options are immutable and cannot be deleted.
});

afterAll(async () => testDb.teardown());

async function seedPlan(tier: Tier): Promise<{ versionId: string; optionId: string }> {
    const connection = db();
    const [plan] = await connection
        .insert(plans)
        .values({
            vertical: VerticalEnum.PARTNER,
            slug: `v7-${tier.toLowerCase()}-${randomUUID()}`,
            name: `V7 ${tier}`
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected Partner plan');
    const versionId = await connection.transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: VerticalEnum.PARTNER,
                rank: Math.floor(Math.random() * 100000) + 1000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Expected Partner plan version');
        await tx.insert(planVersionEntitlements).values(
            keySet[tier].map((key) => ({
                planVersionId: version.id,
                key,
                planQuota: null,
                trialQuota: null
            }))
        );
        return version.id;
    });
    const [option] = await connection
        .insert(billingOptions)
        .values({
            planVersionId: versionId,
            cycle: 'monthly',
            amount: tier === 'GOLD' ? 50000 : 25000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    return { versionId, optionId: option.id };
}

/** Seed one owner, Partner, principal subscription, and succeeded payment. */
async function seedPartner(args: {
    readonly owner?: Owner;
    readonly tier?: Tier;
    readonly gold: { readonly versionId: string; readonly optionId: string };
    readonly silver: { readonly versionId: string; readonly optionId: string };
    readonly moderated?: boolean;
    readonly revoked?: boolean;
}): Promise<{
    owner: Owner | null;
    partner: typeof partners.$inferSelect;
    subscriptionId: string;
}> {
    const connection = db();
    const owner = args.owner ?? (await createOwner());
    if (args.owner === undefined) createdUserIds.push(owner.id);
    const tier = args.tier ?? 'GOLD';
    const selected = tier === 'GOLD' ? args.gold : args.silver;
    const [partner] = await connection
        .insert(partners)
        .values({
            slug: `v7-${randomUUID()}`,
            name: 'V7 public partner',
            type: 'business',
            description: 'Partner content retained during presence moderation',
            ownerUserId: owner.id,
            revokedAt: args.revoked ? new Date('2026-01-01T00:00:00.000Z') : null
        })
        .returning();
    if (!partner) throw new Error('Expected Partner row');
    createdPartnerIds.push(partner.id);
    if (args.moderated) {
        // The moderation route is corrida 2; here the bit is seeded directly.
        await connection
            .update(partners)
            .set({ presenceModerated: true })
            .where(eq(partners.id, partner.id));
    }
    const [subscription] = await connection
        .insert(subscriptions)
        .values({
            userId: owner.id,
            vertical: VerticalEnum.PARTNER,
            planVersionId: selected.versionId,
            billingOptionId: selected.optionId,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    await connection.insert(payments).values({
        subscriptionId: subscription.id,
        amount: tier === 'GOLD' ? 50000 : 25000,
        currency: 'ARS',
        status: 'SUCCEEDED',
        provider: 'fake',
        providerFactId: `v7-${randomUUID()}`,
        factAt: new Date('2026-10-12T10:00:00.000Z')
    });
    return { owner, partner, subscriptionId: subscription.id };
}

async function publicPage(slug: string) {
    return app.request(`/api/v1/public/partners/${slug}`, {
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });
}

async function carouselIds(ids: readonly string[]): Promise<string[]> {
    const response = await app.request('/api/v1/public/partners?pageSize=100', {
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });
    const body = (await response.json()) as { data: { items: Array<{ id: string }> } };
    return body.data.items.filter((item) => ids.includes(item.id)).map((item) => item.id);
}

describe('TEST:V7:13 AC:V7:13 — public presence is selected by key and moderation', () => {
    it('serves each surface by its key, reads moderation live, and never answers 410', async () => {
        const gold = await seedPlan('GOLD');
        const silver = await seedPlan('SILVER');
        const g = await seedPartner({ gold, silver });
        const s = await seedPartner({ gold, silver, tier: 'SILVER' });
        const m = await seedPartner({ gold, silver, moderated: true });
        const u = await db()
            .insert(partners)
            .values({
                slug: `v7-${randomUUID()}`,
                name: 'V7 unowned partner',
                type: 'business',
                description: 'Unowned partner',
                ownerUserId: null
            })
            .returning();
        if (!u[0]) throw new Error('Expected unowned Partner');
        createdPartnerIds.push(u[0].id);

        const goldPage = await publicPage(g.partner.slug);
        expect(goldPage.status, await goldPage.clone().text()).toBe(200);
        expect((await goldPage.json()).data).toEqual(PartnerPublicSchema.parse(g.partner));
        expect((await publicPage(s.partner.slug)).status).toBe(404);
        expect((await publicPage(m.partner.slug)).status).toBe(404);
        expect((await publicPage(u[0].slug)).status).toBe(404);
        const initialIds = await carouselIds([g.partner.id, s.partner.id, m.partner.id, u[0].id]);
        expect(initialIds).toContain(g.partner.id);
        expect(initialIds).toContain(s.partner.id);
        expect(initialIds).not.toContain(m.partner.id);
        expect(initialIds).not.toContain(u[0].id);

        await db()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, s.subscriptionId));
        // In production coverage notice or the daily reconciler invalidates this cache (V7 §1.6).
        await invalidateEffectiveSetsForUser(s.owner!.id);
        publicPartnerCache();
        const afterSilverSuspension = await carouselIds([g.partner.id, s.partner.id]);
        expect(afterSilverSuspension).toContain(g.partner.id);
        expect(afterSilverSuspension).not.toContain(s.partner.id);

        await db()
            .update(subscriptions)
            .set({ planVersionId: silver.versionId, billingOptionId: silver.optionId })
            .where(eq(subscriptions.id, g.subscriptionId));
        await invalidateEffectiveSetsForUser(g.owner!.id);
        publicPartnerCache();
        expect((await publicPage(g.partner.slug)).status).toBe(404);
        expect(await carouselIds([g.partner.id])).toContain(g.partner.id);

        const subscriptionBefore = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, m.subscriptionId));
        const paymentBefore = await db()
            .select()
            .from(payments)
            .where(eq(payments.subscriptionId, m.subscriptionId));
        const partnerBefore = await db()
            .select()
            .from(partners)
            .where(eq(partners.id, m.partner.id));
        const moderatedResponse = await publicPage(m.partner.slug);
        expect(moderatedResponse.status).toBe(404);
        expect((await moderatedResponse.json()).error.code).toBe('NOT_FOUND');
        expect(moderatedResponse.status).not.toBe(410);
        const subscriptionAfter = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, m.subscriptionId));
        const paymentAfter = await db()
            .select()
            .from(payments)
            .where(eq(payments.subscriptionId, m.subscriptionId));
        const partnerAfter = await db()
            .select()
            .from(partners)
            .where(eq(partners.id, m.partner.id));
        expect(subscriptionAfter.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(
            subscriptionBefore.map(({ updatedAt: _updatedAt, ...row }) => row)
        );
        expect(paymentAfter.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(
            paymentBefore.map(({ updatedAt: _updatedAt, ...row }) => row)
        );
        expect(partnerAfter.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(
            partnerBefore.map(({ updatedAt: _updatedAt, ...row }) => row)
        );
        expect(partnerAfter[0]?.deletedAt).toBeNull();
        expect(partnerAfter[0]?.description).toBe(partnerBefore[0]?.description);

        await db()
            .update(subscriptions)
            .set({ planVersionId: gold.versionId, billingOptionId: gold.optionId })
            .where(eq(subscriptions.id, g.subscriptionId));
        await invalidateEffectiveSetsForUser(g.owner!.id);
        publicPartnerCache();
        expect((await publicPage(g.partner.slug)).status).toBe(200);
        await db()
            .update(partners)
            .set({ presenceModerated: true })
            .where(eq(partners.id, g.partner.id));
        publicPartnerCache();
        expect((await publicPage(g.partner.slug)).status).toBe(404);
        expect(await carouselIds([g.partner.id])).not.toContain(g.partner.id);
        await db()
            .update(partners)
            .set({ presenceModerated: false })
            .where(eq(partners.id, g.partner.id));
        publicPartnerCache();
        expect((await publicPage(g.partner.slug)).status).toBe(200);

        const revoked = await seedPartner({ gold, silver, revoked: true });
        expect((await publicPage(revoked.partner.slug)).status).toBe(200);
        // V/21 §4 moves administrative revocation from the 410 response to the moderation bit.
    });
});
