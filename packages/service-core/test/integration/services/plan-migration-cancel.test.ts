import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cancelPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-cancel.service.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_CANCELLED_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { sendPlanMigrationNotices } from '../../../src/services/billing/plan-migration/send-plan-migration-notices.service.js';
import { cancelPendingAttempt } from '../../../src/services/billing/subscription/cancel-pending-attempt.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';
import { createPriceIncreaseCase, migrationClock } from './support/plan-migration-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
const clock = { now: () => new Date('2026-10-11T13:00:00.000Z') };
const pendingClock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const usersToClean: string[] = [];
const queueIdsToClean: string[] = [];
const increaseRecipients: string[] = [];
const increaseMigrationIds: string[] = [];
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

afterEach(async () => {
    if (usersToClean.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, usersToClean.splice(0)));
    if (queueIdsToClean.length)
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.id, queueIdsToClean.splice(0)));
    if (increaseRecipients.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, increaseRecipients.splice(0)));
    for (const id of increaseMigrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupAnnouncedExitCases();
});
afterAll(closeServiceTestPool);

async function scopeFor(subscriptionId: string) {
    const [row] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.subscriptionId, subscriptionId));
    if (!row) throw new Error('Migration scope missing');
    return row;
}

async function cancellationMail(userId: string) {
    return db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId))
        .then((rows) => rows.filter((row) => row.template === 'billing.plan-migration-cancelled'));
}

