import {
    type CoverageChangedEvent,
    type CoverageResponse,
    CoverageResponseSchema,
    type CoverageSource
} from '@repo/billing-verticals-contract';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { convertTrialOnTitle, findConvertingTitle } from '../../src/trial/trial-conversion';
import { trialMachineLockKey } from '../../src/trial/trial-lock-key';
import type { TrialAfterCommit } from '../../src/trial/trial-machine-types';
import { createInMemoryTrialMachine } from './in-memory-trial-machine';

const userId = '11111111-1111-4111-8111-111111111111';
const vertical = VerticalEnum.ACCOMMODATION;
const endsAt = new Date('2026-11-10T12:00:00.000Z');
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
              : endsAt,
    charged,
    floor: type === 'GRANT' ? 'plan-floor' : null
});
const response = (...sources: CoverageSource[]): CoverageResponse =>
    CoverageResponseSchema.parse({ covered: true, sources });
const trial = source('TRIAL');
const base = source('BASE');
const event: CoverageChangedEvent = {
    userId,
    vertical,
    sourceType: 'SUBSCRIPTION',
    change: 'ADDED'
};

function setup(status = TrialStatusEnum.TRIAL_ACTIVE, withRow = true) {
    const machine = createInMemoryTrialMachine();
    if (withRow) {
        machine.seedTrial({
            id: 'trial-1',
            userId,
            vertical,
            status,
            startedAt: since,
            endsAt,
            deadlinesVersion: 1
        });
    }
    const emitted = vi.fn(async (_notice: CoverageChangedEvent) => undefined);
    const invalidated = vi.fn(async (_args: { readonly userId: string }) => undefined);
    const afterCommit: TrialAfterCommit = {
        emitCoverageChanged: emitted,
        invalidateUser: invalidated
    };
    const convert = (coverage: CoverageResponse) =>
        convertTrialOnTitle({
            unitOfWork: machine.unitOfWork,
            billing: { coverage: async () => coverage },
            afterCommit,
            event
        });
    return { machine, emitted, invalidated, afterCommit, convert };
}

