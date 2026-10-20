import { ExtendTrialResponseSchema } from '@repo/billing-verticals-contract';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { computePreExpiryMilestones } from '../../src/trial/trial-deadlines';
import { createExtendTrial } from '../../src/trial/trial-extension';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';
import { InvalidTrialMachineInputError } from '../../src/trial/trial-machine-types';
import { createInMemoryTrialMachine } from './in-memory-trial-machine';

const DAY = 86_400_000;
const NOW = new Date('2026-10-10T12:00:00.000Z');
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const vertical = VerticalEnum.ACCOMMODATION;
const startedAt = new Date(NOW.getTime() - 10 * DAY);
const initialEndsAt = new Date(NOW.getTime() + 20 * DAY);

function setup(
    args: {
        ceiling?: number;
        status?: TrialStatusEnum;
        endsAt?: Date;
        seed?: boolean;
        deadlinesVersion?: number | null;
    } = {}
) {
    const machine = createInMemoryTrialMachine();
    machine.setCeilingDays(vertical, args.ceiling ?? 40);
    if (args.seed !== false) {
        machine.seedTrial({
            id: 'trial-1',
            userId,
            vertical,
            status: args.status ?? TrialStatusEnum.TRIAL_ACTIVE,
            startedAt,
            endsAt: args.endsAt ?? initialEndsAt,
            deadlinesVersion: args.deadlinesVersion === undefined ? 3 : args.deadlinesVersion
        });
    }
    const events: unknown[] = [];
    const effectOrder: string[] = [];
    const afterCommit = {
        async invalidateUser(value: { readonly userId: string }) {
            expect(value).toEqual({ userId });
            effectOrder.push('invalidate');
            expect(machine.log.at(-1)).toBe('commit');
        },
        async emitCoverageChanged(event: {
            readonly userId: string;
            readonly vertical: typeof vertical;
            readonly sourceType: 'TRIAL';
            readonly change: 'CHANGED' | 'REMOVED' | 'ADDED';
        }) {
            events.push(event);
            effectOrder.push('emit');
            expect(machine.log.at(-1)).toBe('commit');
        }
    };
    const clock = { now: () => NOW };
    const extend = createExtendTrial({
        unitOfWork: machine.unitOfWork,
        clock,
        afterCommit
    }).extendTrial;
    const call = (days: number, redemptionKey = 'key-1', requestedUserId = userId) =>
        extend({ userId: requestedUserId, vertical, days, redemptionKey });
    return { machine, events, effectOrder, call, extend };
}

function expectValid(response: unknown) {
    expect(ExtendTrialResponseSchema.safeParse(response).success).toBe(true);
}

