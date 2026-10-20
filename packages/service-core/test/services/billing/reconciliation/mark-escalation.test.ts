import { reconciliationMarkModel } from '@repo/db';
import { describe, expect, it, vi } from 'vitest';
import {
    isMarkEscalationDue,
    runMarkEscalation
} from '../../../../src/services/billing/reconciliation/sweep/mark-escalation.js';

describe('mark escalation deadline (TEST:1607:1)', () => {
    const placedAt = new Date('2026-01-01T00:00:00.000Z');
    const dueAt = new Date(placedAt.getTime() + 7 * 86_400_000);

    it('uses an inclusive day boundary', () => {
        expect(isMarkEscalationDue({ placedAt, days: 7, now: new Date(dueAt.getTime() - 1) })).toBe(
            false
        );
        expect(isMarkEscalationDue({ placedAt, days: 7, now: dueAt })).toBe(true);
        expect(isMarkEscalationDue({ placedAt, days: 7, now: new Date(dueAt.getTime() + 1) })).toBe(
            true
        );
    });

    it('rejects zero and fractional day values', () => {
        expect(isMarkEscalationDue({ placedAt, days: 0, now: dueAt })).toBe(false);
        expect(isMarkEscalationDue({ placedAt, days: 1.5, now: dueAt })).toBe(false);
    });

    it('fails closed for a missing deadline and continues to other candidates', async () => {
        const list = vi
            .spyOn(reconciliationMarkModel, 'listOpenUnescalatedPage')
            .mockResolvedValueOnce([
                {
                    id: 'missing',
                    subscriptionId: 's1',
                    addonInstanceId: null,
                    reason: 'DIVERGENCIA_DE_MONTO',
                    placedAt,
                    deadlinesVersion: 1,
                    deadlineDays: null
                },
                {
                    id: 'not-due',
                    subscriptionId: 's2',
                    addonInstanceId: null,
                    reason: 'DIVERGENCIA_DE_MONTO',
                    placedAt,
                    deadlinesVersion: 1,
                    deadlineDays: 7
                }
            ])
            .mockResolvedValueOnce([]);
        const summary = await runMarkEscalation(
            { correlationId: 'correlation', pageSize: 10 },
            { clock: { now: () => new Date(placedAt.getTime() + 6 * 86_400_000) } }
        );
        expect(summary.examined).toBe(2);
        expect(summary.failures).toHaveLength(1);
        expect(summary.failures[0]?.markId).toBe('missing');
        expect(summary.escalated).toBe(0);
        list.mockRestore();
    });
});
