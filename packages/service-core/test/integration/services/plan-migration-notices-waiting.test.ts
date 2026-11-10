import {
    courtesyGrants,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    reconciliationMarks,
    subscriptionPauses,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { sendPlanMigrationNotices } from '../../../src/services/billing/plan-migration/send-plan-migration-notices.service.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { startCyclePriceCustomer } from './support/cycle-price-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const db = getServiceTestDb();
const migrationIds: string[] = [];
const recipientIds: string[] = [];
const extraCustomers: Array<{ subscriptionId: string; userId: string }> = [];
let deadlineLock: PoolClient | null = null;

beforeEach(async () => {
    deadlineLock = await getServiceTestPool().connect();
    await deadlineLock.query('SELECT pg_advisory_lock(1613, 5)');
});
type Case = Awaited<ReturnType<typeof createPlanMigrationCase>>;
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const coverageNotices = { emitCoverageChanged: async () => undefined };

// The shared fixture seeds catalog versions and an actor. Subscription states use real services.
async function launch(seeded: Case) {
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const result = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(result.planMigrationId);
    recipientIds.push(seeded.user.id);
    if (seeded.pendingCustomer) recipientIds.push(seeded.pendingCustomer.userId);
    const rows = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, result.planMigrationId));
    return { result, rows };
}

async function messages(userId: string) {
    return db
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
}

async function run(at: string) {
    const result = await sendPlanMigrationNotices(
        { limit: 100, db },
        { clock: { now: () => new Date(at) } }
    );
    const scopes = migrationIds.length
        ? await db
              .select({ id: planMigrationSubscriptions.id })
              .from(planMigrationSubscriptions)
              .where(inArray(planMigrationSubscriptions.planMigrationId, migrationIds))
        : [];
    const ownIds = new Set(scopes.map((scope) => scope.id));
    const rows = result.rows.filter((row) => ownIds.has(row.planMigrationSubscriptionId));
    return {
        rows,
        failed: rows.filter((row) => row.outcome === 'FAILED').length,
        enqueued: rows.filter((row) => row.outcome === 'ENQUEUED').length
    };
}

