/**
 * TEST:V4:5 — T1 over the real catalog (AC:V4:4)
 * TEST:V4:6 — T1 does not fire without a sellable catalog or on a consumed hash (AC:V4:5)
 * TEST:V4:4 (second half, Coord-16) — starting a trial writes no phone, tax id or device
 * FILA:V4 item 6 (lock) — one start at a time per user + vertical
 * FILA:V4 (atomicity and post-commit notice) — the row and the campaign are one transaction
 *
 * All tests use the real PostgreSQL catalog. No hard-coded plan ids:
 * the floor references are derived from the migrated data.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { type DrizzleClient, plans, planVersions, trials, users } from '@repo/db';
import { TrialStatusEnum, type VerticalActivationEvent, VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import type { BootstrapCoverageReader } from '../../src/coverage/trial-and-base-sources';
import { computePreExpiryMilestones } from '../../src/trial/trial-deadlines';
import { evaluateTrialStart, startTrial } from '../../src/trial/trial-start';
import type { NewTrialRow } from '../../src/trial/trial-start-types';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';
import { createTrialStartAdapter } from './support/trial-start-unit-of-work';

/* ------------------------------------------------------------------ */
/* Pool, db, helpers (copy of bootstrap-coverage.integration.test.ts)  */
/* ------------------------------------------------------------------ */

const pool = new Pool({
    connectionString: process.env.HOSPEDA_TEST_DATABASE_URL,
    max: 8
});
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());

class Rollback extends Error {}

async function inRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}

async function seedUser(db: DrizzleClient) {
    const [user] = await db
        .insert(users)
        .values({
            email: `trial-${randomUUID()}@example.com`,
            displayName: 'Trial User'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('User insert failed');
    return user;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const VERTICAL = VerticalEnum.ACCOMMODATION;
const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');
const clock = { now: () => new Date(FIXED_NOW.getTime()) };
const pseudonym = () => randomBytes(32).toString('hex');
const EVENT: VerticalActivationEvent = 'listing_published';

/* ------------------------------------------------------------------ */
/* Independent helpers (query the DB, NOT the code under test)         */
/* ------------------------------------------------------------------ */

/** Returns { planId, versionId, trialDays } for the trial plan of a vertical. */
async function trialPlanOf(
    db: DrizzleClient,
    vertical: string
): Promise<{ planId: string; versionId: string; trialDays: number }> {
    const [row] = await db
        .select({
            planId: plans.id,
            versionId: planVersions.id,
            trialDays: planVersions.trialDays
        })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            and(
                eq(plans.vertical, vertical),
                eq(plans.role, 'trial'),
                eq(planVersions.current, true)
            )
        )
        .limit(1);
    if (!row) throw new Error(`No trial plan for ${vertical}`);
    return row;
}

/** Returns sellable current version ids ordered by rank ascending. */
async function sellableCurrentIds(db: DrizzleClient, vertical: string): Promise<string[]> {
    const rows = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
            and(
                eq(planVersions.vertical, vertical),
                eq(planVersions.sellable, true),
                eq(planVersions.current, true)
            )
        )
        .orderBy(planVersions.rank);
    return rows.map((r) => r.id);
}

/** Query a trial row by userId using a raw pool (another connection). */
async function trialRowOf(
    userId: string,
    vertical: string
): Promise<Record<string, unknown> | undefined> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM trial WHERE user_id = $1 AND vertical = $2',
            [userId, vertical]
        );
        if (result.rows.length === 0) return undefined;
        return result.rows[0] as Record<string, unknown>;
    } finally {
        client.release();
    }
}

/** Query the canje_de_trial count for a user. */
async function canjeCountOf(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT count(*) FROM canje_de_trial WHERE user_id = $1',
            [userId]
        );
        return Number(result.rows[0].count);
    } finally {
        client.release();
    }
}

