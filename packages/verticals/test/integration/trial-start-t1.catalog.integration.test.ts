/**
 * TEST:V4:5 — T1 over the real catalog (AC:V4:4)
 *
 * All tests use the real PostgreSQL catalog. No hard-coded plan ids:
 * the floor references are derived from the migrated data.
 *
 * Tests:
 * - starts the trial: the row, the floor references, the clock and the campaign
 * - the coverage notice goes out after the commit
 * - coverage reads the trial T1 wrote
 * - already covered does not start (T6's case, not T1's)
 */
import { randomUUID } from 'node:crypto';
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { type DrizzleClient, trials } from '@repo/db';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { computePreExpiryMilestones } from '../../src/trial/trial-deadlines';
import { evaluateTrialStart, startTrial } from '../../src/trial/trial-start';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';
import {
    seedUser,
    sellableCurrentIds,
    trialPlanOf,
    trialRowOf
} from './support/trial-start-helpers';
import { createTrialStartAdapter } from './support/trial-start-unit-of-work';

/* ------------------------------------------------------------------ */
/* Pool, db, helpers (same pattern as other integration test files)    */
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

/* ------------------------------------------------------------------ */
/* TEST:V4:5 — T1 over the real catalog (AC:V4:4)                     */
/* ------------------------------------------------------------------ */

describe('TEST:V4:5 - T1 over the real catalog (AC:V4:4)', () => {
    const VERTICAL = VerticalEnum.ACCOMMODATION;
    const FIXED_NOW = new Date('2026-10-07T12:00:00.000Z');
    const clock = { now: () => new Date(FIXED_NOW.getTime()) };
    const pseudonym = () =>
        randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 32);
    const EVENT: 'listing_published' = 'listing_published';

    it('starts the trial: the row, the floor references, the clock and the campaign', async () => {
        const user = await seedUser(db);
        const trialPlan = await trialPlanOf(db, VERTICAL);
        const sellableIds = await sellableCurrentIds(db, VERTICAL);
        const pseudo = pseudonym();

        const { unitOfWork, stats } = createTrialStartAdapter({ db });
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
        const row = await trialRowOf(db, user.id, VERTICAL);
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
        const expectedMilestones = computePreExpiryMilestones({
            endsAt: expectedEndsAt
        });
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
                row: await trialRowOf(db, event.userId, event.vertical)
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
        const row = await trialRowOf(db, user.id, VERTICAL);
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

            const { unitOfWork } = createTrialStartAdapter({
                db: tx as unknown as DrizzleClient
            });
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
                    billingSim.coverage({
                        userId: args.userId,
                        vertical: args.vertical as VerticalEnum
                    })
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