async function announcementPayload(userId: string): Promise<Record<string, unknown>> {
    const rows = await db
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    const announcement = rows.find((row) => row.template === 'billing.plan-migration-announced');
    if (
        !announcement ||
        typeof announcement.payload !== 'object' ||
        announcement.payload === null ||
        Array.isArray(announcement.payload)
    )
        throw new Error('Announcement payload missing');
    return announcement.payload as Record<string, unknown>;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:7 AC:B12:7 cancelar una migración anunciada',
    () => {
        it('cancels pending and unresolved rows, keeps started rows, and preserves subscriptions and their queue', async () => {
            const {
                seeded,
                pendingCustomer,
                additionalCustomers,
                unresolvedCustomer,
                migrationId
            } = await createAnnouncedExitCase({
                addPendingCustomer: true,
                additionalPendingCustomers: 3,
                addUnresolvedCustomer: true
            });
            if (!pendingCustomer || !unresolvedCustomer || additionalCustomers.length !== 3)
                throw new Error('Cancellation cohort fixture missing');
            const [targetOption] = await db
                .select()
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                        eq(billingOptions.cycle, 'monthly')
                    )
                );
            if (!targetOption) throw new Error('Destination option missing');
            const recipients = [
                seeded.user.id,
                pendingCustomer.userId,
                unresolvedCustomer.userId,
                ...additionalCustomers.map((c) => c.userId)
            ];
            usersToClean.push(...recipients);
            const announced = new Map(
                await Promise.all(
                    recipients.map(
                        async (userId) => [userId, await announcementPayload(userId)] as const
                    )
                )
            );
            const future = await scopeFor(seeded.predecessor.id);
            const past = await scopeFor(additionalCustomers[0]!.subscriptionId);
            const futureDate = new Date('2026-10-12T12:00:00.000Z');
            const pastDate = new Date('2026-10-10T12:00:00.000Z');
            // S37 is HOS-1614. Seed only its two APLICADA scope outcomes and one scheduled queue.
            await db
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', appliedAt: clock.now(), applicationDate: futureDate })
                .where(eq(planMigrationSubscriptions.id, future.id));
            await db
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', appliedAt: clock.now(), applicationDate: pastDate })
                .where(eq(planMigrationSubscriptions.id, past.id));
            const [queued] = await db
                .insert(subscriptionScheduledChanges)
                .values({
                    subscriptionId: seeded.predecessor.id,
                    targetPlanVersionId: seeded.targetPlanVersionId,
                    targetBillingOptionId: targetOption.id,
                    effectiveAt: futureDate,
                    planMigrationSubscriptionId: future.id
                })
                .returning();
            if (!queued) throw new Error('Scheduled queue seed failed');
            queueIdsToClean.push(queued.id);
            // S40 reaches ABANDONED through its real service; the c1 trigger marks FUERA.
            await cancelPendingAttempt(
                { subscriptionId: pendingCustomer.subscriptionId, userId: pendingCustomer.userId },
                { provider: pendingCustomer.provider, clock: pendingClock, beforeCancelNotice }
            );
            const ids = [
                seeded.predecessor.id,
                pendingCustomer.subscriptionId,
                unresolvedCustomer.subscriptionId,
                ...additionalCustomers.map((c) => c.subscriptionId)
            ];
            const beforeSubscriptions = await db
                .select()
                .from(subscriptions)
                .where(inArray(subscriptions.id, ids));
            const beforeQueue = await db
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, queued.id));
            const result = await cancelPlanMigration(
                { actor: seeded.actor, planMigrationId: migrationId, db },
                { clock }
            );
            expect(result).toEqual({
                planMigrationId: migrationId,
                cancelledAt: clock.now(),
                rows: { cancelled: 3, alreadyStarted: 1, untouched: 2 }
            });
            const [migration] = await db
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.id, migrationId));
            expect(migration?.cancelledAt).toEqual(clock.now());
            expect(migration?.cancelledBy).toBe(seeded.actor.id);
            const byId = [
                future,
                past,
                await scopeFor(pendingCustomer.subscriptionId),
                await scopeFor(unresolvedCustomer.subscriptionId),
                await scopeFor(additionalCustomers[1]!.subscriptionId),
                await scopeFor(additionalCustomers[2]!.subscriptionId)
            ];
            const final = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId));
            expect(
                final
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map(({ id, status, outReason, appliedAt, applicationDate, updatedAt }) => ({
                        id,
                        status,
                        outReason,
                        appliedAt,
                        applicationDate,
                        updatedAt
                    }))
            ).toEqual(
                [
                    {
                        id: future.id,
                        status: 'APLICADA',
                        outReason: null,
                        appliedAt: clock.now(),
                        applicationDate: futureDate,
                        updatedAt: expect.any(Date)
                    },
                    {
                        id: past.id,
                        status: 'APLICADA',
                        outReason: null,
                        appliedAt: clock.now(),
                        applicationDate: pastDate,
                        updatedAt: expect.any(Date)
                    },
                    {
                        id: byId[2]!.id,
                        status: 'FUERA',
                        outReason: 'TERMINO',
                        appliedAt: null,
                        applicationDate: byId[2]!.applicationDate,
                        updatedAt: expect.any(Date)
                    },
                    ...byId.slice(3).map((row) => ({
                        id: row.id,
                        status: 'CANCELADA',
                        outReason: null,
                        appliedAt: null,
                        applicationDate: row.applicationDate,
                        updatedAt: expect.any(Date)
                    }))
                ].sort((a, b) => a.id.localeCompare(b.id))
            );
            expect(
                await db.select().from(subscriptions).where(inArray(subscriptions.id, ids))
            ).toEqual(beforeSubscriptions);
            expect(
                await db
                    .select()
                    .from(subscriptionScheduledChanges)
                    .where(eq(subscriptionScheduledChanges.id, queued.id))
            ).toEqual(beforeQueue);
            expect(announced.get(seeded.user.id)?.newAmountMinor).toBe(targetOption.amount);
            expect(
                (await cancellationMail(seeded.user.id)).map((mail) => ({
                    payload: mail.payload,
                    dedupKey: mail.dedupKey
                }))
            ).toEqual([
                {
                    payload: {
                        ...announced.get(seeded.user.id),
                        variant: 'ALREADY_STARTED',
                        applicationDate: '2026-10-12'
                    },
                    dedupKey: planMigrationNoticeDedupKey({
                        recipientUserId: seeded.user.id,
                        template: PLAN_MIGRATION_CANCELLED_TEMPLATE,
                        planMigrationSubscriptionId: future.id,
                        milestone: 'mig:cancel',
                        targetDate: '2026-10-11'
                    })
                }
            ]);
            expect(await cancellationMail(pendingCustomer.userId)).toHaveLength(0);
            expect(await cancellationMail(unresolvedCustomer.userId)).toHaveLength(0);
            expect(await cancellationMail(additionalCustomers[0]!.userId)).toHaveLength(0);
            for (const customer of additionalCustomers.slice(1)) {
                const scope = await scopeFor(customer.subscriptionId);
                expect(
                    (await cancellationMail(customer.userId)).map((mail) => ({
                        payload: mail.payload,
                        dedupKey: mail.dedupKey
                    }))
                ).toEqual([
                    {
                        payload: {
                            ...announced.get(customer.userId),
                            variant: 'NOTHING_CHANGES',
                            applicationDate: null
                        },
                        dedupKey: planMigrationNoticeDedupKey({
                            recipientUserId: customer.userId,
                            template: PLAN_MIGRATION_CANCELLED_TEMPLATE,
                            planMigrationSubscriptionId: scope.id,
                            milestone: 'mig:cancel',
                            targetDate: '2026-10-11'
                        })
                    }
                ]);
            }
            await expect(
                cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: migrationId, db },
                    { clock }
                )
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_ALREADY_CANCELLED' });
            expect(await cancellationMail(seeded.user.id)).toHaveLength(1);
            const notice = await sendPlanMigrationNotices({ limit: 10, db }, { clock });
            expect(
                notice.rows.filter((row) =>
                    final.some((scope) => scope.id === row.planMigrationSubscriptionId)
                )
            ).toHaveLength(0);
        });

        it('cancels PARA_RESOLVER without an email', async () => {
            const { seeded, migrationId } = await createAnnouncedExitCase({ unresolved: true });
            usersToClean.push(seeded.user.id);
            const before = await scopeFor(seeded.predecessor.id);
            expect(before.status).toBe('PARA_RESOLVER');
            expect(
                await cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: migrationId, db },
                    { clock }
                )
            ).toEqual({
                planMigrationId: migrationId,
                cancelledAt: clock.now(),
                rows: { cancelled: 1, alreadyStarted: 0, untouched: 0 }
            });
            expect(await scopeFor(seeded.predecessor.id)).toEqual({
                ...before,
                status: 'CANCELADA',
                updatedAt: expect.any(Date)
            });
            expect(await cancellationMail(seeded.user.id)).toHaveLength(0);
        });

        it('rejects missing ids and denied actors before any write', async () => {
            const { seeded, migrationId } = await createAnnouncedExitCase();
            usersToClean.push(seeded.user.id);
            const before = await scopeFor(seeded.predecessor.id);
            await expect(
                cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: crypto.randomUUID(), db },
                    { clock }
                )
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_NOT_FOUND' });
            await expect(
                cancelPlanMigration(
                    {
                        actor: {
                            ...seeded.actor,
                            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
                        },
                        planMigrationId: migrationId,
                        db
                    },
                    { clock }
                )
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            expect(await scopeFor(seeded.predecessor.id)).toEqual(before);
            expect(await cancellationMail(seeded.user.id)).toHaveLength(0);
        });

        it('cancelar un aumento nombra el motivo en el correo de cancelación', async () => {
            const seeded = await createPriceIncreaseCase({ targetAmountMinor: 350000 });
            increaseRecipients.push(seeded.user.id);
            const input = {
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.increaseTarget.id,
                reason: 'PRICE_INCREASE' as const
            };
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input,
                verticals: seeded.verticals,
                clock: migrationClock
            });
            const launched = await launchPlanMigration({
                actor: seeded.actor,
                input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            increaseMigrationIds.push(launched.planMigrationId);
            const scope = await scopeFor(seeded.predecessor.id);
            const announced = await announcementPayload(seeded.user.id);
            expect(announced.reason).toBe('PRICE_INCREASE');

            expect(
                await cancelPlanMigration(
                    { actor: seeded.actor, planMigrationId: launched.planMigrationId, db },
                    { clock }
                )
            ).toEqual({
                planMigrationId: launched.planMigrationId,
                cancelledAt: clock.now(),
                rows: { cancelled: 1, alreadyStarted: 0, untouched: 0 }
            });

            expect(
                (await cancellationMail(seeded.user.id)).map((mail) => ({
                    payload: mail.payload,
                    dedupKey: mail.dedupKey
                }))
            ).toEqual([
                {
                    payload: {
                        ...announced,
                        variant: 'NOTHING_CHANGES',
                        applicationDate: null,
                        reason: 'PRICE_INCREASE'
                    },
                    dedupKey: planMigrationNoticeDedupKey({
                        recipientUserId: seeded.user.id,
                        template: PLAN_MIGRATION_CANCELLED_TEMPLATE,
                        planMigrationSubscriptionId: scope.id,
                        milestone: 'mig:cancel',
                        targetDate: '2026-10-11'
                    })
                }
            ]);
        });
    }
);
