/**
 * Unit tests: input validation for trial-start (T1).
 *
 * Covers invalid pseudonym length, uppercase characters, empty userId,
 * unknown events, and ensures error messages never leak user data.
 */
import { randomUUID } from 'node:crypto';
import type { CoverageResponse } from '@repo/billing-verticals-contract';
import {
    VERTICAL_ACTIVATION_EVENTS,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidTrialStartInputError, startTrial } from '../../src/trial/trial-start';
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

function _makeInput(
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
/* Invalid input                                                       */
/* ------------------------------------------------------------------ */

describe('invalid input', () => {
    beforeEach(() => {
        // Set up the trial plan and catalog for all tests
        state.setActivationEvent(VerticalEnum.ACCOMMODATION, 'listing_published');
        state.setTrialPlan(VerticalEnum.ACCOMMODATION, {
            planId: TRIAL_PLAN_ID,
            planVersionId: TRIAL_PLAN_VERSION_ID,
            trialDays: 30
        });
        state.setSellableVersions(VerticalEnum.ACCOMMODATION, [...VERSIONS]);
    });

    it('seudónimo de 63 caracteres → InvalidTrialStartInputError(field: emailPseudonym)', async () => {
        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock: { now: () => FIXED },
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
        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock: { now: () => FIXED },
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
        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock: { now: () => FIXED },
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
        // Act & Assert
        await expect(
            startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock: { now: () => FIXED },
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
        // Act & Assert
        try {
            await startTrial({
                unitOfWork: state.unitOfWork,
                billing: { coverage: async () => PRE_TRIAL_COVERAGE },
                clock: { now: () => FIXED },
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
