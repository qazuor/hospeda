import { describe, expect, it } from 'vitest';
import {
    ActionableReconciliationMarkSchema,
    ReconciliationMarkEventsResponseSchema
} from '../../../src/api/billing/reconciliation-marks.schema';

const uuid = '00000000-0000-4000-8000-000000000001';
const mark = (reasonNumber: number, eventLink: { markId: string } | null) => ({
    markId: uuid,
    reason: reasonNumber === 7 ? 'PAGO_TARDIO_RECHAZADO' : 'DIVERGENCIA_DE_MONTO',
    reasonNumber,
    refundConfirmation: reasonNumber === 7,
    defaultProposal: reasonNumber === 7 ? 'REFUND' : 'NONE',
    openedAt: '2026-01-01T00:00:00.000Z',
    subject: { kind: 'SUBSCRIPTION', id: uuid, status: 'ACTIVE' },
    payments: [],
    paymentCount: 0,
    totalAmount: [],
    unknownAmountCount: 0,
    eventLink
});

describe('reconciliation mark schemas', () => {
    it('accepts marks with and without an event link', () => {
        expect(
            ActionableReconciliationMarkSchema.safeParse(mark(7, { markId: uuid })).success
        ).toBe(true);
        expect(ActionableReconciliationMarkSchema.safeParse(mark(5, null)).success).toBe(true);
    });

    it('rejects unknown proposals, non-uuid ids, and out-of-range conditions', () => {
        expect(
            ActionableReconciliationMarkSchema.safeParse({
                ...mark(7, null),
                defaultProposal: 'LATER'
            }).success
        ).toBe(false);
        expect(
            ActionableReconciliationMarkSchema.safeParse({ ...mark(7, null), markId: 'bad' })
                .success
        ).toBe(false);
        const response = {
            mark: {
                markId: uuid,
                reason: 'X',
                reasonNumber: 7,
                openedAt: '2026-01-01T00:00:00.000Z',
                liftedAt: null,
                subject: { kind: 'SUBSCRIPTION', id: uuid }
            },
            events: [
                {
                    eventId: uuid,
                    occurredAt: '2026-01-01T00:00:00.000Z',
                    actorType: 'ADMIN',
                    actorId: null,
                    correlationId: 'x',
                    outcome: null,
                    failedCondition: 5,
                    conditionRecorded: true,
                    changes: []
                }
            ]
        };
        expect(ReconciliationMarkEventsResponseSchema.safeParse(response).success).toBe(false);
    });
});
