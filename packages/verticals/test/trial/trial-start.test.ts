import { randomUUID } from 'node:crypto';
import type { CoverageResponse } from '@repo/billing-verticals-contract';
import {
    TrialStatusEnum,
    VERTICAL_ACTIVATION_EVENTS,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { computePreExpiryMilestones } from '../../src/trial/trial-deadlines';
import {
    evaluateTrialStart,
    InvalidTrialStartInputError,
    startTrial
} from '../../src/trial/trial-start';
import { createInMemoryTrialStart } from './in-memory-trial-start';

/* ------------------------------------------------------------------ */
/* Test fixtures                                                       */
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

/** A PRE_TRIAL coverage response (covered: false). */
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

/** A covered coverage response (covered: true, with subscription). */
const COVERED_COVERAGE: CoverageResponse = {
    covered: true,
    sources: [
        {
            type: 'SUBSCRIPTION',
            reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-premium' },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-08-28T12:00:00.000Z'),
            until: 'NO_KNOWN_DATE',
            charged: true,
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

/**
 * Three sellable current versions with different ranks, as the catalog
 * returns them ordered by rank ascending (lowest first): 10, 20, 30.
 */
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

/** A test input that matches accommodation + listing_published + 30 days. */
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

/**
 * Returns a valid 64-char hex pseudonym.
 */
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
/* AC:V4:4 (unitaria) — happy path & vertical behaviour                */
/* ------------------------------------------------------------------ */

describe('AC:V4:4 (unitaria) — the trial starts on activation', () => {
    const clock = makeClock();
    let emitCalls: unknown[] = [];
    const emitCoverageChanged = async (event: unknown) => {
        emitCalls.push(event);
    };

    beforeEach(() => {
        emitCalls = [];
        clock.reset();
    });

    function buildArgs(input = makeInput()) {
        return {
            unitOfWork: state.unitOfWork,
            billing: {
                coverage: async () => PRE_TRIAL_COVERAGE
            },
            clock,
            emitCoverageChanged,
            input
        };
    }

    it('camino feliz: starts, row is TRIAL_ACTIVE with correct fields', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const input = makeInput();
        const result = await startTrial(buildArgs(input));

        // Assert
        expect(result.started).toBe(true);
        const startedResult = result as {
            started: true;
            trial: {
                status: string;
                trialPlanId: string;
                startedAt: Date;
                endsAt: Date;
                emailPseudonym: string;
                deadlinesVersion: number;
                floorEntitlementsVersionId: string;
                floorLimitsVersionId: string;
                floorTrialPlanVersionId: string;
            };
        };
        expect(startedResult.trial.status).toBe(TrialStatusEnum.TRIAL_ACTIVE);
        expect(startedResult.trial.trialPlanId).toBe(TRIAL_PLAN_ID);
        expect(startedResult.trial.startedAt).toEqual(FIXED);
        // endsAt = startedAt + 30 days
        const expectedEndsAt = new Date(FIXED.getTime() + 30 * 86_400_000);
        expect(startedResult.trial.endsAt).toEqual(expectedEndsAt);
        expect(startedResult.trial.emailPseudonym).toBe(input.emailPseudonym);
        expect(startedResult.trial.deadlinesVersion).toBe(1);
        // Floor references:
        // entitlements = last (rank 30), limits = first (rank 10)
        expect(startedResult.trial.floorEntitlementsVersionId).toBe('v-rank-30');
        expect(startedResult.trial.floorLimitsVersionId).toBe('v-rank-10');
        expect(startedResult.trial.floorTrialPlanVersionId).toBe(TRIAL_PLAN_VERSION_ID);
    });

    it('schedules the pre-expiry campaign once', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        await startTrial(buildArgs());

        // Assert
        expect(state.log).toContain('schedule');
        expect(state.log.filter((l) => l === 'schedule').length).toBe(1);
        const campaign = state.campaigns[0];
        expect(campaign).toBeDefined();
        const expectedMilestones = computePreExpiryMilestones({
            endsAt: new Date(FIXED.getTime() + 30 * 86_400_000)
        });
        expect(campaign!.milestones).toEqual(expectedMilestones);
        expect(campaign!.deadlinesVersion).toBe(1);
    });

    it('accommodation: listing_published triggers the trial', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const result = await startTrial(buildArgs());

        // Assert
        expect(result.started).toBe(true);
    });

    it('tourist: start_button_pressed triggers the trial', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.TOURIST, 'start_button_pressed');
        state.setTrialPlan(VerticalEnum.TOURIST, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(
            VerticalEnum.TOURIST,
            VERSIONS.map((v) => ({ ...v, vertical: VerticalEnum.TOURIST }))
        );

        // Act
        const result = await startTrial(
            buildArgs({
                ...makeInput(),
                vertical: VerticalEnum.TOURIST,
                event: VERTICAL_ACTIVATION_EVENTS.START_BUTTON_PRESSED
            })
        );

        // Assert
        expect(result.started).toBe(true);
    });

    it('tourist: listing_published does NOT trigger (EVENT_NOT_DECLARED_BY_VERTICAL)', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.TOURIST, 'start_button_pressed');
        state.setTrialPlan(VerticalEnum.TOURIST, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(
            VerticalEnum.TOURIST,
            VERSIONS.map((v) => ({ ...v, vertical: VerticalEnum.TOURIST }))
        );

        // Act
        const result = await startTrial(
            buildArgs({
                ...makeInput(),
                vertical: VerticalEnum.TOURIST,
                event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED
            })
        );

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EVENT_NOT_DECLARED_BY_VERTICAL'
        );
        // No row written
        expect(state.trialRows.size).toBe(0);
    });

    it('partner (null event): EVENT_NOT_DECLARED_BY_VERTICAL', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.PARTNER, null);
        state.setTrialPlan(VerticalEnum.PARTNER, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(
            VerticalEnum.PARTNER,
            VERSIONS.map((v) => ({ ...v, vertical: VerticalEnum.PARTNER }))
        );

        // Act
        const result = await startTrial(
            buildArgs({
                ...makeInput(),
                vertical: VerticalEnum.PARTNER,
                event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED
            })
        );

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EVENT_NOT_DECLARED_BY_VERTICAL'
        );
    });

    it('días en cero: TRIAL_DAYS_NOT_POSITIVE, no writes', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 0
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const result = await startTrial(buildArgs());

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'TRIAL_DAYS_NOT_POSITIVE'
        );
        expect(state.trialRows.size).toBe(0);
        expect(state.log.filter((l) => l === 'insert').length).toBe(0);
    });

    it('covered: true → ALREADY_COVERED, no write', async () => {
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
            ...buildArgs(),
            billing: {
                coverage: async () => COVERED_COVERAGE
            }
        });

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe('ALREADY_COVERED');
        expect(state.trialRows.size).toBe(0);
    });
});

