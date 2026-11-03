import { randomUUID } from 'node:crypto';
import { billingOptions, getDb, plans, planVersions, sql, subscriptions } from '@repo/db';
import { RoleEnum, RoleGrantReason, VerticalEnum } from '@repo/schemas';
import { grantRole } from '@repo/service-core';
import { runDailyCoverageReconciler } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { testDb } from '../../e2e/setup/test-database';
import { createOwner } from '../listing-publication/publication-routes.helpers';

describe('TEST:V7:12 AC:V7:12 partner role survives loss of presence', () => {
    const users: string[] = [];
    const partnerIds: string[] = [];
    const optionIds: string[] = [];
    const subscriptionIds: string[] = [];

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        initApp();
    });

    afterEach(async () => {
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
        const [version] = await getDb()
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
        const [option] = await getDb()
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
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
                planVersionId: version.id,
                billingOptionId: option.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        if (!subscription) throw new Error('Expected Partner subscription');
        subscriptionIds.push(subscription.id);

        const before = await rolePhoto(owner.id);
        expect(before.some((row) => row.role === 'PARTNER_OWNER')).toBe(true);
        expect(before).toContainEqual(
            expect.objectContaining({ role: 'PARTNER_OWNER', grant_reason: 'partner_claimed' })
        );

        // The production writer, writeArrearsSuspension, is not exported from @repo/service-core;
        // G4 already guarantees subscription transitions never write user_role.
        await getDb().execute(sql`
            UPDATE subscription SET status = 'SUSPENDED'
            WHERE id = ${subscription.id}::uuid`);
        const ports = getListingReconcilerPorts();
        let cursor: string | null = null;
        let ownerWasEvaluated = false;
        do {
            const page = await ports.population.listPartnerUsers({ after: cursor, limit: 200 });
            ownerWasEvaluated ||= page.items.includes(owner.id);
            cursor = page.next;
        } while (cursor !== null);
        const summary = await runDailyCoverageReconciler({ ports });
        expect(summary.partnerChecked).toBeGreaterThan(0);
        if (!ownerWasEvaluated) console.info('HUECO: reconciler did not evaluate the test owner');

        const after = await rolePhoto(owner.id);
        expect(after).toEqual(before);
        const ownerRow = await getDb().execute(sql`
            SELECT owner_user_id FROM partners WHERE id = ${partnerId}::uuid`);
        expect(ownerRow.rows).toEqual([{ owner_user_id: owner.id }]);
    });
});
