/**
 * TEST:V1:10 (AC:V1:6, items 3 and 4): the shared case sets.
 *
 * - Both case sets run entire, as real tests, against the simulators.
 * - Run against implementations that answer a constant, they fail: the forward
 *   set through its PRE_TRIAL case ("covered: no and sources not empty",
 *   contract §5.1), the inverse set in every one of its five groups.
 */
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { BillingForVerticals, CoverageResponse, VerticalsForBilling } from '../src/index';
import {
    type CaseRunner,
    type CoverageCaseHarness,
    coverageCaseSet,
    type InverseCaseHarness,
    inverseCaseSet
} from '../src/testing/index';
import {
    makeSimulatorCoverageHarness,
    makeSimulatorInverseHarness,
    NOW,
    PRE_TRIAL_RESPONSE,
    RUNNING_TRIAL_RESPONSE
} from './fixtures';

/** One case registered by a case set, with the group it was registered under. */
interface CollectedCase {
    readonly group: string;
    readonly name: string;
    readonly body: () => Promise<void>;
}

/** Registers a case set without running it, collecting its cases. */
function collect({
    register
}: {
    readonly register: (runner: CaseRunner) => void;
}): readonly CollectedCase[] {
    const cases: CollectedCase[] = [];
    let group = '';
    register({
        describe: (name, body) => {
            group = name;
            body();
        },
        it: (name, body) => {
            cases.push({ group, name, body });
        },
        expect
    });
    return cases;
}

/** Runs collected cases; returns the ones that failed. */
async function failing({
    cases
}: {
    readonly cases: readonly CollectedCase[];
}): Promise<readonly CollectedCase[]> {
    const failed: CollectedCase[] = [];
    for (const testCase of cases) {
        try {
            await testCase.body();
        } catch {
            failed.push(testCase);
        }
    }
    return failed;
}

/** A coverage implementation that answers the same thing to everyone and never emits. */
function constantCoverage({
    response
}: {
    readonly response: CoverageResponse;
}): Pick<BillingForVerticals, 'coverage' | 'onCoverageChanged'> {
    return { coverage: async () => response, onCoverageChanged: () => () => undefined };
}

/** A harness over a constant implementation: arranging changes nothing it answers. */
function constantCoverageHarness({
    response
}: {
    readonly response: CoverageResponse;
}): () => Promise<CoverageCaseHarness> {
    let next = 0;
    return async () => ({
        subject: constantCoverage({ response }),
        arrange: {
            preTrial: async () => undefined,
            trialRunning: async () => undefined,
            trialExpired: async () => undefined
        },
        act: { startTrial: async () => undefined },
        newUserId: () => {
            next += 1;
            return `user-${next}`;
        }
    });
}

const PRE_TRIAL_CASE = /^PRE_TRIAL: covered is no and sources is not empty/;

describe('TEST:V1:10 the forward case set runs entire against the billing simulator', () => {
    coverageCaseSet({ describe, it, expect, makeHarness: makeSimulatorCoverageHarness });
});

describe('TEST:V1:10 the inverse case set runs entire against the verticals simulator', () => {
    inverseCaseSet({ describe, it, expect, makeHarness: makeSimulatorInverseHarness });
});

describe('TEST:V1:10 the forward case set fails a constant implementation', () => {
    it.each<[string, CoverageResponse]>([
        ['always covered (a running trial for everyone)', RUNNING_TRIAL_RESPONSE],
        ['never anything (no coverage, no sources)', { covered: false, sources: [] }]
    ])('fails "%s" on its PRE_TRIAL case', async (_name, response) => {
        // Arrange
        const cases = collect({
            register: (runner) =>
                coverageCaseSet({
                    ...runner,
                    makeHarness: constantCoverageHarness({ response })
                })
        });

        // Act
        const failed = await failing({ cases });

        // Assert
        expect(cases.length).toBeGreaterThanOrEqual(5);
        expect(failed.some((testCase) => PRE_TRIAL_CASE.test(testCase.name))).toBe(true);
    });

    it('fails the constant that gives everyone the PRE_TRIAL answer, on the cases where that answer is wrong', async () => {
        // Arrange: the one constant the PRE_TRIAL case alone cannot catch
        const cases = collect({
            register: (runner) =>
                coverageCaseSet({
                    ...runner,
                    makeHarness: constantCoverageHarness({ response: PRE_TRIAL_RESPONSE })
                })
        });

        // Act
        const failed = await failing({ cases });

        // Assert: the running-trial and the notice cases catch it
        expect(failed.map((testCase) => testCase.name)).toEqual([
            'a running trial covers: a TRIAL source of class TITLE, with a date as until',
            'starting the trial emits the notice after the commit: a listener that re-reads sees it covered'
        ]);
    });
});

/** A verticals implementation that answers the same thing to every question. */
function constantVerticals({ flip }: { readonly flip: boolean }): VerticalsForBilling {
    return {
        planPolicy: async () => ({
            graceDays: 7,
            allowsPause: true,
            current: true,
            sellable: true
        }),
        changeDirection: async () => ({ direction: flip ? 'DOWN' : 'UP' }),
        listingPurged: async () => ({ purged: flip }),
        listing: async () => ({
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: 'owner',
            acceptsFeature: !flip
        }),
        addonPolicy: async () => ({
            addonId: 'addon',
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'USER'
        }),
        extendTrial: async () =>
            flip ? { outcome: 'REJECTED', reason: 'ALWAYS' } : { outcome: 'ACCEPTED' },
        onListingPurged: () => () => undefined
    };
}

/** A harness over a constant implementation. */
function constantInverseHarness({ flip }: { readonly flip: boolean }) {
    let next = 0;
    const newId = () => {
        next += 1;
        return `id-${next}`;
    };
    return async (): Promise<InverseCaseHarness> => ({
        subject: constantVerticals({ flip }),
        arrangePlanVersion: async () => ({ planVersionId: newId() }),
        arrangeChange: async () => ({ fromPlanVersionId: newId(), toPlanVersionId: newId() }),
        arrangeListing: async () => ({ listingId: newId() }),
        purgeListing: async () => undefined,
        unknownListingId: newId,
        arrangeAddonVersion: async () => ({ addonVersionId: newId() }),
        arrangeRunningTrial: async () => undefined,
        arrangeEndedTrial: async () => undefined,
        trialEndsAt: async () => NOW,
        newUserId: newId,
        newRedemptionKey: newId
    });
}

describe('TEST:V1:10 the inverse case set fails a constant implementation, in every group', () => {
    it.each([
        ['UP, not purged, ACCEPTED', false],
        ['DOWN, purged, REJECTED', true]
    ] as const)('fails the constant "%s" in each of its five groups', async (_name, flip) => {
        // Arrange
        const cases = collect({
            register: (runner) =>
                inverseCaseSet({ ...runner, makeHarness: constantInverseHarness({ flip }) })
        });
        const groups = [...new Set(cases.map((testCase) => testCase.group))];

        // Act
        const failed = await failing({ cases });

        // Assert
        expect(groups).toHaveLength(5);
        for (const group of groups) {
            expect(
                failed.some((testCase) => testCase.group === group),
                `a constant passes every case of "${group}"`
            ).toBe(true);
        }
    });
});