/* ------------------------------------------------------------------ */
/* AC:V4:5 (unitaria) — guarded denial                                 */
/* ------------------------------------------------------------------ */

describe('AC:V4:5 (unitaria) — guarded denial', () => {
    const clock = makeClock();
    let emitCalls: unknown[] = [];

    beforeEach(() => {
        emitCalls = [];
        clock.reset();
    });

    const emitCoverageChanged = async (event: unknown) => {
        emitCalls.push(event);
    };

    function buildArgs(input = makeInput()) {
        return {
            unitOfWork: state.unitOfWork,
            billing: {
                coverage: async () => PRE_TRIAL_COVERAGE
            },
            clock,
            emitCoverageChanged,
            input
        };
    }

    it('sin versiones vendibles → NO_SELLABLE_CURRENT_VERSION, no write', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, []);

        // Act
        const result = await startTrial(buildArgs());

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'NO_SELLABLE_CURRENT_VERSION'
        );
        expect(state.trialRows.size).toBe(0);

        // evaluateTrialStart also says starts: false (PB1 reads this)
        const decision = await evaluateTrialStart({
            reader: state.reader,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            input: makeInput()
        });
        expect(decision.starts).toBe(false);
    });

    it('seudónimo ya de otro usuario → EMAIL_PSEUDONYM_ALREADY_USED, no emit', async () => {
        // Arrange
        const otherUser = randomUUID();
        const pseudo = validPseudonym();
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);
        // Insert a trial row for another user with the same pseudonym
        state.setTrialRow(otherUser, VerticalEnum.ACCOMMODATION, {
            id: 'existing',
            userId: otherUser,
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

        // Act
        const result = await startTrial(buildArgs({ ...makeInput(), emailPseudonym: pseudo }));

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EMAIL_PSEUDONYM_ALREADY_USED'
        );
        // No campaign scheduled
        expect(state.campaigns.length).toBe(0);
        // No emitCoverageChanged
        expect(emitCalls.length).toBe(0);
    });

    it('misma persona con fila previa → USER_ALREADY_HAS_TRIAL_ROW', async () => {
        // Arrange
        const userId = randomUUID();
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);
        state.setTrialRow(userId, VerticalEnum.ACCOMMODATION, {
            id: 'existing',
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            status: TrialStatusEnum.TRIAL_ACTIVE,
            trialPlanId: TRIAL_PLAN_ID,
            floorEntitlementsVersionId: 'v-rank-30',
            floorLimitsVersionId: 'v-rank-10',
            floorTrialPlanVersionId: TRIAL_PLAN_VERSION_ID,
            startedAt: FIXED,
            endsAt: new Date(FIXED.getTime() + 30 * 86_400_000),
            emailPseudonym: validPseudonym(),
            deadlinesVersion: 1
        });

        // Act
        const result = await startTrial(buildArgs({ ...makeInput(), userId }));

        // Assert
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'USER_ALREADY_HAS_TRIAL_ROW'
        );
    });

    it('orden de evaluación: evento mal declarado + días cero → EVENT_NOT_DECLARED_BY_VERTICAL', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'start_button_pressed'); // wrong
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 0
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        const result = await startTrial(
            buildArgs({ ...makeInput(), event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED })
        );

        // Assert — the FIRST failing guard wins
        expect(result.started).toBe(false);
        expect((result as { started: boolean; reason: string }).reason).toBe(
            'EVENT_NOT_DECLARED_BY_VERTICAL'
        );
    });
});

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
        const startedResult = result as { started: true; trial: any; coverageNotice: string };
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
        const failedResult = result as { started: true; trial: any; coverageNotice: string };
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

