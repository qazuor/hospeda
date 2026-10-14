/**
 * TEST:B4:9 (AC:B4:9): the contract's case sets against both implementations
 * of `coverage()` (contract §5, §6.2).
 *
 * - (i) and (ii): the shared forward case set (`coverageCaseSet`, V1) runs
 *   entire against the real implementation of B4, composed as production does
 *   (`createApiBillingCoverage` over `createBootstrapCoverageReader()`), and
 *   against the bootstrap one of V4, over the SAME database and the SAME
 *   reader: the only difference between the two harnesses is the billing half.
 * - (iii): the real implementation's own case set (`realCoverageCaseSet`) runs
 *   entire against the real one.
 * - (iv): that own set holds two cases the bootstrap does not pass: "an ACTIVE
 *   subscription covers" and the G-R2-C case of the ADDON source.
 * - (v): the shared set's distinctive case (PRE_TRIAL, contract §5.1) fails
 *   against a constant implementation, both "always covered" and "never
 *   anything". This block reads no database.
 * - (vi): the collector behind (iv) and (v) is not empty.
 *
 * Integration with a database, not a unit test as the spec types it: the real
 * SUBSCRIPTION source reads the database, and a unit test would have to mock
 * it away, after which "an ACTIVE subscription covers" no longer tests the
 * real implementation (HOS-1535, I-1).
 *
 * Cleans only its own rows in `afterEach`; never TRUNCATE. Trial rows cannot be
 * deleted (extras 042, FK `ON DELETE RESTRICT`), so every `TRIAL_ACTIVE` row a
 * case leaves becomes `TRIAL_EXPIRED` (no sweep takes one) and its user stays;
 * users without a trial row are deleted. Plans and plan versions stay, as in
 * `real-coverage-wiring.test.ts`: `plan_version` is immutable by trigger, and
 * these are neither current nor sellable.
 */
import { randomUUID } from 'node:crypto';
import type {
    CoverageChangedEvent,
    CoverageResponse,
    UserVerticalArgs
} from '@repo/billing-verticals-contract';
import {
    type CaseRunner,
    type CoverageCaseHarness,
    coverageCaseSet
} from '@repo/billing-verticals-contract/testing';
import {
    and,
    billingOptions,
    eq,
    getDb,
    plans,
    planVersions,
    subscriptions,
    trials,
    users
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { createCoverageNoticeRegistry } from '@repo/service-core';
import { createBootstrapBillingForVerticals } from '@repo/verticals';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { createApiBillingCoverage } from '../../../src/utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../../src/utils/listing-access/bootstrap-coverage-reader';
import { testDb } from '../../e2e/setup/test-database';
import {
    createTrial,
    ensureAccommodationCatalog,
    MATRIX_NOW
} from '../listing-publication/publication-routes.helpers';
import { deleteAddonInstances, seedUserAndGlobalAddons } from './real-coverage-addon-fixtures';
import {
    G_R2_C_CASE,
    type RealCoverageCaseHarness,
    realCoverageCaseSet
} from './real-coverage-case-set';

/** Users seeded by one harness: one per case of either set is enough. */
const USERS_PER_HARNESS = 2;

/** Everything the cases wrote, cleaned in `afterEach`. */
const createdUserIds: string[] = [];
const createdBillingOptionIds: string[] = [];
const createdAddonInstanceIds: string[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => MATRIX_NOW } });
    await ensureAccommodationCatalog();
});

afterEach(async () => {
    const db = getDb();
    const userIds = createdUserIds.splice(0);
    const billingOptionIds = createdBillingOptionIds.splice(0);
    await deleteAddonInstances({ instanceIds: createdAddonInstanceIds.splice(0) });
    for (const userId of userIds) {
        await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    }
    for (const billingOptionId of billingOptionIds) {
        await db.delete(billingOptions).where(eq(billingOptions.id, billingOptionId));
    }
    for (const userId of userIds) {
        await db
            .update(trials)
            .set({ status: 'TRIAL_EXPIRED' })
            .where(and(eq(trials.userId, userId), eq(trials.status, 'TRIAL_ACTIVE')));
        const [trial] = await db
            .select({ id: trials.id })
            .from(trials)
            .where(eq(trials.userId, userId))
            .limit(1);
        if (!trial) await db.delete(users).where(eq(users.id, userId));
    }
});

