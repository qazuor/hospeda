import { randomUUID } from 'node:crypto';
/** TEST:V7:13 — public Partner presence follows its own entitlement key and live moderation bit. */
import { eq, getDb, partners, payments, subscriptions } from '@repo/db';
import { PartnerPublicSchema, PermissionEnum, RoleEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { invalidateEffectiveSetsForUser } from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../listing-publication/publication-routes.helpers';
import {
    createdPartnerIds,
    createdUserIds,
    seedPartner,
    seedPlan
} from './partner-presence.helpers';

const app = initApp();
const db = getDb;

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    const connection = db();
    for (const id of createdPartnerIds.splice(0)) {
        await connection.delete(partners).where(eq(partners.id, id));
    }
    for (const userId of createdUserIds.splice(0)) {
        await connection.execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await connection.delete(subscriptions).where(eq(subscriptions.userId, userId));
        await connection.execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
});

afterAll(async () => testDb.teardown());

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

        // TEST:V7:13 (a) Gold and Silver have distinct presence keys; moderated and unowned rows are hidden.
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

        // TEST:V7:13 (b) A suspended Silver loses carousel presence after effective-set invalidation.
        await db()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, s.subscriptionId));
        // In production coverage notice or the daily reconciler invalidates this cache (V7 §1.6).
        await invalidateEffectiveSetsForUser(s.owner!.id);
        const afterSilverSuspension = await carouselIds([g.partner.id, s.partner.id]);
        expect(afterSilverSuspension).toContain(g.partner.id);
        expect(afterSilverSuspension).not.toContain(s.partner.id);

        // TEST:V7:13 (c) Gold downgraded to Silver loses its page but keeps carousel presence.
        await db()
            .update(subscriptions)
            .set({ planVersionId: silver.versionId, billingOptionId: silver.optionId })
            .where(eq(subscriptions.id, g.subscriptionId));
        await invalidateEffectiveSetsForUser(g.owner!.id);
        expect((await publicPage(g.partner.slug)).status).toBe(404);
        expect(await carouselIds([g.partner.id])).toContain(g.partner.id);

        // TEST:V7:13 (d) Moderation answers 404 without changing billing or retained content.
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

        // TEST:V7:13 (e) Restoring Gold makes the page available on the next read.
        await db()
            .update(subscriptions)
            .set({ planVersionId: gold.versionId, billingOptionId: gold.optionId })
            .where(eq(subscriptions.id, g.subscriptionId));
        await invalidateEffectiveSetsForUser(g.owner!.id);
        expect((await publicPage(g.partner.slug)).status).toBe(200);
        // TEST:V7:13 (f) Moderation goes through the admin route while the response cache is warm.
        const adminId = randomUUID();
        const moderationHeaders = actorHeaders({
            id: adminId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE]
        });
        const moderationResponse = await app.request(
            `/api/v1/admin/partners/${g.partner.id}/presence-moderation`,
            {
                method: 'POST',
                headers: moderationHeaders,
                body: JSON.stringify({ action: 'MODERATE', reason: 'Test moderation' })
            }
        );
        expect(moderationResponse.status).toBe(200);
        expect((await publicPage(g.partner.slug)).status).toBe(404);
        expect(await carouselIds([g.partner.id])).not.toContain(g.partner.id);
        const liftResponse = await app.request(
            `/api/v1/admin/partners/${g.partner.id}/presence-moderation`,
            {
                method: 'POST',
                headers: moderationHeaders,
                body: JSON.stringify({ action: 'LIFT', reason: 'Test lift' })
            }
        );
        expect(liftResponse.status).toBe(200);
        expect((await publicPage(g.partner.slug)).status).toBe(200);

        // TEST:V7:13 (g) Legacy revoked_at does not replace key-based presence with 410.
        const revoked = await seedPartner({ gold, silver, revoked: true });
        expect((await publicPage(revoked.partner.slug)).status).toBe(200);
        // V/21 §4 moves administrative revocation from the 410 response to the moderation bit.
    });
});
