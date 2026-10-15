import {
    billingDeadlineVersions,
    domainEventModel,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { desc } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { runMarkEscalation } from '../../../src/services/billing/reconciliation/sweep/mark-escalation.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';

afterAll(closeServiceTestPool);

describe('TEST:B11:15 — escalation uses the mark deadline version', () => {
    it('keeps the old deadline, adopts the new deadline for later marks, and writes one event', async () => {
        await withServiceTestTransaction(async (tx) => {
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(desc(billingDeadlineVersions.version))
                .limit(1);
            if (!current) throw new Error('Current billing deadline version missing');
            const version = current.version;
            const values = current.values;
            const [subject] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
                .returning();
            if (!subject) throw new Error('Expected subscription');
            const placedAt = new Date('2026-01-01T00:00:00Z');
            const oldMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.id },
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
            const fiveDay = await runMarkEscalation(
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(fiveDay.escalated).toBe(0);
            now = new Date(placedAt.getTime() + 7 * 86_400_000);
            const sevenDay = await runMarkEscalation(
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(sevenDay.escalated).toBe(1);
            const mark = await reconciliationMarkModel.findById({ markId: oldMark.id, tx });
            expect(mark?.escalatedAt).toEqual(now);
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: subject.id,
                tx
            });
            expect(
                events.filter(
                    (event) =>
                        event.eventType === 'reconciliation.mark_escalated' &&
                        event.reason === oldMark.reason
                )
            ).toHaveLength(1);
            const repeated = await runMarkEscalation(
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(repeated.escalated).toBe(0);
            const newMark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.id },
                reason: 'PAGO_PENDIENTE_SIN_RAMA',
                placedAt: new Date('2026-02-01T00:00:00Z'),
                tx
            });
            now = new Date(newMark.placedAt.getTime() + 3 * 86_400_000);
            const newVersion = await runMarkEscalation(
                { correlationId, pageSize: 100 },
                { clock, tx }
            );
            expect(newVersion.escalated).toBe(1);
        });
    });
});
