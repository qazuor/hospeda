import {
    type CoverageChangedEvent,
    type CoverageResponse,
    CoverageResponseSchema,
    type CoverageSource
} from '@repo/billing-verticals-contract';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { consumeTrialOnFirstPayment } from '../../src/trial/trial-first-payment';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';
import {
    InvalidTrialMachineInputError,
    type TrialAfterCommit
} from '../../src/trial/trial-machine-types';
import { createInMemoryTrialMachine } from './in-memory-trial-machine';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const vertical = VerticalEnum.ACCOMMODATION;
const pseudonym = 'a'.repeat(64);
const since = new Date('2026-10-10T12:00:00.000Z');
const source = (type: CoverageSource['type'], charged: boolean | null = null): CoverageSource => ({
    type,
    reference:
        type === 'ADDON'
            ? { kind: 'ADDON_VERSION', addonVersionId: 'addon-1' }
            : { kind: 'PLAN_VERSION', planVersionId: 'plan-1' },
    scope: 'VERTICAL',
    target: null,
    since,
    until:
        type === 'BASE' || type === 'GRANT'
            ? 'NEVER_EXPIRES'
            : type === 'SUBSCRIPTION' || type === 'ADDON'
              ? 'NO_KNOWN_DATE'
              : new Date('2026-12-10T12:00:00.000Z'),
    charged,
    floor: type === 'GRANT' ? 'plan-floor' : null
});
const response = (...sources: CoverageSource[]): CoverageResponse =>
    CoverageResponseSchema.parse({ covered: true, sources });
const paid = response(source('SUBSCRIPTION', true));
const unpaid = response(source('SUBSCRIPTION', false));
const event: CoverageChangedEvent = {
    userId,
    vertical,
    sourceType: 'SUBSCRIPTION',
    change: 'CHANGED'
};

function setup(coverage: CoverageResponse = paid) {
    const machine = createInMemoryTrialMachine();
    machine.seedExercised({ userId, vertical });
    const emitted = vi.fn(async (_notice: CoverageChangedEvent) => undefined);
    const invalidated = vi.fn(async (_args: { readonly userId: string }) => undefined);
    const afterCommit: TrialAfterCommit = {
        emitCoverageChanged: emitted,
        invalidateUser: invalidated
    };
    const coverageRead = vi.fn(
        async (args: { readonly userId: string; readonly vertical: typeof vertical }) => {
            expect(machine.isLocked(trialMachineLockKey(args).key)).toBe(true);
            return CoverageResponseSchema.parse(coverage);
        }
    );
    const consume = (
        input: { readonly event?: CoverageChangedEvent; readonly emailPseudonym?: string } = {}
    ) =>
        consumeTrialOnFirstPayment({
            unitOfWork: machine.unitOfWork,
            billing: { coverage: coverageRead },
            afterCommit,
            event: input.event ?? event,
            emailPseudonym: input.emailPseudonym ?? pseudonym
        });
    return { machine, emitted, invalidated, afterCommit, coverageRead, consume };
}