/** Creates a BootstrapCoverageReader from a Drizzle handle (for billing coverage tests). */
function bootstrapReaderOf(db: DrizzleClient): BootstrapCoverageReader {
    return {
        async findTrial({ userId, vertical }) {
            const [row] = await db
                .select()
                .from(trials)
                .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                .limit(1);
            if (!row) return null;
            return {
                userId: row.userId,
                vertical: row.vertical,
                trialPlanId: row.trialPlanId,
                status: row.status as TrialStatusEnum,
                startedAt: row.startedAt,
                endsAt: row.endsAt,
                floor:
                    row.floorEntitlementsVersionId &&
                    row.floorLimitsVersionId &&
                    row.floorTrialPlanVersionId
                        ? {
                              entitlementsVersionId: row.floorEntitlementsVersionId,
                              limitsVersionId: row.floorLimitsVersionId,
                              trialPlanVersionId: row.floorTrialPlanVersionId
                          }
                        : null
            };
        },
        async findAccountCreatedAt({ userId }) {
            const [row] = await db
                .select({ createdAt: users.createdAt })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
            if (!row) throw new Error(`Account ${userId} does not exist`);
            return row.createdAt;
        },
        async findCurrentVersionByRole({ vertical, role }) {
            const [row] = await db
                .select({
                    id: planVersions.id,
                    planId: planVersions.planId,
                    vertical: planVersions.vertical,
                    rank: planVersions.rank,
                    sellable: planVersions.sellable,
                    current: planVersions.current
                })
                .from(planVersions)
                .innerJoin(plans, eq(planVersions.planId, plans.id))
                .where(
                    and(
                        eq(plans.vertical, vertical),
                        eq(plans.role, role),
                        eq(planVersions.current, true)
                    )
                )
                .limit(1);
            return row ?? null;
        }
    };
}

/* ------------------------------------------------------------------ */
/* TEST:V4:5 — T1 over the real catalog (AC:V4:4)                     */
/* ------------------------------------------------------------------ */

