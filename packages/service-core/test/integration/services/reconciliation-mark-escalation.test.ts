import {
    billingDeadlineVersions,
    coveredPeriods,
    domainEventModel,
    payments,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import { desc, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runMarkEscalation } from '../../../src/services/billing/reconciliation/sweep/mark-escalation.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock
} from './reconciliation-zero-call-fixtures.js';

async function runEscalationForMarks(
    markIds: readonly string[],
    input: Parameters<typeof runMarkEscalation>[0],
    ports: Parameters<typeof runMarkEscalation>[1]
) {
    const allowed = new Set(markIds);
    const listPage = reconciliationMarkModel.listOpenUnescalatedPage.bind(reconciliationMarkModel);
    const listSpy = vi
        .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
        .mockImplementation(async (pageInput) => {
            const page = await listPage({ ...pageInput, limit: 10_000 });
            return page.filter(({ id }) => allowed.has(id));
        });
    try {
        return await runMarkEscalation(input, ports);
    } finally {
        listSpy.mockRestore();
    }
}

import {
    seedCoverageAddon,
    seedCoverageAddonInstance,
    seedCoverageAddonProduct,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';

afterAll(closeServiceTestPool);

describe('TEST:B11:15 — escalation uses the mark deadline version', () => {
    it('keeps the old deadline, adopts the new deadline for later marks, and writes one event', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subject = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current billing deadline version missing');
            const version = current.version;
            const values = current.values;
            const placedAt = new Date('2026-01-01T00:00:00Z');
            const oldMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            await tx.insert(billingDeadlineVersions).values({
                version: version + 1,
                values: { ...values, '17': { days: 3 } },
                changedKey: 17,
                previousValue: values['17'],
                newValue: { days: 3 }
            });
            let now = new Date(placedAt.getTime() + 5 * 86_400_000);
            const clock = { now: () => now };
            const correlationId = crypto.randomUUID();
            const fiveDay = await runEscalationForMarks(
                [oldMark.id],
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(fiveDay.escalated).toBe(0);
            now = new Date(placedAt.getTime() + 7 * 86_400_000);
            const sevenDay = await runEscalationForMarks(
                [oldMark.id],
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(sevenDay.escalated).toBe(1);
            const mark = await reconciliationMarkModel.findById({ markId: oldMark.id, tx });
            expect(mark?.escalatedAt).toEqual(now);
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: subject.subscriptionId,
                tx
            });
            expect(
                events.filter(
                    (event) =>
                        event.eventType === 'reconciliation.mark_escalated' &&
                        event.reason === oldMark.reason
                )
            ).toHaveLength(1);
            const repeated = await runEscalationForMarks(
                [oldMark.id],
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(repeated.escalated).toBe(0);
            const newMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                reason: 'PAGO_PENDIENTE_SIN_RAMA',
                placedAt: new Date('2026-02-01T00:00:00Z'),
                tx
            });
            now = new Date(newMark.placedAt.getTime() + 3 * 86_400_000);
            const newVersion = await runEscalationForMarks(
                [newMark.id],
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(newVersion.escalated).toBe(1);
        });
    });

    it('excludes lifted marks and reads the current version for a legacy null version', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subscription = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const placedAt = new Date('2026-03-01T00:00:00Z');
            const lifted = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            expect(
                (
                    await reconciliationMarkModel.lift({
                        markId: lifted.id,
                        expectedVersion: 1,
                        liftedBy: userId,
                        now: placedAt,
                        tx
                    })
                ).outcome
            ).toBe('LIFTED');
            const [legacy] = await tx
                .insert(reconciliationMarks)
                .values({
                    subscriptionId: subscription.subscriptionId,
                    reason: 'PAGO_PENDIENTE_SIN_RAMA',
                    placedAt
                })
                .returning();
            if (!legacy) throw new Error('Expected legacy mark');
            const now = new Date(placedAt.getTime() + 7 * 86_400_000);
            const summary = await runEscalationForMarks(
                [legacy.id],
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock: { now: () => now }, tx }
            );
            expect(summary.examined).toBe(1);
            expect(summary.escalated).toBe(1);
            expect(summary.failures).toHaveLength(0);
            expect(
                (await reconciliationMarkModel.findById({ markId: legacy.id, tx }))?.escalatedAt
            ).toEqual(now);
        });
    });

    it('fails a missing deadline key closed and continues with other marks', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subscription = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const placedAt = new Date('2026-04-01T00:00:00Z');
            const valid = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current billing deadline version missing');
            await tx.execute(sql`
                INSERT INTO "billing_deadline_version"
                    ("version", "values", "changed_key", "previous_value", "new_value")
                SELECT ${current.version + 1}, "values" - '17', 17, "values" -> '17', NULL
                FROM "billing_deadline_version" WHERE "version" = ${current.version}
            `);
            const missing = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.subscriptionId },
                reason: 'PAGO_PENDIENTE_SIN_RAMA',
                placedAt,
                tx
            });
            const now = new Date(placedAt.getTime() + 7 * 86_400_000);
            const summary = await runEscalationForMarks(
                [valid.id, missing.id],
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock: { now: () => now }, tx }
            );
            expect(summary.failures.map(({ markId }) => markId)).toEqual([missing.id]);
            expect(summary.escalated).toBe(1);
            expect(
                (await reconciliationMarkModel.findById({ markId: valid.id, tx }))?.escalatedAt
            ).toEqual(now);
            expect(
                (await reconciliationMarkModel.findById({ markId: missing.id, tx }))?.escalatedAt
            ).toBeNull();
        });
    });

    it('does not change refund, payment, coverage, or subscription state while escalating', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const plan = await seedCoveragePlanVersion(tx, 'accommodation');
            const subscription = await seedCoverageSubscription(tx, {
                userId,
                vertical: 'accommodation',
                ...plan,
                status: 'ACTIVE'
            });
            const [payment] = await tx
                .insert(payments)
                .values({
                    subscriptionId: subscription.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'fake',
                    providerFactId: `escalation-${crypto.randomUUID()}`,
                    factAt: new Date('2026-10-01T00:00:00Z')
                })
                .returning();
            if (!payment) throw new Error('Expected payment');
            const placedAt = new Date('2026-01-01T00:00:00Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.subscriptionId },
                reason: 'PAGO_PENDIENTE_SIN_RAMA',
                placedAt,
                tx
            });
            const [refund] = await tx
                .insert(refunds)
                .values({
                    paymentId: payment.id,
                    amount: payment.amount,
                    reason: 'MANUAL_REVIEW',
                    status: 'REQUESTED'
                })
                .returning();
            if (!refund) throw new Error('Expected pending refund');
            await tx
                .insert(reconciliationMarkPayments)
                .values({ markId: mark.id, paymentId: payment.id });
            await tx.insert(coveredPeriods).values({
                subscriptionId: subscription.subscriptionId,
                periodStart: new Date('2026-10-01T00:00:00Z'),
                paymentId: payment.id,
                creditedAt: new Date('2026-10-01T00:00:00Z')
            });
            const before = {
                refund: await tx.select().from(refunds).where(eq(refunds.id, refund.id)),
                payment: await tx.select().from(payments).where(eq(payments.id, payment.id)),
                coverage: await tx
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id)),
                subscription: await tx
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscription.subscriptionId))
            };
            const now = new Date(placedAt.getTime() + 7 * 86_400_000);
            await runEscalationForMarks(
                [mark.id],
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock: { now: () => now }, tx }
            );
            const after = {
                refund: await tx.select().from(refunds).where(eq(refunds.id, refund.id)),
                payment: await tx.select().from(payments).where(eq(payments.id, payment.id)),
                coverage: await tx
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id)),
                subscription: await tx
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscription.subscriptionId))
            };
            expect(after).toEqual(before);
        });
    });

    it('escalates addon-instance marks with the addon instance as the event subject', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const addon = await seedCoverageAddon(tx, {
                versions: [{ validity: 'FIXED_DAYS', scopeType: 'USER' }]
            });
            const versionId = addon.versionIds[0];
            if (!versionId) throw new Error('Expected addon version');
            const product = await seedCoverageAddonProduct(tx, {
                addonId: addon.addonId,
                versionId,
                compatibleVerticals: ['accommodation']
            });
            const instance = await seedCoverageAddonInstance(tx, {
                productId: product.productId,
                addonVersionId: versionId,
                ownerId: userId
            });
            const placedAt = new Date('2026-05-01T00:00:00Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId: instance.instanceId },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                placedAt,
                tx
            });
            const now = new Date(placedAt.getTime() + 7 * 86_400_000);
            const summary = await runEscalationForMarks(
                [mark.id],
                { correlationId: crypto.randomUUID(), pageSize: 100 },
                { clock: { now: () => now }, tx }
            );
            expect(summary.escalated).toBe(1);
            const events = await domainEventModel.findByEntity({
                entityType: 'addon_instance',
                entityId: instance.instanceId,
                tx
            });
            const event = events.find((candidate) => {
                return (
                    candidate.eventType === 'reconciliation.mark_escalated' &&
                    candidate.changes.some(
                        (change) =>
                            change.field === 'reconciliation_mark.id' && change.new === mark.id
                    )
                );
            });
            expect(event?.reason).toBe(mark.reason);
        });
    });

    it('exposes the optional pass summary only when the sweep port is enabled', async () => {
        const listSpy = vi
            .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
            .mockResolvedValue([]);
        try {
            const { fake } = createReconciliationFake();
            const ports = {
                provider: fake,
                clock: reconciliationClock,
                comparisons: [],
                rowChecks: []
            };
            const withPass = await runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                { ...ports, markEscalation: {} }
            );
            expect(withPass.markEscalation).toMatchObject({
                examined: 0,
                due: 0,
                escalated: 0,
                alreadyHandled: 0,
                failures: []
            });
            const withoutPass = await runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                ports
            );
            expect(withoutPass).not.toHaveProperty('markEscalation');
        } finally {
            listSpy.mockRestore();
        }
    });
});
