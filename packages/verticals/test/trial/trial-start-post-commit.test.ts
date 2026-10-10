/**
 * Unit tests: post-commit notice and concurrency for trial-start (T1).
 *
 * Post-commit: the coverage notice fires after the row is committed,
 * is never called on denial, and survives emit failures.
 *
 * Concurrency: two simultaneous startTrial of the same user — exactly
 * one succeeds, the other gets USER_ALREADY_HAS_TRIAL_ROW, no UNIQUE
 * conflicts from race conditions.
 */
import { randomUUID } from 'node:crypto';
import type { CoverageResponse } from '@repo/billing-verticals-contract';
import {
    TrialStatusEnum,
    VERTICAL_ACTIVATION_EVENTS,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { startTrial } from '../../src/trial/trial-start';
import { createInMemoryTrialStart } from './in-memory-trial-start';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const FIXED = new Date('2026-10-07T12:00:00.000Z');

function makeClock(now = FIXED) {
    let calls = 0;
    return {
        get nowCalls() {
            return calls;
        },
        now() {
            calls++;
            return now;
        },
        reset() {
            calls = 0;
        }
    };
}

const PRE_TRIAL_COVERAGE: CoverageResponse = {
    covered: false,
    sources: [
        {
            type: 'TRIAL',
            reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-pre-trial' },
            scope: 'VERTICAL',
            target: null,
            since: 'NOT_STARTED',
            until: 'NOT_STARTED',
            charged: null,
            floor: null
        },
        {
            type: 'BASE',
            reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-floor' },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01T00:00:00.000Z'),
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: null
        }
    ]
};

const VERSIONS = [
    {
        id: 'v-rank-10',
        planId: 'p-accom',
        vertical: VerticalEnum.ACCOMMODATION,
        rank: 10,
        sellable: true,
        current: true
    },
    {
        id: 'v-rank-20',
        planId: 'p-accom',
        vertical: VerticalEnum.ACCOMMODATION,
        rank: 20,
        sellable: true,
        current: true
    },
    {
        id: 'v-rank-30',
        planId: 'p-accom',
        vertical: VerticalEnum.ACCOMMODATION,
        rank: 30,
        sellable: true,
        current: true
    }
] as const;

const TRIAL_PLAN_ID = randomUUID();
const TRIAL_PLAN_VERSION_ID = randomUUID();

function makeInput(
    overrides: Partial<{
        userId: string;
        vertical: VerticalEnum;
        event: VerticalActivationEvent;
        emailPseudonym: string;
    }> = {}
) {
    return {
        userId: overrides.userId ?? randomUUID(),
        vertical: overrides.vertical ?? VerticalEnum.ACCOMMODATION,
        event: overrides.event ?? VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
        emailPseudonym:
            overrides.emailPseudonym ??
            randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 32)
    };
}

function validPseudonym() {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 32);
}

beforeEach(() => {
    state.reset();
});

/* ------------------------------------------------------------------ */
/* State (shared fixture)                                              */
/* ------------------------------------------------------------------ */

const state = createInMemoryTrialStart();

/* ------------------------------------------------------------------ */
/* Post-commit notice                                                  */
/* ------------------------------------------------------------------ */