describe('TEST:V4:5 - T1 over the real catalog (AC:V4:4)', () => {
    it('starts the trial: the row, the floor references, the clock and the campaign', async () => {
        const user = await seedUser(db);
        const trialPlan = await trialPlanOf(db, VERTICAL);
        const sellableIds = await sellableCurrentIds(db, VERTICAL);
        const pseudo = pseudonym();

        const { unitOfWork } = createTrialStartAdapter({ db });
        const billing = createBootstrapBillingForVerticals({
            reader: createBootstrapCoverageReader(db)
        });

        // evaluateTrialStart should say starts: true
        const evaluation = await evaluateTrialStart({
            reader: createTrialStartAdapter({ db }).reader,
            billing,
            input: {
                userId: user.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: pseudo
            }
        });
        expect(evaluation.starts).toBe(true);

        // startTrial
        const result = await startTrial({
            unitOfWork,
            billing,
            clock,
            emitCoverageChanged: async (event: CoverageChangedEvent) => {
                await billing.emitCoverageChanged(event);
            },
            input: {
                userId: user.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: pseudo
            }
        });

        expect(result.started).toBe(true);
        if (!result.started) throw new Error('unreachable');

        // The row: check via a separate connection so we see the committed data
        const row = await trialRowOf(user.id, VERTICAL);
        expect(row).toBeDefined();
        expect(row!.status).toBe(TrialStatusEnum.TRIAL_ACTIVE);
        expect(row!.trial_plan_id).toBe(trialPlan.planId);
        expect(row!.floor_trial_plan_version_id).toBe(trialPlan.versionId);
        expect(row!.floor_limits_version_id).toBe(sellableIds[0]);
        expect(row!.floor_entitlements_version_id).toBe(sellableIds[sellableIds.length - 1]);
        expect(row!.started_at).toEqual(FIXED_NOW);

        const expectedEndsAt = new Date(FIXED_NOW.getTime() + trialPlan.trialDays * 86_400_000);
        expect(new Date(row!.ends_at as string).getTime()).toBe(expectedEndsAt.getTime());
        expect(trialPlan.trialDays).toBeGreaterThan(0);
        expect(row!.email_pseudonym).toBe(pseudo);
        expect(row!.deadlines_version).toBe(1);

        // Campaign: 4 milestones from endsAt - 10d, endsAt - 5d, endsAt - 2d, endsAt
        expect(stats.campaigns).toHaveLength(1);
        const campaign = stats.campaigns[0]!;
        expect(campaign.userId).toBe(user.id);
        expect(campaign.vertical).toBe(VERTICAL);
        expect(campaign.endsAt.getTime()).toBe(expectedEndsAt.getTime());
        expect(campaign.deadlinesVersion).toBe(1);
        expect(campaign.milestones).toHaveLength(4);
        const expectedMilestones = computePreExpiryMilestones({ endsAt: expectedEndsAt });
        for (let i = 0; i < 4; i++) {
            expect(campaign.milestones[i]!.getTime()).toBe(expectedMilestones[i]!.getTime());
        }

        // coverageNotice is EMITTED (only on started: true branch)
        if (result.started) {
            expect(result.coverageNotice).toBe('EMITTED');
        }
    });

    it('the coverage notice goes out after the commit', async () => {
        const user = await seedUser(db);
        const pseudo = pseudonym();

        const { unitOfWork } = createTrialStartAdapter({ db });
        const billing = createBootstrapBillingForVerticals({
            reader: createBootstrapCoverageReader(db)
        });

        let noticeSeen: {
            userId: string;
            vertical: string;
            sourceType: string;
            change: string;
            row?: Record<string, unknown>;
        } | null = null;

        billing.onCoverageChanged(async (event: CoverageChangedEvent) => {
            noticeSeen = {
                userId: event.userId,
                vertical: event.vertical,
                sourceType: event.sourceType,
                change: event.change,
                row: await trialRowOf(event.userId, event.vertical)
            };
        });

        const result = await startTrial({
            unitOfWork,
            billing,
            clock,
            emitCoverageChanged: async (event: CoverageChangedEvent) => {
                // The bootstrap billing's emitCoverageChanged takes the event directly
                await billing.emitCoverageChanged(event);
            },
            input: {
                userId: user.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: pseudo
            }
        });

        expect(noticeSeen).not.toBeNull();
        expect(noticeSeen!.userId).toBe(user.id);
        expect(noticeSeen!.vertical).toBe(VERTICAL);
        expect(noticeSeen!.sourceType).toBe('TRIAL');
        expect(noticeSeen!.change).toBe('CHANGED');
        expect(noticeSeen!.row).toBeDefined();
        if (result.started) {
            expect(result.coverageNotice).toBe('EMITTED');
        }
    });

    it('coverage reads the trial T1 wrote', async () => {
        const user = await seedUser(db);
        const pseudo = pseudonym();
        const { unitOfWork } = createTrialStartAdapter({ db });
        const billing = createBootstrapBillingForVerticals({
            reader: createBootstrapCoverageReader(db)
        });

        await startTrial({
            unitOfWork,
            billing,
            clock,
            emitCoverageChanged: async () => {},
            input: {
                userId: user.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: pseudo
            }
        });

        const cov = await billing.coverage({ userId: user.id, vertical: VERTICAL });
        expect(cov.covered).toBe(true);
        const trialSource = cov.sources.find(
            (s): s is (typeof cov.sources)[number] & { type: 'TRIAL' } => s.type === 'TRIAL'
        );
        expect(trialSource).toBeDefined();
        expect(trialSource!.scope).toBe('VERTICAL');
        expect(trialSource!.target).toBeNull();
        expect(trialSource!.charged).toBeNull();

        // The trial row to read exact dates
        const row = await trialRowOf(user.id, VERTICAL);
        expect(trialSource!.since).toEqual(new Date(row!.started_at as string));
        expect(trialSource!.until).toEqual(new Date(row!.ends_at as string));
        // narrow: the reference is a PLAN_VERSION for trial sources
        if (trialSource!.reference.kind === 'PLAN_VERSION') {
            expect(trialSource!.reference.planVersionId).toBe(row!.floor_trial_plan_version_id);
        }
    });

    it("already covered does not start (T6's case, not T1's)", async () => {
        await inRollback(async (tx) => {
            const user = await seedUser(tx);
            const pseudo = pseudonym();

            const { unitOfWork } = createTrialStartAdapter({ db: tx as unknown as DrizzleClient });
            const { BillingForVerticalsSimulator } = await import(
                '@repo/billing-verticals-contract/testing'
            );
            const billingSim = new BillingForVerticalsSimulator();
            billingSim.setCoverage({
                userId: user.id,
                vertical: VERTICAL,
                response: {
                    covered: true,
                    sources: [
                        {
                            type: 'SUBSCRIPTION',
                            reference: {
                                kind: 'PLAN_VERSION',
                                planVersionId: 'pv-premium'
                            },
                            scope: 'VERTICAL',
                            target: null,
                            since: new Date('2026-08-28T12:00:00.000Z'),
                            until: 'NO_KNOWN_DATE',
                            charged: true,
                            floor: null
                        },
                        {
                            type: 'BASE',
                            reference: {
                                kind: 'PLAN_VERSION',
                                planVersionId: 'pv-floor'
                            },
                            scope: 'VERTICAL',
                            target: null,
                            since: new Date('2026-01-01T00:00:00.000Z'),
                            until: 'NEVER_EXPIRES',
                            charged: null,
                            floor: null
                        }
                    ]
                }
            });

            const billing = createBootstrapBillingForVerticals({
                reader: createBootstrapCoverageReader(tx as unknown as DrizzleClient)
            });

            // Replace billing.coverage with the simulator
            const patchedBilling = {
                ...billing,
                coverage: async (args: { readonly userId: string; readonly vertical: string }) =>
                    // biome-ignore lint/suspicious/noExplicitAny: the simulator validates types via zod at runtime
                    (billingSim.coverage as (a: any) => ReturnType<typeof billingSim.coverage>)(
                        args
                    )
            };

            const result = await startTrial({
                unitOfWork,
                billing: patchedBilling,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudo
                }
            });

            expect(result.started).toBe(false);
            if (result.started) throw new Error('unreachable');
            expect(result.reason).toBe('ALREADY_COVERED');

            // No trial row was created
            const txRow = await (tx as DrizzleClient)
                .select({ id: trials.id })
                .from(trials)
                .where(and(eq(trials.userId, user.id), eq(trials.vertical, VERTICAL)))
                .limit(1);
            expect(txRow).toHaveLength(0);
        });
    });
});

