import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    emailOutbox,
    eq,
    getDb,
    idempotencyKeys,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { ensureBillingDeadlineVersion1 } from '../helpers/billing-deadline-version.js';

const root = '/api/v1/protected/billing/subscriptions';
const now = new Date('2026-10-08T20:00:00.000Z');
const clock = { now: () => now };

async function fixture() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `hos1735-${randomUUID()}@example.test`,
            displayName: 'HOS-1735 user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `hos1735-${randomUUID()}`,
            name: 'HOS-1735 plan'
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
    const createOption = async (cycle: 'monthly' | 'annual', amount: number) => {
        const [option] = await db
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle,
                amount,
                currency: 'ARS'
            })
            .returning();
        if (!option) throw new Error(`No ${cycle} option`);
        return option;
    };
    return {
        user,
        monthly: await createOption('monthly', 100000),
        annual: await createOption('annual', 1000000)
    };
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

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(ensureBillingDeadlineVersion1);
afterAll(async () => testDb.teardown());

describe('TEST:1735:10 pending signup attempt cancellation API', () => {
    it('TEST:1735:8 hides another option attempt after its authorization window expires', async () => {
        const { user, monthly, annual } = await fixture();
        const fake = new FakePaymentProvider({ idNamespace: randomUUID(), clock });
        const app = initApp({ clock, paymentProvider: fake });
        const signup = await app.request(root, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({
                billingOptionId: monthly.id,
                payerEmail: `payer-${randomUUID()}@example.test`
            })
        });
        const signupBody = await signup.json();
        expect(signup.status).toBe(201);
        await getDb()
            .update(subscriptions)
            .set({ authorizationWindowEndsAt: new Date(now.getTime() - 1) })
            .where(eq(subscriptions.id, signupBody.data.subscriptionId));

        const notice = await app.request(`${root}/signup-notice/${annual.id}`, {
            headers: headers(user.id)
        });

        expect(notice.status).toBe(200);
        expect((await notice.json()).data.pendingAttempt).toBeNull();
    });

    it('shows another option attempt, cancels it, then permits signup on the requested option', async () => {
        const { user, monthly, annual } = await fixture();
        const fake = new FakePaymentProvider({
            idNamespace: randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'exercise an applied creation' }]
        });
        const app = initApp({ clock, paymentProvider: fake });
        const signup = async (billingOptionId: string) =>
            app.request(root, {
                method: 'POST',
                headers: headers(user.id),
                body: JSON.stringify({
                    billingOptionId,
                    payerEmail: `payer-${randomUUID()}@example.test`
                })
            });
        const first = await signup(monthly.id);
        const firstBody = await first.json();
        expect(first.status).toBe(201);

        const annualNotice = await app.request(`${root}/signup-notice/${annual.id}`, {
            headers: headers(user.id)
        });
        const annualNoticeBody = await annualNotice.json();
        expect(annualNotice.status).toBe(200);
        expect(annualNoticeBody.data.pendingAttempt).toMatchObject({
            subscriptionId: firstBody.data.subscriptionId,
            plan: { name: 'HOS-1735 plan', amount: 100000, currency: 'ARS', cycle: 'monthly' },
            checkoutUrl: firstBody.data.checkoutUrl
        });

        const sameOption = await app.request(`${root}/signup-notice/${monthly.id}`, {
            headers: headers(user.id)
        });
        expect((await sameOption.json()).data.pendingAttempt).toBeNull();
        const cancelled = await app.request(
            `${root}/${firstBody.data.subscriptionId}/pending-attempt-cancellation`,
            {
                method: 'POST',
                headers: headers(user.id)
            }
        );
        expect(cancelled.status).toBe(200);
        expect(await cancelled.json()).toMatchObject({
            data: { subscriptionId: firstBody.data.subscriptionId, outcome: 'ABANDONED' }
        });
        const annualAfter = await app.request(`${root}/signup-notice/${annual.id}`, {
            headers: headers(user.id)
        });
        expect((await annualAfter.json()).data.pendingAttempt).toBeNull();

        const second = await signup(annual.id);
        const secondBody = await second.json();
        expect(second.status).toBe(201);
        expect(secondBody.data.subscriptionId).not.toBe(firstBody.data.subscriptionId);
        const outbox = await getDb()
            .select({ template: emailOutbox.template })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(outbox).toContainEqual({ template: 'billing.attempt-cancelled-cancel' });

        const repeated = await app.request(
            `${root}/${firstBody.data.subscriptionId}/pending-attempt-cancellation`,
            {
                method: 'POST',
                headers: headers(user.id)
            }
        );
        expect(repeated.status).toBe(200);
        expect((await repeated.json()).data.outcome).toBe('ALREADY_ABANDONED');
    });

    it('returns 404 for another owner, 409 for ACTIVE, and validates auth and params in order', async () => {
        const first = await fixture();
        const second = await fixture();
        const fake = new FakePaymentProvider({ idNamespace: randomUUID(), clock });
        const app = initApp({ clock, paymentProvider: fake });
        const signup = await app.request(root, {
            method: 'POST',
            headers: headers(first.user.id),
            body: JSON.stringify({
                billingOptionId: first.monthly.id,
                payerEmail: 'payer@example.test'
            })
        });
        const started = await signup.json();
        const cancelPath = (id: string) => `${root}/${id}/pending-attempt-cancellation`;
        const foreign = await app.request(cancelPath(started.data.subscriptionId), {
            method: 'POST',
            headers: headers(second.user.id)
        });
        expect(foreign.status).toBe(404);
        const foreignRow = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, started.data.subscriptionId));
        expect(foreignRow[0]?.status).toBe('PENDING_AUTHORIZATION');
        const invalid = await app.request(cancelPath('bad-id'), {
            method: 'POST',
            headers: headers(first.user.id)
        });
        expect(invalid.status).toBe(400);
        const anonymous = await app.request(cancelPath(started.data.subscriptionId), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
        });
        expect(anonymous.status).toBe(401);

        const active = await getDb()
            .insert(subscriptions)
            .values({
                userId: second.user.id,
                vertical: 'accommodation',
                planVersionId: second.monthly.planVersionId,
                billingOptionId: second.monthly.id,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning();
        expect(active).toHaveLength(1);
        const conflict = await app.request(cancelPath(active[0]!.id), {
            method: 'POST',
            headers: headers(second.user.id)
        });
        expect(conflict.status).toBe(409);
        expect((await conflict.json()).error.reason).toBe('COMMITMENT_TAKEN');
    });

    it('maps an incomplete signup key to 409 PREVIOUS_ATTEMPT_IN_PROGRESS', async () => {
        const { user, monthly } = await fixture();
        const fake = new FakePaymentProvider({ idNamespace: randomUUID(), clock });
        const app = initApp({ clock, paymentProvider: fake });
        const signup = await app.request(root, {
            method: 'POST',
            headers: headers(user.id),
            body: JSON.stringify({
                billingOptionId: monthly.id,
                payerEmail: `payer-${randomUUID()}@example.test`
            })
        });
        const signupBody = await signup.json();
        expect(signup.status).toBe(201);
        await getDb()
            .update(idempotencyKeys)
            .set({ result: null, completedAt: null })
            .where(eq(idempotencyKeys.subjectId, signupBody.data.subscriptionId));

        const response = await app.request(
            `${root}/${signupBody.data.subscriptionId}/pending-attempt-cancellation`,
            { method: 'POST', headers: headers(user.id) }
        );
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.reason).toBe('PREVIOUS_ATTEMPT_IN_PROGRESS');
    });
});
