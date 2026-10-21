import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/subscriptions';
const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

/**
 * Migration `0138_woozy_dagger.sql` owns billing deadline version 1, but every
 * `hospeda-api` integration file shares one database and runs in series, and
 * `billing-deadlines.test.ts` truncates `billing_deadline_version` after its
 * tests. The signup reads version 1, so each fixture recreates it instead of
 * assuming it survives (same pattern as `reuse.test.ts`). `onConflictDoNothing`
 * keeps the seed idempotent and never triggers the UPDATE/DELETE-only
 * immutability trigger.
 */
const billingDeadlineVersion1Values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
}

async function fixture() {
    await ensureBillingDeadlineVersion1();
    const db = getDb();
    const accountEmail = `account-${crypto.randomUUID()}@example.test`;
    const [user] = await db
        .insert(users)
        .values({
            email: accountEmail,
            displayName: 'Declared payer test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `declared-payer-${crypto.randomUUID()}`,
            name: 'Basic'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No version');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('No option');
    return { user, option, accountEmail };
}

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

describe('TEST:1730:1b declared payer email route contract', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => testDb.clean());
    afterAll(async () => testDb.teardown());

    it('rejects five invalid bodies before persistence or provider authorization', async () => {
        const { user, option } = await fixture();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const oversizedEmail = `a@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(62)}`;
        const invalidBodies = [
            { billingOptionId: option.id },
            { billingOptionId: option.id, payerEmail: '' },
            { billingOptionId: option.id, payerEmail: '   ' },
            { billingOptionId: option.id, payerEmail: 'invalid' },
            { billingOptionId: option.id, payerEmail: oversizedEmail }
        ];
        for (const body of invalidBodies) {
            const response = await app.request(path, {
                method: 'POST',
                headers: headers(user.id),
                body: JSON.stringify(body)
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
        }
        expect(authorize).not.toHaveBeenCalled();
        expect(
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        ).toEqual([]);
    });

    it('sends and stores the declared email instead of the account email', async () => {
        const { user, option, accountEmail } = await fixture();
        const payerEmail = `declared-${crypto.randomUUID()}@example.test`;
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        const app = initApp({ clock, paymentProvider: fake });
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({ billingOptionId: option.id, payerEmail })
        });
        const body = await response.json();
        expect(response.status).toBe(201);
        expect(authorize).toHaveBeenCalledOnce();
        expect(authorize.mock.calls[0]?.[0].payerEmail).toBe(payerEmail);
        const declaredMatches = await fake.searchAuthorizations({ payerEmail });
        const accountMatches = await fake.searchAuthorizations({ payerEmail: accountEmail });
        expect(
            declaredMatches.authorizations.map((authorization) => authorization.authorizationId)
        ).toContain(body.data.authorizationId);
        expect(accountMatches.authorizations).toHaveLength(0);
        const [subscription] = await getDb()
            .select({ declaredPayerEmail: subscriptions.declaredPayerEmail })
            .from(subscriptions)
            .where(eq(subscriptions.id, body.data.subscriptionId))
            .limit(1);
        const [providerLink] = await getDb()
            .select({ providerId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, body.data.subscriptionId))
            .limit(1);
        const [storedUser] = await getDb()
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
        expect(subscription?.declaredPayerEmail).toBe(payerEmail);
        expect(providerLink?.providerId).toBe(body.data.authorizationId);
        expect(storedUser?.email).toBe(accountEmail);
    });
});