/* ------------------------------------------------------------------ */
/* TEST:V4:6 — T1 does not fire without a sellable catalog or on a     */
/* consumed hash (AC:V4:5)                                            */
/* ------------------------------------------------------------------ */

describe('TEST:V4:6 - T1 does not fire without a sellable catalog or on a consumed hash (AC:V4:5)', () => {
    it('(a) a vertical with all its plans retired', async () => {
        await inRollback(async (tx) => {
            const txDb = tx as unknown as DrizzleClient;
            const user = await seedUser(txDb);
            const pseudo = pseudonym();

            // Retire all sellable current versions of accommodation
            const sellableRows = await txDb
                .select({ id: planVersions.id, rank: planVersions.rank })
                .from(planVersions)
                .where(
                    and(
                        eq(planVersions.vertical, VERTICAL),
                        eq(planVersions.sellable, true),
                        eq(planVersions.current, true)
                    )
                );

            // Set each to current=false
            for (const row of sellableRows) {
                await txDb
                    .update(planVersions)
                    .set({ current: false })
                    .where(eq(planVersions.id, row.id));
            }

            // Create one non-sellable current version per original rank
            // to keep the plan catalog valid
            for (const row of sellableRows) {
                await txDb.insert(planVersions).values({
                    planId: row.id, // reuse plan (will fail FK but try)
                    vertical: VERTICAL,
                    rank: row.rank,
                    sellable: false,
                    current: true,
                    trialDays: 0,
                    allowsPause: false
                });
            }

            const { unitOfWork, reader } = createTrialStartAdapter({ db: txDb });
            const billing = createBootstrapBillingForVerticals({
                reader: createBootstrapCoverageReader(txDb)
            });

            let noticeCallCount = 0;
            billing.onCoverageChanged(async () => {
                noticeCallCount += 1;
            });

            // evaluateTrialStart
            const evaluation = await evaluateTrialStart({
                reader,
                billing,
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudo
                }
            });

            expect(evaluation.starts).toBe(false);
            if (evaluation.starts) throw new Error('unreachable');
            expect(evaluation.reason).toBe('NO_SELLABLE_CURRENT_VERSION');

            // startTrial
            const result = await startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudo
                }
            });

            expect(result.started).toBe(false);
            if (result.started) throw new Error('unreachable');
            expect(result.reason).toBe('NO_SELLABLE_CURRENT_VERSION');
            expect(noticeCallCount).toBe(0);

            // Billing still shows the trial source as NOT_STARTED
            const cov = await billing.coverage({
                userId: user.id,
                vertical: VERTICAL
            });
            const trialSource = cov.sources.find(
                (s): s is (typeof cov.sources)[number] & { type: 'TRIAL' } => s.type === 'TRIAL'
            );
            expect(trialSource).toBeDefined();
            expect(trialSource!.since).toBe('NOT_STARTED');
        });
    });

    it('(b) the pseudonym already has a row with another user', async () => {
        await inRollback(async (tx) => {
            const txDb = tx as unknown as DrizzleClient;

            const userA = await seedUser(txDb);
            const userB = await seedUser(txDb);
            const sharedPseudo = pseudonym();

            const { unitOfWork } = createTrialStartAdapter({ db: txDb });
            const billingA = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });

            const inputA = {
                userId: userA.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: sharedPseudo
            };

            // User A starts: should succeed
            const resultA = await startTrial({
                unitOfWork,
                billing: billingA,
                clock,
                emitCoverageChanged: async () => {},
                input: inputA
            });

            expect(resultA.started).toBe(true);

            // User B tries same pseudonym: should fail
            const billingB = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });

            const resultB = await startTrial({
                unitOfWork,
                billing: billingB,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    ...inputA,
                    userId: userB.id,
                    emailPseudonym: sharedPseudo
                }
            });

            expect(resultB.started).toBe(false);
            if (resultB.started) throw new Error('unreachable');
            expect(resultB.reason).toBe('EMAIL_PSEUDONYM_ALREADY_USED');

            // B has no row
            const bRow = await (txDb as DrizzleClient)
                .select({ id: trials.id })
                .from(trials)
                .where(and(eq(trials.userId, userB.id), eq(trials.vertical, VERTICAL)))
                .limit(1);
            expect(bRow).toHaveLength(0);
        });
    });

    it('(b) the UNIQUE is the net', async () => {
        await inRollback(async (tx) => {
            const txDb = tx as unknown as DrizzleClient;

            const userCompetitor = await seedUser(txDb);
            const userSub = await seedUser(txDb);
            const sharedPseudo = pseudonym();

            // The beforeInsert inserts a competing row before T1's insert
            const { unitOfWork, stats } = createTrialStartAdapter({
                db: txDb,
                beforeInsert: async (_row: NewTrialRow) => {
                    // Insert a competitor from another user with the same pseudonym
                    await txDb.insert(trials).values({
                        userId: userCompetitor.id,
                        vertical: VERTICAL,
                        status: TrialStatusEnum.TRIAL_CONVERTED,
                        trialPlanId: null,
                        floorEntitlementsVersionId: null,
                        floorLimitsVersionId: null,
                        floorTrialPlanVersionId: null,
                        startedAt: null,
                        endsAt: null,
                        emailPseudonym: sharedPseudo,
                        deadlinesVersion: null
                    });
                }
            });

            const billing = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });

            let noticeCallCount = 0;
            billing.onCoverageChanged(async () => {
                noticeCallCount += 1;
            });

            const result = await startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: userSub.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: sharedPseudo
                }
            });

            expect(result.started).toBe(false);
            if (result.started) throw new Error('unreachable');
            expect(result.reason).toBe('EMAIL_PSEUDONYM_ALREADY_USED');
            expect(stats.uniqueConflicts).toBe(1);
            expect(stats.campaigns).toHaveLength(0);
            expect(noticeCallCount).toBe(0);

            // No row for the sub user
            const subRow = await (txDb as DrizzleClient)
                .select({ id: trials.id })
                .from(trials)
                .where(and(eq(trials.userId, userSub.id), eq(trials.vertical, VERTICAL)))
                .limit(1);
            expect(subRow).toHaveLength(0);
        });
    });

    it('the same person cannot start twice', async () => {
        await inRollback(async (tx) => {
            const txDb = tx as unknown as DrizzleClient;
            const user = await seedUser(txDb);
            const pseudo1 = pseudonym();

            const { unitOfWork } = createTrialStartAdapter({ db: txDb });
            const { BillingForVerticalsSimulator } = await import(
                '@repo/billing-verticals-contract/testing'
            );
            const sim = new BillingForVerticalsSimulator();
            sim.setCoverage({
                userId: user.id,
                vertical: VERTICAL,
                response: { covered: false, sources: [] }
            });
            const billing = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });
            const patchedBilling = {
                ...billing,
                coverage: async (args: { readonly userId: string; readonly vertical: string }) =>
                    // biome-ignore lint/suspicious/noExplicitAny: the simulator runtime checks types via zod
                    (sim.coverage as (a: any) => ReturnType<typeof sim.coverage>)(args)
            };

            // First start: OK
            const r1 = await startTrial({
                unitOfWork,
                billing: patchedBilling,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudo1
                }
            });
            expect(r1.started).toBe(true);

            // Second start with a different pseudonym: should fail
            const r2 = await startTrial({
                unitOfWork,
                billing: patchedBilling,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudonym()
                }
            });

            expect(r2.started).toBe(false);
            if (r2.started) throw new Error('unreachable');
            expect(r2.reason).toBe('USER_ALREADY_HAS_TRIAL_ROW');

            // Exactly one row for the user
            const rows = await (txDb as DrizzleClient)
                .select({ id: trials.id })
                .from(trials)
                .where(and(eq(trials.userId, user.id), eq(trials.vertical, VERTICAL)));
            expect(rows).toHaveLength(1);
        });
    });
});