afterEach(async () => {
    try {
        const recipients = recipientIds.splice(0);
        if (recipients.length)
            await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, recipients));
        for (const id of migrationIds.splice(0)) {
            await db
                .delete(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, id));
            await db.delete(planMigrations).where(eq(planMigrations.id, id));
        }
        // S8/S9 create dependent rows through real services; remove only this fixture's rows.
        const affected = recipients.length
            ? await db
                  .select({ id: subscriptions.id })
                  .from(subscriptions)
                  .where(inArray(subscriptions.userId, recipients))
            : [];
        if (affected.length) {
            const ids = affected.map((row) => row.id);
            await db.delete(courtesyGrants).where(inArray(courtesyGrants.subscriptionId, ids));
            await db
                .delete(subscriptionPauses)
                .where(inArray(subscriptionPauses.subscriptionId, ids));
            await db
                .delete(reconciliationMarks)
                .where(inArray(reconciliationMarks.subscriptionId, ids));
        }
        for (const extra of extraCustomers.splice(0)) {
            await db
                .delete(providerLinks)
                .where(eq(providerLinks.subscriptionId, extra.subscriptionId));
            await db.delete(subscriptions).where(eq(subscriptions.id, extra.subscriptionId));
            await db.delete(users).where(eq(users.id, extra.userId));
        }
        await cleanupPlanMigrationCases();
    } finally {
        if (deadlineLock) {
            await deadlineLock.query('SELECT pg_advisory_unlock(1613, 5)');
            deadlineLock.release();
            deadlineLock = null;
        }
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:6 AC:B12:6 las que no están ACTIVE esperan como una pausada, y una cortesía vigente espera a volver',
    () => {
        it('a real paused principal waits; real resume shifts next charge and recalculates forwards', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { rows } = await launch(seeded);
            const scope = rows[0];
            if (!scope) throw new Error('Scope missing');
            const paused = await pauseSubscription(
                { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements,
                    coverageNotices
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            expect((await run('2026-11-11T12:00:00.000Z')).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'WAITING',
                    milestone: null,
                    recalculated: false
                }
            ]);
            expect(await messages(seeded.user.id)).toHaveLength(1);
            const [link] = await db
                .select({ providerId: providerLinks.providerId })
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, seeded.predecessor.id));
            if (!link) throw new Error('Provider link missing');
            seeded.fake.moveNextCharge({
                authorizationId: link.providerId,
                at: new Date('2027-01-11T13:00:00.000Z')
            });
            const resumed = await resumeSubscription(
                { subscriptionId: seeded.predecessor.id, cause: 'EARLY' },
                { provider: seeded.provider, clock: migrationClock, complements, coverageNotices }
            );
            expect(resumed.outcome).toBe('RESUMED');
            expect((await run('2026-12-12T12:00:00.000Z')).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'ENQUEUED',
                    milestone: 'mig:-30d',
                    recalculated: true
                }
            ]);
            const [after] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect(after?.applicationDate).toEqual(new Date('2027-01-11T12:00:00.000Z'));
            expect(await messages(seeded.user.id)).toHaveLength(2);
        });

        it('a real temporary courtesy waits until the principal resumes', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { rows } = await launch(seeded);
            const scope = rows[0];
            if (!scope) throw new Error('Scope missing');
            const courtesy = await grantTemporaryCourtesy(
                {
                    subscriptionId: seeded.predecessor.id,
                    months: 2,
                    grantedBy: seeded.actor.id,
                    reason: 'TEST:B12:6 courtesy'
                },
                { provider: seeded.provider, clock: migrationClock, coverageNotices }
            );
            expect(courtesy.outcome).toBe('GRANTED');
            expect((await run('2026-11-11T12:00:00.000Z')).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'WAITING',
                    milestone: null,
                    recalculated: false
                }
            ]);
            expect(await messages(seeded.user.id)).toHaveLength(1);
        });

        it('PARA_RESOLVER receives only its announcement and cancellation prevents reminders', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            const { result, rows } = await launch(seeded);
            expect(rows.map((row) => row.status)).toEqual(['PARA_RESOLVER']);
            expect((await run('2027-11-10T12:00:00.000Z')).rows).toEqual([]);
            expect(
                await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: rows[0]!.id,
                        now: new Date('2027-11-10T12:00:00.000Z')
                    })
                )
            ).toEqual({ outcome: 'SKIPPED', milestone: null, recalculated: false });
            expect((await messages(seeded.user.id)).map((message) => message.template)).toEqual([
                'billing.plan-migration-announced'
            ]);
            // Cancellation is seeded here because cancelPlanMigration belongs to c6.
            await db
                .update(planMigrations)
                .set({
                    cancelledAt: new Date('2026-10-12T12:00:00.000Z'),
                    cancelledBy: seeded.actor.id
                })
                .where(eq(planMigrations.id, result.planMigrationId));
            expect((await run('2027-12-03T12:00:00.000Z')).rows).toEqual([]);
            expect(await messages(seeded.user.id)).toHaveLength(1);
        });

        it('a cancelled pending migration never queues an upcoming email', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { result, rows } = await launch(seeded);
            // Cancellation is seeded because its real service belongs to c6.
            await db
                .update(planMigrations)
                .set({
                    cancelledAt: new Date('2026-10-12T12:00:00.000Z'),
                    cancelledBy: seeded.actor.id
                })
                .where(eq(planMigrations.id, result.planMigrationId));
            expect((await run('2026-11-11T12:00:00.000Z')).rows).toEqual([]);
            expect(
                await db.transaction((tx) =>
                    applyPlanMigrationUpcomingNotice({
                        tx,
                        planMigrationSubscriptionId: rows[0]!.id,
                        now: new Date('2026-11-11T12:00:00.000Z')
                    })
                )
            ).toEqual({ outcome: 'SKIPPED', milestone: null, recalculated: false });
            expect((await messages(seeded.user.id)).map((message) => message.template)).toEqual([
                'billing.plan-migration-announced'
            ]);
        });

        it('a real path to CANCELLED leaves FUERA and stops the 30-day reminder', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { rows } = await launch(seeded);
            const scope = rows[0];
            if (!scope) throw new Error('Scope missing');
            await seeded.fake.pause({ authorizationId: seeded.started.authorizationId });
            const suspended = await suspendForArrears(
                {
                    subscriptionId: seeded.predecessor.id,
                    event: 'PROVIDER_PAUSE_OBSERVED',
                    occurrenceId: crypto.randomUUID()
                },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices
                }
            );
            expect(suspended.outcome).toBe('SUSPENDED');
            const cancelled = await cancelDirectSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices,
                    orphanhood: complements
                }
            );
            expect(cancelled.outcome).toBe('CANCELLED');
            const [after] = await db
                .select({
                    status: planMigrationSubscriptions.status,
                    outReason: planMigrationSubscriptions.outReason
                })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect(after).toEqual({ status: 'FUERA', outReason: 'SE_DIO_DE_BAJA' });
            expect((await run('2026-11-11T12:00:00.000Z')).rows).toEqual([]);
            expect(
                (await messages(seeded.user.id)).filter(
                    (message) => message.template === 'billing.plan-migration-upcoming'
                )
            ).toHaveLength(0);
        });

        it('does not move a stored date backwards, including at 23:30 market-local time', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { rows } = await launch(seeded);
            const scope = rows[0];
            if (!scope) throw new Error('Scope missing');
            // Seed a later scope date to test the Q4 forward-only rule; no service changes this yet.
            await db
                .update(planMigrationSubscriptions)
                .set({ applicationDate: new Date('2027-02-11T12:00:00.000Z') })
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect((await run('2027-01-12T02:30:00.000Z')).rows).toEqual([
                {
                    planMigrationSubscriptionId: scope.id,
                    outcome: 'NOT_DUE',
                    milestone: null,
                    recalculated: false
                }
            ]);
            expect(await messages(seeded.user.id)).toHaveLength(1);
            expect((await run('2027-01-12T12:00:00.000Z')).rows[0]?.milestone).toBe('mig:-30d');
            const [after] = await db
                .select()
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.id, scope.id));
            expect(after?.applicationDate).toEqual(new Date('2027-02-11T12:00:00.000Z'));
        });

        it('one broken announcement fails its row while another is enqueued; INV:D13 leaves subscription and queue intact', async () => {
            const seeded = await createPlanMigrationCase();
            const additional = await startCyclePriceCustomer(seeded.predecessorBillingOptionId);
            const [owner] = await db
                .select({ userId: subscriptions.userId })
                .from(subscriptions)
                .where(eq(subscriptions.id, additional.subscriptionId));
            if (!owner?.userId) throw new Error('Second customer missing');
            extraCustomers.push({
                subscriptionId: additional.subscriptionId,
                userId: owner.userId
            });
            recipientIds.push(owner.userId);
            const internalAuthorizationId = additional.authorizationId.split(':').at(-1);
            if (!internalAuthorizationId) throw new Error('Fake authorization missing');
            await additional.fake.approve({ authorizationId: internalAuthorizationId });
            const activated = await activateSubscription(additional.subscriptionId, {
                provider: additional.provider,
                clock: { now: () => new Date('2026-10-08T20:00:00.000Z') },
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip,
                coverageNotices
            });
            expect(activated.activated).toBe(true);
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const { rows } = await launch(seeded);
            const subscriptionIds = rows.map((row) => row.subscriptionId);
            // The additional customer fixture has no synchronized charge date yet.
            await db
                .update(subscriptions)
                .set({ nextChargeAt: new Date('2026-11-11T13:00:00.000Z') })
                .where(eq(subscriptions.id, additional.subscriptionId));
            const beforeSubscriptions = await db
                .select()
                .from(subscriptions)
                .where(inArray(subscriptions.id, subscriptionIds));
            const beforeQueue = await db
                .select()
                .from(subscriptionScheduledChanges)
                .where(inArray(subscriptionScheduledChanges.subscriptionId, subscriptionIds));
            // Seed a missing announcement to exercise per-row failure isolation.
            await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, owner.userId));
            const result = await run('2026-11-11T12:00:00.000Z');
            expect(result.failed).toBe(1);
            expect(result.enqueued).toBe(1);
            expect(result.rows.map((row) => row.outcome).sort()).toEqual(['ENQUEUED', 'FAILED']);
            const afterSubscriptions = await db
                .select()
                .from(subscriptions)
                .where(inArray(subscriptions.id, subscriptionIds));
            const afterQueue = await db
                .select()
                .from(subscriptionScheduledChanges)
                .where(inArray(subscriptionScheduledChanges.subscriptionId, subscriptionIds));
            expect(afterSubscriptions).toEqual(beforeSubscriptions);
            expect(afterQueue).toEqual(beforeQueue);
        });
    }
);
