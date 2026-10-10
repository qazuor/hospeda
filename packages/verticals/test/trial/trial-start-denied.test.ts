/**
 * Unit tests: guarded denial for trial-start (T1).
 *
 * Covers AC:V4:5 — the trial is denied when:
 * - No sellable versions exist
 * - A pseudonym is already used by another user
 * - The same user already has a trial row
 * - Multiple guards could fail (first failing guard wins)
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
import { evaluateTrialStart, startTrial } from '../../src/trial/trial-start';
import { createInMemoryTrialStart } from './in-memory-trial-start';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const FIXED = new Date('2026-10-07T12:00:00.000Z');

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
        // The pseudonym guard fired FIRST, so insertTrial was never called
        expect(state.log.filter((l) => l === 'insert').length).toBe(0);
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