/** A fresh account, registered for cleanup. */
async function seedUser(): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b4-case-sets-${randomUUID()}@example.test`,
            displayName: 'B4 case sets',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    createdUserIds.push(user.id);
    return user.id;
}

/**
 * An `ACTIVE` PRINCIPAL `CARD` subscription of the person in the vertical,
 * over its own plan version (neither current nor sellable, so no catalog
 * lookup and no global population sees it), with no trial.
 */
async function seedActiveSubscription({ userId, vertical }: UserVerticalArgs): Promise<void> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({ vertical, slug: `b4-case-sets-${randomUUID()}`, name: 'B4 case sets' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    createdBillingOptionIds.push(option.id);
    await db.insert(subscriptions).values({
        userId,
        vertical,
        planVersionId: version.id,
        billingOptionId: option.id,
        paymentMethod: 'CARD',
        status: 'ACTIVE',
        class: 'PRINCIPAL'
    });
}

/** The trial rows only exist in accommodation, the vertical both sets arrange. */
function asTrialVertical({ vertical }: UserVerticalArgs): typeof VerticalEnum.ACCOMMODATION {
    if (vertical !== VerticalEnum.ACCOMMODATION) {
        throw new Error(
            `The case-set harness arranges trials in accommodation only, not ${vertical}`
        );
    }
    return vertical;
}

/** A harness both case sets accept. */
type DbHarness = CoverageCaseHarness & RealCoverageCaseHarness;

/**
 * The database part both harnesses share: the arranging, T1 and the user ids.
 * Only the billing half (`subject` and how it emits) differs.
 */
async function makeDbHarness(args: {
    readonly subject: DbHarness['subject'];
    readonly emitCoverageChanged: (event: CoverageChangedEvent) => Promise<void>;
}): Promise<DbHarness> {
    const userIds: string[] = [];
    for (let index = 0; index < USERS_PER_HARNESS; index += 1) userIds.push(await seedUser());
    return {
        subject: args.subject,
        arrange: {
            // No trial row is PRE_TRIAL.
            preTrial: async () => undefined,
            trialRunning: async (who) =>
                createTrial({
                    userId: who.userId,
                    vertical: asTrialVertical(who),
                    status: 'TRIAL_ACTIVE'
                }),
            trialExpired: async (who) =>
                createTrial({
                    userId: who.userId,
                    vertical: asTrialVertical(who),
                    status: 'TRIAL_EXPIRED'
                }),
            activeSubscription: seedActiveSubscription,
            // The bootstrap ignores these rows; that is why it fails the G-R2-C case.
            compatibleAddons: async (who) => {
                const { instanceIds } = await seedUserAndGlobalAddons(who);
                createdAddonInstanceIds.push(...instanceIds);
            }
        },
        act: {
            // T1's write, committed (`createTrial` runs outside a transaction),
            // and then the notice (HOS-1535, I-2).
            startTrial: async (who) => {
                await createTrial({
                    userId: who.userId,
                    vertical: asTrialVertical(who),
                    status: 'TRIAL_ACTIVE'
                });
                await args.emitCoverageChanged({
                    userId: who.userId,
                    vertical: who.vertical,
                    sourceType: 'TRIAL',
                    change: 'CHANGED'
                });
            }
        },
        newUserId: () => {
            const userId = userIds.shift();
            if (!userId) {
                throw new Error(
                    `The case-set harness seeds ${USERS_PER_HARNESS} users; a case asked for more`
                );
            }
            return userId;
        }
    };
}

/**
 * The real implementation of B4, as production composes it: billing's
 * SUBSCRIPTION/ADDON sources with the trial and BASE resolution of verticals,
 * plus a fresh real notice registry (HOS-1535, I-3: not the process-wide one).
 */
async function makeRealHarness(): Promise<DbHarness> {
    const registry = createCoverageNoticeRegistry();
    const { coverage } = createApiBillingCoverage({ reader: createBootstrapCoverageReader() });
    return makeDbHarness({
        subject: { coverage, onCoverageChanged: registry.onCoverageChanged },
        emitCoverageChanged: registry.emitCoverageChanged
    });
}

/** The bootstrap implementation of V4, over the same database and reader. */
async function makeBootstrapHarness(): Promise<DbHarness> {
    const bootstrap = createBootstrapBillingForVerticals({
        reader: createBootstrapCoverageReader()
    });
    return makeDbHarness({
        subject: bootstrap,
        emitCoverageChanged: bootstrap.emitCoverageChanged
    });
}

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

/** A harness over a constant implementation: arranging changes nothing it answers, and it never emits. */
function constantCoverageHarness({
    response
}: {
    readonly response: CoverageResponse;
}): () => Promise<CoverageCaseHarness> {
    return async () => ({
        subject: { coverage: async () => response, onCoverageChanged: () => () => undefined },
        arrange: {
            preTrial: async () => undefined,
            trialRunning: async () => undefined,
            trialExpired: async () => undefined
        },
        act: { startTrial: async () => undefined },
        newUserId: randomUUID
    });
}

const DAY_MS = 86_400_000;

/** "Always covered": a valid running-trial answer, given to everyone. */
const ALWAYS_COVERED: CoverageResponse = {
    covered: true,
    sources: [
        {
            type: 'TRIAL',
            reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
            scope: 'VERTICAL',
            target: null,
            since: new Date(MATRIX_NOW.getTime() - 5 * DAY_MS),
            until: new Date(MATRIX_NOW.getTime() + 25 * DAY_MS),
            charged: null,
            floor: null
        },
        {
            type: 'BASE',
            reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01T00:00:00.000Z'),
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: null
        }
    ]
};

/** "Never anything": no coverage and no sources, given to everyone. */
const NEVER_ANYTHING: CoverageResponse = { covered: false, sources: [] };

const PRE_TRIAL_CASE =
    'PRE_TRIAL: covered is no and sources is not empty (the case a constant fails, §5.1)';
const ACTIVE_COVERS_CASE = 'an ACTIVE subscription covers';

describe('TEST:B4:9 (AC:B4:9) (i) the shared case set passes entire against the real implementation', () => {
    coverageCaseSet({ describe, it, expect, makeHarness: makeRealHarness });
});

describe('TEST:B4:9 (AC:B4:9) (ii) the shared case set passes entire against the bootstrap implementation', () => {
    coverageCaseSet({ describe, it, expect, makeHarness: makeBootstrapHarness });
});

describe("TEST:B4:9 (AC:B4:9) (iii) the real implementation's own case set passes against it", () => {
    realCoverageCaseSet({ describe, it, expect, makeHarness: makeRealHarness });
});

describe("TEST:B4:9 (AC:B4:9) (iv) the real implementation's own set has a case the bootstrap does not pass", () => {
    it('against the bootstrap, exactly two cases fail: "an ACTIVE subscription covers" and the G-R2-C case', async () => {
        // Arrange
        const cases = collect({
            register: (runner) =>
                realCoverageCaseSet({ ...runner, makeHarness: makeBootstrapHarness })
        });

        // Act
        const failed = await failing({ cases });

        // Assert
        expect(cases.length).toBeGreaterThanOrEqual(2);
        expect(failed.map((testCase) => testCase.name)).toEqual([ACTIVE_COVERS_CASE, G_R2_C_CASE]);
    });
});

describe('TEST:B4:9 (AC:B4:9) (v) the distinctive case of the shared set fails against a constant', () => {
    it.each<[string, CoverageResponse]>([
        ['always covered (a running trial for everyone)', ALWAYS_COVERED],
        ['never anything (no coverage, no sources)', NEVER_ANYTHING]
    ])('fails "%s" on its PRE_TRIAL case', async (_name, response) => {
        // Arrange
        const cases = collect({
            register: (runner) =>
                coverageCaseSet({ ...runner, makeHarness: constantCoverageHarness({ response }) })
        });

        // Act
        const failed = await failing({ cases });

        // Assert
        expect(cases.length).toBeGreaterThanOrEqual(5);
        expect(failed.map((testCase) => testCase.name)).toContain(PRE_TRIAL_CASE);
    });
});

describe('TEST:B4:9 (AC:B4:9) (vi) the collector is not empty, so (iv) and (v) cannot pass vacuously', () => {
    it('collects every case of both sets without registering them', () => {
        // Act
        const own = collect({
            register: (runner) =>
                realCoverageCaseSet({ ...runner, makeHarness: makeBootstrapHarness })
        });
        const shared = collect({
            register: (runner) =>
                coverageCaseSet({
                    ...runner,
                    makeHarness: constantCoverageHarness({ response: NEVER_ANYTHING })
                })
        });

        // Assert
        expect(own.map((testCase) => testCase.name)).toEqual([
            ACTIVE_COVERS_CASE,
            'an ACTIVE subscription does not cover another vertical',
            G_R2_C_CASE
        ]);
        expect(shared.length).toBeGreaterThanOrEqual(5);
        expect(shared.map((testCase) => testCase.name)).toContain(PRE_TRIAL_CASE);
    });
});