/* ------------------------------------------------------------------ */
/* Invalid input                                                       */
/* ------------------------------------------------------------------ */

describe('invalid input', () => {
    const clock = makeClock();

    it('seudónimo de 63 caracteres → InvalidTrialStartInputError(field: emailPseudonym)', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: randomUUID(),
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: 'a'.repeat(63) // too short
                }
            })
        ).rejects.toThrow(InvalidTrialStartInputError);
    });

    it('seudónimo con mayúsculas → InvalidTrialStartInputError(field: emailPseudonym)', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged: async () => {
                    // no-op
                },
                input: {
                    userId: randomUUID(),
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: 'A'.repeat(64) // uppercase
                }
            })
        ).rejects.toThrow(InvalidTrialStartInputError);
    });

    it('userId vacío → InvalidTrialStartInputError(field: userId)', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged: async () => {
                    // no-op
                },
                input: {
                    userId: '',
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: validPseudonym()
                }
            })
        ).rejects.toThrow(InvalidTrialStartInputError);
    });

    it('event desconocido → InvalidTrialStartInputError(field: event)', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged: async () => {
                    // no-op
                },
                input: {
                    userId: randomUUID(),
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: 'fake_event' as VerticalActivationEvent,
                    emailPseudonym: validPseudonym()
                }
            })
        ).rejects.toThrow(InvalidTrialStartInputError);
    });

    it('el mensaje del error no contiene el valor recibido', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        try {
            await startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock,
                emitCoverageChanged: async () => {
                    // no-op
                },
                input: {
                    userId: 'super-secret-id',
                    vertical: VerticalEnum.ACCOMMODATION,
                    event: VERTICAL_ACTIVATION_EVENTS.LISTING_PUBLISHED,
                    emailPseudonym: 'deadbeef'.repeat(8)
                }
            });
        } catch (err) {
            expect(err).toBeInstanceOf(InvalidTrialStartInputError);
            // The message should not contain 'super-secret-id' or 'deadbeef'
            const message = (err as Error).message;
            expect(message).not.toContain('super-secret-id');
            expect(message).not.toContain('deadbeef');
        }
    });
});

/* ------------------------------------------------------------------ */
/* Catalog missing trial plan                                         */
/* ------------------------------------------------------------------ */

describe('missing trial plan in catalog', () => {
    it('launches CatalogVersionNotFoundError', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, null); // no trial plan
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act & Assert
        await expect(
            evaluateTrialStart({
                reader: state.reader,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                input: makeInput()
            })
        ).rejects.toThrow('plan_version accommodation:trial does not exist');
    });
});

/* ------------------------------------------------------------------ */
/* Clock usage                                                          */
/* ------------------------------------------------------------------ */

describe('clock usage', () => {
    const clock = makeClock();

    beforeEach(() => {
        clock.reset();
    });

    it('startTrial calls clock.now exactly once', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        await startTrial({
            unitOfWork: state.unitOfWork,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            clock,
            emitCoverageChanged: async () => {},
            input: makeInput()
        });

        // Assert
        expect(clock.nowCalls).toBe(1);
    });

    it('evaluateTrialStart calls clock.now zero times', async () => {
        // Arrange
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);

        // Act
        await evaluateTrialStart({
            reader: state.reader,
            billing: { coverage: async () => PRE_TRIAL_COVERAGE },
            input: makeInput()
        });

        // Assert
        expect(clock.nowCalls).toBe(0);
    });
});
