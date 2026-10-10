/**
 * TEST:V4:6 — T1 does not fire without a sellable catalog or on a
 * consumed hash (AC:V4:5)
 *
 * Tests:
 * - (a) a vertical with all its plans retired → NO_SELLABLE_CURRENT_VERSION
 * - (b) the pseudonym already has a row with another user (guard fires first)
 * - (b) the UNIQUE is the net (DB conflict, guard doesn't fire)
 * - the same person cannot start twice
 */
import { randomBytes } from 'node:crypto';
import { type DrizzleClient, planVersions, trials } from '@repo/db';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { evaluateTrialStart, startTrial } from '../../src/trial/trial-start';
import type { NewTrialRow } from '../../src/trial/trial-start-types';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';
import { bootstrapReaderOf, inRollback, seedUser } from './support/trial-start-helpers';
import { createTrialStartAdapter } from './support/trial-start-unit-of-work';

/* ------------------------------------------------------------------ */
/* Pool, db                                                            */
/* ------------------------------------------------------------------ */

const pool = new Pool({
    connectionString: process.env.HOSPEDA_TEST_DATABASE_URL,
    max: 8
});
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const VERTICAL = VerticalEnum.ACCOMMODATION;
const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');
const clock = { now: () => new Date(FIXED_NOW.getTime()) };
const pseudonym = () => randomBytes(32).toString('hex');
const EVENT: 'listing_published' = 'listing_published';

/* ------------------------------------------------------------------ */
/* TEST:V4:6 — T1 does not fire without a sellable catalog or on a     */
/* consumed hash (AC:V4:5)                                            */
/* ------------------------------------------------------------------ */

describe('TEST:V4:6 - T1 does not fire without a sellable catalog or on a consumed hash (AC:V4:5)', () => {
    it('(a) a vertical with all its plans retired', async () => {
        await inRollback(db, async (tx) => {
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

            // Set each sellable current version to current=false.
            for (const row of sellableRows) {
                await txDb
                    .update(planVersions)
                    .set({ current: false })
                    .where(eq(planVersions.id, row.id));
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
        await inRollback(db, async (tx) => {
            const txDb = tx as unknown as DrizzleClient;

            const userA = await seedUser(txDb);
            const userB = await seedUser(txDb);
            const sharedPseudo = pseudonym();

            // Use createTrialStartAdapter to get stats (proves the guard fires,
            // not the database UNIQUE constraint).
            const { unitOfWork, stats } = createTrialStartAdapter({ db: txDb });
            const billingA = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });

            const inputA = {
                userId: userA.id,
                vertical: VERTICAL,
                event: EVENT,
                emailPseudonym: sharedPseudo
            };

            // Count notices from both billing instances.
            let noticeCallCount = 0;
            billingA.onCoverageChanged(async () => {
                noticeCallCount += 1;
            });

            // User A starts: should succeed
            const resultA = await startTrial({
                unitOfWork,
                billing: billingA,
                clock,
                emitCoverageChanged: async (event) => {
                    // The bootstrap billing's emitCoverageChanged broadcasts
                    // to all onCoverageChanged listeners (including noticeCallCount)
                    await billingA.emitCoverageChanged(event);
                },
                input: inputA
            });

            expect(resultA.started).toBe(true);

            // User B tries same pseudonym: should fail
            const billingB = createBootstrapBillingForVerticals({
                reader: bootstrapReaderOf(txDb)
            });
            billingB.onCoverageChanged(async () => {
                noticeCallCount += 1;
            });

            const resultB = await startTrial({
                unitOfWork,
                billing: billingB,
                clock,
                emitCoverageChanged: async (event) => {
                    await billingB.emitCoverageChanged(event);
                },
                input: {
                    ...inputA,
                    userId: userB.id,
                    emailPseudonym: sharedPseudo
                }
            });

            expect(resultB.started).toBe(false);
            if (resultB.started) throw new Error('unreachable');
            expect(resultB.reason).toBe('EMAIL_PSEUDONYM_ALREADY_USED');

            // B was stopped by the pseudonym guard, before the DB UNIQUE net.
            expect(stats.uniqueConflicts).toBe(0);

            // The guard fired for B → no insert → no notice for B.
            // A already succeeded above, so exactly ONE notice call total.
            expect(noticeCallCount).toBe(1);

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
        await inRollback(db, async (tx) => {
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

            // startTrial
            const result = await startTrial({
                unitOfWork,
                billing,
                clock,
                emitCoverageChanged: async (event) => {
                    await billing.emitCoverageChanged(event);
                },
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
        await inRollback(db, async (tx) => {
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
                    sim.coverage({
                        userId: args.userId,
                        vertical: args.vertical as VerticalEnum
                    })
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
