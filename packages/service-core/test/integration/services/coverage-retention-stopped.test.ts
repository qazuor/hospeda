// TEST:B4:3 (AC:B4:4) — the real `retenciónDetenida` answers yes only with a PRINCIPAL `PAUSED`
// row whose open pause is `CUSTOMER_REQUEST`, returns the latest closed `CUSTOMER_REQUEST` pause end,
// and returns `coberturaPerdidaEn` written by S6 in the SAME transaction as the drop: a rollback
// keeps neither, a commit keeps both, and the instant is there while the post-commit notice is
// still pending or after it failed (contract §4.1; DEC-DATA-006 and its 📌1; DEC-ARCH-009📌2).
//
// Cleanup: every row seeded here is DELETED after each test, children first (coverage_loss,
// subscription_pause, subscription). The temporary trigger of case (c) is dropped in a `finally`,
// also when the test fails. Users and the non-sellable plan versions stay (immutable, not global).
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { coverageLosses, eq, inArray, subscriptionPauses, subscriptions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createBillingRetentionStopped } from '../../../src/services/billing/coverage/retention-stopped.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { writeArrearsSuspension } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    coverageNow,
    frozenClock,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** S6's write instant in the cases that suspend. */
const S6_AT = new Date('2026-10-10T08:00:00.000Z');

const seededSubscriptions: string[] = [];
const seededUsers: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    if (seededUsers.length > 0)
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, seededUsers));
    if (seededSubscriptions.length > 0) {
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, seededSubscriptions));
        await db.delete(subscriptions).where(inArray(subscriptions.id, seededSubscriptions));
    }
    seededSubscriptions.length = 0;
    seededUsers.length = 0;
});
afterAll(closeServiceTestPool);

const retention = createBillingRetentionStopped({ ports: { clock: frozenClock(coverageNow) } });

async function seedUser(): Promise<string> {
    const { userId } = await seedCoverageUser(getServiceTestDb());
    seededUsers.push(userId);
    return userId;
}

/** One subscription row of the person, seeded directly in the asked state. */
async function seedRow(input: {
    readonly userId: string;
    readonly vertical?: string;
    readonly status: string;
    readonly class?: 'PRINCIPAL' | 'COMPLEMENTO';
    readonly serviceEndsAt?: Date | null;
    readonly inGrace?: boolean;
    readonly succeedsId?: string;
}): Promise<string> {
    const db = getServiceTestDb();
    const vertical = input.vertical ?? VerticalEnum.ACCOMMODATION;
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(db, vertical);
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId: input.userId,
        vertical,
        planVersionId,
        billingOptionId,
        status: input.status,
        class: input.class,
        serviceEndsAt: input.serviceEndsAt ?? null,
        succeedsId: input.succeedsId ?? null
    });
    seededSubscriptions.push(subscriptionId);
    if (input.inGrace)
        await db
            .update(subscriptions)
            .set({
                graceStartedAt: new Date('2026-10-02T10:00:00.000Z'),
                graceEndsAt: new Date('2026-10-09T10:00:00.000Z')
            })
            .where(eq(subscriptions.id, subscriptionId));
    return subscriptionId;
}

async function seedPause(input: {
    readonly subscriptionId: string;
    readonly reason: 'CUSTOMER_REQUEST' | 'COURTESY';
    readonly actualEndAt: Date | null;
}): Promise<void> {
    await getServiceTestDb()
        .insert(subscriptionPauses)
        .values({
            subscriptionId: input.subscriptionId,
            reason: input.reason,
            startsAt: new Date('2026-09-01T00:00:00.000Z'),
            actualEndAt: input.actualEndAt
        });
}

/** A coverage listener that records what it saw, without rejecting. */
function recordingNotices(): CoverageNotices & { readonly events: CoverageChangedEvent[] } {
    const events: CoverageChangedEvent[] = [];
    return {
        events,
        emitCoverageChanged: vi.fn(async (event: CoverageChangedEvent) => {
            events.push(event);
        })
    };
}

/** The coverage_loss rows of a person, read through a fresh pool connection. */
async function lossesOf(userId: string): Promise<{ vertical: string; lost_at: Date }[]> {
    const { rows } = await getServiceTestPool().query<{ vertical: string; lost_at: Date }>(
        'SELECT vertical, lost_at FROM coverage_loss WHERE user_id = $1',
        [userId]
    );
    return rows;
}

