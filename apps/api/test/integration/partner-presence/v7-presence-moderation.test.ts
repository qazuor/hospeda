/** TEST:V7:14 — ACC:12 (sources: action 13) moderates Partner presence, AC:V7:14; V7 §1.6. */
import { randomUUID } from 'node:crypto';
import { eq, getDb, partners, payments, sql, subscriptions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import * as serviceCore from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
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
    for (const partnerId of createdPartnerIds.splice(0)) {
        await db().delete(partners).where(eq(partners.id, partnerId));
    }
    for (const userId of createdUserIds.splice(0)) {
        await db().execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await db().delete(subscriptions).where(eq(subscriptions.userId, userId));
        await db().execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
});

afterAll(async () => testDb.teardown());

const adminHeaders = (id: string, permissions: PermissionEnum[]) =>
    actorHeaders({ id, role: RoleEnum.ADMIN, permissions });

async function moderationRequest(args: {
    readonly partnerId: string;
    readonly actorId: string;
    readonly permissions: PermissionEnum[];
    readonly body: Record<string, unknown>;
}) {
    return app.request(`/api/v1/admin/partners/${args.partnerId}/presence-moderation`, {
        method: 'POST',
        headers: adminHeaders(args.actorId, args.permissions),
        body: JSON.stringify(args.body)
    });
}

async function eventRows(partnerId: string) {
    const result = await db().execute(sql`
        SELECT event_type, entity_type, entity_id, actor_type, actor_id, reason, changes, correlation_id
        FROM domain_event WHERE entity_id = ${partnerId} AND event_type = 'partner.presence_moderation_changed'
        ORDER BY occurred_at, id`);
    return result.rows;
}

