import { randomUUID } from 'node:crypto';
import { extendTrialCaseSet } from '@repo/billing-verticals-contract/testing';
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createExtendTrial, extendTrialByAdmin } from '../../src/trial/trial-extension';
import {
    InvalidTrialMachineInputError,
    type TrialAfterCommit
} from '../../src/trial/trial-machine-types';
import { seedActiveTrial } from './support/trial-machine-helpers';
import { createTrialMachineAdapter } from './support/trial-machine-unit-of-work';
import { canjeCountOf, trialPlanOf, trialRowOf } from './support/trial-start-helpers';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
const vertical = VerticalEnum.ACCOMMODATION;
const day = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const afterCommit: TrialAfterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {}
};
const seed = (days: number) =>
    seedActiveTrial({
        db,
        vertical,
        startedAt: new Date(now.getTime() - 5 * day),
        endsAt: new Date(now.getTime() + days * day)
    });
const endsAt = async (userId: string) =>
    (await trialRowOf(pool, userId, vertical))?.ends_at as Date;

describe('TEST:V4:10 - extendTrial persists T4 atomically under the ceiling', () => {
    it('accepts room, moves exact days, writes one redemption and reschedules', async () => {
        const { userId } = await seed(5);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 20 });
        const key = randomUUID();
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        expect(
            await subject.extendTrial({ userId, vertical, days: 3, redemptionKey: key })
        ).toEqual({ outcome: 'ACCEPTED' });
        expect((await endsAt(userId)).getTime() - before.getTime()).toBe(3 * day);
        expect(await canjeCountOf(pool, userId)).toBe(1);
        const redemption = await pool.query(
            'SELECT redemption_key, applied_days FROM canje_de_trial WHERE user_id = $1',
            [userId]
        );
        expect(redemption.rows).toEqual([{ redemption_key: key, applied_days: 3 }]);
        expect(adapter.stats.expiryCampaigns).toHaveLength(1);
        expect(adapter.stats.expiryCampaigns[0]?.endsAt).toEqual(await endsAt(userId));
    });

    it('rejects an extension beyond the ceiling without changing date or writing redemption', async () => {
        const { userId } = await seed(5);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 10 });
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        expect(
            await subject.extendTrial({ userId, vertical, days: 1, redemptionKey: randomUUID() })
        ).toMatchObject({ outcome: 'REJECTED', reason: 'CEILING_REACHED' });
        expect(await endsAt(userId)).toEqual(before);
        expect(await canjeCountOf(pool, userId)).toBe(0);
    });

    it('accepts a retry of the same key without moving T4 twice', async () => {
        const { userId } = await seed(5);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 20 });
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        const call = { userId, vertical, days: 2, redemptionKey: randomUUID() };
        expect(await subject.extendTrial(call)).toEqual({ outcome: 'ACCEPTED' });
        expect(await subject.extendTrial(call)).toEqual({ outcome: 'ACCEPTED' });
        expect((await endsAt(userId)).getTime() - before.getTime()).toBe(2 * day);
        expect(await canjeCountOf(pool, userId)).toBe(1);
        expect(adapter.stats.expiryCampaigns).toHaveLength(1);
    });

    it('rejects a past end while T3 has not run', async () => {
        const { userId } = await seed(-1);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 20 });
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        expect(
            await subject.extendTrial({ userId, vertical, days: 1, redemptionKey: randomUUID() })
        ).toMatchObject({ outcome: 'REJECTED', reason: 'TRIAL_ENDED' });
        expect(await endsAt(userId)).toEqual(before);
        expect(await canjeCountOf(pool, userId)).toBe(0);
    });

    it('serializes two simultaneous calls with the same key to one move and one redemption', async () => {
        const { userId } = await seed(5);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 20 });
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        const call = { userId, vertical, days: 3, redemptionKey: randomUUID() };
        const answers = await Promise.all([subject.extendTrial(call), subject.extendTrial(call)]);
        expect(answers.map((answer) => answer.outcome)).toEqual(['ACCEPTED', 'ACCEPTED']);
        expect((await endsAt(userId)).getTime() - before.getTime()).toBe(3 * day);
        expect(await canjeCountOf(pool, userId)).toBe(1);
    });

    it('serializes distinct keys so only one extension fits under the ceiling', async () => {
        const { userId } = await seed(5);
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 12 });
        const subject = createExtendTrial({ unitOfWork: adapter.unitOfWork, clock, afterCommit });
        const base = { userId, vertical, days: 2 };
        const answers = await Promise.all([
            subject.extendTrial({ ...base, redemptionKey: randomUUID() }),
            subject.extendTrial({ ...base, redemptionKey: randomUUID() })
        ]);
        expect(answers.map((answer) => answer.outcome).sort()).toEqual(['ACCEPTED', 'REJECTED']);
        expect((await endsAt(userId)).getTime() - before.getTime()).toBe(2 * day);
        expect(await canjeCountOf(pool, userId)).toBe(1);
    });

    it('admin action passes a full ceiling, requires reason, and rolls back if audit fails', async () => {
        const { userId } = await seed(5);
        const actorId = randomUUID();
        const before = await endsAt(userId);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 10 });
        const input = { userId, vertical, days: 2, actorId, reason: 'Correction' };
        expect(
            await extendTrialByAdmin({ unitOfWork: adapter.unitOfWork, clock, afterCommit, input })
        ).toMatchObject({ extended: true, totalDays: 12 });
        expect((await endsAt(userId)).getTime() - before.getTime()).toBe(2 * day);
        expect(adapter.stats.adminExtensions).toHaveLength(1);
        await expect(
            extendTrialByAdmin({
                unitOfWork: adapter.unitOfWork,
                clock,
                afterCommit,
                input: { ...input, reason: '' }
            })
        ).rejects.toBeInstanceOf(InvalidTrialMachineInputError);
        const failed = createTrialMachineAdapter({
            db,
            ceilingDays: () => 10,
            failOn: 'recordAdminExtension'
        });
        const after = await endsAt(userId);
        await expect(
            extendTrialByAdmin({ unitOfWork: failed.unitOfWork, clock, afterCommit, input })
        ).rejects.toThrow('recordAdminExtension failed');
        expect(await endsAt(userId)).toEqual(after);
    });
});

extendTrialCaseSet({
    describe,
    it,
    expect,
    async makeHarness() {
        const mapped = new Map<string, string>();
        const ceiling = new Map<string, number>();
        const adapter = createTrialMachineAdapter({
            db,
            ceilingDays: () => [...ceiling.values()][0] ?? 100
        });
        const implementation = createExtendTrial({
            unitOfWork: adapter.unitOfWork,
            clock,
            afterCommit
        });
        const actual = (requested: string) => mapped.get(requested) ?? requested;
        return {
            subject: {
                extendTrial: (input) =>
                    implementation.extendTrial({ ...input, userId: actual(input.userId) })
            },
            async arrangeRunningTrial({ userId, remainingExtensionDays }) {
                const plan = await trialPlanOf(db, vertical);
                const seeded = await seed(plan.trialDays);
                mapped.set(userId, seeded.userId);
                ceiling.set(seeded.userId, 5 + plan.trialDays + remainingExtensionDays);
            },
            async arrangeEndedTrial({ userId }) {
                const seeded = await seed(-1);
                mapped.set(userId, seeded.userId);
            },
            async trialEndsAt({ userId }) {
                return endsAt(actual(userId));
            },
            newUserId: () => randomUUID(),
            newRedemptionKey: () => randomUUID()
        };
    }
});
