import { billingOptions, eq, getDb, plans, planVersions, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './admin-cancellation-fixtures';
import { seedUser } from './revocation-route-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    auditLog: audit
}));
const adminId = '00000000-0000-4000-8000-000000000092';
let app: ReturnType<typeof initApp>;
let ownerId: string;
let subscriptionId: string;
let currentOptionId: string;
let currentVersionId: string;
let destinationOptionId: string;
const optionsPath = (id = subscriptionId) =>
    `/api/v1/admin/billing-subscription/${id}/plan-change-options`;
const inspectPath = () => `/api/v1/admin/billing-subscription/${subscriptionId}`;
const headers = (id: string, permissions: PermissionEnum[]) =>
    actorHeaders({
        id,
        role: 'SUPER_ADMIN',
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
    ownerId = await seedUser('admin-plan-options');
    const seedPlan = async (name: string, amount: number) => {
        const [plan] = await getDb()
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `plan-options-${crypto.randomUUID()}`,
                name
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('plan missing');
        const [version] = await getDb()
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 1000000000) + 10000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: true
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('version missing');
        const [option] = await getDb()
            .insert(billingOptions)
            .values({ planVersionId: version.id, cycle: 'monthly', amount, currency: 'ARS' })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('option missing');
        return { versionId: version.id, optionId: option.id };
    };
    const current = await seedPlan('Plan actual de prueba', 10000);
    const destination = await seedPlan('Plan destino de prueba', 20000);
    currentOptionId = current.optionId;
    currentVersionId = current.versionId;
    destinationOptionId = destination.optionId;
    const [subscription] = await getDb()
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: 'accommodation',
            planVersionId: current.versionId,
            billingOptionId: current.optionId,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('subscription missing');
    subscriptionId = subscription.id;
});
afterAll(async () => testDb.teardown());

describe('ACC_10 plan change options and enriched inspection', () => {
    it('requires its own permission', async () => {
        const response = await app.request(optionsPath(), { headers: headers(adminId, []) });
        expect(response.status).toBe(403);
    });
    it('rejects the subject and missing subscription', async () => {
        const permission = [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN];
        const subject = await app.request(optionsPath(), { headers: headers(ownerId, permission) });
        expect(subject.status).toBe(403);
        expect((await subject.json()).error.details.reason).toBe('ADMINISTRATIVE_ACTION_FORBIDDEN');
        const missing = await app.request(optionsPath(crypto.randomUUID()), {
            headers: headers(adminId, permission)
        });
        expect(missing.status).toBe(404);
    });
    it('reads persisted sellable options, marks current, and audits BILLING_READ', async () => {
        audit.mockClear();
        const response = await app.request(optionsPath(), {
            headers: headers(adminId, [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN])
        });
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data.options).toContainEqual(
            expect.objectContaining({
                billingOptionId: currentOptionId,
                planName: 'Plan actual de prueba',
                amountMinor: 10000,
                cycle: 'monthly',
                current: true
            })
        );
        expect(data.options).toContainEqual(
            expect.objectContaining({
                billingOptionId: destinationOptionId,
                planName: 'Plan destino de prueba',
                amountMinor: 20000,
                cycle: 'monthly',
                current: false
            })
        );
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_READ,
                resourceId: subscriptionId
            })
        );
    });
    it('adds subject identity and current plan to inspect', async () => {
        const response = await app.request(inspectPath(), {
            headers: headers(adminId, [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT])
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            subject: { id: ownerId },
            currentPlan: { planName: 'Plan actual de prueba', cycle: 'monthly' }
        });
    });
    it('keeps the anchored option marked after its version leaves the current offer', async () => {
        await getDb()
            .update(planVersions)
            .set({ current: false })
            .where(eq(planVersions.id, currentVersionId));
        const response = await app.request(optionsPath(), {
            headers: headers(adminId, [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN])
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data.options).toContainEqual(
            expect.objectContaining({ billingOptionId: currentOptionId, current: true })
        );
    });
});
