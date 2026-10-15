import { eq, max } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationMarkModel } from '../../src/models/reconciliation-mark/reconciliation-mark.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { reconciliationMarks } from '../../src/schemas/vertical/reconciliation-mark.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('TEST:1607:2 — reconciliation mark escalation model', () => {
    it('captures the current deadline version and escalates one open mark once', async () => {
        await withTestTransaction(async (tx) => {
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('Expected user');
            const [deadline] = await tx
                .select({ version: max(billingDeadlineVersions.version) })
                .from(billingDeadlineVersions);
            const [subject] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA', userId: user.id })
                .returning();
            if (!subject || !deadline || deadline.version === null)
                throw new Error('Required reconciliation fixture missing');
            const placedAt = new Date('2026-01-01T00:00:00Z');
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.id },
                reason: 'DIVERGENCIA_DE_MONTO',
                placedAt,
                tx
            });
            const lifted = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.id },
                reason: 'PAGO_PENDIENTE_SIN_RAMA',
                placedAt,
                tx
            });
            const [legacy] = await tx
                .insert(reconciliationMarks)
                .values({
                    subscriptionId: subject.id,
                    reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                    placedAt,
                    deadlinesVersion: null
                })
                .returning();
            if (!legacy) throw new Error('Expected legacy mark');
            await tx
                .update(reconciliationMarks)
                .set({ liftedAt: placedAt, liftedBy: user.id })
                .where(eq(reconciliationMarks.id, lifted.id));
            expect(mark.deadlinesVersion).toBe(deadline.version);
            const page = await reconciliationMarkModel.listOpenUnescalatedPage({ limit: 100, tx });
            expect(page.some((item) => item.id === lifted.id)).toBe(false);
            expect(page.find((item) => item.id === mark.id)?.deadlinesVersion).toBe(
                deadline.version
            );
            expect(page.find((item) => item.id === mark.id)?.deadlineDays).toBe(7);
            expect(page.find((item) => item.id === legacy.id)?.deadlineDays).toBe(7);
            const escalatedAt = new Date('2026-01-08T00:00:00Z');
            expect(
                await reconciliationMarkModel.markEscalated({ markId: mark.id, escalatedAt, tx })
            ).toBe(true);
            expect(
                await reconciliationMarkModel.markEscalated({ markId: mark.id, escalatedAt, tx })
            ).toBe(false);
            expect(
                (await reconciliationMarkModel.listOpenUnescalatedPage({ limit: 100, tx })).some(
                    (item) => item.id === mark.id
                )
            ).toBe(false);
        });
    });
});
