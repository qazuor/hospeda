import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' });
const subscriptionId = '8b17fa49-59f3-4a13-a0d5-fd42e6bac482';

describe('billing signup outbox renderers', () => {
    it('renders the confirmed signup with plan, provider notice, and formatted first charge date', async () => {
        const result = await renderers['billing.signup-confirmed']!({
            row: row({
                template: 'billing.signup-confirmed',
                payload: {
                    subscriptionId,
                    vertical: 'accommodation',
                    planName: 'Plan premium',
                    firstChargeDate: '2026-10-08'
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toContain('suscripción');
        expect(html).toContain('Plan premium');
        expect(html).toContain('Mercado Pago');
        expect(html).toContain('ya pagaste');
        expect(html).toContain('8 de octubre de 2026');
        expect(html).not.toContain(subscriptionId);
    });

    it('renders the before-cancel and incomplete-signup notices without identifiers', async () => {
        const beforeCancel = await renderers['billing.before-cancel']!({
            row: row({ template: 'billing.before-cancel', payload: { subscriptionId } })
        });
        const beforeCancelHtml = renderToStaticMarkup(beforeCancel.react);
        expect(beforeCancelHtml).toContain('Mercado Pago');
        expect(beforeCancelHtml).toContain('cancelación');
        expect(beforeCancelHtml).toContain('No se hará ningún cobro');
        expect(beforeCancelHtml).not.toContain(subscriptionId);

        const incomplete = await renderers['billing.signup-incomplete']!({
            row: row({
                template: 'billing.signup-incomplete',
                payload: {
                    subscriptionId,
                    vertical: 'gastronomy',
                    paymentMethod: 'CARD',
                    windowEndsAt: null,
                    closedCourtesyMonths: 2
                }
            })
        });
        const incompleteHtml = renderToStaticMarkup(incomplete.react);
        expect(incompleteHtml).toContain('Gastronomía');
        expect(incompleteHtml).toContain('quedó sin completarse');
        expect(incompleteHtml).toContain('2 meses de cortesía');
        expect(incompleteHtml).toContain('volver a suscribirte');
        expect(incompleteHtml).not.toContain(subscriptionId);
    });

    it.each([
        ['billing.signup-confirmed', { subscriptionId }],
        ['billing.before-cancel', {}],
        ['billing.signup-incomplete', { subscriptionId, vertical: 'accommodation' }]
    ])('rejects invalid payloads for %s', (template, payload) => {
        expect(() => renderers[template]!({ row: row({ template, payload }) })).toThrow(TypeError);
    });
});
