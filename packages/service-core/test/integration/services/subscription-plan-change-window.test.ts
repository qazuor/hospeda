import { billingDeadlineVersions, desc, eq, sql, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readCycleDeadlines } from '../../../src/services/billing/subscription/plan-change-cycle-deadlines.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service.js';
import { resolveSuccessorWindow } from '../../../src/services/billing/subscription/successor-window.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';

const chargeAt = new Date('2026-10-12T15:00:00.000Z');
const cutoff = new Date('2026-10-12T04:00:00.000Z');
const clockAt = (instant: string) => ({ now: () => new Date(instant) });

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:18 plan change window', () => {
    it('rejects at 23 hours without creating or authorizing a successor', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt, rankRelation: 'LOWER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        const result = await requestPlanChange(seeded.input, {
            ...seeded.ports,
            clock: clockAt('2026-10-11T05:00:00.000Z')
        });
        const successors = await getServiceTestDb()
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        const [predecessor] = await getServiceTestDb()
            .select({ succeededById: subscriptions.succeededById })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(result).toEqual({
            path: 'REJECTED',
            reason: 'CHANGE_WINDOW_TOO_SHORT',
            availableFrom: chargeAt
        });
        expect(successors).toHaveLength(0);
        expect(predecessor?.succeededById).toBeNull();
        expect(authorize).toHaveBeenCalledTimes(0);
    });

    it('rejects a direct S1 call when the window became too short before insertion', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt });
        const authorize = vi.spyOn(seeded.fake, 'authorize');
        await expect(
            startSuccession(
                {
                    userId: seeded.user.id,
                    predecessorSubscriptionId: seeded.predecessor.id,
                    billingOptionId: seeded.targetBillingOptionId,
                    returnUrl: seeded.input.returnUrl
                },
                { ...seeded.ports, clock: clockAt('2026-10-11T05:00:00.000Z') }
            )
        ).rejects.toMatchObject({
            reason: 'SUCCESSION_WINDOW_TOO_SHORT'
        });
        const [predecessor] = await getServiceTestDb()
            .select({ succeededById: subscriptions.succeededById })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const successors = await getServiceTestDb()
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        expect(predecessor?.succeededById).toBeNull();
        expect(successors).toHaveLength(0);
        expect(authorize).toHaveBeenCalledTimes(0);
    });

    it('offers 30 hours and stores the provider-day cutoff before the first charge', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt, rankRelation: 'LOWER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        const result = await requestPlanChange(seeded.input, {
            ...seeded.ports,
            clock: clockAt('2026-10-10T22:00:00.000Z')
        });
        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.authorizationWindowEndsAt).toEqual(cutoff);
        expect(successor?.firstChargeAt?.getTime()).toBeGreaterThan(cutoff.getTime());
    });

    it('keeps the full 72-hour window for a distant charge', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt, rankRelation: 'LOWER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        const now = new Date('2026-10-08T00:00:00.000Z');
        const result = await requestPlanChange(seeded.input, {
            ...seeded.ports,
            clock: { now: () => now }
        });
        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.authorizationWindowEndsAt).toEqual(
            new Date(now.getTime() + 72 * 60 * 60 * 1000)
        );
    });

    it('does not reduce a manual payer even one hour before its charge', async () => {
        const now = new Date('2026-10-11T03:00:00.000Z');
        const nextChargeAt = new Date('2026-10-11T04:00:00.000Z');
        const seeded = await seedPlanChange({ paymentMethod: 'MANUAL', nextChargeAt });
        const deadlines = await getServiceTestDb().transaction((tx) =>
            readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id })
        );
        expect(
            resolveSuccessorWindow({
                now,
                cardHours: deadlines.values['10'].cardHours,
                minimumRemainingHours: deadlines.values['15'].hoursRemaining,
                predecessor: { status: 'ACTIVE', paymentMethod: 'MANUAL', nextChargeAt }
            })
        ).toEqual({
            kind: 'OFFERED',
            endsAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
            reduced: false
        });
    });

    it('reads the stamped cycle version after a new immutable version is published', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt });
        await withServiceTestTransaction(async (tx) => {
            const first = await readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id });
            expect(first.stamped).toBe(true);
            expect(first.values['15'].hoursRemaining).toBe(24);
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Deadline version missing');
            await tx.insert(billingDeadlineVersions).values({
                version: current.version + 1,
                values: { ...current.values, '15': { hoursRemaining: 12 } },
                changedKey: 15,
                previousValue: current.values['15'],
                newValue: { hoursRemaining: 12 }
            });
            const frozen = await readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id });
            expect(frozen).toMatchObject({
                version: first.version,
                stamped: false,
                values: { '15': { hoursRemaining: 24 } }
            });
            expect(
                resolveSuccessorWindow({
                    now: new Date('2026-10-11T05:00:00.000Z'),
                    cardHours: frozen.values['10'].cardHours,
                    minimumRemainingHours: frozen.values['15'].hoursRemaining,
                    predecessor: { status: 'ACTIVE', paymentMethod: 'CARD', nextChargeAt: chargeAt }
                })
            ).toEqual({ kind: 'NOT_OFFERED', availableFrom: chargeAt });
            await tx
                .update(subscriptions)
                .set({ renewalNoticeDeadlineVersion: null, renewalNoticeChargeAt: null })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const fresh = await readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id });
            expect(fresh).toMatchObject({
                version: current.version + 1,
                stamped: true,
                values: { '15': { hoursRemaining: 12 } }
            });
        });
    });

    it('serializes two stamps through the predecessor row lock', async () => {
        const seeded = await seedPlanChange({ nextChargeAt: chargeAt });
        let releaseFirst: () => void = () => undefined;
        let firstEntered: () => void = () => undefined;
        let reportSecondPid: (pid: number) => void = () => undefined;
        const holdFirst = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const entered = new Promise<void>((resolve) => {
            firstEntered = resolve;
        });
        const secondPid = new Promise<number>((resolve) => {
            reportSecondPid = resolve;
        });
        const first = getServiceTestDb().transaction(async (tx) => {
            const result = await readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id });
            firstEntered();
            await holdFirst;
            return result;
        });
        await entered;
        const second = getServiceTestDb().transaction(async (tx) => {
            const [session] = await tx
                .select({ pid: sql<number>`pg_backend_pid()` })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            if (!session) throw new Error('Second transaction has no backend');
            reportSecondPid(session.pid);
            return readCycleDeadlines({ tx, subscriptionId: seeded.predecessor.id });
        });
        try {
            const pid = await secondPid;
            let locked = false;
            for (let attempt = 0; attempt < 100; attempt++) {
                const activity = await getServiceTestPool().query<{
                    wait_event_type: string | null;
                }>('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
                if (activity.rows[0]?.wait_event_type === 'Lock') {
                    locked = true;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(locked).toBe(true);
        } finally {
            releaseFirst();
        }
        const [firstResult, secondResult] = await Promise.all([first, second]);
        const [row] = await getServiceTestDb()
            .select({ version: subscriptions.renewalNoticeDeadlineVersion })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(firstResult.stamped).toBe(true);
        expect(secondResult.stamped).toBe(false);
        expect(firstResult.version).toBe(secondResult.version);
        expect(row?.version).toBe(firstResult.version);
    });
});
