import { eq, getDb, manualPayments, plans, planVersions, subscriptions } from '@repo/db';
import { OwnManualInstallmentsResponseSchema, PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedManualPayment,
    seedPrincipal,
    seedUser
} from './revocation-route-fixtures';

const clock = routeClock(NOW);
const fake = routeFake(clock);
const path = '/api/v1/protected/billing-subscription/manual-installments';
let app: ReturnType<typeof initApp>;
const headers = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    clock.set(NOW);
    injectPaymentProvider({ provider: fake });
});
afterEach(async () => retireRevocationRouteRows());
afterAll(async () => {
    await retireRevocationRouteRows();
    await testDb.teardown();
});

async function seedOpen(input: {
    status?: 'PENDING_AUTHORIZATION' | 'GRACE_PERIOD';
    paymentMethod?: 'MANUAL' | 'CARD';
    ownerId?: string;
    dueAt?: Date;
}) {
    const ownerId = input.ownerId ?? (await seedUser('manual-installment-owner'));
    const subscriptionId = await seedPrincipal({
        ownerId,
        status: input.status ?? 'PENDING_AUTHORIZATION',
        paymentMethod: input.paymentMethod ?? 'MANUAL'
    });
    const dueAt = input.dueAt ?? new Date('2026-10-15T12:00:00.000Z');
    await getDb()
        .update(subscriptions)
        .set(
            input.status === 'GRACE_PERIOD'
                ? { graceStartedAt: new Date('2026-10-01T12:00:00.000Z'), graceEndsAt: dueAt }
                : { authorizationWindowEndsAt: dueAt, authorizationWindowDeadlineVersion: 1 }
        )
        .where(eq(subscriptions.id, subscriptionId));
    const manualPaymentId = await seedManualPayment({ subscriptionId, registeredBy: ownerId });
    await getDb()
        .update(manualPayments)
        .set({ status: 'AWAITING', registeredBy: null, registeredAt: null })
        .where(eq(manualPayments.id, manualPaymentId));
    return { ownerId, subscriptionId, manualPaymentId, dueAt };
}

async function read(ownerId: string) {
    const response = await app.request(path, { headers: headers(ownerId) });
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const data = (body as { data: unknown }).data;
    expect(OwnManualInstallmentsResponseSchema.safeParse(data).success).toBe(true);
    return OwnManualInstallmentsResponseSchema.parse(data).installments;
}

describe('manual installment read route (HOS-1782)', () => {
    it('lists the first manual installment with amount, period and due date', async () => {
        // Arrange
        const row = await seedOpen({});
        const [plan] = await getDb()
            .select({ slug: plans.slug, name: plans.name })
            .from(subscriptions)
            .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .innerJoin(plans, eq(plans.id, planVersions.planId))
            .where(eq(subscriptions.id, row.subscriptionId));
        if (!plan) throw new Error('Expected seeded plan');
        // Act
        const result = await read(row.ownerId);
        // Assert
        expect(result).toEqual([
            {
                subscriptionId: row.subscriptionId,
                manualPaymentId: row.manualPaymentId,
                vertical: 'accommodation',
                plan,
                amount: { amountMinor: 10000, currency: 'ARS' },
                periodStart: '2026-10-01T03:00:00.000Z',
                dueAt: row.dueAt.toISOString()
            }
        ]);
    });

    it('lists a renewal installment due at the end of the grace period', async () => {
        // Arrange
        const row = await seedOpen({ status: 'GRACE_PERIOD' });
        // Act
        const result = await read(row.ownerId);
        // Assert
        expect(result[0]?.dueAt).toBe(row.dueAt.toISOString());
    });

    it('does not list a registered installment', async () => {
        // Arrange
        const row = await seedOpen({});
        await getDb()
            .update(manualPayments)
            .set({ status: 'REGISTERED', registeredBy: row.ownerId, registeredAt: NOW })
            .where(eq(manualPayments.id, row.manualPaymentId));
        // Act
        const result = await read(row.ownerId);
        // Assert
        expect(result).toEqual([]);
    });

    it("never lists another owner's installment", async () => {
        // Arrange
        await seedOpen({});
        const otherOwner = await seedUser('manual-installment-other-owner');
        // Act
        const result = await read(otherOwner);
        // Assert
        expect(result).toEqual([]);
    });

    it('does not list a card subscription in grace', async () => {
        // Arrange
        const row = await seedOpen({ status: 'GRACE_PERIOD', paymentMethod: 'CARD' });
        // Act
        const result = await read(row.ownerId);
        // Assert
        expect(result).toEqual([]);
    });

    it('does not list an installment whose due date already passed', async () => {
        // Arrange
        const row = await seedOpen({ dueAt: new Date(NOW.getTime() - 1) });
        // Act
        const result = await read(row.ownerId);
        // Assert
        expect(result).toEqual([]);
    });
});
