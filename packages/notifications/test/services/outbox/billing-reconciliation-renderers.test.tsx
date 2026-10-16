import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingReconciliationRenderers } from '../../../src/services/outbox/billing-reconciliation-renderers.js';
import { classifyOutboxTemplate } from '../../../src/services/outbox/email-outbox-suppression.js';
import {
    DUPLICATE_CHARGE_DETECTED_SUBJECT,
    MARK_ESCALATED_SUBJECT,
    RECONCILIATION_SUMMARY_SUBJECT
} from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingReconciliationRenderers({ siteUrl: 'https://hospeda.test' });
const summary = {
    windowId: 'window-1',
    coversFrom: '2026-10-01T00:00:00.000Z',
    closesAt: '2026-10-02T00:00:00.000Z',
    windowMinutes: 60,
    totals: { events: 100 },
    marks: [
        {
            reason: 'RECONCILIATION_REQUIRED',
            subjectType: 'subscription',
            subjectId: 'sub-1',
            count: 100
        }
    ],
    escalations: [
        {
            reason: 'COBRO_DUPLICADO',
            subjectType: 'addon_instance',
            subjectId: 'addon-1',
            markId: 'mark-1'
        }
    ],
    underCharges: [
        {
            subscriptionId: 'sub-1',
            paymentId: 'pay-1',
            currency: 'ARS',
            expectedMinor: 10000,
            chargedMinor: 5000,
            differenceMinor: 5000
        }
    ],
    pauseGifts: [
        {
            subscriptionId: 'sub-2',
            pauseId: 'pause-1',
            pauseStartedAt: '2026-09-01T00:00:00.000Z',
            pauseEndedAt: '2026-09-10T00:00:00.000Z',
            skippedChargeAt: '2026-09-05T00:00:00.000Z',
            nextChargeAfterReturnAt: '2026-10-05T00:00:00.000Z',
            giftDays: 5
        }
    ],
    omitted: { marks: 2, escalations: 0, underCharges: 0, pauseGifts: 0 }
};

describe('TEST:1607:8 reconciliation summary renderer', () => {
    it('renders all populated sections, count, omission line, and no action 16', async () => {
        const result = await renderers['billing.reconciliation-summary']!({
            row: row({ template: 'billing.reconciliation-summary', payload: summary })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(RECONCILIATION_SUMMARY_SUBJECT);
        expect(html).toContain('RECONCILIATION_REQUIRED · subscription sub-1 · 100 veces');
        expect(html).toContain('Marcas que pasaron su plazo sin resolverse');
        expect(html).toContain('Cobros por debajo del esperado');
        expect(html).toContain('Pausas que regalaron días');
        expect(html).toContain('… y 2 más');
        expect(html).not.toContain('acción 16');
        expect(html).not.toContain('actos administrativos');
        const empty = await renderers['billing.reconciliation-summary']!({
            row: row({
                template: 'billing.reconciliation-summary',
                payload: { ...summary, marks: [], omitted: { ...summary.omitted, marks: 0 } }
            })
        });
        expect(renderToStaticMarkup(empty.react)).not.toContain('Marcas abiertas');
    });

    it.each([
        ['missing windowId', { ...summary, windowId: undefined }],
        ['marks not array', { ...summary, marks: {} }],
        ['zero window', { ...summary, windowMinutes: 0 }],
        ['non-ISO date', { ...summary, coversFrom: 'yesterday' }],
        [
            'unknown subject',
            { ...summary, marks: [{ ...summary.marks[0], subjectType: 'unknown' }] }
        ]
    ])('rejects invalid summary: %s', (_label, payload) => {
        expect(() =>
            renderers['billing.reconciliation-summary']!({
                row: row({ template: 'billing.reconciliation-summary', payload })
            })
        ).toThrow(TypeError);
    });
});

describe('TEST:1607:9 immediate transactional renderers', () => {
    it('renders duplicate charge details and omits a null payment identifier', async () => {
        const payload = {
            markId: 'mark-1',
            subjectType: 'subscription',
            subjectId: 'sub-1',
            reason: 'COBRO_DUPLICADO',
            openedAt: '2026-10-01T00:00:00.000Z',
            paymentId: 'pay-1'
        };
        const result = await renderers['billing.duplicate-charge-detected']!({
            row: row({ template: 'billing.duplicate-charge-detected', payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(DUPLICATE_CHARGE_DETECTED_SUBJECT);
        expect(html).toContain('subscription sub-1');
        expect(html).toContain('mark-1');
        expect(html).toContain('Pago: pay-1');
        const withoutPayment = await renderers['billing.duplicate-charge-detected']!({
            row: row({
                template: 'billing.duplicate-charge-detected',
                payload: { ...payload, paymentId: null }
            })
        });
        expect(renderToStaticMarkup(withoutPayment.react)).not.toContain('Pago:');
        expect(() =>
            renderers['billing.duplicate-charge-detected']!({
                row: row({ template: 'billing.duplicate-charge-detected', payload: {} })
            })
        ).toThrow(TypeError);
    });

    it('renders escalation details and rejects invalid payloads', async () => {
        const payload = {
            markId: 'mark-2',
            subjectType: 'addon_instance',
            subjectId: 'addon-2',
            reason: 'RECONCILIATION_REQUIRED',
            placedAt: '2026-09-01T00:00:00.000Z',
            escalatedAt: '2026-09-08T00:00:00.000Z',
            escalationDays: 7
        };
        const result = await renderers['billing.mark-escalated']!({
            row: row({ template: 'billing.mark-escalated', payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(MARK_ESCALATED_SUBJECT);
        for (const value of [
            'RECONCILIATION_REQUIRED',
            'addon_instance addon-2',
            'mark-2',
            '7 días',
            '1 de septiembre de 2026',
            '8 de septiembre de 2026'
        ])
            expect(html).toContain(value);
        for (const invalid of [
            { ...payload, escalationDays: 0 },
            { ...payload, subjectType: 'bad' },
            { ...payload, placedAt: 'bad' }
        ]) {
            expect(() =>
                renderers['billing.mark-escalated']!({
                    row: row({ template: 'billing.mark-escalated', payload: invalid })
                })
            ).toThrow(TypeError);
        }
    });

    it('classifies all three templates as transactional by default', () => {
        for (const template of [
            'billing.reconciliation-summary',
            'billing.duplicate-charge-detected',
            'billing.mark-escalated'
        ]) {
            expect(classifyOutboxTemplate({ template }).emailClass).toBe('transactional');
        }
    });
});
