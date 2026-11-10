import { emailOutbox, eq, inArray, planMigrationSubscriptions, planMigrations } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { sendPlanMigrationNotices } from '../../../src/services/billing/plan-migration/send-plan-migration-notices.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';

const db = getServiceTestDb();
const clock = { now: () => new Date('2026-10-11T13:00:00.000Z') };
const recipients: string[] = [];

afterEach(async () => {
    if (recipients.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipients.splice(0)));
    await cleanupAnnouncedExitCases();
});
afterAll(closeServiceTestPool);

async function cancellationMail(userId: string) {
    const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter((row) => row.template === 'billing.plan-migration-cancelled');
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:7 AC:B12:7 cancelar una migración anunciada',
    () => {
        it('compares an APLICADA date by local day, including 23:30', async () => {
            const { seeded, migrationId } = await createAnnouncedExitCase();
            recipients.push(seeded.user.id);
            const [scope] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId));
            if (!scope) throw new Error('Migration row missing');
            // S37 belongs to HOS-1614; seed its APLICADA state and a 23:30 local application date.
            const applicationDate = new Date('2026-10-12T02:30:00.000Z');
            const localClock = { now: () => new Date('2026-10-12T01:00:00.000Z') };
            await db
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', appliedAt: clock.now(), applicationDate })
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect(getLocalDateString({ instant: applicationDate })).toBe(
                getLocalDateString({ instant: localClock.now() })
            );
            expect(
                await cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: migrationId, db },
                    { clock: localClock }
                )
            ).toEqual({
                planMigrationId: migrationId,
                cancelledAt: localClock.now(),
                rows: { cancelled: 0, alreadyStarted: 0, untouched: 1 }
            });
            expect(await cancellationMail(seeded.user.id)).toHaveLength(0);
        });

        it('rolls back state and outbox if a later row cannot build its email', async () => {
            const { seeded, pendingCustomer, migrationId } = await createAnnouncedExitCase({
                addPendingCustomer: true
            });
            if (!pendingCustomer) throw new Error('Second customer missing');
            recipients.push(seeded.user.id, pendingCustomer.userId);
            const scopes = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId))
                .orderBy(planMigrationSubscriptions.id);
            expect(scopes).toHaveLength(2);
            const announcements = await db
                .select()
                .from(emailOutbox)
                .where(inArray(emailOutbox.recipientUserId, recipients));
            const last = announcements.find(
                (mail) =>
                    (mail.payload as { planMigrationSubscriptionId?: string })
                        .planMigrationSubscriptionId === scopes[1]?.id
            );
            if (!last) throw new Error('Last announcement missing');
            // A malformed later announcement forces failure after the first cancellation enqueue.
            await db
                .update(emailOutbox)
                .set({ payload: { invalid: true } })
                .where(eq(emailOutbox.id, last.id));
            await expect(
                cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: migrationId, db },
                    { clock }
                )
            ).rejects.toThrow();
            const after = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId))
                .orderBy(planMigrationSubscriptions.id);
            expect(after).toEqual(scopes);
            const [migration] = await db
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.id, migrationId));
            expect(migration?.cancelledAt).toBeNull();
            expect(await cancellationMail(seeded.user.id)).toHaveLength(0);
            expect(await cancellationMail(pendingCustomer.userId)).toHaveLength(0);
        });

        it('serializes two cancellations through the parent row lock', async () => {
            const { seeded, migrationId } = await createAnnouncedExitCase();
            recipients.push(seeded.user.id);
            let release!: () => void;
            let locked!: () => void;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const ready = new Promise<void>((resolve) => {
                locked = resolve;
            });
            const holder = db.transaction(async (tx) => {
                await tx
                    .select()
                    .from(planMigrations)
                    .where(eq(planMigrations.id, migrationId))
                    .for('update');
                locked();
                await gate;
            });
            await ready;
            const first = cancelPlanMigration(
                { actor: seeded.actor, planMigrationId: migrationId, db },
                { clock }
            );
            const second = cancelPlanMigration(
                { actor: seeded.actor, planMigrationId: migrationId, db },
                { clock }
            );
            release();
            await holder;
            const settled = await Promise.allSettled([first, second]);
            expect(settled.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
            expect(
                settled
                    .filter((entry) => entry.status === 'rejected')
                    .map((entry) => (entry as PromiseRejectedResult).reason.reason)
            ).toEqual(['PLAN_MIGRATION_ALREADY_CANCELLED']);
            expect(await cancellationMail(seeded.user.id)).toHaveLength(1);
        });

        it('keeps an already queued notice if the notice job wins the row lock first', async () => {
            const { seeded, migrationId } = await createAnnouncedExitCase();
            recipients.push(seeded.user.id);
            const [scope] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId));
            if (!scope) throw new Error('Migration row missing');
            const dueClock = {
                now: () => new Date(scope.applicationDate.getTime() - 30 * 86_400_000)
            };
            let release!: () => void;
            let processed!: () => void;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const ready = new Promise<void>((resolve) => {
                processed = resolve;
            });
            const noticeHolder = db.transaction(async (tx) => {
                const result = await applyPlanMigrationUpcomingNotice({
                    tx,
                    planMigrationSubscriptionId: scope.id,
                    now: dueClock.now()
                });
                expect(result.outcome).toBe('ENQUEUED');
                processed();
                await gate;
            });
            await ready;
            const cancellation = cancelPlanMigration(
                { actor: seeded.actor, planMigrationId: migrationId, db },
                { clock: dueClock }
            );
            release();
            await noticeHolder;
            await cancellation;
            const [after] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect(after?.status).toBe('CANCELADA');
            const mails = await db
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.user.id));
            expect(mails.map((mail) => mail.template).sort()).toEqual([
                'billing.plan-migration-announced',
                'billing.plan-migration-cancelled',
                'billing.plan-migration-upcoming'
            ]);
            const rerun = await sendPlanMigrationNotices({ limit: 10, db }, { clock: dueClock });
            expect(
                rerun.rows.filter((row) => row.planMigrationSubscriptionId === scope.id)
            ).toHaveLength(0);
        });
    }
);
