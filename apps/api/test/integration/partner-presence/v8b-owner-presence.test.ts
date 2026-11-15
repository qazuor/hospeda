import { randomUUID } from 'node:crypto';
import { eq, getDb, partners, sql, subscriptions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { readOwnerPartnerPresence } from '../../../src/services/partner-presence/partner-presence-read.service';
import { invalidateEffectiveSetsForUser } from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
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
    for (const id of createdPartnerIds.splice(0))
        await db().delete(partners).where(eq(partners.id, id));
    for (const id of createdUserIds.splice(0)) {
        await db().execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${id}::uuid)`
        );
        await db().delete(subscriptions).where(eq(subscriptions.userId, id));
        await db().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

const mine = (owner: { id: string }) =>
    app.request('/api/v1/protected/partners/mine', {
        headers: actorHeaders({ id: owner.id, role: RoleEnum.USER, permissions: [] })
    });
const publicPage = (slug: string) =>
    app.request(`/api/v1/public/partners/${slug}`, {
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });
const moderate = (id: string, adminId: string, action: 'MODERATE' | 'LIFT', reason: string) =>
    app.request(`/api/v1/admin/partners/${id}/presence-moderation`, {
        method: 'POST',
        headers: actorHeaders({
            id: adminId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE]
        }),
        body: JSON.stringify({ action, reason })
    });

describe('AC:V8b:1 TEST:V8b:1 (API half) — the owner reads presence with the public reader', () => {
    it('returns hidden presence for approved content without either paid surface', async () => {
        const owner = await createOwner();
        createdUserIds.push(owner.id);
        const [partner] = await db()
            .insert(partners)
            .values({
                slug: `v8b-approved-hidden-${randomUUID()}`,
                name: 'V8b approved content without paid presence',
                type: 'business',
                ownerUserId: owner.id,
                contentApprovedAt: new Date()
            })
            .returning();
        if (!partner) throw new Error('Expected approved Partner fixture');
        createdPartnerIds.push(partner.id);

        const response = await mine(owner);
        expect(response.status).toBe(200);
        const body = (await response.json()).data;
        expect(body.partner).toMatchObject({
            id: partner.id,
            contentApprovedAt: expect.any(String)
        });
        expect(body.presence).toEqual({
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: false,
            moderationReason: null
        });
    });

    it('fails closed on both surfaces when the partner has no owner', async () => {
        await expect(
            readOwnerPartnerPresence({
                partner: {
                    id: 'partner-without-owner',
                    ownerUserId: null,
                    presenceModerated: false
                }
            })
        ).resolves.toEqual({
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: false,
            moderationReason: null
        });
    });

    it('keeps an unowned moderated partner hidden and returns its moderation reason', async () => {
        const gold = await seedPlan('GOLD');
        const silver = await seedPlan('SILVER');
        const fixture = await seedPartner({ gold, silver });
        const admin = await createOwner();
        createdUserIds.push(admin.id);

        expect(
            (await moderate(fixture.partner.id, admin.id, 'MODERATE', 'Unowned moderation')).status
        ).toBe(200);
        await db()
            .update(partners)
            .set({ ownerUserId: null })
            .where(eq(partners.id, fixture.partner.id));

        await expect(
            readOwnerPartnerPresence({
                partner: {
                    id: fixture.partner.id,
                    ownerUserId: null,
                    presenceModerated: true
                }
            })
        ).resolves.toEqual({
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: true,
            moderationReason: 'Unowned moderation'
        });
    });

    it('reports owner keys, suspended plans, moderation history, and null ownership', async () => {
        const gold = await seedPlan('GOLD');
        const silver = await seedPlan('SILVER');
        const owner = await createOwner();
        createdUserIds.push(owner.id);
        const fixture = await seedPartner({ owner, gold, silver });
        let response = await mine(owner);
        expect(response.status).toBe(200);
        let body = (await response.json()).data;
        expect(body.presence).toEqual({
            publicPage: 'visible',
            carousel: 'visible',
            moderated: false,
            moderationReason: null
        });
        expect((await publicPage(fixture.partner.slug)).status).toBe(200);
        await db()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, fixture.subscriptionId));
        await invalidateEffectiveSetsForUser(owner.id);
        response = await mine(owner);
        body = (await response.json()).data;
        expect(body.presence).toEqual({
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: false,
            moderationReason: null
        });
        expect((await publicPage(fixture.partner.slug)).status).toBe(404);
        expect(body.partner).toMatchObject({
            name: fixture.partner.name,
            description: fixture.partner.description
        });
        expect(JSON.stringify(body)).toContain('presence');
        expect(JSON.stringify(body)).not.toContain('presenceModerated');
        const silverOwner = await createOwner();
        createdUserIds.push(silverOwner.id);
        const silverFixture = await seedPartner({
            owner: silverOwner,
            tier: 'SILVER',
            gold,
            silver
        });
        body = (await (await mine(silverOwner)).json()).data;
        expect(body.presence).toEqual({
            publicPage: 'hidden',
            carousel: 'visible',
            moderated: false,
            moderationReason: null
        });
        const modOwner = await createOwner();
        createdUserIds.push(modOwner.id);
        const modFixture = await seedPartner({ owner: modOwner, gold, silver });
        const admin = await createOwner();
        createdUserIds.push(admin.id);
        expect((await moderate(modFixture.partner.id, admin.id, 'MODERATE', 'R1')).status).toBe(
            200
        );
        expect((await moderate(modFixture.partner.id, admin.id, 'LIFT', 'L1')).status).toBe(200);
        expect((await moderate(modFixture.partner.id, admin.id, 'MODERATE', 'R2')).status).toBe(
            200
        );
        body = (await (await mine(modOwner)).json()).data;
        expect(body.presence).toEqual({
            publicPage: 'hidden',
            carousel: 'hidden',
            moderated: true,
            moderationReason: 'R2'
        });
        expect((await publicPage(modFixture.partner.slug)).status).toBe(404);
        expect((await moderate(modFixture.partner.id, admin.id, 'LIFT', 'L2')).status).toBe(200);
        body = (await (await mine(modOwner)).json()).data;
        expect(body.presence).toEqual({
            publicPage: 'visible',
            carousel: 'visible',
            moderated: false,
            moderationReason: null
        });
        expect((await publicPage(modFixture.partner.slug)).status).toBe(200);
        const noPartner = await createOwner();
        createdUserIds.push(noPartner.id);
        expect((await (await mine(noPartner)).json()).data).toEqual({
            partner: null,
            presence: null
        });
        expect(silverFixture.partner.id).toBeTruthy();
    });
});