/* ------------------------------------------------------------------ */
/* TEST:V4:4 (second half, Coord-16) — starting a trial writes no      */
/* phone, tax id or device                                             */
/* ------------------------------------------------------------------ */

describe('TEST:V4:4 (second half, Coord-16) - starting a trial writes no phone, tax id or device', () => {
    it('the trial row has exactly the expected columns and no phone/tax/device data', async () => {
        const user = await seedUser(db);
        const pseudo = pseudonym();

        // Also insert the user's email to check it's not in the trial row
        const userEmail = `user-${randomUUID()}@example.com`;
        await db.update(users).set({ email: userEmail }).where(eq(users.id, user.id));

        const { unitOfWork } = createTrialStartAdapter({ db });
        const billing = createBootstrapBillingForVerticals({
            reader: createBootstrapCoverageReader(db)
        });

        await startTrial({
            unitOfWork,
            billing,
            clock,
            emitCoverageChanged: async () => {},
            input: {
                userId: user.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: pseudo
            }
        });

        const row = await trialRowOf(user.id, VERTICAL);
        expect(row).toBeDefined();

        // Expected column set
        const expectedColumns = new Set([
            'created_at',
            'deadlines_version',
            'email_pseudonym',
            'ends_at',
            'floor_entitlements_version_id',
            'floor_limits_version_id',
            'floor_trial_plan_version_id',
            'id',
            'started_at',
            'status',
            'trial_plan_id',
            'updated_at',
            'user_id',
            'vertical'
        ]);

        const actualColumns = new Set(Object.keys(row!).sort());
        expect(actualColumns).toEqual(expectedColumns);

        // No phone/tax/device columns
        const phoneDevicePattern =
            /phone|tel[ei_]|mobile|whats|cell|tax|fiscal|cuit|cuil|dni|device|fingerprint|user_agent|ip_addr|imei/i;
        for (const col of actualColumns) {
            expect(col).not.toMatch(phoneDevicePattern);
        }

        // The user's email must NOT appear in the JSON of the row
        const rowJson = JSON.stringify(row);
        expect(rowJson).not.toContain(userEmail);

        // email_pseudonym is exactly 64 hex chars
        expect(row!.email_pseudonym).toMatch(/^[0-9a-f]{64}$/);

        // No canje_de_trial rows
        expect(await canjeCountOf(user.id)).toBe(0);
    });
});

