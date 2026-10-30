import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingPromoRenderers } from '../../../src/services/outbox/billing-promo-renderers.js';
import { PROMO_ENDING_SUBJECT } from '../../../src/templates/billing/promo-ending.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingPromoRenderers({ siteUrl: 'https://hospeda.test' });
const complete = {
    subscriptionId: 'subscription-test',
    redemptionId: 'redemption-test',
    vertical: 'accommodation',
    planName: 'Plan premium',
    lastDiscountedChargeDate: '2026-10-20',
    amountAfterMinor: 80000,
    currency: 'ARS',
    daysBefore: 7,
    deadlinesVersion: 1
};

describe('TEST:B9b:5 AC:B9b:5 the promo ending notice renders', () => {
    it('(a) renders the requested subject, date, amount and provider notice', async () => {
        const result = await renderers['billing.promo-ending']!({
            row: row({ template: 'billing.promo-ending', payload: complete })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(PROMO_ENDING_SUBJECT);
        expect(html).toContain('Tu promo termina con el cobro del 20 de octubre de 2026');
        expect(html).toContain('Desde el mes que viene pagás $800,00');
        expect(html).toContain(
            'Mercado Pago te va a mandar un correo avisando que cambió el monto.'
        );
    });

    it.each([
        ['payload', {}],
        ['missing planName', { ...complete, planName: undefined }],
        ['empty planName', { ...complete, planName: '' }],
        ['missing date', { ...complete, lastDiscountedChargeDate: undefined }],
        ['date', { ...complete, lastDiscountedChargeDate: '20-10-2026' }],
        ['missing amount', { ...complete, amountAfterMinor: undefined }],
        ['amount', { ...complete, amountAfterMinor: -1 }],
        ['fractional amount', { ...complete, amountAfterMinor: 1.5 }],
        ['missing currency', { ...complete, currency: undefined }],
        ['currency', { ...complete, currency: '' }]
    ])('(b) rejects incomplete %s data with TypeError', (_label, payload) => {
        expect(() =>
            renderers['billing.promo-ending']!({
                row: row({ template: 'billing.promo-ending', payload })
            })
        ).toThrow(TypeError);
    });
});
