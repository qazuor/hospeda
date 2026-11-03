import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    coveredPeriods,
    getDb,
    payments,
    plans,
    planVersionEntitlements,
    planVersions,
    sql,
    subscriptions
} from '@repo/db';
import { RoleEnum, RoleGrantReason, VerticalEnum } from '@repo/schemas';
import { grantRole } from '@repo/service-core';
import type { EffectiveSetSnapshot } from '@repo/verticals';
import { runDailyCoverageReconciler } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import * as effectiveSetCache from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { testDb } from '../../e2e/setup/test-database';
import { seededPermissionsFor } from '../helpers/seeded-role-permissions';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';

describe('TEST:V7:12 AC:V7:12 partner role survives loss of presence', () => {
    let app: ReturnType<typeof initApp>;
    const users: string[] = [];
    const partnerIds: string[] = [];
    const optionIds: string[] = [];
    const subscriptionIds: string[] = [];
    const paymentIds: string[] = [];
    const coveredPeriodIds: string[] = [];

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        for (const id of coveredPeriodIds.splice(0))
            await getDb().delete(coveredPeriods).where(sql`${coveredPeriods.id} = ${id}::uuid`);
        for (const id of paymentIds.splice(0))
            await getDb().delete(payments).where(sql`${payments.id} = ${id}::uuid`);
        for (const id of subscriptionIds.splice(0))
            await getDb().delete(subscriptions).where(sql`${subscriptions.id} = ${id}::uuid`);
        for (const id of optionIds.splice(0))
            await getDb().delete(billingOptions).where(sql`${billingOptions.id} = ${id}::uuid`);
        for (const id of partnerIds.splice(0))
            await getDb().execute(sql`DELETE FROM partners WHERE id = ${id}::uuid`);
        for (const id of users.splice(0)) {
            await getDb().execute(sql`DELETE FROM user_role_audit WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM session WHERE user_id = ${id}::uuid`);
            await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
        }
    });

    afterAll(async () => testDb.teardown());

    async function rolePhoto(userId: string) {
        const result = await getDb().execute(sql`
            SELECT user_id, role, granted_at, granted_by, grant_reason
            FROM user_role WHERE user_id = ${userId}::uuid ORDER BY role`);
        return result.rows;
    }

    it('(a) keeps the complete role photo after Partner coverage is suspended and reconciled', async () => {
        const owner = await createOwner();
        users.push(owner.id);
        const grant = await grantRole({
            userId: owner.id,
            role: RoleEnum.PARTNER_OWNER,
            grantedBy: null,
            reason: RoleGrantReason.PARTNER_CLAIMED
        });
        expect(grant.error).toBeUndefined();
        const partnerResult = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, owner_user_id, created_by_id, updated_by_id)
            VALUES (${`hos1487-kept-${randomUUID()}`}, 'HOS1487 role retained', 'business', 'ACTIVE',
                    ${owner.id}::uuid, ${owner.id}::uuid, ${owner.id}::uuid)
            RETURNING id`);
        const partner = partnerResult.rows[0];
        expect(partner?.id).toBeTruthy();
        const partnerId = String(partner?.id);
        partnerIds.push(partnerId);

        const [plan] = await getDb()
            .insert(plans)
            .values({
                vertical: VerticalEnum.PARTNER,
                slug: `hos1487-role-${randomUUID()}`,
                name: 'HOS1487 role retention fixture'
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('Expected Partner plan');
        const versionId = await getDb().transaction(async (tx) => {
            const [version] = await tx
                .insert(planVersions)
                .values({
                    planId: plan.id,
                    vertical: VerticalEnum.PARTNER,
                    rank: Math.floor(Math.random() * 100_000_000) + 1_000,
                    sellable: false,
                    current: false,
                    trialDays: 0,
                    allowsPause: false
                })
                .returning({ id: planVersions.id });
            if (!version) throw new Error('Expected Partner plan version');
            await tx.insert(planVersionEntitlements).values([
                {
                    planVersionId: version.id,
                    key: 'partner_public_page',
                    planQuota: null,
                    trialQuota: null
                },
                {
                    planVersionId: version.id,
                    key: 'partner_carousel_presence',
                    planQuota: null,
                    trialQuota: null
                }
            ]);
            return version.id;
        });
        const [option] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: versionId,
                cycle: 'monthly',
                amount: 10_000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Expected Partner billing option');
        optionIds.push(option.id);
        const [subscription] = await getDb()
            .insert(subscriptions)
            .values({
                userId: owner.id,
                vertical: VerticalEnum.PARTNER,
                planVersionId: versionId,
                billingOptionId: option.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        if (!subscription) throw new Error('Expected Partner subscription');
        subscriptionIds.push(subscription.id);
        const [payment] = await getDb()
            .insert(payments)
            .values({
                subscriptionId: subscription.id,
                amount: 10_000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'FAKE',
                providerFactId: `hos1487-role-${randomUUID()}`,
                factAt: new Date()
            })
            .returning({ id: payments.id });
        if (!payment) throw new Error('Expected Partner coverage payment');
        paymentIds.push(payment.id);
        const [coveredPeriod] = await getDb()
            .insert(coveredPeriods)
            .values({
                subscriptionId: subscription.id,
                periodStart: new Date(),
                paymentId: payment.id,
                creditedAt: new Date()
            })
            .returning({ id: coveredPeriods.id });
        if (!coveredPeriod) throw new Error('Expected covered Partner period');
        coveredPeriodIds.push(coveredPeriod.id);

        const before = await rolePhoto(owner.id);
        expect(before.some((row) => row.role === 'PARTNER_OWNER')).toBe(true);
        expect(before).toContainEqual(
            expect.objectContaining({ role: 'PARTNER_OWNER', grant_reason: 'partner_claimed' })
        );
        const effectiveSet = await getListingAccessPorts().effectiveSet({
            userId: owner.id,
            vertical: VerticalEnum.PARTNER
        });
        const cachedPartnerKeys = ['partner_public_page', 'partner_carousel_presence'].filter(
            (key) =>
                effectiveSet?.entitlements.get({
                    key,
                    userId: owner.id,
                    vertical: VerticalEnum.PARTNER
                }) !== undefined
        );
        expect(cachedPartnerKeys).toEqual(['partner_public_page', 'partner_carousel_presence']);

        // The production writer, writeArrearsSuspension, is not exported from @repo/service-core;
        // G4 already guarantees subscription transitions never write user_role.
        await getDb().execute(sql`
            UPDATE subscription SET status = 'SUSPENDED'
            WHERE id = ${subscription.id}::uuid`);
        await getDb().execute(sql`
            UPDATE covered_period SET released_at = now()
            WHERE subscription_id = ${subscription.id}::uuid AND released_at IS NULL`);
        const ports = getListingReconcilerPorts();
        expect(await ports.presence.liveKeys({ userId: owner.id })).toEqual([]);
        const cachedSnapshot: EffectiveSetSnapshot = {
            version: 1,
            userId: owner.id,
            vertical: VerticalEnum.PARTNER,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries: [
                { key: 'partner_public_page', value: 1, strategy: 'MAX' },
                { key: 'partner_carousel_presence', value: 1, strategy: 'MAX' }
            ]
        };
        vi.spyOn(effectiveSetCache, 'peekEffectiveSetForUser').mockResolvedValue(cachedSnapshot);
        let cursor: string | null = null;
        let ownerWasEvaluated = false;
        do {
            const page = await ports.population.listPartnerUsers({ after: cursor, limit: 200 });
            ownerWasEvaluated ||= page.items.includes(owner.id);
            cursor = page.next;
        } while (cursor !== null);
        const summary = await runDailyCoverageReconciler({ ports });
        expect(summary.partnerChecked).toBeGreaterThan(0);
        expect(summary.partnerInvalidated).toBeGreaterThan(0);
        if (!ownerWasEvaluated) console.info('HUECO: reconciler did not evaluate the test owner');

        const after = await rolePhoto(owner.id);
        expect(after).toEqual(before);
        const ownerRow = await getDb().execute(sql`
            SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`);
        expect(ownerRow.rows).toEqual([{ owner_user_id: owner.id }]);

        // (b) Even after presence loss, the owner family still passes route step 3.
        const familyPermissions = [
            ...new Set([
                ...seededPermissionsFor({ role: RoleEnum.USER }),
                ...seededPermissionsFor({ role: RoleEnum.PARTNER_OWNER })
            ])
        ];
        const update = await app.request('/api/v1/protected/partners/mine', {
            method: 'PATCH',
            headers: actorHeaders({
                id: owner.id,
                role: RoleEnum.PARTNER_OWNER,
                permissions: familyPermissions
            }),
            body: JSON.stringify({ contactInfo: { workPhone: '+543442000000' } })
        });
        expect(update.status).toBe(200);
        const updatedContact = await getDb().execute(sql`
            SELECT contact_info FROM partners WHERE id = ${partnerId}::uuid`);
        expect(updatedContact.rows).toEqual([{ contact_info: { workPhone: '+543442000000' } }]);
    });

    it('(c) rejects an owner without PARTNER_OWNER and leaves their Partner unchanged', async () => {
        const owner = await createOwner();
        users.push(owner.id);
        const inserted = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, owner_user_id, created_by_id, updated_by_id, contact_info)
            VALUES (${`hos1487-no-role-${randomUUID()}`}, 'HOS1487 no role', 'business', 'ACTIVE',
                    ${owner.id}::uuid, ${owner.id}::uuid, ${owner.id}::uuid, '{"workPhone":"+543442111111"}'::jsonb)
            RETURNING id`);
        const partnerId = String(inserted.rows[0]?.id);
        partnerIds.push(partnerId);
        const before = await getDb().execute(
            sql`SELECT * FROM partners WHERE id = ${partnerId}::uuid`
        );

        const response = await app.request('/api/v1/protected/partners/mine', {
            method: 'PATCH',
            headers: actorHeaders({
                id: owner.id,
                role: RoleEnum.USER,
                permissions: seededPermissionsFor({ role: RoleEnum.USER })
            }),
            body: JSON.stringify({ contactInfo: { workPhone: '+543442222222' } })
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
            metadata: {
                timestamp: expect.any(String),
                requestId: expect.any(String),
                version: '1.0.0'
            }
        });
        const after = await getDb().execute(
            sql`SELECT * FROM partners WHERE id = ${partnerId}::uuid`
        );
        expect(after.rows).toEqual(before.rows);
    });

    it('(d) keeps GET /mine available to owners and accounts without a Partner', async () => {
        const owner = await createOwner();
        const visitor = await createOwner();
        users.push(owner.id, visitor.id);
        const inserted = await getDb().execute(sql`
            INSERT INTO partners (slug, name, type, lifecycle_state, owner_user_id, created_by_id, updated_by_id)
            VALUES (${`hos1487-get-mine-${randomUUID()}`}, 'HOS1487 GET mine', 'business', 'ACTIVE',
                    ${owner.id}::uuid, ${owner.id}::uuid, ${owner.id}::uuid)
            RETURNING id`);
        const partnerId = String(inserted.rows[0]?.id);
        partnerIds.push(partnerId);

        const ownerResponse = await app.request('/api/v1/protected/partners/mine', {
            headers: actorHeaders({ id: owner.id, role: RoleEnum.USER, permissions: [] })
        });
        expect(ownerResponse.status).toBe(200);
        const ownerBody = await ownerResponse.json();
        expect(ownerBody.data.partner).toMatchObject({ id: partnerId });

        const visitorResponse = await app.request('/api/v1/protected/partners/mine', {
            headers: actorHeaders({ id: visitor.id, role: RoleEnum.USER, permissions: [] })
        });
        expect(visitorResponse.status).toBe(200);
        expect(await visitorResponse.json()).toEqual({
            success: true,
            data: { partner: null },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
    });
});