describe('AC:V4:6 (unitaria) trial conversion', () => {
    it('unpaid subscription leaves active trial and notices untouched', async () => {
        const fixture = setup();
        expect(await fixture.convert(response(trial, source('SUBSCRIPTION', false), base))).toEqual(
            {
                converted: false,
                reason: 'NO_CONVERTING_TITLE'
            }
        );
        expect(fixture.machine.log).not.toContain('markConverted');
        expect(fixture.emitted).not.toHaveBeenCalled();
        expect(fixture.invalidated).not.toHaveBeenCalled();
    });

    it('paid subscription converts T2, cancels pre-expiry, and notifies once', async () => {
        const fixture = setup();
        expect(await fixture.convert(response(trial, source('SUBSCRIPTION', true), base))).toEqual({
            converted: true,
            transition: 'T2',
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'DONE' }
        });
        expect(fixture.machine.trialOf(userId, vertical)?.status).toBe(
            TrialStatusEnum.TRIAL_CONVERTED
        );
        expect(fixture.machine.log).toContain('cancel:PRE_EXPIRY');
        expect(fixture.emitted).toHaveBeenCalledExactlyOnceWith({
            userId,
            vertical,
            sourceType: 'TRIAL',
            change: 'REMOVED'
        });
        expect(fixture.invalidated).toHaveBeenCalledExactlyOnceWith({ userId });
    });

    it('rejected payment with no subscription keeps the remaining days', async () => {
        const fixture = setup();
        expect(await fixture.convert(response(trial, base))).toMatchObject({
            converted: false,
            reason: 'NO_CONVERTING_TITLE'
        });
        expect(fixture.machine.trialOf(userId, vertical)).toMatchObject({
            status: TrialStatusEnum.TRIAL_ACTIVE,
            endsAt
        });
    });

    it('a grant title converts an active trial by T2', async () => {
        const fixture = setup();
        expect(await fixture.convert(response(trial, source('GRANT'), base))).toMatchObject({
            converted: true,
            transition: 'T2'
        });
    });

    it('the live trial title cannot convert itself', async () => {
        const fixture = setup();
        expect(await fixture.convert(response(trial, base))).toMatchObject({
            converted: false,
            reason: 'NO_CONVERTING_TITLE'
        });
        expect(fixture.machine.log).not.toContain('markConverted');
    });

    it('paid subscription converts an expired trial by T5 and cancels recovery only', async () => {
        const fixture = setup(TrialStatusEnum.TRIAL_EXPIRED);
        expect(await fixture.convert(response(source('SUBSCRIPTION', true), base))).toMatchObject({
            converted: true,
            transition: 'T5'
        });
        expect(fixture.machine.log).toContain('cancel:RECOVERY');
        expect(fixture.machine.log).not.toContain('cancel:PRE_EXPIRY');
        expect(fixture.emitted).toHaveBeenCalledWith({
            userId,
            vertical,
            sourceType: 'TRIAL',
            change: 'CHANGED'
        });
    });

    it('unpaid subscription does not convert an expired trial', async () => {
        const fixture = setup(TrialStatusEnum.TRIAL_EXPIRED);
        expect(await fixture.convert(response(source('SUBSCRIPTION', false), base))).toMatchObject({
            converted: false,
            reason: 'NO_CONVERTING_TITLE'
        });
        expect(fixture.machine.trialOf(userId, vertical)?.status).toBe(
            TrialStatusEnum.TRIAL_EXPIRED
        );
    });

    it('without a trial row a converting title cannot create one', async () => {
        const fixture = setup(TrialStatusEnum.TRIAL_ACTIVE, false);
        expect(await fixture.convert(response(source('SUBSCRIPTION', true), base))).toMatchObject({
            converted: false,
            reason: 'NO_TRIAL_ROW'
        });
        expect(fixture.machine.rows.size).toBe(0);
    });

    it('an already converted trial is left unchanged', async () => {
        const fixture = setup(TrialStatusEnum.TRIAL_CONVERTED);
        expect(await fixture.convert(response(source('SUBSCRIPTION', true), base))).toMatchObject({
            converted: false,
            reason: 'ALREADY_CONVERTED'
        });
        expect(fixture.machine.log).not.toContain('markConverted');
    });

    it('reads billing coverage while the shared machine lock is held', async () => {
        const fixture = setup();
        const locked: boolean[] = [];
        await convertTrialOnTitle({
            unitOfWork: fixture.machine.unitOfWork,
            billing: {
                coverage: async () => {
                    locked.push(
                        fixture.machine.isLocked(trialMachineLockKey({ userId, vertical }).key)
                    );
                    return response(trial, base);
                }
            },
            afterCommit: fixture.afterCommit,
            event
        });
        expect(locked).toEqual([true]);
    });

    it('emits only after the transaction commits', async () => {
        const fixture = setup();
        const sawCommit: boolean[] = [];
        fixture.afterCommit.emitCoverageChanged = async () => {
            sawCommit.push(fixture.machine.log.includes('commit'));
        };
        await fixture.convert(response(trial, source('SUBSCRIPTION', true), base));
        expect(sawCommit).toEqual([true]);
    });

    it('retains conversion when notice emission fails', async () => {
        const fixture = setup();
        fixture.afterCommit.emitCoverageChanged = async () => {
            throw new Error('notice failed');
        };
        expect(
            await fixture.convert(response(trial, source('SUBSCRIPTION', true), base))
        ).toMatchObject({
            converted: true,
            notices: { coverageNotice: 'FAILED', cacheInvalidation: 'DONE' }
        });
        expect(fixture.machine.trialOf(userId, vertical)?.status).toBe(
            TrialStatusEnum.TRIAL_CONVERTED
        );
    });

    it('emits the notice even if cache invalidation fails', async () => {
        const fixture = setup();
        fixture.afterCommit.invalidateUser = async () => {
            throw new Error('cache failed');
        };
        expect(
            await fixture.convert(response(trial, source('SUBSCRIPTION', true), base))
        ).toMatchObject({
            converted: true,
            notices: { coverageNotice: 'EMITTED', cacheInvalidation: 'FAILED' }
        });
        expect(fixture.emitted).toHaveBeenCalledTimes(1);
    });

    it('pure title lookup skips addon and trial before finding the paid subscription', () => {
        const paid = source('SUBSCRIPTION', true);
        expect(
            findConvertingTitle({ coverage: response(source('ADDON'), trial, paid, base) })
        ).toEqual({
            source: paid
        });
    });
});
