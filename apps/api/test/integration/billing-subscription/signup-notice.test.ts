import { randomUUID } from 'node:crypto';
import {
    and,
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptions,
    trials,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createTrial,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers';

const path = '/api/v1/protected/billing/subscriptions/signup-notice';
const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => now };
const fixtureUsers = new Set<string>();
const fixturePlans = new Set<string>();
const fixtureVersions = new Set<string>();
const fixtureOptions = new Set<string>();

async function createUser() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b13a-signup-notice-${randomUUID()}@example.test`,
            displayName: 'B13a signup notice user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No signup notice user');
    fixtureUsers.add(user.id);
    return user;
}

async function createOption(vertical: string) {
    const [plan] = await getDb()
        .insert(plans)
        .values({ vertical, slug: `b13a-notice-${randomUUID()}`, name: 'Checkout plan' })
        .returning();
    if (!plan) throw new Error('No signup notice plan');
    fixturePlans.add(plan.id);
    const [version] = await getDb()
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No signup notice plan version');
    fixtureVersions.add(version.id);
    const [option] = await getDb()
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No signup notice billing option');
    fixtureOptions.add(option.id);
    return option;
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

async function readNotice(userId: string, billingOptionId: string) {
    const response = await app.request(`${path}/${billingOptionId}`, {
        headers: headers(userId)
    });
    return { response, body: await response.json() };
}

const fake = new FakePaymentProvider({ clock, idNamespace: randomUUID() });
const authorize = vi.spyOn(fake, 'authorize');
const app = initApp({ clock, paymentProvider: fake });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
    await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
    await ensurePublicationCatalog(VerticalEnum.GASTRONOMY);
});

afterAll(async () => {
    const db = getDb();
    for (const id of fixtureOptions)
        await db.delete(billingOptions).where(eq(billingOptions.id, id));
    for (const id of fixtureVersions) await db.delete(planVersions).where(eq(planVersions.id, id));
    for (const id of fixturePlans) await db.delete(plans).where(eq(plans.id, id));
    // Trial rows are permanent by contract; their own test database is dropped below.
    await testDb.teardown();
});

describe('TEST:B13a:21a AC:B13a:5 the checkout reads the trial of the option vertical', () => {
    it('returns the ceil day count and only the selected vertical trial', async () => {
        const user = await createUser();
        const accommodationOption = await createOption(VerticalEnum.ACCOMMODATION);
        const gastronomyOption = await createOption(VerticalEnum.GASTRONOMY);
        await createTrial({ userId: user.id, status: 'TRIAL_ACTIVE' });
        const endsAt = new Date(now.getTime() + 10.5 * 86_400_000);
        await getDb()
            .update(trials)
            .set({ endsAt })
            .where(
                and(eq(trials.userId, user.id), eq(trials.vertical, VerticalEnum.ACCOMMODATION))
            );

        const before = await getDb()
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));
        const accommodation = await readNotice(user.id, accommodationOption.id);
        const gastronomy = await readNotice(user.id, gastronomyOption.id);
        const after = await getDb()
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.userId, user.id));

        expect(accommodation.response.status).toBe(200);
        expect(accommodation.body.data).toEqual({
            vertical: 'accommodation',
            trial: { status: 'RUNNING', endsAt: endsAt.toISOString(), daysLeft: 11 }
        });
        expect(gastronomy.response.status).toBe(200);
        expect(gastronomy.body.data).toEqual({
            vertical: 'gastronomy',
            trial: { status: 'NOT_RUNNING' }
        });
        expect(before).toHaveLength(0);
        expect(after).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
    });

    it('returns NOT_RUNNING for an expired trial and for PRE_TRIAL without a row', async () => {
        const expiredUser = await createUser();
        const expiredOption = await createOption(VerticalEnum.ACCOMMODATION);
        await createTrial({ userId: expiredUser.id, status: 'TRIAL_EXPIRED' });
        const expired = await readNotice(expiredUser.id, expiredOption.id);

        const preTrialUser = await createUser();
        const preTrialOption = await createOption(VerticalEnum.ACCOMMODATION);
        const preTrial = await readNotice(preTrialUser.id, preTrialOption.id);

        expect(expired.response.status).toBe(200);
        expect(expired.body.data.trial).toEqual({ status: 'NOT_RUNNING' });
        expect(preTrial.response.status).toBe(200);
        expect(preTrial.body.data.trial).toEqual({ status: 'NOT_RUNNING' });
    });

    it('returns NOT_RUNNING when no trial row exists', async () => {
        const user = await createUser();
        const option = await createOption(VerticalEnum.ACCOMMODATION);
        const result = await readNotice(user.id, option.id);

        expect(result.response.status).toBe(200);
        expect(result.body.data.trial).toEqual({ status: 'NOT_RUNNING' });
    });

    it('uses the error contract for missing options, invalid ids, and anonymous requests', async () => {
        const user = await createUser();
        const missing = await readNotice(user.id, randomUUID());
        const invalid = await app.request(`${path}/not-a-uuid`, { headers: headers(user.id) });
        const anonymous = await app.request(`${path}/${randomUUID()}`, {
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
        });

        expect(missing.response.status).toBe(404);
        expect(missing.body.error.code).toBe('NOT_FOUND');
        expect(invalid.status).toBe(400);
        expect(anonymous.status).toBe(401);
    });
});