async function statusOf(subscriptionId: string): Promise<string | undefined> {
    const { rows } = await getServiceTestPool().query<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return rows[0]?.status;
}

describe('TEST:B4:3 retenciónDetenida and coberturaPerdidaEn (AC:B4:4)', () => {
    it('(a) a PRINCIPAL PAUSED with its open CUSTOMER_REQUEST pause ⇒ stopped', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'PAUSED' });
        await seedPause({ subscriptionId, reason: 'CUSTOMER_REQUEST', actualEndAt: null });

        // Act
        const answer = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(answer).toEqual({ stopped: true, pauseEndedAt: null, coverageLostAt: null });
    });

    it('(a) a PRINCIPAL PAUSED with its open COURTESY pause ⇒ not stopped', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'PAUSED' });
        await seedPause({ subscriptionId, reason: 'COURTESY', actualEndAt: null });

        // Act
        const answer = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(answer).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: null });
    });

    it('(a) the CUSTOMER_REQUEST pause of another vertical ⇒ not stopped in this one', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({
            userId,
            vertical: VerticalEnum.GASTRONOMY,
            status: 'PAUSED'
        });
        await seedPause({ subscriptionId, reason: 'CUSTOMER_REQUEST', actualEndAt: null });

        // Act
        const here = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });
        const there = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.GASTRONOMY
        });

        // Assert
        expect(here).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: null });
        expect(there).toEqual({ stopped: true, pauseEndedAt: null, coverageLostAt: null });
    });

    it('(a) a COMPLEMENTO PAUSED with an open CUSTOMER_REQUEST pause ⇒ not stopped (I-7)', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({
            userId,
            status: 'PAUSED',
            class: 'COMPLEMENTO'
        });
        await seedPause({ subscriptionId, reason: 'CUSTOMER_REQUEST', actualEndAt: null });

        // Act
        const answer = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(answer).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: null });
    });

    it('(b) two closed CUSTOMER_REQUEST pauses ⇒ pauseEndedAt is the latest actual end', async () => {
        // Arrange
        const userId = await seedUser();
        const first = await seedRow({ userId, status: 'CANCELLED' });
        const second = await seedRow({ userId, status: 'ACTIVE' });
        const earlierEnd = new Date('2026-09-10T00:00:00.000Z');
        const laterEnd = new Date('2026-09-20T00:00:00.000Z');
        await seedPause({
            subscriptionId: first,
            reason: 'CUSTOMER_REQUEST',
            actualEndAt: earlierEnd
        });
        await seedPause({
            subscriptionId: second,
            reason: 'CUSTOMER_REQUEST',
            actualEndAt: laterEnd
        });
        // A later COURTESY end never counts as the end of the owner's pause.
        await seedPause({
            subscriptionId: first,
            reason: 'COURTESY',
            actualEndAt: new Date('2026-09-30T00:00:00.000Z')
        });

        // Act
        const answer = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(answer).toEqual({ stopped: false, pauseEndedAt: laterEnd, coverageLostAt: null });
    });

    it('(c) losing the last source, a rollback keeps neither the drop nor its instant', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'GRACE_PERIOD', inGrace: true });
        const notices = recordingNotices();
        const suffix = crypto.randomUUID().replaceAll('-', '');
        const fn = `b43_reject_coverage_loss_${suffix}`;
        const trigger = `b43_reject_coverage_loss_${suffix}`;
        const pool = getServiceTestPool();
        await pool.query(
            `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
             BEGIN
                 IF NEW.user_id = '${userId}'::uuid THEN
                     RAISE EXCEPTION 'TEST:B4:3 forced coverage_loss failure';
                 END IF;
                 RETURN NEW;
             END $$`
        );
        try {
            await pool.query(
                `CREATE TRIGGER ${trigger} BEFORE INSERT ON coverage_loss FOR EACH ROW EXECUTE FUNCTION ${fn}()`
            );

            // Act
            const suspension = writeArrearsSuspension({
                subscriptionId,
                origin: 'GRACE_PERIOD',
                now: S6_AT,
                coverageNotices: notices
            });

            // Assert
            await expect(suspension).rejects.toThrow();
        } finally {
            await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON coverage_loss`);
            await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
        }
        expect(await statusOf(subscriptionId)).toBe('GRACE_PERIOD');
        expect(await lossesOf(userId)).toEqual([]);
        expect(notices.events).toEqual([]);
        expect(
            await retention.retentionStopped({ userId, vertical: VerticalEnum.ACCOMMODATION })
        ).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: null
        });
    });

    it('(d) a commit keeps both while the notice is still pending', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'GRACE_PERIOD', inGrace: true });
        let release: () => void = () => undefined;
        let emitted: () => void = () => undefined;
        const emittedSignal = new Promise<void>((resolve) => {
            emitted = resolve;
        });
        const notices: CoverageNotices = {
            emitCoverageChanged: vi.fn(
                () =>
                    new Promise<void>((resolve) => {
                        release = resolve;
                        emitted();
                    })
            )
        };

        // Act
        const suspension = writeArrearsSuspension({
            subscriptionId,
            origin: 'GRACE_PERIOD',
            now: S6_AT,
            coverageNotices: notices
        });
        await emittedSignal;

        // Assert — while the notice is held, another connection already sees both.
        expect(await statusOf(subscriptionId)).toBe('SUSPENDED');
        expect(await lossesOf(userId)).toEqual([
            { vertical: VerticalEnum.ACCOMMODATION, lost_at: S6_AT }
        ]);
        expect(
            await retention.retentionStopped({ userId, vertical: VerticalEnum.ACCOMMODATION })
        ).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: S6_AT
        });
        release();
        expect(await suspension).toBe('SUSPENDED');
    });

    it('(d) a commit keeps both when the notice fails', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'GRACE_PERIOD', inGrace: true });
        const notices: CoverageNotices = {
            emitCoverageChanged: vi.fn(async () => {
                throw new Error('TEST:B4:3 lost notice');
            })
        };

        // Act
        const suspended = await writeArrearsSuspension({
            subscriptionId,
            origin: 'GRACE_PERIOD',
            now: S6_AT,
            coverageNotices: notices
        });

        // Assert
        expect(suspended).toBe('SUSPENDED');
        expect(notices.emitCoverageChanged).toHaveBeenCalledTimes(1);
        expect(await statusOf(subscriptionId)).toBe('SUSPENDED');
        expect(
            await retention.retentionStopped({ userId, vertical: VerticalEnum.ACCOMMODATION })
        ).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: S6_AT
        });
    });

    it('(e) with an authorized ACTIVE successor left in the vertical, S6 records no loss (I-5)', async () => {
        // Arrange
        const userId = await seedUser();
        const subscriptionId = await seedRow({ userId, status: 'GRACE_PERIOD', inGrace: true });
        await seedRow({ userId, status: 'ACTIVE', succeedsId: subscriptionId });
        const notices = recordingNotices();

        // Act
        const suspended = await writeArrearsSuspension({
            subscriptionId,
            origin: 'GRACE_PERIOD',
            now: S6_AT,
            coverageNotices: notices
        });

        // Assert
        expect(suspended).toBe('SUSPENDED');
        expect(await statusOf(subscriptionId)).toBe('SUSPENDED');
        expect(await lossesOf(userId)).toEqual([]);
        expect(
            await retention.retentionStopped({ userId, vertical: VerticalEnum.ACCOMMODATION })
        ).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: null
        });
    });

    it('(f) an elapsed CANCEL_SCHEDULED end later than the recorded loss is coverageLostAt; a future one is not', async () => {
        // Arrange
        const userId = await seedUser();
        const recordedLoss = new Date(coverageNow.getTime() - 10 * DAY_MS);
        const elapsedEnd = new Date(coverageNow.getTime() - 2 * DAY_MS);
        await getServiceTestDb()
            .insert(coverageLosses)
            .values({ userId, vertical: VerticalEnum.ACCOMMODATION, lostAt: recordedLoss });
        const otherUserId = await seedUser();
        await getServiceTestDb().insert(coverageLosses).values({
            userId: otherUserId,
            vertical: VerticalEnum.ACCOMMODATION,
            lostAt: recordedLoss
        });
        await seedRow({ userId, status: 'CANCEL_SCHEDULED', serviceEndsAt: elapsedEnd });
        await seedRow({
            userId: otherUserId,
            status: 'CANCEL_SCHEDULED',
            serviceEndsAt: new Date(coverageNow.getTime() + 5 * DAY_MS)
        });

        // Act
        const elapsed = await retention.retentionStopped({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });
        const future = await retention.retentionStopped({
            userId: otherUserId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(elapsed).toEqual({ stopped: false, pauseEndedAt: null, coverageLostAt: elapsedEnd });
        expect(future).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: recordedLoss
        });
    });
});