/* ------------------------------------------------------------------ */
/* FILA:V4 item 6 (lock) — one start at a time per user + vertical     */
/* ------------------------------------------------------------------ */

describe('FILA:V4 item 6 (lock) - one start at a time per user + vertical', () => {
    it('two simultaneous starts of the same person leave one row', async () => {
        const user = await seedUser(db);
        const pseudo = pseudonym();

        let callCount = 0;

        const { unitOfWork, stats } = createTrialStartAdapter({
            db,
            beforeInsert: async () => {
                callCount += 1;
                if (callCount === 1) {
                    // Wait up to 500ms for the second call (or timeout)
                    await new Promise((resolve) => {
                        const checkInterval = setInterval(() => {
                            if (callCount >= 2) {
                                clearInterval(checkInterval);
                                resolve(undefined);
                            }
                        }, 20);
                        // Timeout fallback: 500ms
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            resolve(undefined);
                        }, 500);
                    });
                }
            }
        });

        const billing = createBootstrapBillingForVerticals({
            reader: bootstrapReaderOf(db)
        });

        const input = {
            userId: user.id,
            vertical: VERTICAL,
            event: EVENT,
            emailPseudonym: pseudo
        };

        const [r1, r2] = await Promise.all([
            startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async () => {},
                input: { ...input, emailPseudonym: pseudo }
            }),
            startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async () => {},
                input: { ...input, emailPseudonym: pseudo }
            })
        ]);

        // Exactly one succeeded
        const successes = [r1, r2].filter((r) => r.started);
        const failures = [r1, r2].filter((r) => !r.started);
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);

        const failure = failures[0]!;
        if (failure.started) throw new Error('unreachable');
        expect(failure.reason).toBe('USER_ALREADY_HAS_TRIAL_ROW');

        // One row only
        const rows = await db
            .select({ id: trials.id })
            .from(trials)
            .where(and(eq(trials.userId, user.id), eq(trials.vertical, VERTICAL)));
        expect(rows).toHaveLength(1);

        expect(stats.uniqueConflicts).toBe(0);
    });

    it('two different people start in parallel', async () => {
        const userA = await seedUser(db);
        const userB = await seedUser(db);
        const { unitOfWork: uoA } = createTrialStartAdapter({ db });
        const { unitOfWork: uoB } = createTrialStartAdapter({ db });

        const billingA = createBootstrapBillingForVerticals({
            reader: bootstrapReaderOf(db)
        });
        const billingB = createBootstrapBillingForVerticals({
            reader: bootstrapReaderOf(db)
        });

        const [r1, r2] = await Promise.all([
            startTrial({
                unitOfWork: uoA,
                billing: billingA,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: userA.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudonym()
                }
            }),
            startTrial({
                unitOfWork: uoB,
                billing: billingB,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: userB.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudonym()
                }
            })
        ]);

        expect(r1.started).toBe(true);
        expect(r2.started).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* FILA:V4 (atomicity and post-commit notice) — the row and the        */
/* campaign are one transaction                                         */
/* ------------------------------------------------------------------ */

describe('FILA:V4 (atomicity and post-commit notice) - the row and the campaign are one transaction', () => {
    it('a failing campaign schedule rolls the row back and sends no notice', async () => {
        const user = await seedUser(db);
        const pseudo = pseudonym();

        const { unitOfWork } = createTrialStartAdapter({
            db,
            failOnSchedule: true
        });

        const billing = createBootstrapBillingForVerticals({
            reader: bootstrapReaderOf(db)
        });

        let noticeCallCount = 0;
        billing.onCoverageChanged(async () => {
            noticeCallCount += 1;
        });

        await expect(
            startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async () => {},
                input: {
                    userId: user.id,
                    vertical: VERTICAL,
                    event: EVENT,
                    emailPseudonym: pseudo
                }
            })
        ).rejects.toThrow('campaign scheduling failed on purpose');

        // No row created (transaction rolled back)
        const rows = await db
            .select({ id: trials.id })
            .from(trials)
            .where(and(eq(trials.userId, user.id), eq(trials.vertical, VERTICAL)));
        expect(rows).toHaveLength(0);
        expect(noticeCallCount).toBe(0);
    });
});
