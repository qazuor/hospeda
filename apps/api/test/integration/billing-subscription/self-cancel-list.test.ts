import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireSelfCancelRows,
    routeClock,
    routeFake,
    seedSelfState
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const listPath = '/api/v1/protected/billing-subscription/';
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

describe('TEST:1617:3 own subscription list', () => {
    it("returns only the owner's principal rows in the four supported states", async () => {
        const own = await Promise.all(
            ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED'].map((status) =>
                seedSelfState(
                    status as 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCEL_SCHEDULED'
                )
            )
        );
        const foreign = await seedSelfState('ACTIVE');
        const excluded = await Promise.all(
            ['CANCELLED', 'PAUSED', 'PENDING_AUTHORIZATION'].map((status) =>
                seedSelfState(status as 'CANCELLED' | 'PAUSED' | 'PENDING_AUTHORIZATION')
            )
        );
        const ownIds = own.map((row) => row.subscriptionId);
        for (const row of own) {
            const response = await app.request(listPath, { headers: headers(row.ownerId) });
            expect(response.status).toBe(200);
            const ids = (
                (await response.json()) as { data: { subscriptions: Array<{ id: string }> } }
            ).data.subscriptions.map((subscription) => subscription.id);
            expect(ids).toEqual([row.subscriptionId]);
            expect(ids).not.toContain(foreign.subscriptionId);
            for (const excludedRow of excluded)
                expect(ids).not.toContain(excludedRow.subscriptionId);
        }
        expect(ownIds).toHaveLength(4);
    });

    it('requires a session', async () => {
        const response = await app.request(listPath, { headers: actorHeaders() });
        expect(response.status).toBe(401);
    });
});