describe('post-commit notice', () => {
    const clock = makeClock();
    let emitCalls: unknown[] = [];

    beforeEach(() => {
        emitCalls = [];
        clock.reset();
    });

    it('aviso después del commit: emit lee log y confirma commit', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        let emitArg: unknown = null;
        const emitCoverageChanged = async (event: unknown) => {
            emitCalls.push(event);
            emitArg = event;
            // Check that log already contains 'commit'
            expect(state.log).toContain('commit');
        };

        // Act
        const input = makeInput();
        const result = await startTrial({
            unitOfWork: state.unitOfWork,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            clock,
            emitCoverageChanged: emitCoverageChanged as (event: unknown) => Promise<void>,
            input
        });

        // Assert
        expect(result.started).toBe(true);
        const startedResult = result as { started: true; trial: unknown; coverageNotice: string };
        expect(startedResult.coverageNotice).toBe('EMITTED');
        // Called exactly once
        expect(emitCalls.length).toBe(1);
        expect(emitArg).toEqual({
            userId: input.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'TRIAL',
            change: 'CHANGED'
        });
    });

    it('no se llamó en denegación', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'start_button_pressed'); // wrong event
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const result = await startTrial({
            unitOfWork: state.unitOfWork,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            clock,
            emitCoverageChanged: async () => {
                throw new Error('should not be called');
            },
            input: makeInput()
        });

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EVENT_NOT_DECLARED_BY_VERTICAL'
        );
    });

    it('aviso que falla → coverageNotice FAILED, trial still started', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const result = await startTrial({
            unitOfWork: state.unitOfWork,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            clock,
            emitCoverageChanged: async () => {
                throw new Error('emit failed');
            },
            input: makeInput()
        });

        // Assert
        expect(result.started).toBe(true);
        const failedResult = result as { started: true; trial: unknown; coverageNotice: string };
        expect(failedResult.coverageNotice).toBe('FAILED');
        // Row was inserted
        expect(state.trialRows.size).toBe(1);
    });

    it('conflicto de la base en insert (EMAIL_PSEUDONYM) → denied, no campaign, no emit', async () => {
        // Pre-seed: insert a trial row with a pseudonym that another user will try.
        const pseudo = validPseudonym();
        const existingUserId = randomUUID();
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        state.setTrialRow(existingUserId, VerticalEnum.ACCOMMODATION, {
            id: 'pre-seeded',
            userId: existingUserId,
            vertical: VerticalEnum.ACCOMMODATION,
            status: TrialStatusEnum.TRIAL_ACTIVE,
            trialPlanId: TRIAL_PLAN_ID,
            floorEntitlementsVersionId: 'v-rank-30',
            floorLimitsVersionId: 'v-rank-10',
            floorTrialPlanVersionId: TRIAL_PLAN_VERSION_ID,
            startedAt: FIXED,
            endsAt: new Date(FIXED.getTime() + 30 * 86_400_000),
            emailPseudonym: pseudo,
            deadlinesVersion: 1
        });

        // Act — a DIFFERENT userId tries with the same pseudonym
        const differentUserId = randomUUID();
        const result = await startTrial({
            unitOfWork: state.unitOfWork,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            clock,
            emitCoverageChanged: async () => {
                throw new Error('should not be called');
            },
            input: {
                userId: differentUserId,
                vertical: VerticalEnum.ACCOMMODATION,
                event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                emailPseudonym: pseudo
            }
        });

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EMAIL_PSEUDONYM_ALREADY_USED'
        );
        expect(state.campaigns.length).toBe(0);
    });
});

/* ------------------------------------------------------------------ */
/* Concurrency                                                         */
/* ------------------------------------------------------------------ */

describe('concurrency — two simultaneous startTrial of the same user', () => {
    const clock = makeClock();
    let emitCalls: number = 0;

    it('exactly one succeeds, the other gets USER_ALREADY_HAS_TRIAL_ROW, no UNIQUE conflicts', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        const emitCoverageChanged = async () => {
            emitCalls++;
        };

        const userId = randomUUID();

        // Act — two concurrent calls
        const [r1, r2] = await Promise.all([
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged,
                input: {
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: validPseudonym()
                }
            }),
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged,
                input: {
                    userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: validPseudonym()
                }
            })
        ]);

        // Assert
        const startedCount = [r1, r2].filter((r) => r.started).length;
        expect(startedCount).toBe(1);

        // Exactly one succeeded
        const succeeded = [r1, r2].find((r) => r.started);
        expect(succeeded).toBeDefined();
        expect(succeeded!.started).toBe(true);

        // The other failed with USER_ALREADY_HAS_TRIAL_ROW
        const failed = [r1, r2].find((r) => !r.started);
        expect(failed!.started).toBe(false);
        expect((failed as { started: boolean; reason: string }).reason).toBe(
            'USER_ALREADY_HAS_TRIAL_ROW'
        );

        // Only one row in the store
        expect(state.trialRows.size).toBe(1);

        // The lock serialized, so the second insert found the first row →
        // conflict via USER_VERTICAL, not a raw UNIQUE violation
        expect(state.log.filter((l) => l === 'insert').length).toBe(2);
    });

    it('emitCoverageChanged was called exactly once', async () => {
        // From the test above, emit should be called only for the winner.
        expect(emitCalls).toBe(1);
    });
});
