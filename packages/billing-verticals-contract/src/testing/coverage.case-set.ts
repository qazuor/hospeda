/**
 * The forward case set (contract §6.2): ONE set that runs entire against both
 * implementations of `coverage` (the bootstrap one of V4 and the real one of
 * B4), and against the simulator.
 *
 * It only holds cases both implementations can pass: the bootstrap answers no
 * to every billing source, so the cases are about the trial and the BASE floor.
 * Cases about billing sources go in the real implementation's own set (contract
 * §6.2, "los casos de las fuentes de billing no son del juego único").
 *
 * The case that tells a correct implementation from a constant one is the
 * first: someone in PRE_TRIAL is NOT covered and still has sources (contract
 * §5.1). Together, the cases fail every constant answer.
 */
import { VerticalEnum } from '@repo/schemas';
import {
    type CoverageResponse,
    CoverageResponseSchema,
    coverageSourceClassOf
} from '../coverage.schema';
import type { CoverageChangedEvent } from '../forward.schema';
import type { BillingForVerticals } from '../interfaces';
import type { UserVerticalArgs } from '../primitives.schema';
import type { CaseExpect, CaseRunner } from './case-set.types';

/**
 * What a case needs from the implementation under test. A fresh harness is
 * made for every case.
 */
export interface CoverageCaseHarness {
    /** The implementation under test. */
    readonly subject: Pick<BillingForVerticals, 'coverage' | 'onCoverageChanged'>;
    /** Puts a person in a trial state, through whatever the implementation stores. */
    readonly arrange: {
        /** In PRE_TRIAL: the trial clock has not started. */
        readonly preTrial: (args: UserVerticalArgs) => Promise<void>;
        /** In a running trial (TRIAL_ACTIVE, end not reached). */
        readonly trialRunning: (args: UserVerticalArgs) => Promise<void>;
        /** With a trial that ran and expired (TRIAL_EXPIRED). */
        readonly trialExpired: (args: UserVerticalArgs) => Promise<void>;
    };
    /** Runs a transition the implementation emits the notice for. */
    readonly act: {
        /**
         * T1: from PRE_TRIAL into a running trial. Resolves once the write is
         * committed AND the coverage-changed notice has been emitted.
         */
        readonly startTrial: (args: UserVerticalArgs) => Promise<void>;
    };
    /** A person id nobody else in this harness uses. */
    readonly newUserId: () => string;
}

/** The vertical the trial cases run in: one whose trial has an activation event. */
const TRIAL_VERTICAL = VerticalEnum.ACCOMMODATION;

/** A second vertical, never arranged. */
const OTHER_VERTICAL = VerticalEnum.GASTRONOMY;

/** Asserts the response validates against the contract; returns it typed. */
function expectValid(args: {
    readonly expect: CaseExpect;
    readonly response: unknown;
}): CoverageResponse {
    const parsed = CoverageResponseSchema.safeParse(args.response);
    args.expect(
        parsed.success ? 'valid' : parsed.error.message,
        'the coverage response validates against the contract'
    ).toBe('valid');
    return CoverageResponseSchema.parse(args.response);
}

const classesOf = ({ response }: { readonly response: CoverageResponse }) =>
    response.sources.map((source) => coverageSourceClassOf({ source }).sourceClass);

/**
 * Registers the forward case set.
 *
 * @param args.describe - The runner's `describe`
 * @param args.it - The runner's `it`
 * @param args.expect - The runner's `expect`
 * @param args.makeHarness - Builds a fresh harness for one case
 */
export function coverageCaseSet(
    args: CaseRunner & { readonly makeHarness: () => Promise<CoverageCaseHarness> }
): void {
    const { describe, it, expect, makeHarness } = args;

    describe('billing-verticals contract: coverage (forward case set, contract §6.2)', () => {
        it('PRE_TRIAL: covered is no and sources is not empty (the case a constant fails, §5.1)', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical: TRIAL_VERTICAL };
            await h.arrange.preTrial(who);

            const response = expectValid({ expect, response: await h.subject.coverage(who) });

            expect(response.covered, 'a clock that did not start does not cover').toBe(false);
            expect(response.sources.length > 0, 'PRE_TRIAL still has sources').toBe(true);
            expect(
                response.sources.some(
                    (source) => source.type === 'TRIAL' && source.until === 'NOT_STARTED'
                ),
                'the trial source is there, with until NOT_STARTED'
            ).toBe(true);
        });

        it('a running trial covers: a TRIAL source of class TITLE, with a date as until', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical: TRIAL_VERTICAL };
            await h.arrange.trialRunning(who);

            const response = expectValid({ expect, response: await h.subject.coverage(who) });

            expect(response.covered).toBe(true);
            expect(
                response.sources.some(
                    (source) =>
                        source.type === 'TRIAL' &&
                        source.until instanceof Date &&
                        coverageSourceClassOf({ source }).sourceClass === 'TITLE'
                ),
                'a running TRIAL source'
            ).toBe(true);
        });

        it('an expired trial does not cover, and leaves no source of class TITLE', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical: TRIAL_VERTICAL };
            await h.arrange.trialExpired(who);

            const response = expectValid({ expect, response: await h.subject.coverage(who) });

            expect(response.covered).toBe(false);
            expect(classesOf({ response }).includes('TITLE')).toBe(false);
        });

        it('a running trial in one vertical does not cover another vertical', async () => {
            const h = await makeHarness();
            const userId = h.newUserId();
            await h.arrange.trialRunning({ userId, vertical: TRIAL_VERTICAL });

            const response = expectValid({
                expect,
                response: await h.subject.coverage({ userId, vertical: OTHER_VERTICAL })
            });

            expect(response.covered).toBe(false);
        });

        it('starting the trial emits the notice after the commit: a listener that re-reads sees it covered', async () => {
            const h = await makeHarness();
            const who = { userId: h.newUserId(), vertical: TRIAL_VERTICAL };
            await h.arrange.preTrial(who);
            const rereads: Promise<CoverageResponse>[] = [];
            const notices: CoverageChangedEvent[] = [];
            const unsubscribe = h.subject.onCoverageChanged((event) => {
                if (event.userId !== who.userId || event.vertical !== who.vertical) return;
                notices.push(event);
                rereads.push(h.subject.coverage(who));
            });

            await h.act.startTrial(who);
            unsubscribe();
            const seen = await Promise.all(rereads);

            expect(notices.length > 0, 'T1 emits the coverage-changed notice').toBe(true);
            expect(
                seen.every((response) => response.covered),
                'every re-read made on reception already sees the committed trial'
            ).toBe(true);
        });
    });
}
