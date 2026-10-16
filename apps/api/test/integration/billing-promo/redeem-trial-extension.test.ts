import { randomUUID } from 'node:crypto';
import {
    and,
    eq,
    getDb,
    plans,
    planVersions,
    promoCodes,
    promoRedemptions,
    setDb,
    trialRedemptions,
    trials,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/protected/billing/promo-codes/redeem';
const now = new Date('2026-10-12T12:00:00.000Z');
const app = initApp({ clock: { now: () => now } });
let userId: string | undefined;
let promoCodeId: string | undefined;

function headers(actorId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

async function seedExpiredTrialExtension(endsAt = new Date(now.getTime() - 86_400_000)) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `promo-trial-route-${randomUUID()}@example.test`,
            displayName: 'Promo trial route',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Could not create route test user');
    userId = user.id;

    const [existingPlan] = await db
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.vertical, 'accommodation'), eq(plans.role, 'trial')))
        .limit(1);
    let plan = existingPlan;
    if (!plan) {
        const [createdPlan] = await db
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `promo-trial-route-${randomUUID()}`,
                name: 'Promo extension route trial',
                role: 'trial'
            })
            .returning({ id: plans.id });
        plan = createdPlan;
    }
    if (!plan) throw new Error('Could not create route test trial plan');

    const [existingVersion] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)))
        .limit(1);
    let version = existingVersion;
    if (!version) {
        const [createdVersion] = await db
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: 0,
                sellable: false,
                current: true,
                trialDays: 30,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        version = createdVersion;
    }
    if (!version) throw new Error('Could not create route test plan version');

    const [trial] = await db
        .insert(trials)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            status: 'TRIAL_ACTIVE',
            trialPlanId: plan.id,
            floorEntitlementsVersionId: version.id,
            floorLimitsVersionId: version.id,
            floorTrialPlanVersionId: version.id,
            startedAt: new Date(now.getTime() - 10 * 86_400_000),
            endsAt,
            emailPseudonym: randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
            deadlinesVersion: 1
        })
        .returning({ id: trials.id });
    if (!trial) throw new Error('Could not create route test trial');

    const [promo] = await db
        .insert(promoCodes)
        .values({
            code: `TRIAL-${randomUUID()}`,
            effectKind: 'TRIAL_EXTENSION',
            extensionDays: 5,
            discountKind: null,
            value: null,
            allVerticals: true,
            verticals: null,
            totalQuota: 1,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: null,
            durationCharges: null
        })
        .returning({ id: promoCodes.id, code: promoCodes.code });
    if (!promo) throw new Error('Could not create route test promo code');
    promoCodeId = promo.id;
    return { code: promo.code };
}

