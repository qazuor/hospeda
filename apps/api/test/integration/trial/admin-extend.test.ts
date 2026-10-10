import { randomUUID } from 'node:crypto';
import {
    and,
    domainEvent,
    eq,
    getDb,
    plans,
    planVersions,
    trialRedemptions,
    trials,
    users
} from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const path = '/api/v1/admin/trials/extend';
const now = new Date('2026-10-08T20:00:00.000Z');
const clock = { now: () => now };
const day = 86_400_000;
const app = initApp({ clock });

async function fixture(withTrial = true, ended = false) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `trial-${randomUUID()}@example.test`,
            displayName: 'Trial subject',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Missing user');
    // The ephemeral database seeds the unique trial plan for each vertical.
    const [plan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.vertical, 'accommodation'), eq(plans.role, 'trial')))
        .limit(1);
    if (!plan) throw new Error('Missing seeded trial plan');
    const [version] = await db
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.planId, plan.id), eq(planVersions.current, true)))
        .limit(1);
    if (!version) throw new Error('Missing seeded trial plan version');
    const end = new Date(now.getTime() + (ended ? -1 : 20) * day);
    const [trial] = withTrial
        ? await db
              .insert(trials)
              .values({
                  userId: user.id,
                  vertical: 'accommodation',
                  status: 'TRIAL_ACTIVE',
                  trialPlanId: plan.id,
                  floorEntitlementsVersionId: version.id,
                  floorLimitsVersionId: version.id,
                  floorTrialPlanVersionId: version.id,
                  startedAt: new Date(now.getTime() - 10 * day),
                  endsAt: end,
                  emailPseudonym:
                      randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
                  deadlinesVersion: 1
              })
              .returning()
        : [undefined];
    return { user, trial, end };
}

function headers(
    actorId: string,
    role = 'SUPER_ADMIN',
    permissions = role === 'SUPER_ADMIN'
        ? '["access.panelAdmin","access.apiAdmin","trial.extend"]'
        : '["access.panelAdmin","access.apiAdmin"]'
) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': permissions
    };
}
function request(body: unknown, actorId?: string, role?: string) {
    return app.request(path, {
        method: 'POST',
        headers: actorId
            ? headers(actorId, role)
            : { 'content-type': 'application/json', 'user-agent': 'vitest' },
        body: JSON.stringify(body)
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe('TEST:V4:11 administrative trial extension', () => {
    it('SUPER_ADMIN passes the filled ceiling, records the origin, and does not redeem', async () => {
        const { user, trial, end } = await fixture();
        if (!trial) throw new Error('Missing trial');
        const actorId = randomUUID();
        const response = await request(
            { userId: user.id, vertical: 'accommodation', days: 15, reason: 'moderation error' },
            actorId
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            previousEndsAt: end.toISOString(),
            endsAt: new Date(end.getTime() + 15 * day).toISOString(),
            totalDays: 45
        });
        const [stored] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(stored?.endsAt?.toISOString()).toBe(
            new Date(end.getTime() + 15 * day).toISOString()
        );
        const events = await getDb()
            .select()
            .from(domainEvent)
            .where(and(eq(domainEvent.entityType, 'trial'), eq(domainEvent.entityId, trial.id)));
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            eventType: 'trial.extended',
            entityId: trial.id,
            actorType: 'admin',
            actorId,
            reason: 'moderation error'
        });
        expect(events[0]?.changes).toContainEqual({ field: 'origin', new: 'SUPER_ADMIN' });
        expect(
            await getDb()
                .select()
                .from(trialRedemptions)
                .where(eq(trialRedemptions.userId, user.id))
        ).toHaveLength(0);
    });

    it.each([
        undefined,
        '   '
    ])('rejects missing or blank reason without writing: %s', async (reason) => {
        const { user, trial, end } = await fixture();
        if (!trial) throw new Error('Missing trial');
        const body = {
            userId: user.id,
            vertical: 'accommodation',
            days: 15,
            ...(reason === undefined ? {} : { reason })
        };
        const response = await request(body, randomUUID());
        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
        const [stored] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(stored?.endsAt?.toISOString()).toBe(end.toISOString());
        expect(
            await getDb().select().from(domainEvent).where(eq(domainEvent.entityId, trial.id))
        ).toHaveLength(0);
    });

    it('rejects an authenticated actor without permission before validating the body', async () => {
        const { user, trial, end } = await fixture();
        if (!trial) throw new Error('Missing trial');
        const response = await request(
            { userId: user.id, vertical: 'accommodation', days: 15 },
            randomUUID(),
            'ADMIN'
        );
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
        const [stored] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(stored?.endsAt?.toISOString()).toBe(end.toISOString());
        expect(
            await getDb().select().from(domainEvent).where(eq(domainEvent.entityId, trial.id))
        ).toHaveLength(0);
    });

    it('rejects an ADMIN with no permissions in the mock header', async () => {
        const { user } = await fixture();
        const response = await app.request(path, {
            method: 'POST',
            headers: headers(randomUUID(), 'ADMIN', '[]'),
            body: JSON.stringify({
                userId: user.id,
                vertical: 'accommodation',
                days: 15,
                reason: 'repair'
            })
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
    });

    it('rejects an absent session with 401', async () => {
        const { user } = await fixture();
        const response = await request({
            userId: user.id,
            vertical: 'accommodation',
            days: 15,
            reason: 'repair'
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });

    it('returns NOT_FOUND for a user without a trial', async () => {
        const { user } = await fixture(false);
        const response = await request(
            { userId: user.id, vertical: 'accommodation', days: 15, reason: 'repair' },
            randomUUID()
        );
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('NOT_FOUND');
    });

    it('returns conflict for a TRIAL_EXPIRED row', async () => {
        const { user, trial } = await fixture();
        if (!trial) throw new Error('Missing trial');
        await getDb()
            .update(trials)
            .set({ status: 'TRIAL_EXPIRED' })
            .where(eq(trials.id, trial.id));
        const response = await request(
            { userId: user.id, vertical: 'accommodation', days: 15, reason: 'repair' },
            randomUUID()
        );
        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('ALREADY_EXISTS');
        expect(
            await getDb().select().from(domainEvent).where(eq(domainEvent.entityId, trial.id))
        ).toHaveLength(0);
    });

    it('returns conflict for a trial whose end date has passed', async () => {
        const { user, trial, end } = await fixture(true, true);
        if (!trial) throw new Error('Missing trial');
        const response = await request(
            { userId: user.id, vertical: 'accommodation', days: 15, reason: 'repair' },
            randomUUID()
        );
        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('ALREADY_EXISTS');
        const [stored] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(stored?.endsAt?.toISOString()).toBe(end.toISOString());
    });
});