describe('AC:V4:8 (unitaria) redemption T4', () => {
    it('accepts five days, persists redemption and schedules four new milestones before post-commit effects', async () => {
        const f = setup();
        const answer = await f.call(5);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'ACCEPTED' });
        const endsAt = new Date(initialEndsAt.getTime() + 5 * DAY);
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(endsAt);
        expect(f.machine.redemptions.get('key-1')).toMatchObject({
            userId,
            vertical,
            appliedDays: 5,
            appliedAt: NOW
        });
        expect(f.machine.campaigns).toEqual([
            {
                userId,
                vertical,
                campaign: 'PRE_EXPIRY',
                at: endsAt,
                deadlinesVersion: 3,
                milestones: computePreExpiryMilestones({ endsAt })
            }
        ]);
        expect(f.machine.log.filter((item) => item === 'scheduleExpiry')).toHaveLength(1);
        expect(f.events).toEqual([{ userId, vertical, sourceType: 'TRIAL', change: 'CHANGED' }]);
        expect(f.effectOrder).toEqual(['invalidate', 'emit']);
    });

    it('accepts exactly the ceiling', async () => {
        const f = setup();
        const answer = await f.call(10);
        expectValid(answer);
        expect(answer.outcome).toBe('ACCEPTED');
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(
            new Date(initialEndsAt.getTime() + 10 * DAY)
        );
    });

    it.each([
        { ceiling: 40, days: 11 },
        { ceiling: 30, days: 1 }
    ])('rejects a whole extension beyond ceiling $ceiling', async ({ ceiling, days }) => {
        const f = setup({ ceiling });
        const answer = await f.call(days);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'REJECTED', reason: 'CEILING_REACHED' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(initialEndsAt);
        expect(f.machine.redemptions.size).toBe(0);
        expect(f.machine.campaigns).toHaveLength(0);
        expect(f.events).toHaveLength(0);
        expect(f.effectOrder).toHaveLength(0);
    });

    it('retries the same key without a second ceiling read or effect', async () => {
        const f = setup();
        const first = await f.call(5);
        const reads = f.machine.ceilingReads.length;
        const second = await f.call(5);
        expectValid(first);
        expectValid(second);
        expect([first.outcome, second.outcome]).toEqual(['ACCEPTED', 'ACCEPTED']);
        expect(f.machine.ceilingReads).toHaveLength(reads);
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(
            new Date(initialEndsAt.getTime() + 5 * DAY)
        );
        expect(f.machine.redemptions.size).toBe(1);
        expect(f.machine.campaigns).toHaveLength(1);
        expect(f.events).toHaveLength(1);
    });

    it('accepts a prior key even after the row expired', async () => {
        const f = setup();
        await f.call(5);
        f.machine.seedTrial({
            id: 'trial-1',
            userId,
            vertical,
            status: TrialStatusEnum.TRIAL_EXPIRED,
            startedAt,
            endsAt: initialEndsAt,
            deadlinesVersion: 3
        });
        const answer = await f.call(5);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'ACCEPTED' });
        expect(f.events).toHaveLength(1);
    });

    it('rejects a key belonging to another user before reading or moving the trial', async () => {
        const f = setup();
        f.machine.seedRedemption('key-1', {
            userId: otherUserId,
            vertical,
            appliedDays: 2,
            appliedAt: NOW
        });
        const answer = await f.call(5);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'REJECTED', reason: 'REDEMPTION_KEY_CONFLICT' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(initialEndsAt);
        expect(f.machine.ceilingReads).toHaveLength(0);
        expect(f.events).toHaveLength(0);
    });

    it('rereads the winner of a unique-key race without moving the end', async () => {
        const f = setup();
        f.machine.setRedemptionInsertConflict('key-1', {
            userId,
            vertical,
            appliedDays: 5,
            appliedAt: NOW
        });
        const answer = await f.call(5);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'ACCEPTED' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(initialEndsAt);
        expect(f.machine.log).not.toContain('moveEndsAt');
        expect(f.events).toHaveLength(0);
    });

    it.each([
        new Date(NOW.getTime() - 1),
        NOW
    ])('rejects an ended active row at %s despite a late T3', async (endsAt) => {
        const f = setup({ endsAt });
        const answer = await f.call(1);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'REJECTED', reason: 'TRIAL_ENDED' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(endsAt);
        expect(f.machine.redemptions.size).toBe(0);
    });

    it.each([
        { seed: false, reason: 'NO_TRIAL' },
        { status: TrialStatusEnum.TRIAL_CONVERTED, reason: 'TRIAL_ENDED' }
    ])('rejects unavailable trial $reason', async ({ seed, status, reason }) => {
        const f = setup({ seed, status });
        const answer = await f.call(1);
        expectValid(answer);
        expect(answer).toEqual({ outcome: 'REJECTED', reason });
        expect(f.machine.redemptions.size).toBe(0);
        expect(f.events).toHaveLength(0);
    });

    it('serializes simultaneous distinct keys and rereads the moved end', async () => {
        const f = setup();
        const answers = await Promise.all([f.call(6, 'key-a'), f.call(6, 'key-b')]);
        answers.forEach(expectValid);
        expect(answers.map((answer) => answer.outcome).sort()).toEqual(['ACCEPTED', 'REJECTED']);
        expect(answers).toContainEqual({ outcome: 'REJECTED', reason: 'CEILING_REACHED' });
        expect(f.machine.redemptions.size).toBe(1);
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(
            new Date(initialEndsAt.getTime() + 6 * DAY)
        );
    });

    it.each([
        { patch: { days: 0 }, field: 'days' },
        { patch: { days: 1.5 }, field: 'days' },
        { patch: { redemptionKey: '' }, field: 'redemptionKey' },
        { patch: { userId: 'not-a-uuid' }, field: 'userId' }
    ])('rejects invalid $field without echoing values', async ({ patch, field }) => {
        const f = setup();
        const input = { userId, vertical, days: 1, redemptionKey: 'key-1', ...patch };
        try {
            await f.extend(input);
            throw new Error('Expected invalid input');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidTrialMachineInputError);
            expect(error).toMatchObject({ field });
            const rejectedValue = String(Object.values(patch)[0]);
            if (rejectedValue.length > 0)
                expect((error as Error).message).not.toContain(rejectedValue);
        }
        expect(f.machine.log).toHaveLength(0);
    });

    it('reads the row deadlines version inside the lock', async () => {
        const f = setup({ deadlinesVersion: 7 });
        let observedLock = false;
        f.machine.setBeforeWork(() => {
            observedLock = f.machine.isLocked(trialMachineLockKey({ userId, vertical }).key);
        });
        await f.call(1);
        expect(observedLock).toBe(true);
        expect(f.machine.ceilingReads).toEqual([{ vertical, deadlinesVersion: 7 }]);
    });
});
