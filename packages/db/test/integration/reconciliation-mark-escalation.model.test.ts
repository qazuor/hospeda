import { max } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationMarkModel } from '../../src/models/reconciliation-mark/reconciliation-mark.model.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('TEST:1607:2 — reconciliation mark escalation model', () => {
    it('captures the current deadline version and escalates one open mark once', async () => {
        await withTestTransaction(async (tx) => {
            const [deadline] = await tx
                .select({ version: max(billingDeadlineVersions.version) })
                .from(billingDeadlineVersions);
            const [subject] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
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
            expect(mark.deadlinesVersion).toBe(deadline.version);
            const page = await reconciliationMarkModel.listOpenUnescalatedPage({ limit: 100, tx });
            expect(page.find((item) => item.id === mark.id)?.deadlinesVersion).toBe(
                deadline.version
            );
            expect(page.find((item) => item.id === mark.id)?.deadlineDays).toBe(7);
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
