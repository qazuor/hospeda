import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { computePreExpiryMilestones } from '../../src/trial/trial-deadlines';
import { createExtendTrial, extendTrialByAdmin } from '../../src/trial/trial-extension';
import { InvalidTrialMachineInputError } from '../../src/trial/trial-machine-types';
import { createInMemoryTrialMachine } from './in-memory-trial-machine';

const DAY = 86_400_000;
const NOW = new Date('2026-10-10T12:00:00.000Z');
const userId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const vertical = VerticalEnum.ACCOMMODATION;
const startedAt = new Date(NOW.getTime() - 10 * DAY);
const initialEndsAt = new Date(NOW.getTime() + 20 * DAY);
const input = {
    userId,
    vertical,
    days: 7,
    reason: '  compensación por moderación errónea  ',
    actorId
};

function setup(options: { seed?: boolean; status?: TrialStatusEnum; endsAt?: Date } = {}) {
    const machine = createInMemoryTrialMachine();
    machine.setCeilingDays(vertical, 30);
    if (options.seed !== false) {
        machine.seedTrial({
            id: 'trial-1',
            userId,
            vertical,
            status: options.status ?? TrialStatusEnum.TRIAL_ACTIVE,
            startedAt,
            endsAt: options.endsAt ?? initialEndsAt,
            deadlinesVersion: 2
        });
    }
    const events: unknown[] = [];
    const invalidations: unknown[] = [];
    const afterCommit = {
        async invalidateUser(value: { readonly userId: string }) {
            expect(machine.log.at(-1)).toBe('commit');
            invalidations.push(value);
        },
        async emitCoverageChanged(value: {
            readonly userId: string;
            readonly vertical: typeof vertical;
            readonly sourceType: 'TRIAL';
            readonly change: 'CHANGED' | 'REMOVED' | 'ADDED';
        }) {
            expect(machine.log.at(-1)).toBe('commit');
            events.push(value);
        }
    };
    const clock = { now: () => NOW };
    const extend = (patch: Partial<typeof input> = {}) =>
        extendTrialByAdmin({
            unitOfWork: machine.unitOfWork,
            clock,
            afterCommit,
            input: { ...input, ...patch }
        });
    return { machine, events, invalidations, afterCommit, clock, extend };
}

describe('AC:V4:9 (unitaria, la máquina) administrative T4', () => {
    it('passes the ceiling, records the trimmed reason and reschedules before commit', async () => {
        const f = setup();
        const result = await f.extend();
        const endsAt = new Date(initialEndsAt.getTime() + 7 * DAY);
        expect(result).toEqual({
            extended: true,
            previousEndsAt: initialEndsAt,
            endsAt,
            totalDays: 37,
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'DONE' }
        });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(endsAt);
        expect(f.machine.adminExtensions).toEqual([
            {
                trialId: 'trial-1',
                userId,
                vertical,
                actorId,
                reason: 'compensación por moderación errónea',
                days: 7,
                previousEndsAt: initialEndsAt,
                endsAt,
                occurredAt: NOW
            }
        ]);
        expect(f.machine.log.indexOf('recordAdmin')).toBeLessThan(f.machine.log.indexOf('commit'));
        expect(f.machine.campaigns).toEqual([
            {
                userId,
                vertical,
                campaign: 'PRE_EXPIRY',
                at: endsAt,
                deadlinesVersion: 2,
                milestones: computePreExpiryMilestones({ endsAt })
            }
        ]);
        expect(f.machine.log).not.toContain('insertRedemption');
        expect(f.machine.log).not.toContain('findRedemption');
        expect(f.machine.ceilingReads).toHaveLength(0);
        expect(f.events).toEqual([{ userId, vertical, sourceType: 'TRIAL', change: 'CHANGED' }]);
        expect(f.invalidations).toEqual([{ userId }]);
    });

    it.each(['', '   '])('rejects blank reason %j without writing', async (reason) => {
        const f = setup();
        await expect(f.extend({ reason })).rejects.toMatchObject({ field: 'reason' });
        expect(f.machine.log).toHaveLength(0);
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(initialEndsAt);
    });

    it.each([
        { patch: { days: 0 }, field: 'days' },
        { patch: { actorId: 'bad-id' }, field: 'actorId' }
    ])('rejects invalid $field', async ({ patch, field }) => {
        const f = setup();
        try {
            await f.extend(patch);
            throw new Error('Expected invalid input');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidTrialMachineInputError);
            expect(error).toMatchObject({ field });
        }
        expect(f.machine.log).toHaveLength(0);
    });

    it('reports a missing row without effects', async () => {
        const f = setup({ seed: false });
        expect(await f.extend()).toEqual({ extended: false, reason: 'NO_TRIAL' });
        expect(f.machine.campaigns).toHaveLength(0);
        expect(f.events).toHaveLength(0);
    });

    it.each([
        { endsAt: new Date(NOW.getTime() - 1) },
        { status: TrialStatusEnum.TRIAL_EXPIRED }
    ])('does not revive an ended trial', async (options) => {
        const f = setup(options);
        expect(await f.extend()).toEqual({ extended: false, reason: 'TRIAL_ENDED' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(
            options.endsAt ?? initialEndsAt
        );
        expect(f.machine.adminExtensions).toHaveLength(0);
        expect(f.machine.campaigns).toHaveLength(0);
        expect(f.events).toHaveLength(0);
    });

    it('counts admin days against a later promotional extension', async () => {
        const f = setup();
        await f.extend();
        const promo = createExtendTrial({
            unitOfWork: f.machine.unitOfWork,
            clock: f.clock,
            afterCommit: f.afterCommit
        });
        expect(
            await promo.extendTrial({ userId, vertical, days: 1, redemptionKey: 'promo-1' })
        ).toEqual({ outcome: 'REJECTED', reason: 'CEILING_REACHED' });
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(
            new Date(initialEndsAt.getTime() + 7 * DAY)
        );
        expect(f.machine.redemptions.size).toBe(0);
    });

    it('rolls back the end and campaign if the audit write fails', async () => {
        const f = setup();
        f.machine.failRecordAdminExtension();
        await expect(f.extend()).rejects.toThrow('Injected admin record failure');
        expect(f.machine.log).toContain('rollback');
        expect(f.machine.trialOf(userId, vertical)?.endsAt).toEqual(initialEndsAt);
        expect(f.machine.campaigns).toHaveLength(0);
        expect(f.machine.adminExtensions).toHaveLength(0);
        expect(f.events).toHaveLength(0);
        expect(f.invalidations).toHaveLength(0);
    });
});
