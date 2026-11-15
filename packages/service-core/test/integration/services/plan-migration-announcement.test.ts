import {
    buildEmailDedupKey,
    buildScheduleOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePlanDisplayName } from '../../../src/services/billing/plan-display-name.js';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    enqueuePlanMigrationNotice,
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE
} from '../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { extractPostgresErrorCause } from '../../../src/utils/postgres-error-cause.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

const migrationIds: string[] = [];
const recipientIds: string[] = [];
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const coverageNotices = { emitCoverageChanged: async () => undefined };

afterEach(async () => {
    const db = getServiceTestDb();
    if (recipientIds.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, recipientIds.splice(0)));
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupPlanMigrationCases();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

// The shared fixture seeds catalog plan versions and the administrative actor directly;
// subscriptions and customer state are reached through the real billing services.
type Case = Awaited<ReturnType<typeof createPlanMigrationCase>>;

async function planName(planVersionId: string): Promise<string> {
    const [found] = await getServiceTestDb()
        .select({ slug: plans.slug, name: plans.name, vertical: planVersions.vertical })
        .from(planVersions)
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(planVersions.id, planVersionId));
    if (!found) throw new Error('Plan name fixture missing');
    return resolvePlanDisplayName({ vertical: found.vertical, plan: found });
}

async function clearOutbox(ids: readonly string[]) {
    recipientIds.push(...ids);
    await getServiceTestDb()
        .delete(emailOutbox)
        .where(inArray(emailOutbox.recipientUserId, [...ids]));
}

async function outboxFor(ids: readonly string[]) {
    const rows = await getServiceTestDb()
        .select({
            recipientUserId: emailOutbox.recipientUserId,
            template: emailOutbox.template,
            dedupKey: emailOutbox.dedupKey,
            payload: emailOutbox.payload
        })
        .from(emailOutbox)
        .where(inArray(emailOutbox.recipientUserId, [...ids]));
    return rows.sort((a, b) => a.dedupKey.localeCompare(b.dedupKey));
}

