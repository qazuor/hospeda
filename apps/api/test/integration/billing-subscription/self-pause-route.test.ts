import {
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    retireAdminCancellationRows,
    routeClock,
    routeFake
} from './admin-cancellation-fixtures';
import { seedUser } from './revocation-route-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    auditLog: audit
}));
let app: ReturnType<typeof initApp>;
const created: Array<{ id: string; ownerId: string }> = [];
const headers = (id: string) =>
    actorHeaders({ id, role: 'USER', permissions: [PermissionEnum.BILLING_VIEW_OWN] });
const path = (id: string, act: 'pause-preview' | 'pause' | 'resume') =>
    `/api/v1/protected/billing-subscription/${id}/${act}`;
const request = (id: string, ownerId: string, act: 'pause-preview' | 'pause' | 'resume') =>
    app.request(
        path(id, act),
        act === 'pause-preview'
            ? { headers: headers(ownerId) }
            : {
                  method: 'POST',
                  headers: headers(ownerId),
                  body: JSON.stringify(act === 'pause' ? { months: 2 } : {})
              }
    );
async function seedEligible() {
    const ownerId = await seedUser('self-pause');
    const authorization = await fake.authorize({
        reference: `self-pause-${crypto.randomUUID()}`,
        amount: { amountMinor: 10000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'self pause route test',
        returnUrl: 'https://example.test/return',
        payerEmail: `self-pause-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId: authorization.authorizationId });
    const [plan] = await getDb()
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `self-pause-${crypto.randomUUID()}`,
            name: 'Self pause route'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Missing plan');
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: true
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Missing version');
    const [option] = await getDb()
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Missing option');
    const [row] = await getDb()
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: 'accommodation',
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Missing principal');
    await getDb().insert(providerLinks).values({
        subscriptionId: row.id,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    created.push({ id: row.id, ownerId });
    return { id: row.id, ownerId, authorizationId: authorization.authorizationId };
}
async function cleanup() {
    const rows = created.splice(0);
    const ids = rows.map((row) => row.id);
    if (ids.length) {
        await getDb().delete(courtesyGrants).where(inArray(courtesyGrants.subscriptionId, ids));
        await getDb()
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, ids));
        await getDb().delete(providerLinks).where(inArray(providerLinks.subscriptionId, ids));
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, ids));
    }
    await retireAdminCancellationRows();
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
    audit.mockClear();
});
afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
});
afterAll(async () => {
    await cleanup();
    await testDb.teardown();
});

describe('TEST:B8b:25 owner pause routes', () => {
    it('previews and pauses with the same end, then resumes with the fake next charge', async () => {
        const row = await seedEligible();
        const previewResponse = await request(row.id, row.ownerId, 'pause-preview');
        expect(previewResponse.status).toBe(200);
        const preview = (await previewResponse.json()).data;
        expect(preview.offered).toBe(true);
        const pausedResponse = await request(row.id, row.ownerId, 'pause');
        expect(pausedResponse.status).toBe(200);
        const paused = (await pausedResponse.json()).data;
        expect(paused.outcome).toBe('PAUSED');
        expect(paused.expectedEndAt.slice(0, 10)).toBe(
            preview.expectedEndAtByMonths[2].slice(0, 10)
        );
        const [stored] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.id));
        const [open] = await getDb()
            .select({ expectedEndAt: subscriptionPauses.expectedEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.id, paused.pauseId));
        expect(stored?.status).toBe('PAUSED');
        expect(open?.expectedEndAt?.toISOString()).toBe(paused.expectedEndAt);
        const resumedResponse = await request(row.id, row.ownerId, 'resume');
        expect(resumedResponse.status).toBe(200);
        const resumed = (await resumedResponse.json()).data;
        expect(resumed.outcome).toBe('RESUMED');
        const provider = await fake.readAuthorization({ authorizationId: row.authorizationId });
        expect(resumed.nextCharge.at).toBe(provider.snapshot.nextChargeAt);
        expect(
            audit.mock.calls.filter(
                ([entry]) => entry.auditEvent === AuditEventType.BILLING_MUTATION
            )
        ).toHaveLength(2);
    });

    it('returns 404 before touching the provider for an alien id on all three routes', async () => {
        const row = await seedEligible();
        const alien = await seedUser('alien-pause');
        const calls = vi.spyOn(fake, 'readAuthorization');
        for (const act of ['pause-preview', 'pause', 'resume'] as const) {
            const response = await request(row.id, alien, act);
            expect(response.status).toBe(404);
        }
        expect(calls).toHaveBeenCalledTimes(0);
    });

    it('refuses to resume a courtesy pause without provider access', async () => {
        const row = await seedEligible();
        await getDb()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, row.id));
        await getDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: row.id,
                reason: 'COURTESY',
                startsAt: NOW,
                expectedEndAt: new Date('2026-11-14T12:00:00.000Z')
            });
        const calls = vi.spyOn(fake, 'resume');
        const response = await request(row.id, row.ownerId, 'resume');
        expect(response.status).toBe(409);
        expect((await response.json()).error.details.reason).toBe('PAUSE_NOT_CUSTOMER_REQUEST');
        expect(calls).toHaveBeenCalledTimes(0);
    });
});
