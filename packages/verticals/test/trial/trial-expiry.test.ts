import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { computeRecoveryMilestones } from '../../src/trial/trial-deadlines';
import { expireDueTrials, expireTrial } from '../../src/trial/trial-expiry';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';
import type { TrialAfterCommit } from '../../src/trial/trial-machine-types';
import { InvalidTrialMachineInputError } from '../../src/trial/trial-machine-types';
import { createInMemoryTrialMachine } from './in-memory-trial-machine';

const vertical = VerticalEnum.ACCOMMODATION;
const T = new Date('2026-11-10T12:00:00.000Z');
const userId = '11111111-1111-4111-8111-111111111111';

function setup() {
    const machine = createInMemoryTrialMachine();
    let current = T;
    const clock = { now: () => current };
    const emitted = vi.fn(async () => undefined);
    const invalidated = vi.fn(async () => undefined);
    const afterCommit: TrialAfterCommit = {
        emitCoverageChanged: emitted,
        invalidateUser: invalidated
    };
    const seed = (id: string, status = TrialStatusEnum.TRIAL_ACTIVE, endsAt = T) => {
        machine.seedTrial({
            id,
            userId: id === 'trial-1' ? userId : `22222222-2222-4222-8222-${id.padStart(12, '0')}`,
            vertical,
            status,
            startedAt: new Date('2026-10-10T12:00:00.000Z'),
            endsAt,
            deadlinesVersion: 0
        });
    };
    const input = { userId, vertical };
    const expire = () => expireTrial({ unitOfWork: machine.unitOfWork, clock, afterCommit, input });
    const batch = (batchSize: number) =>
        expireDueTrials({
            scanner: machine.scanner,
            unitOfWork: machine.unitOfWork,
            clock,
            afterCommit,
            batchSize
        });
    return {
        machine,
        clock,
        emitted,
        invalidated,
        afterCommit,
        seed,
        input,
        expire,
        batch,
        setCurrent(value: Date) {
            current = value;
        }
    };
}

