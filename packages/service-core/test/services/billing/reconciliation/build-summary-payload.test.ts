import type { SelectDomainEvent, SelectReconciliationSummaryWindow } from '@repo/db';
import { describe, expect, it } from 'vitest';
import { buildReconciliationSummaryPayload } from '../../../../src/services/billing/reconciliation/summary/build-summary-payload.js';

const window = {
    id: 'window-1',
    coversFrom: new Date('2026-10-01T00:00:00.000Z'),
    openedAt: new Date('2026-10-01T00:00:00.000Z'),
    closesAt: new Date('2026-10-01T01:00:00.000Z'),
    windowMinutes: 60,
    deadlinesVersion: 1,
    sentAt: null,
    eventCount: null
} satisfies SelectReconciliationSummaryWindow;
function event(id: number, entityId: string, reason = 'COBRO_DUPLICADO'): SelectDomainEvent {
    return {
        id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
        eventType: 'reconciliation.mark_opened',
        entityType: 'subscription',
        entityId,
        actorId: null,
        actorType: 'job',
        occurredAt: new Date('2026-10-01T00:30:00.000Z'),
        changes: [
            { field: 'reconciliation_mark.id', new: `mark-${id}` },
            { field: 'reconciliation_mark.reason', new: reason },
            { field: 'reconciliation_mark.outcome', new: 'OPENED' }
        ],
        reason: null,
        correlationId: '00000000-0000-4000-8000-000000000001'
    };
}
describe('buildReconciliationSummaryPayload', () => {
    it('aggregates 100 events into one subject line and total', () => {
        const payload = buildReconciliationSummaryPayload({
            window,
            events: Array.from({ length: 100 }, (_, i) => event(i, 'subject-a'))
        });
        expect(payload.marks).toEqual([
            {
                reason: 'COBRO_DUPLICADO',
                subjectType: 'subscription',
                subjectId: 'subject-a',
                count: 100
            }
        ]);
        expect(payload.totals.events).toBe(100);
    });
    it('keeps separate subjects and stable order, caps at 200, and counts malformed events as omitted', () => {
        const rows = Array.from({ length: 202 }, (_, i) =>
            event(i, `subject-${String(i).padStart(3, '0')}`)
        );
        const malformed = event(300, 'broken');
        malformed.changes = [];
        const payload = buildReconciliationSummaryPayload({ window, events: [...rows, malformed] });
        expect(payload.marks).toHaveLength(200);
        expect(payload.omitted.marks).toBe(3);
        expect(payload.marks[0]?.subjectId).toBe('subject-000');
        expect(payload.totals.events).toBe(203);
        expect(
            buildReconciliationSummaryPayload({
                window,
                events: [event(9, 'b'), event(8, 'a')]
            }).marks.map((x) => x.subjectId)
        ).toEqual(['a', 'b']);
    });
    it('does not add administrative actions or action 16 and returns an empty payload with zero totals', () => {
        const payload = buildReconciliationSummaryPayload({ window, events: [] });
        expect(payload).toMatchObject({
            totals: { events: 0 },
            marks: [],
            escalations: [],
            underCharges: [],
            pauseGifts: [],
            omitted: { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 }
        });
        expect(Object.keys(payload).some((key) => /administrative|action.?16/i.test(key))).toBe(
            false
        );
    });
});
