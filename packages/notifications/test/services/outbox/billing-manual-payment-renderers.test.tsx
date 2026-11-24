import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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
        // The installment id identifies the row staff must act on (E2E billing-35 filters by it).
        expect(html).toContain('manual-1');
        expect(html).toContain('Renovación');
        expect(html).toContain('Vertical');
        expect(html).not.toContain('class="hospeda-btn"');
        expect(html).toContain('Facturación → Suscripciones');
    });

    it('links the subscription page in the admin panel and names the holder when it can', async () => {
        const reader = vi.fn(async () => ({
            subscriptions: new Map([
                [
                    'subscription-1',
                    {
                        holderName: 'Ana Pérez',
                        holderEmail: null,
                        vertical: 'partner',
                        planName: 'Oro',
                        cycle: null,
                        amountMinor: null,
                        currency: null,
                        status: 'ACTIVE',
                        listingNames: []
                    }
                ]
            ]),
            addonInstances: new Map(),
            openMarks: new Map()
        }));
        const withAdmin = createBillingManualPaymentRenderers({
            adminUrl: 'https://admin.hospeda.test/',
            readSubjects: reader
        })['billing.manual-installment-unpaid']!;
        const mail = await withAdmin({
            row: row({ template: 'billing.manual-installment-unpaid', payload })
        });
        const html = renderToStaticMarkup(mail.react);
        expect(html).toContain(
            'href="https://admin.hospeda.test/billing/subscriptions/subscription-1"'
        );
        expect(html).toContain('Ana Pérez');
        expect(reader).toHaveBeenCalledTimes(1);
    });

    it('renders without the holder, and reports it, when the reader throws', async () => {
        const onEnrichmentError = vi.fn();
        const failing = createBillingManualPaymentRenderers({
            adminUrl: 'https://admin.hospeda.test',
            readSubjects: async () => {
                throw new Error('db down');
            },
            onEnrichmentError
        })['billing.manual-installment-unpaid']!;
        const mail = await failing({
            row: row({ template: 'billing.manual-installment-unpaid', payload })
        });
        const html = renderToStaticMarkup(mail.react);
        expect(html).not.toContain('Titular');
        expect(html).toContain('/billing/subscriptions/subscription-1');
        expect(onEnrichmentError).toHaveBeenCalledTimes(1);
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
