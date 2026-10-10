/**
 * TEST:V4:4 (second half, Coord-16) — starting a trial writes no
 * phone, tax id or device
 *
 * FILA:V4 item 6 (lock) — one start at a time per user + vertical
 *
 * FILA:V4 (atomicity and post-commit notice) — the row and the campaign
 * are one transaction
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { type DrizzleClient, trials, users } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { startTrial } from '../../src/trial/trial-start';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';
import {
    bootstrapReaderOf,
    canjeCountOf,
    seedUser,
    trialRowOf
} from './support/trial-start-helpers';
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

        const row = await trialRowOf(pool, user.id, VERTICAL);
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
        expect(await canjeCountOf(pool, user.id)).toBe(0);
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
        expect(failure.reason).toBe('ALREADY_COVERED');

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
