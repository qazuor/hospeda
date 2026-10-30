import { randomUUID } from 'node:crypto';
import type { CoverageChangedEvent, CoverageSource } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { convertTrialOnTitle } from '../../src/trial/trial-conversion';
import { expireTrial } from '../../src/trial/trial-expiry';
import type { TrialAfterCommit } from '../../src/trial/trial-machine-types';
import { seedActiveTrial } from './support/trial-machine-helpers';
import { createTrialMachineAdapter } from './support/trial-machine-unit-of-work';
import { seedUser, trialRowOf } from './support/trial-start-helpers';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
const vertical = VerticalEnum.ACCOMMODATION;
const now = new Date('2026-10-10T12:00:00.000Z');
const day = 86_400_000;
const clock = { now: () => new Date(now) };
const subscription = (charged: boolean): CoverageSource => ({
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
    scope: 'VERTICAL',
    target: null,
    since: now,
    until: 'NO_KNOWN_DATE',
    charged,
    floor: null
});
const event = (userId: string): CoverageChangedEvent => ({
    userId,
    vertical,
    sourceType: 'TRIAL',
    change: 'CHANGED'
});
const notices = () => {
    const events: CoverageChangedEvent[] = [];
    const invalidations: string[] = [];
    const afterCommit: TrialAfterCommit = {
        async emitCoverageChanged(message) {
            const row = await trialRowOf(pool, message.userId, vertical);
            expect(row?.status).toBe('TRIAL_CONVERTED');
            events.push(message);
        },
        async invalidateUser({ userId }) {
            invalidations.push(userId);
        }
    };
    return { afterCommit, events, invalidations };
};

describe('TEST:V4:7 - T2/T5 convert only a paid title against Postgres', () => {
    it('an unpaid subscription leaves T2 running; the first accredited payment converts after commit once', async () => {
        const { userId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: now,
            endsAt: new Date(now.getTime() + 10 * day)
        });
        const before = await trialRowOf(pool, userId, vertical);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const billing = new BillingForVerticalsSimulator();
        const notice = notices();
        billing.setCoverage({
            userId,
            vertical,
            response: { covered: true, sources: [subscription(false)] }
        });
        expect(
            await convertTrialOnTitle({
                unitOfWork: adapter.unitOfWork,
                billing,
                afterCommit: notice.afterCommit,
                event: event(userId)
            })
        ).toMatchObject({ converted: false, reason: 'NO_CONVERTING_TITLE' });
        expect((await trialRowOf(pool, userId, vertical))?.ends_at).toEqual(before?.ends_at);
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_ACTIVE');
        billing.setCoverage({
            userId,
            vertical,
            response: { covered: true, sources: [subscription(true)] }
        });
        expect(
            await convertTrialOnTitle({
                unitOfWork: adapter.unitOfWork,
                billing,
                afterCommit: notice.afterCommit,
                event: event(userId)
            })
        ).toMatchObject({ converted: true, transition: 'T2' });
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_CONVERTED');
        expect(adapter.stats.cancellations).toEqual([{ userId, vertical, campaign: 'PRE_EXPIRY' }]);
        expect(notice.events).toHaveLength(1);
        expect(notice.invalidations).toEqual([userId]);
    });

    it('a rejected first charge disappears from coverage and preserves every remaining day', async () => {
        const { userId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: now,
            endsAt: new Date(now.getTime() + 7 * day)
        });
        const before = await trialRowOf(pool, userId, vertical);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const billing = new BillingForVerticalsSimulator();
        billing.setCoverage({
            userId,
            vertical,
            response: { covered: true, sources: [subscription(false)] }
        });
        expect(
            await convertTrialOnTitle({
                unitOfWork: adapter.unitOfWork,
                billing,
                afterCommit: notices().afterCommit,
                event: event(userId)
            })
        ).toMatchObject({ converted: false });
        billing.setCoverage({ userId, vertical, response: { covered: false, sources: [] } });
        const result = await convertTrialOnTitle({
            unitOfWork: adapter.unitOfWork,
            billing,
            afterCommit: notices().afterCommit,
            event: event(userId)
        });
        expect(result).toMatchObject({ converted: false });
        const after = await trialRowOf(pool, userId, vertical);
        expect(after?.status).toBe('TRIAL_ACTIVE');
        expect(after?.ends_at).toEqual(before?.ends_at);
    });

    it('T5 converts an expired trial on a charged subscription and cancels recovery', async () => {
        const { userId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: new Date(now.getTime() - 10 * day),
            endsAt: new Date(now.getTime() - day)
        });
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        await expireTrial({
            unitOfWork: adapter.unitOfWork,
            clock,
            afterCommit: { emitCoverageChanged: async () => {}, invalidateUser: async () => {} },
            input: { userId, vertical }
        });
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_EXPIRED');
        const billing = new BillingForVerticalsSimulator();
        billing.setCoverage({
            userId,
            vertical,
            response: { covered: true, sources: [subscription(true)] }
        });
        const notice = notices();
        expect(
            await convertTrialOnTitle({
                unitOfWork: adapter.unitOfWork,
                billing,
                afterCommit: notice.afterCommit,
                event: event(userId)
            })
        ).toMatchObject({ converted: true, transition: 'T5' });
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_CONVERTED');
        expect(adapter.stats.cancellations).toContainEqual({
            userId,
            vertical,
            campaign: 'RECOVERY'
        });
        expect(notice.events).toHaveLength(1);
        expect(notice.invalidations).toEqual([userId]);
    });

    it('a converting title without a trial row does not create one', async () => {
        const { id: userId } = await seedUser(db);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const billing = new BillingForVerticalsSimulator();
        billing.setCoverage({
            userId,
            vertical,
            response: { covered: true, sources: [subscription(true)] }
        });
        expect(
            await convertTrialOnTitle({
                unitOfWork: adapter.unitOfWork,
                billing,
                afterCommit: notices().afterCommit,
                event: event(userId)
            })
        ).toMatchObject({ converted: false, reason: 'NO_TRIAL_ROW' });
        expect(await trialRowOf(pool, userId, vertical)).toBeUndefined();
    });
});