describe('AC:V4:10 (unitaria) - T8 first payment', () => {
    it('consumes a first paid subscription after the exercised event and notifies after commit without clock or campaigns', async () => {
        const f = setup();
        f.emitted.mockImplementation(async (notice) => {
            f.machine.log.push(`notice:${notice.sourceType}:${notice.change}`);
        });
        expect(await f.consume()).toEqual({
            consumed: true,
            transition: 'T8',
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'DONE' }
        });
        expect(f.machine.trialOf(userId, vertical)).toMatchObject({
            status: TrialStatusEnum.TRIAL_CONVERTED,
            startedAt: null,
            endsAt: null,
            deadlinesVersion: null
        });
        expect(f.machine.log).toContain('insertConsumedTrial');
        expect(f.machine.log).not.toContain('scheduleExpiry');
        expect(f.machine.log).not.toContain('scheduleRecovery');
        expect(f.machine.log.some((call) => call.startsWith('cancel:'))).toBe(false);
        expect(f.machine.log.indexOf('commit')).toBeLessThan(
            f.machine.log.indexOf('notice:TRIAL:REMOVED')
        );
        expect(f.emitted).toHaveBeenCalledExactlyOnceWith({
            userId,
            vertical,
            sourceType: 'TRIAL',
            change: 'REMOVED'
        });
        expect(f.invalidated).toHaveBeenCalledExactlyOnceWith({ userId });
    });

    it('does not read the event record or consume on an unpaid subscription, then consumes when that same subscription is paid', async () => {
        const f = setup(unpaid);
        expect(await f.consume()).toEqual({ consumed: false, reason: 'NO_CONVERTING_TITLE' });
        expect(f.machine.log).not.toContain('hasExercised');
        expect(f.machine.log).not.toContain('insertConsumedTrial');
        expect(f.emitted).not.toHaveBeenCalled();
        f.coverageRead.mockImplementation(async ({ userId: id, vertical: v }) => {
            expect(f.machine.isLocked(trialMachineLockKey({ userId: id, vertical: v }).key)).toBe(
                true
            );
            return CoverageResponseSchema.parse(paid);
        });
        expect(await f.consume()).toMatchObject({ consumed: true, transition: 'T8' });
    });

    it('declines when the owner never exercised activation', async () => {
        const f = setup();
        const machine = createInMemoryTrialMachine();
        const result = await consumeTrialOnFirstPayment({
            unitOfWork: machine.unitOfWork,
            billing: { coverage: async () => CoverageResponseSchema.parse(paid) },
            afterCommit: f.afterCommit,
            event,
            emailPseudonym: pseudonym
        });
        expect(result).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });
        expect(machine.log).not.toContain('insertConsumedTrial');
        expect(f.emitted).not.toHaveBeenCalled();
    });

    it.each([
        TrialStatusEnum.TRIAL_ACTIVE,
        TrialStatusEnum.TRIAL_EXPIRED,
        TrialStatusEnum.TRIAL_CONVERTED
    ])('leaves an existing %s row unchanged', async (status) => {
        const f = setup();
        f.machine.seedTrial({
            id: 'existing',
            userId,
            vertical,
            status,
            startedAt: status === TrialStatusEnum.TRIAL_CONVERTED ? null : since,
            endsAt: status === TrialStatusEnum.TRIAL_CONVERTED ? null : since,
            deadlinesVersion: status === TrialStatusEnum.TRIAL_CONVERTED ? null : 1
        });
        const before = f.machine.trialOf(userId, vertical);
        expect(await f.consume()).toEqual({ consumed: false, reason: 'TRIAL_ROW_EXISTS' });
        expect(f.machine.trialOf(userId, vertical)).toEqual(before);
        expect(f.machine.log).not.toContain('insertConsumedTrial');
    });

    it('declines a pseudonym already owned by another user', async () => {
        const f = setup();
        f.machine.seedPseudonym({ emailPseudonym: pseudonym, vertical, userId: otherUserId });
        expect(await f.consume()).toEqual({
            consumed: false,
            reason: 'EMAIL_PSEUDONYM_ALREADY_USED'
        });
        expect(f.emitted).not.toHaveBeenCalled();
    });

    it('declines missing activation catalog and nonpositive trial days', async () => {
        const missing = setup();
        missing.machine.setDeclaredEvent(vertical, null);
        expect(await missing.consume()).toEqual({
            consumed: false,
            reason: 'EVENT_NOT_DECLARED_BY_VERTICAL'
        });
        const zero = setup();
        zero.machine.setTrialPlanDays(vertical, 0);
        expect(await zero.consume()).toEqual({
            consumed: false,
            reason: 'TRIAL_DAYS_NOT_POSITIVE'
        });
    });

    it('maps insert conflicts to the shared denial without throwing or notifying', async () => {
        const f = setup();
        f.machine.forceInsertConflict({
            userId,
            vertical,
            emailPseudonym: pseudonym,
            conflict: 'EMAIL_PSEUDONYM'
        });
        expect(await f.consume()).toEqual({
            consumed: false,
            reason: 'EMAIL_PSEUDONYM_ALREADY_USED'
        });
        expect(f.machine.trialOf(userId, vertical)).toBeNull();
        expect(f.emitted).not.toHaveBeenCalled();
    });

    it('uses only user and vertical from the event, regardless of source type and change', async () => {
        const a = setup();
        const b = setup();
        expect(
            await a.consume({ event: { ...event, sourceType: 'SUBSCRIPTION', change: 'CHANGED' } })
        ).toMatchObject({ consumed: true });
        expect(
            await b.consume({ event: { ...event, sourceType: 'TRIAL', change: 'REMOVED' } })
        ).toMatchObject({ consumed: true });
    });

    it('keeps the row when post-commit effects fail and reports each outcome independently', async () => {
        const noticeFailure = setup();
        noticeFailure.emitted.mockRejectedValue(new Error('notice failed'));
        expect(await noticeFailure.consume()).toMatchObject({
            consumed: true,
            notices: { coverageNotice: 'FAILED', cacheInvalidation: 'DONE' }
        });
        expect(noticeFailure.machine.trialOf(userId, vertical)?.status).toBe(
            TrialStatusEnum.TRIAL_CONVERTED
        );
        const invalidationFailure = setup();
        invalidationFailure.invalidated.mockRejectedValue(new Error('invalidate failed'));
        expect(await invalidationFailure.consume()).toMatchObject({
            consumed: true,
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'FAILED' }
        });
        expect(invalidationFailure.emitted).toHaveBeenCalledOnce();
    });

    it('validates the input without exposing the pseudonym', async () => {
        const f = setup();
        await expect(f.consume({ event: { ...event, userId: '' } })).rejects.toMatchObject({
            name: 'InvalidTrialMachineInputError',
            field: 'userId'
        });
        try {
            await f.consume({ emailPseudonym: 'secret-value' });
            expect.fail('invalid pseudonym should throw');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidTrialMachineInputError);
            expect((error as Error).message).not.toContain('secret-value');
            expect((error as InvalidTrialMachineInputError).field).toBe('emailPseudonym');
        }
    });

    it('serializes simultaneous first-payment events for one user and vertical', async () => {
        const f = setup();
        const results = await Promise.all([f.consume(), f.consume()]);
        expect(results.filter((result) => result.consumed)).toHaveLength(1);
        expect(f.machine.rows.size).toBe(1);
        expect(f.machine.log.filter((call) => call === 'insertConsumedTrial')).toHaveLength(1);
    });
});
