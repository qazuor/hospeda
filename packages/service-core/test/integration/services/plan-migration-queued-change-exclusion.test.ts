import {
    and,
    billingDeadlineVersions,
    desc,
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';

const outboxRecipientIds: string[] = [];
const migrationIds: string[] = [];
const queuedChangeSubscriptionIds: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    // The queued change references the participation row (no ON DELETE), so it
    // must be cleared before the migration-side fixtures are deleted.
    if (queuedChangeSubscriptionIds.length)
        await db
            .delete(subscriptionScheduledChanges)
            .where(
                inArray(
                    subscriptionScheduledChanges.subscriptionId,
                    queuedChangeSubscriptionIds.splice(0)
                )
            );
    if (outboxRecipientIds.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, outboxRecipientIds.splice(0)));
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

/** A queued change that mirrors C2's staging shape: migration origin, still future at preview time. */
async function seedQueuedMigrationChange(args: {
    readonly subscriptionId: string;
    readonly targetPlanVersionId: string;
    readonly targetBillingOptionId: string;
    readonly planMigrationSubscriptionId?: string | null;
}) {
    const [change] = await getServiceTestDb()
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: args.subscriptionId,
            targetPlanVersionId: args.targetPlanVersionId,
            targetBillingOptionId: args.targetBillingOptionId,
            effectiveAt: new Date('2026-12-15T09:46:00.000Z'),
            planMigrationSubscriptionId: args.planMigrationSubscriptionId ?? null
        })
        .returning();
    if (!change) throw new Error('Queued change fixture missing');
    return change;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2310 un cambio programado pendiente excluye la suscripción del cohorte',
    () => {
        it('excludes a customer with a queued change even when no migration row is still pending', async () => {
            const seeded = await createPlanMigrationCase();
            queuedChangeSubscriptionIds.push(seeded.predecessor.id);
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            await seedQueuedMigrationChange({
                subscriptionId: seeded.predecessor.id,
                targetPlanVersionId: seeded.planVersionId,
                targetBillingOptionId: seeded.predecessorBillingOptionId
            });
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input: {
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId
                },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                preview.rows.map((row) => ({
                    subscriptionId: row.subscriptionId,
                    outcome: row.outcome,
                    excludedReason: row.excludedReason
                }))
            ).toEqual([
                {
                    subscriptionId: seeded.predecessor.id,
                    outcome: 'EXCLUDED',
                    excludedReason: 'ALREADY_IN_MIGRATION'
                }
            ]);
            expect(preview.launchable).toBe(false);
        });

        it('excludes a customer whose migration already applied and left a queued change behind', async () => {
            const seeded = await createPlanMigrationCase();
            queuedChangeSubscriptionIds.push(seeded.predecessor.id);
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const db = getServiceTestDb();
            const [deadline] = await db
                .select({ version: billingDeadlineVersions.version })
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!deadline) throw new Error('Deadline fixture missing');
            const [migration] = await db
                .insert(planMigrations)
                .values({
                    vertical: 'accommodation',
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId,
                    reason: 'RETIREMENT',
                    announcedAt: migrationClock.now(),
                    noticeDays: 60,
                    deadlineVersion: deadline.version,
                    signedBy: seeded.actor.id
                })
                .returning();
            if (!migration) throw new Error('Migration fixture missing');
            migrationIds.push(migration.id);
            const [participation] = await db
                .insert(planMigrationSubscriptions)
                .values({
                    planMigrationId: migration.id,
                    subscriptionId: seeded.predecessor.id,
                    applicationDate: new Date('2026-12-15T09:46:00.000Z'),
                    status: 'APLICADA',
                    appliedAt: new Date('2026-11-01T09:46:00.000Z')
                })
                .returning();
            if (!participation) throw new Error('Migration participation fixture missing');
            await seedQueuedMigrationChange({
                subscriptionId: seeded.predecessor.id,
                targetPlanVersionId: seeded.planVersionId,
                targetBillingOptionId: seeded.predecessorBillingOptionId,
                planMigrationSubscriptionId: participation.id
            });
            const preview = await previewPlanMigration({
                actor: seeded.actor,
                input: {
                    sourcePlanVersionId: seeded.planVersionId,
                    targetPlanVersionId: seeded.targetPlanVersionId
                },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            expect(
                preview.rows.map((row) => ({
                    subscriptionId: row.subscriptionId,
                    outcome: row.outcome,
                    excludedReason: row.excludedReason
                }))
            ).toEqual([
                {
                    subscriptionId: seeded.predecessor.id,
                    outcome: 'EXCLUDED',
                    excludedReason: 'ALREADY_IN_MIGRATION'
                }
            ]);
        });

        it('launches for the other customer only, without a scope row or announcement mail for the excluded one', async () => {
            const seeded = await createPlanMigrationCase({ addPendingCustomer: true });
            if (!seeded.pendingCustomer) throw new Error('Pending customer fixture missing');
            queuedChangeSubscriptionIds.push(seeded.predecessor.id);
            outboxRecipientIds.push(seeded.user.id, seeded.pendingCustomer.userId);
            await setMigrationTargetCycle({
                actor: seeded.actor,
                planVersionId: seeded.targetPlanVersionId,
                cycle: 'monthly',
                amount: 300000
            });
            const db = getServiceTestDb();
            await seedQueuedMigrationChange({
                subscriptionId: seeded.predecessor.id,
                targetPlanVersionId: seeded.planVersionId,
                targetBillingOptionId: seeded.predecessorBillingOptionId
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
            const launched = await launchPlanMigration({
                actor: seeded.actor,
                input: { ...input, cohortFingerprint: preview.cohortFingerprint },
                verticals: seeded.verticals,
                clock: migrationClock
            });
            migrationIds.push(launched.planMigrationId);
            const rows = await db
                .select({
                    subscriptionId: planMigrationSubscriptions.subscriptionId,
                    status: planMigrationSubscriptions.status
                })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
            expect(rows).toEqual([
                {
                    subscriptionId: seeded.pendingCustomer.subscriptionId,
                    status: 'PENDIENTE'
                }
            ]);
            expect(launched.excluded).toEqual([
                { subscriptionId: seeded.predecessor.id, excludedReason: 'ALREADY_IN_MIGRATION' }
            ]);
            expect(launched.rows.map((row) => row.subscriptionId)).toEqual([
                seeded.pendingCustomer.subscriptionId
            ]);
            const mails = await db
                .select({ recipientUserId: emailOutbox.recipientUserId })
                .from(emailOutbox)
                .where(
                    and(
                        inArray(emailOutbox.recipientUserId, outboxRecipientIds),
                        eq(emailOutbox.template, 'billing.plan-migration-announced')
                    )
                );
            expect(mails).toEqual([{ recipientUserId: seeded.pendingCustomer.userId }]);
        });
    }
);