async function previewAndLaunch(seeded: Case, actor = seeded.actor) {
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
    };
    const preview = await previewPlanMigration({
        actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    return { preview, launched };
}

async function expectedAnnouncement(args: {
    readonly seeded: Case;
    readonly migrationId: string;
    readonly subscriptionId: string;
    readonly recipientUserId: string;
    readonly preview: Awaited<ReturnType<typeof previewPlanMigration>>;
    readonly variant: 'SCHEDULED' | 'WAITING' | 'TO_RESOLVE';
}) {
    const [scope] = await getServiceTestDb()
        .select({ id: planMigrationSubscriptions.id })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.subscriptionId, args.subscriptionId));
    const previewRow = args.preview.rows.find((row) => row.subscriptionId === args.subscriptionId);
    if (!scope || !previewRow) throw new Error('Expected preview row missing');
    return {
        recipientUserId: args.recipientUserId,
        template: 'billing.plan-migration-announced' as const,
        dedupKey: buildEmailDedupKey({
            recipient: args.recipientUserId,
            template: 'billing.plan-migration-announced',
            occurrence: buildScheduleOccurrence({
                subjectKind: 'pms',
                subjectId: scope.id,
                milestone: 'mig:announce',
                targetDate: getLocalDateString({ instant: migrationClock.now() })
            })
        }),
        payload: {
            planMigrationId: args.migrationId,
            planMigrationSubscriptionId: scope.id,
            subscriptionId: args.subscriptionId,
            vertical: 'accommodation',
            planName: await planName(args.seeded.planVersionId),
            targetPlanName: await planName(args.seeded.targetPlanVersionId),
            direction: args.preview.direction,
            currentAmountMinor: previewRow.currentAmount,
            newAmountMinor: args.variant === 'TO_RESOLVE' ? null : previewRow.newAmount,
            currency: previewRow.currency,
            applicationDate: args.variant === 'SCHEDULED' ? previewRow.applicationDate : null,
            losesPromo: previewRow.losesPromo,
            variant: args.variant,
            deadlinesVersion: args.preview.deadlineVersion
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:3 AC:B12:3 salen tres correos —al anunciar, y 30 y 7 días antes de la fecha de renovación de cada cliente—: el del anuncio',
    () => {
        it('queues exactly one announcement per written row with its complete payload and local-day key', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const users = [seeded.user.id, seeded.pendingCustomer.userId];
            await clearOutbox(users);
            const { preview, launched } = await previewAndLaunch(seeded);
            const expected = await Promise.all([
                expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.predecessor.id,
                    recipientUserId: seeded.user.id,
                    preview,
                    variant: 'SCHEDULED'
                }),
                expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.pendingCustomer.subscriptionId,
                    recipientUserId: seeded.pendingCustomer.userId,
                    preview,
                    variant: 'WAITING'
                })
            ]);
            expect(await outboxFor(users)).toEqual(
                expected.sort((a, b) => a.dedupKey.localeCompare(b.dedupKey))
            );
            const scheduled = expected.find((row) => row.recipientUserId === seeded.user.id);
            if (!scheduled) throw new Error('Scheduled notice missing');
            await getServiceTestDb().transaction(async (tx) => {
                const input = {
                    tx,
                    template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
                    row: {
                        id: scheduled.payload.planMigrationSubscriptionId,
                        recipientUserId: seeded.user.id,
                        recipientEmail: seeded.user.email
                    },
                    milestone: 'mig:announce',
                    targetDate: getLocalDateString({ instant: migrationClock.now() }),
                    payload: scheduled.payload
                } as const;
                expect(await enqueuePlanMigrationNotice(input)).toEqual({ enqueued: false });
                expect(await enqueuePlanMigrationNotice(input)).toEqual({ enqueued: false });
            });
            expect(await outboxFor(users)).toEqual(expected);
        });

        it('excludes the actor while announcing to the other customer', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            await clearOutbox([seeded.user.id, seeded.pendingCustomer.userId]);
            const actor = { ...seeded.actor, id: seeded.user.id };
            const { preview, launched } = await previewAndLaunch(seeded, actor);
            expect(await outboxFor([seeded.user.id])).toHaveLength(0);
            expect(await outboxFor([seeded.pendingCustomer.userId])).toEqual([
                await expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.pendingCustomer.subscriptionId,
                    recipientUserId: seeded.pendingCustomer.userId,
                    preview,
                    variant: 'WAITING'
                })
            ]);
        });

        it('excludes a real CANCEL_SCHEDULED customer from mail and scope', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const cancelled = await cancelActiveSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                    complements,
                    coverageNotices
                }
            );
            expect(cancelled.outcome).toBe('SCHEDULED');
            await clearOutbox([seeded.user.id, seeded.pendingCustomer.userId]);
            const { preview, launched } = await previewAndLaunch(seeded);
            expect(await outboxFor([seeded.user.id])).toHaveLength(0);
            expect(await outboxFor([seeded.pendingCustomer.userId])).toEqual([
                await expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.pendingCustomer.subscriptionId,
                    recipientUserId: seeded.pendingCustomer.userId,
                    preview,
                    variant: 'WAITING'
                })
            ]);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(planMigrationSubscriptions)
                    .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id))
            ).toHaveLength(0);
        });

        it('sends no second announcement to an ALREADY_IN_MIGRATION customer', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const users = [seeded.user.id, seeded.pendingCustomer.userId];
            await clearOutbox(users);
            await previewAndLaunch(seeded, { ...seeded.actor, id: seeded.user.id });
            await clearOutbox(users);
            const { preview, launched } = await previewAndLaunch(seeded);
            expect(
                preview.rows.find(
                    (row) => row.subscriptionId === seeded.pendingCustomer?.subscriptionId
                )?.excludedReason
            ).toBe('ALREADY_IN_MIGRATION');
            expect(await outboxFor([seeded.pendingCustomer.userId])).toHaveLength(0);
            // An attempted duplicate scope row probes the database's partial unique index.
            const duplicateError = await getServiceTestDb()
                .insert(planMigrationSubscriptions)
                .values({
                    planMigrationId: launched.planMigrationId,
                    subscriptionId: seeded.pendingCustomer.subscriptionId,
                    applicationDate: new Date('2027-01-11T12:00:00.000Z'),
                    status: 'PENDIENTE'
                })
                .then(
                    () => null,
                    (error: unknown) => error
                );
            expect(extractPostgresErrorCause(duplicateError)).toMatchObject({
                code: '23505',
                constraint: 'uq_plan_migration_subscription_one_pending'
            });
            expect(await outboxFor([seeded.user.id])).toEqual([
                await expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.predecessor.id,
                    recipientUserId: seeded.user.id,
                    preview,
                    variant: 'SCHEDULED'
                })
            ]);
        });

        it('rolls back already queued mail if a later notice fails in the launch transaction', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const users = [seeded.user.id, seeded.pendingCustomer.userId];
            await clearOutbox(users);
            const original = emailOutboxModel.enqueue.bind(emailOutboxModel);
            let calls = 0;
            vi.spyOn(emailOutboxModel, 'enqueue').mockImplementation(async (input, tx) => {
                calls += 1;
                if (calls === 2) throw new Error('injected second notice failure');
                return original(input, tx);
            });
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
            await expect(
                launchPlanMigration({
                    actor: seeded.actor,
                    input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                    verticals: seeded.verticals,
                    clock: migrationClock
                })
            ).rejects.toThrow('injected second notice failure');
            expect(calls).toBe(2);
            expect(await outboxFor(users)).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(planMigrationSubscriptions)
                    .where(
                        inArray(planMigrationSubscriptions.subscriptionId, [
                            seeded.predecessor.id,
                            seeded.pendingCustomer.subscriptionId
                        ])
                    )
            ).toHaveLength(0);
        });

        it('rejects a changed cohort without leaving any announcement', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            await clearOutbox([seeded.user.id]);
            await expect(
                launchPlanMigration({
                    actor: seeded.actor,
                    input: {
                        sourcePlanVersionId: seeded.planVersionId,
                        targetPlanVersionId: seeded.targetPlanVersionId,
                        cohortFingerprint: '0'.repeat(64)
                    },
                    verticals: seeded.verticals,
                    clock: migrationClock
                })
            ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_COHORT_CHANGED' });
            expect(await outboxFor([seeded.user.id])).toHaveLength(0);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:6 AC:B12:6 la que no tiene su ciclo en el destino queda PARA_RESOLVER, sin tocarla, y recibe sólo el correo del anuncio diciendo que la van a contactar',
    () => {
        it('keeps an annual customer unchanged and queues TO_RESOLVE without date or destination price', async () => {
            const seeded = await createPlanMigrationCase({ sourceCycle: 'annual' });
            await clearOutbox([seeded.user.id]);
            const [before] = await getServiceTestDb()
                .select({
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId,
                    status: subscriptions.status,
                    nextChargeAt: subscriptions.nextChargeAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const { preview, launched } = await previewAndLaunch(seeded);
            const [after] = await getServiceTestDb()
                .select({
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId,
                    status: subscriptions.status,
                    nextChargeAt: subscriptions.nextChargeAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(after).toEqual(before);
            const [scope] = await getServiceTestDb()
                .select({ status: planMigrationSubscriptions.status })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            expect(scope).toEqual({ status: 'PARA_RESOLVER' });
            expect(await outboxFor([seeded.user.id])).toEqual([
                await expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.predecessor.id,
                    recipientUserId: seeded.user.id,
                    preview,
                    variant: 'TO_RESOLVE'
                })
            ]);
        });

        it('queues WAITING without date after a real pause', async () => {
            const seeded = await createPlanMigrationCase();
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
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
            await clearOutbox([seeded.user.id]);
            const { preview, launched } = await previewAndLaunch(seeded);
            expect(await outboxFor([seeded.user.id])).toEqual([
                await expectedAnnouncement({
                    seeded,
                    migrationId: launched.planMigrationId,
                    subscriptionId: seeded.predecessor.id,
                    recipientUserId: seeded.user.id,
                    preview,
                    variant: 'WAITING'
                })
            ]);
        });
    }
);
