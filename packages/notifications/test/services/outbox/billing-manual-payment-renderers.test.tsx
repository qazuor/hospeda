import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingManualPaymentRenderers } from '../../../src/services/outbox/billing-manual-payment-renderers.js';
import { MANUAL_INSTALLMENT_UNPAID_SUBJECT } from '../../../src/templates/billing/manual-installment-unpaid.js';
import { row } from './outbox-batch.harness.js';

const renderer = createBillingManualPaymentRenderers()['billing.manual-installment-unpaid']!;
const payload = {
    manualPaymentId: 'manual-1',
    subscriptionId: 'subscription-1',
    vertical: 'partner',
    periodStart: '2026-09-03T12:00:00.000Z',
    openedAt: '2026-09-04T12:00:00.000Z',
    firstInstallment: false
};

describe('manual installment notice renderer', () => {
    it('renders the subject and period', async () => {
        const mail = await renderer({
            row: row({ template: 'billing.manual-installment-unpaid', payload })
        });
        const html = renderToStaticMarkup(mail.react);
        expect(mail.subject).toBe(MANUAL_INSTALLMENT_UNPAID_SUBJECT);
        expect(html).toContain('septiembre');
        expect(html).toContain('subscription-1');
    });

    it('throws TypeError for an invalid payload', () => {
        expect(() =>
            renderer({
                row: row({
                    template: 'billing.manual-installment-unpaid',
                    payload: { ...payload, periodStart: 'tomorrow' }
                })
            })
        ).toThrow(TypeError);
    });

    it('throws TypeError for an extra payload property', () => {
        expect(() =>
            renderer({
                row: row({
                    template: 'billing.manual-installment-unpaid',
                    payload: { ...payload, unexpected: true }
                })
            })
        ).toThrow(TypeError);
    });
});