describe('AC:V4:7 (unitaria) trial expiry', () => {
    it('expires at the inclusive boundary and schedules five recovery milestones', async () => {
        const fixture = setup();
        fixture.seed('trial-1');
        let noticeAfterCommit = false;
        fixture.afterCommit.emitCoverageChanged = async (event) => {
            noticeAfterCommit = fixture.machine.log.includes('commit');
            emittedEvents.push(event);
        };
        const emittedEvents: unknown[] = [];
        expect(await fixture.expire()).toEqual({
            expired: true,
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'DONE' }
        });
        expect(fixture.machine.trialOf(userId, vertical)).toMatchObject({
            status: TrialStatusEnum.TRIAL_EXPIRED,
            deadlinesVersion: 1
        });
        expect(fixture.machine.campaigns).toEqual([
            {
                userId,
                vertical,
                campaign: 'RECOVERY',
                at: T,
                deadlinesVersion: 1,
                milestones: computeRecoveryMilestones({ expiredAt: T })
            }
        ]);
        expect(fixture.machine.log).toContain('scheduleRecovery');
        expect(noticeAfterCommit).toBe(true);
        expect(emittedEvents).toEqual([
            { userId, vertical, sourceType: 'TRIAL', change: 'REMOVED' }
        ]);
        expect(fixture.invalidated).toHaveBeenCalledExactlyOnceWith({ userId });
    });

    it('leaves a trial one millisecond before its end untouched', async () => {
        const fixture = setup();
        fixture.seed('trial-1');
        fixture.setCurrent(new Date(T.getTime() - 1));
        expect(await fixture.expire()).toEqual({ expired: false, reason: 'NOT_DUE' });
        expect(fixture.machine.log).not.toContain('markExpired');
        expect(fixture.machine.trialOf(userId, vertical)?.status).toBe(
            TrialStatusEnum.TRIAL_ACTIVE
        );
    });

    it('rereads the end date after the scanner selected the row', async () => {
        const fixture = setup();
        fixture.seed('trial-1');
        fixture.machine.setBeforeWork(() => {
            fixture.machine.seedTrial({
                id: 'trial-1',
                userId,
                vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                startedAt: new Date('2026-10-10T12:00:00.000Z'),
                endsAt: new Date(T.getTime() + 5 * 86_400_000),
                deadlinesVersion: 0
            });
            fixture.machine.setBeforeWork(undefined);
        });
        expect(await fixture.batch(10)).toEqual({ expired: 0, skipped: 1, failed: 0 });
        expect(fixture.machine.trialOf(userId, vertical)).toMatchObject({
            status: TrialStatusEnum.TRIAL_ACTIVE,
            endsAt: new Date(T.getTime() + 5 * 86_400_000)
        });
        expect(fixture.machine.log).not.toContain('markExpired');
    });

    it.each([
        TrialStatusEnum.TRIAL_CONVERTED,
        TrialStatusEnum.TRIAL_EXPIRED
    ])('%s is not active', async (status) => {
        const fixture = setup();
        fixture.seed('trial-1', status);
        expect(await fixture.expire()).toEqual({ expired: false, reason: 'NOT_ACTIVE' });
        expect(fixture.machine.log).not.toContain('markExpired');
    });

    it('reports a missing trial row', async () => {
        const fixture = setup();
        expect(await fixture.expire()).toEqual({ expired: false, reason: 'NO_TRIAL_ROW' });
        expect(fixture.machine.rows.size).toBe(0);
    });

    it('isolates a failing row and rolls its state back', async () => {
        const fixture = setup();
        for (const id of ['trial-1', '2', '3', '4']) fixture.seed(id);
        fixture.machine.failMarkExpiredFor('4');
        expect(await fixture.batch(10)).toEqual({ expired: 3, skipped: 0, failed: 1 });
        expect(fixture.machine.log).toContain('rollback');
        const failed = [...fixture.machine.rows.values()].find((row) => row.id === '4');
        expect(failed?.status).toBe(TrialStatusEnum.TRIAL_ACTIVE);
    });

    it('reads the clock for the expiry decision inside the lock', async () => {
        const fixture = setup();
        fixture.seed('trial-1');
        const observations: boolean[] = [];
        const clock = {
            now: () => {
                observations.push(
                    fixture.machine.isLocked(trialMachineLockKey({ userId, vertical }).key)
                );
                return T;
            }
        };
        await expireTrial({
            unitOfWork: fixture.machine.unitOfWork,
            clock,
            afterCommit: fixture.afterCommit,
            input: fixture.input
        });
        expect(observations).toEqual([true]);
    });

    it('only writes trial machine states and has no SUSPENDED status', async () => {
        const fixture = setup();
        fixture.seed('trial-1');
        await fixture.expire();
        expect([...fixture.machine.rows.values()].map((row) => row.status)).toEqual([
            TrialStatusEnum.TRIAL_EXPIRED
        ]);
        expect(Object.values(TrialStatusEnum)).not.toContain('SUSPENDED');
    });

    it('rejects invalid batch size and user id without reflecting input values', async () => {
        const fixture = setup();
        await expect(fixture.batch(0)).rejects.toMatchObject({
            field: 'batchSize'
        });
        await expect(
            expireTrial({
                unitOfWork: fixture.machine.unitOfWork,
                clock: fixture.clock,
                afterCommit: fixture.afterCommit,
                input: { userId: '', vertical }
            })
        ).rejects.toMatchObject({ field: 'userId' });
        try {
            await expireTrial({
                unitOfWork: fixture.machine.unitOfWork,
                clock: fixture.clock,
                afterCommit: fixture.afterCommit,
                input: { userId: '', vertical }
            });
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidTrialMachineInputError);
            expect((error as Error).message).not.toContain('""');
        }
    });
});