describe('TEST:V7:14 AC:V7:14 — Partner presence moderation uses ACC:12 and is auditable', () => {
    it('enforces permission and subject, audits changes, purges public cache, and leaves billing intact', async () => {
        const gold = await seedPlan('GOLD');
        const silver = await seedPlan('SILVER');
        const owner = await createOwner();
        createdUserIds.push(owner.id);
        const fixture = await seedPartner({ owner, gold, silver });
        const scheduleSpy = vi.fn();
        vi.spyOn(serviceCore, 'getRevalidationService').mockReturnValue({
            scheduleRevalidation: scheduleSpy
        } as never);
        const actor1 = randomUUID();
        const actor2 = randomUUID();
        const eventCount = (await eventRows(fixture.partner.id)).length;
        const billingBefore = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.subscriptionId));
        const paymentsBefore = await db()
            .select()
            .from(payments)
            .where(eq(payments.subscriptionId, fixture.subscriptionId));
        const publicHeaders = { 'user-agent': 'vitest', accept: 'application/json' };
        const pagePath = `/api/v1/public/partners/${fixture.partner.slug}`;

        // TEST:V7:14 (a) PARTNER_MANAGE alone is not the permission of ACC:12.
        const denied = await moderationRequest({
            partnerId: fixture.partner.id,
            actorId: actor1,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE],
            body: { action: 'MODERATE', reason: 'Contenido inadecuado' }
        });
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.code).toBe('FORBIDDEN');
        expect(
            (
                await db()
                    .select({ presenceModerated: partners.presenceModerated })
                    .from(partners)
                    .where(eq(partners.id, fixture.partner.id))
            )[0]
        ).toEqual({ presenceModerated: false });
        expect(await eventRows(fixture.partner.id)).toHaveLength(eventCount);
        expect(scheduleSpy).not.toHaveBeenCalled();

        // Warm the response cache before the route write.
        expect((await app.request(pagePath, { headers: publicHeaders })).status).toBe(200);

        const retiredRevoke = await app.request(
            `/api/v1/admin/partners/${fixture.partner.id}/revoke`,
            {
                method: 'POST',
                headers: adminHeaders(actor2, [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.PARTNER_MANAGE
                ]),
                body: JSON.stringify({ reason: 'Retired' })
            }
        );
        expect(retiredRevoke.status).toBe(404);
        // TEST:V7:14 (b) LISTING_MODERATE alone can moderate; the response cache is purged after commit.
        const moderated = await moderationRequest({
            partnerId: fixture.partner.id,
            actorId: actor2,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'MODERATE', reason: 'Contenido inadecuado' }
        });
        expect(moderated.status).toBe(200);
        expect((await moderated.json()).data).toEqual({
            id: fixture.partner.id,
            presenceModerated: true
        });
        expect(
            (
                await db()
                    .select({ presenceModerated: partners.presenceModerated })
                    .from(partners)
                    .where(eq(partners.id, fixture.partner.id))
            )[0]
        ).toEqual({ presenceModerated: true });
        const moderatedEvents = await eventRows(fixture.partner.id);
        expect(moderatedEvents).toHaveLength(eventCount + 1);
        const moderatedEvent = moderatedEvents.at(-1);
        expect(moderatedEvent).toEqual({
            event_type: 'partner.presence_moderation_changed',
            entity_type: 'partner',
            entity_id: fixture.partner.id,
            actor_type: 'admin',
            actor_id: actor2,
            reason: 'Contenido inadecuado',
            changes: [{ field: 'presence_moderated', old: false, new: true }],
            correlation_id: moderatedEvent?.correlation_id
        });
        expect(moderatedEvent?.correlation_id).toBeTruthy();
        const hidden = await app.request(pagePath, { headers: publicHeaders });
        expect(hidden.status).toBe(404);
        expect((await hidden.json()).error.code).toBe('NOT_FOUND');
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        // TEST:V7:14 (c) Repeating the same decision is a no-op conflict without another event.
        const repeated = await moderationRequest({
            partnerId: fixture.partner.id,
            actorId: actor2,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'MODERATE', reason: 'Duplicado' }
        });
        expect(repeated.status).toBe(409);
        expect((await repeated.json()).error.code).toBe('ALREADY_EXISTS');
        expect(await eventRows(fixture.partner.id)).toHaveLength(eventCount + 1);
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        // TEST:V7:14 (d) Lifting moderation writes the reverse delta and restores the page.
        const lifted = await moderationRequest({
            partnerId: fixture.partner.id,
            actorId: actor2,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'LIFT', reason: 'Revisado' }
        });
        expect(lifted.status).toBe(200);
        expect((await lifted.json()).data).toEqual({
            id: fixture.partner.id,
            presenceModerated: false
        });
        expect(await eventRows(fixture.partner.id)).toHaveLength(eventCount + 2);
        const liftEvent = (await eventRows(fixture.partner.id)).at(-1);
        expect(liftEvent).toEqual({
            event_type: 'partner.presence_moderation_changed',
            entity_type: 'partner',
            entity_id: fixture.partner.id,
            actor_type: 'admin',
            actor_id: actor2,
            reason: 'Revisado',
            changes: [{ field: 'presence_moderated', old: true, new: false }],
            correlation_id: liftEvent?.correlation_id
        });
        expect((await app.request(pagePath, { headers: publicHeaders })).status).toBe(200);
        expect(scheduleSpy).toHaveBeenCalledTimes(2);

        // TEST:V7:14 (e) Missing and whitespace-only reasons fail before writing.
        for (const body of [{ action: 'MODERATE' }, { action: 'MODERATE', reason: '   ' }]) {
            expect(
                (
                    await moderationRequest({
                        partnerId: fixture.partner.id,
                        actorId: actor2,
                        permissions: [
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.LISTING_MODERATE
                        ],
                        body
                    })
                ).status
            ).toBe(400);
        }
        expect(scheduleSpy).toHaveBeenCalledTimes(2);
        expect(
            (
                await db()
                    .select({ presenceModerated: partners.presenceModerated })
                    .from(partners)
                    .where(eq(partners.id, fixture.partner.id))
            )[0]
        ).toEqual({ presenceModerated: false });

        // TEST:V7:14 (f) An administrator cannot moderate their own Partner.
        const self = await moderationRequest({
            partnerId: fixture.partner.id,
            actorId: owner.id,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'MODERATE', reason: 'Propio' }
        });
        expect(self.status).toBe(403);
        expect((await self.json()).error.code).toBe('FORBIDDEN');
        expect(scheduleSpy).toHaveBeenCalledTimes(2);
        expect(
            (
                await db()
                    .select({ presenceModerated: partners.presenceModerated })
                    .from(partners)
                    .where(eq(partners.id, fixture.partner.id))
            )[0]
        ).toEqual({ presenceModerated: false });

        const billingAfter = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.subscriptionId));
        const paymentsAfter = await db()
            .select()
            .from(payments)
            .where(eq(payments.subscriptionId, fixture.subscriptionId));
        expect(billingAfter.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(
            billingBefore.map(({ updatedAt: _updatedAt, ...row }) => row)
        );
        expect(paymentsAfter.map(({ updatedAt: _updatedAt, ...row }) => row)).toEqual(
            paymentsBefore.map(({ updatedAt: _updatedAt, ...row }) => row)
        );
        expect(scheduleSpy).toHaveBeenNthCalledWith(1, {
            entityType: 'partner',
            id: fixture.partner.id,
            slug: fixture.partner.slug
        });
        expect(scheduleSpy).toHaveBeenNthCalledWith(2, {
            entityType: 'partner',
            id: fixture.partner.id,
            slug: fixture.partner.slug
        });
        vi.restoreAllMocks();
    });

    it('accepts an unowned Partner and returns NOT_FOUND for an absent id', async () => {
        const [partner] = await db()
            .insert(partners)
            .values({
                slug: `v7-${randomUUID()}`,
                name: 'Unowned moderation fixture',
                type: 'business',
                ownerUserId: null
            })
            .returning();
        if (!partner) throw new Error('Expected unowned Partner');
        createdPartnerIds.push(partner.id);
        const actorId = randomUUID();
        const success = await moderationRequest({
            partnerId: partner.id,
            actorId,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'MODERATE', reason: 'Sin dueño' }
        });
        expect(success.status).toBe(200);
        expect((await success.json()).data).toEqual({ id: partner.id, presenceModerated: true });
        const missing = await moderationRequest({
            partnerId: randomUUID(),
            actorId,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.LISTING_MODERATE],
            body: { action: 'MODERATE', reason: 'No existe' }
        });
        expect(missing.status).toBe(404);
        expect((await missing.json()).error.code).toBe('NOT_FOUND');
    });
});
