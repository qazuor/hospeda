import { eq, getDb, subscriptions } from '@repo/db';
import { OwnSubscriptionsResponseSchema, PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { seedPrincipal } from './revocation-route-fixtures';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const path = '/api/v1/protected/billing-subscription/';
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
afterEach(async () => {
    await retireSelfCancelRows();
});
afterAll(async () => {
    await retireSelfCancelRows();
    await testDb.teardown();
});

async function readDeclined(ownerId: string) {
    const response = await app.request(path, { headers: headers(ownerId) });
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const parsed = z.object({ data: OwnSubscriptionsResponseSchema }).safeParse(body);
    expect(parsed.success).toBe(true);
    return parsed.success ? parsed.data.data.declinedSignups : [];
}

async function seedDeclined(
    ownerId: string,
    overrides: { readonly createdAt?: Date; readonly updatedAt?: Date } = {}
) {
    const subscriptionId = await seedPrincipal({ ownerId, status: 'CHARGE_DECLINED' });
    const declinedAt = overrides.updatedAt ?? new Date(NOW.getTime() - 2 * 86_400_000);
    await getDb()
        .update(subscriptions)
        .set({
            createdAt: overrides.createdAt ?? declinedAt,
            updatedAt: declinedAt,
            declaredPayerEmail: 'payer@example.test'
        })
        .where(eq(subscriptions.id, subscriptionId));
    const [row] = await getDb()
        .select({ billingOptionId: subscriptions.billingOptionId })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row?.billingOptionId) throw new Error('Expected declined signup option');
    return { subscriptionId, billingOptionId: row.billingOptionId, declinedAt };
}

describe('HOS-2064 own declined signup list', () => {
    it('lists a recent declined signup with its option, declared email and plan', async () => {
        // Arrange
        const ownerId = await seedUser('declined-recent-owner');
        const seeded = await seedDeclined(ownerId);
        // Act
        const notices = await readDeclined(ownerId);
        // Assert
        expect(notices).toHaveLength(1);
        expect(notices[0]).toMatchObject({
            subscriptionId: seeded.subscriptionId,
            vertical: 'accommodation',
            billingOptionId: seeded.billingOptionId,
            declaredPayerEmail: 'payer@example.test',
            declinedAt: seeded.declinedAt.toISOString(),
            plan: { slug: expect.any(String), name: expect.any(String) }
        });
    });

    it('does not list it after seven days', async () => {
        // Arrange
        const ownerId = await seedUser('declined-expired-owner');
        await seedDeclined(ownerId, { updatedAt: new Date(NOW.getTime() - 7 * 86_400_000) });
        // Act
        const notices = await readDeclined(ownerId);
        // Assert
        expect(notices).toEqual([]);
    });

    it('does not list it when the owner has an active subscription in the vertical', async () => {
        // Arrange
        const ownerId = await seedUser('declined-active-owner');
        await seedDeclined(ownerId);
        await seedPrincipal({ ownerId, status: 'ACTIVE' });
        // Act
        const notices = await readDeclined(ownerId);
        // Assert
        expect(notices).toEqual([]);
    });

    it('never lists another owner’s declined signup', async () => {
        // Arrange
        const ownerA = await seedUser('declined-owner-a');
        const ownerB = await seedUser('declined-owner-b');
        await seedDeclined(ownerA);
        // Act
        const notices = await readDeclined(ownerB);
        // Assert
        expect(notices).toEqual([]);
    });
});