afterEach(async () => {
    promoCodeId = undefined;
    userId = undefined;
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe('TEST:B9b:6 AC:B9b:6 the redeem route extends a real trial', () => {
    it('extends a real trial once and rejects a second redemption without extending twice', async () => {
        await testDb.withRollback(async (tx) => {
            const runtimeDb = getDb();
            setDb(tx);
            try {
                const initialEndsAt = new Date(now.getTime() + 10 * 86_400_000);
                const { code } = await seedExpiredTrialExtension(initialEndsAt);
                injectPaymentProvider({
                    provider: new FakePaymentProvider({
                        clock: { now: () => now },
                        idNamespace: randomUUID()
                    })
                });
                const redeem = () =>
                    app.request(path, {
                        method: 'POST',
                        headers: headers(userId!),
                        body: JSON.stringify({ code, vertical: 'accommodation' })
                    });

                const first = await redeem();
                expect(first.status).toBe(200);
                expect(await first.json()).toMatchObject({
                    success: true,
                    data: {
                        kind: 'TRIAL_EXTENSION',
                        days: 5,
                        replay: false
                    }
                });
                const [extendedTrial] = await getDb()
                    .select({ endsAt: trials.endsAt })
                    .from(trials)
                    .where(eq(trials.userId, userId!));
                expect(extendedTrial?.endsAt?.getTime()).toBe(
                    initialEndsAt.getTime() + 5 * 86_400_000
                );
                expect(
                    await getDb()
                        .select()
                        .from(trialRedemptions)
                        .where(eq(trialRedemptions.userId, userId!))
                ).toHaveLength(1);
                expect(
                    await getDb()
                        .select()
                        .from(promoRedemptions)
                        .where(eq(promoRedemptions.promoCodeId, promoCodeId!))
                ).toHaveLength(1);

                const replay = await redeem();
                expect(replay.status).toBe(409);
                expect(await replay.json()).toMatchObject({
                    success: false,
                    error: { reason: 'PROMO_CODE_ALREADY_REDEEMED' }
                });
                const [replayedTrial] = await getDb()
                    .select({ endsAt: trials.endsAt })
                    .from(trials)
                    .where(eq(trials.userId, userId!));
                expect(replayedTrial?.endsAt?.getTime()).toBe(
                    initialEndsAt.getTime() + 5 * 86_400_000
                );
                expect(
                    await getDb()
                        .select()
                        .from(trialRedemptions)
                        .where(eq(trialRedemptions.userId, userId!))
                ).toHaveLength(1);
                expect(
                    await getDb()
                        .select()
                        .from(promoRedemptions)
                        .where(eq(promoRedemptions.promoCodeId, promoCodeId!))
                ).toHaveLength(1);
            } finally {
                setDb(runtimeDb);
            }
        });
    });

    it('returns TRIAL_ENDED and leaves the extension code unconsumed', async () => {
        await testDb.withRollback(async (tx) => {
            const runtimeDb = getDb();
            setDb(tx);
            try {
                const { code } = await seedExpiredTrialExtension();
                injectPaymentProvider({
                    provider: new FakePaymentProvider({
                        clock: { now: () => now },
                        idNamespace: randomUUID()
                    })
                });
                const response = await app.request(path, {
                    method: 'POST',
                    headers: headers(userId!),
                    body: JSON.stringify({ code, vertical: 'accommodation' })
                });
                expect(response.status).toBe(422);
                expect((await response.json()).error).toMatchObject({
                    code: 'VALIDATION_ERROR',
                    reason: 'TRIAL_ENDED'
                });
                expect(
                    await getDb()
                        .select()
                        .from(promoRedemptions)
                        .where(eq(promoRedemptions.promoCodeId, promoCodeId!))
                ).toHaveLength(0);
                expect(
                    await getDb()
                        .select()
                        .from(trialRedemptions)
                        .where(eq(trialRedemptions.userId, userId!))
                ).toHaveLength(0);
            } finally {
                setDb(runtimeDb);
            }
        });
    });

    it('maps a real T4 redemption key conflict to 409 without consuming the code', async () => {
        await testDb.withRollback(async (tx) => {
            const runtimeDb = getDb();
            setDb(tx);
            try {
                const { code } = await seedExpiredTrialExtension();
                const [otherUser] = await getDb()
                    .insert(users)
                    .values({
                        email: `promo-trial-conflict-${randomUUID()}@example.test`,
                        displayName: 'Conflicting trial redemption owner',
                        emailVerified: true,
                        lifecycleState: 'ACTIVE'
                    })
                    .returning({ id: users.id });
                if (!otherUser) throw new Error('Could not create conflicting redemption owner');
                await getDb()
                    .insert(trialRedemptions)
                    .values({
                        userId: otherUser.id,
                        vertical: 'accommodation',
                        redemptionKey: `promo-redemption:${promoCodeId}:${userId}`,
                        appliedDays: 5,
                        appliedAt: now
                    });
                injectPaymentProvider({
                    provider: new FakePaymentProvider({
                        clock: { now: () => now },
                        idNamespace: randomUUID()
                    })
                });
                const response = await app.request(path, {
                    method: 'POST',
                    headers: headers(userId!),
                    body: JSON.stringify({ code, vertical: 'accommodation' })
                });
                expect(response.status).toBe(409);
                expect((await response.json()).error).toMatchObject({
                    code: 'ALREADY_EXISTS',
                    reason: 'REDEMPTION_KEY_CONFLICT'
                });
                expect(
                    await getDb()
                        .select()
                        .from(promoRedemptions)
                        .where(eq(promoRedemptions.promoCodeId, promoCodeId!))
                ).toHaveLength(0);
            } finally {
                setDb(runtimeDb);
            }
        });
    });
});
