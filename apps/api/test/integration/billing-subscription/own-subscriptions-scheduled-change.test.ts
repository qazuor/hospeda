import { eq, subscriptionScheduledChanges } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './revocation-route-fixtures';
import { startPlanChangeScenario, withCompositionRollback } from './succession-wiring-fixtures';

/**
 * HOS-2381: a downgrade queued from Mi suscripción must be read back by the
 * own-subscriptions reader, so the «Tu plan cambia el…» notice survives a reload.
 * The downgrade goes through the real owner route, which calls `queueDowngrade`.
 */
const clock = createAdjustableClock({ start: new Date('2026-10-05T12:00:00.000Z') });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'fixture signup' }]
});
const ownPath = '/api/v1/protected/billing-subscription/';
const planChangePath = (id: string) => `/api/v1/protected/billing-subscription/${id}/plan-change`;
let app: ReturnType<typeof initApp>;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
    injectPaymentProvider({ provider: fake });
    app = initApp({ clock, paymentProvider: fake });
});
afterAll(async () => testDb.teardown());

async function readOwnRow(input: {
    readonly userId: string;
    readonly subscriptionId: string;
}): Promise<Record<string, unknown>> {
    const response = await app.request(ownPath, {
        headers: actorHeaders({
            id: input.userId,
            role: 'USER',
            permissions: [PermissionEnum.BILLING_VIEW_OWN]
        })
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as {
        data: { subscriptions: Array<Record<string, unknown>> };
    };
    const row = body.data.subscriptions.find((item) => item.id === input.subscriptionId);
    if (!row) throw new Error(`Expected own subscription ${input.subscriptionId}`);
    return row;
}

describe('HOS-2381 own subscriptions read back a queued downgrade', () => {
    it('returns null when nothing is queued', async () => {
        await withCompositionRollback(async (tx) => {
            // Arrange
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                },
                direction: 'DOWN'
            });

            // Act
            const listed = await readOwnRow(row);

            // Assert
            expect(listed.scheduledChange).toBeNull();
        });
    });

    it('returns the effective date of a downgrade queued through the owner route', async () => {
        await withCompositionRollback(async (tx) => {
            // Arrange
            const row = await startPlanChangeScenario(tx, {
                provider: fake,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                },
                direction: 'DOWN'
            });
            const requested = await app.request(planChangePath(row.subscriptionId), {
                method: 'POST',
                headers: actorHeaders({ id: row.userId, role: 'USER', permissions: [] }),
                body: JSON.stringify({
                    billingOptionId: row.targetOptionId,
                    payerEmail: row.declaredPayerEmail
                })
            });
            expect(requested.status, await requested.clone().text()).toBe(200);
            const outcome = (await requested.json()) as {
                data: { outcome: string; effectiveAt: string };
            };
            expect(outcome.data.outcome).toBe('DOWNGRADE');
            const [queued] = await tx
                .select({ effectiveAt: subscriptionScheduledChanges.effectiveAt })
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.subscriptionId, row.subscriptionId));
            expect(queued?.effectiveAt.toISOString()).toBe(outcome.data.effectiveAt);

            // Act: what a page reload reads.
            const listed = await readOwnRow(row);

            // Assert
            expect(listed.scheduledChange).toEqual({ effectiveAt: outcome.data.effectiveAt });
        });
    });
});
