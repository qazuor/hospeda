import {
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    planVersions,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { grantTemporaryCourtesy } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    seedSelfActive,
    seedUser
} from './self-cancel-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
const headers = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
const path = (id: string, act: 'pause-preview' | 'pause') =>
    `/api/v1/protected/billing-subscription/${id}/${act}`;
const preview = (id: string, ownerId: string) =>
    app.request(path(id, 'pause-preview'), { headers: headers(ownerId) });
const pause = (id: string, ownerId: string, body: unknown) =>
    app.request(path(id, 'pause'), {
        method: 'POST',
        headers: headers(ownerId),
        body: JSON.stringify(body)
    });
async function seedCourtesy() {
    const row = await seedSelfActive(fake, clock);
    const [sub] = await getDb()
        .select({ planVersionId: subscriptions.planVersionId })
        .from(subscriptions)
        .where(eq(subscriptions.id, row.subscriptionId));
    if (!sub?.planVersionId) throw new Error('Missing plan version');
    const [oldVersion] = await getDb()
        .select({ planId: planVersions.planId })
        .from(planVersions)
        .where(eq(planVersions.id, sub.planVersionId));
    if (!oldVersion) throw new Error('Missing plan');
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: oldVersion.planId,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Missing pause-ready version');
    const [option] = await getDb()
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Missing pause-ready option');
    await getDb()
        .update(subscriptions)
        .set({ planVersionId: version.id, billingOptionId: option.id })
        .where(eq(subscriptions.id, row.subscriptionId));
    const granted = await grantTemporaryCourtesy(
        {
            subscriptionId: row.subscriptionId,
            months: 1,
            grantedBy: row.ownerId,
            reason: 'S35 route test'
        },
        { provider: fake, clock }
    );
    expect(granted.outcome).toBe('GRANTED');
    if (granted.outcome !== 'GRANTED') throw new Error('Courtesy grant failed');
    return { ...row, endsAt: granted.endsAt };
}
async function snapshot(id: string) {
    const [sub] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    const pauses = await getDb()
        .select({ reason: subscriptionPauses.reason, actualEndAt: subscriptionPauses.actualEndAt })
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, id))
        .orderBy(subscriptionPauses.startsAt);
    const [grant] = await getDb()
        .select({ endsAt: courtesyGrants.endsAt })
        .from(courtesyGrants)
        .where(eq(courtesyGrants.subscriptionId, id));
    return { status: sub?.status, pauses, grantEndsAt: grant?.endsAt };
}
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
    await getDb().delete(courtesyGrants).where(eq(courtesyGrants.reason, 'S35 route test'));
    await retireSelfCancelRows();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await testDb.teardown();
});

describe('AC:B9b:8 S35 owner pause route', () => {
    it('previews an offered pause with the courtesy end date', async () => {
        const row = await seedCourtesy();
        const response = await preview(row.subscriptionId, row.ownerId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            offered: true,
            courtesyForfeit: { endsAt: row.endsAt.toISOString() },
            months: { min: 1, max: 4 }
        });
    });
    it('requires the loss confirmation and changes nothing without it', async () => {
        const row = await seedCourtesy();
        const before = await snapshot(row.subscriptionId);
        const response = await pause(row.subscriptionId, row.ownerId, { months: 1 });
        expect(response.status).toBe(409);
        expect((await response.json()).error.reason).toBe('COURTESY_FORFEIT_NOT_CONFIRMED');
        expect(await snapshot(row.subscriptionId)).toEqual(before);
    });
    it('opens a customer-request pause after confirmation', async () => {
        const row = await seedCourtesy();
        const response = await pause(row.subscriptionId, row.ownerId, {
            months: 1,
            courtesyForfeitConfirmed: true
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data.outcome).toBe('PAUSED');
        const stored = await snapshot(row.subscriptionId);
        expect(stored.status).toBe('PAUSED');
        expect(
            stored.pauses.map((entry) => ({
                reason: entry.reason,
                closed: entry.actualEndAt !== null
            }))
        ).toEqual([
            { reason: 'COURTESY', closed: true },
            { reason: 'CUSTOMER_REQUEST', closed: false }
        ]);
        expect(stored.grantEndsAt).toBeInstanceOf(Date);
        expect(stored.grantEndsAt?.getTime()).toBeLessThan(row.endsAt.getTime());
    });
    it('hides another owner subscription', async () => {
        const row = await seedCourtesy();
        const alien = await seedUser('alien-courtesy');
        const response = await pause(row.subscriptionId, alien, {
            months: 1,
            courtesyForfeitConfirmed: true
        });
        expect(response.status).toBe(404);
        expect((await snapshot(row.subscriptionId)).status).toBe('PAUSED');
    });
});
