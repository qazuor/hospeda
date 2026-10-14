import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import {
    GRACE_STARTED_SUBJECT,
    PAYMENT_CREDITED_SUBJECT,
    SIGNUP_DECLINED_SUBJECT
} from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test/' });
const subscriptionId = 'sub-private-1675';
const paymentId = 'payment-private-1675';
const receiptId = 'receipt-private-1675';
const addonInstanceId = 'addon-private-1675';

async function render(
    template: string,
    payload: Record<string, unknown>,
    createdAt = new Date('2026-10-07T12:00:00.000Z')
) {
    const result = await renderers[template]!({ row: row({ template, payload, createdAt }) });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('TEST:1675:1 AC:1675:1 AC:1675:3 the signup-declined, grace-started and payment-credited notices render', () => {
    it.each([
        'cc_rejected_high_risk',
        null
    ])('renders generic signup decline for declineReason %s without identifiers', async (declineReason) => {
        const { subject, html } = await render('billing.signup-declined', {
            subscriptionId,
            vertical: 'accommodation',
            declineReason
        });
        expect(subject).toBe(SIGNUP_DECLINED_SUBJECT);
        expect(html).toContain('No se te cobró nada');
        expect(html).toContain('Alojamiento');
        expect(html).toContain('https://hospeda.test/es/mi-cuenta/suscripcion/');
        expect(html).toContain('Mercado Pago');
        expect(html).not.toContain(subscriptionId);
        expect(html).not.toContain('revisá tu tarjeta');
        expect(html).not.toContain('tu tarjeta está bien');
    });

    it('renders grace end on the market day', async () => {
        const { subject, html } = await render('billing.grace-started', {
            subscriptionId,
            vertical: 'gastronomy',
            graceEndsAt: '2026-10-20T02:00:00.000Z'
        });
        expect(subject).toBe(GRACE_STARTED_SUBJECT);
        expect(html).toContain('19 de octubre de 2026');
        expect(html).toContain('se vuelve a intentar en el momento');
        expect(html).toContain('No podemos asegurarte que entre');
        expect(html).toContain('volver a suscribirte');
        expect(html).not.toContain('20 de octubre de 2026');
        expect(html).not.toContain(subscriptionId);
    });

    it.each([
        [
            'subscription',
            {
                paymentId,
                subscriptionId,
                amountMinor: 1800000,
                currency: 'ARS',
                receiptId,
                receiptNumber: 42
            }
        ],
        [
            'addon',
            {
                paymentId,
                addonInstanceId,
                amountMinor: 1800000,
                currency: 'ARS',
                receiptId,
                receiptNumber: 42
            }
        ]
    ])('renders credited payment on %s without internal identifiers', async (_kind, payload) => {
        const { subject, html } = await render('billing.payment-credited', payload);
        expect(subject).toBe(PAYMENT_CREDITED_SUBJECT);
        expect(html).toContain('$18.000,00');
        expect(html).toContain('42');
        expect(html).toContain('no fiscal');
        expect(html).toContain('7 de octubre de 2026');
        for (const id of [paymentId, receiptId, subscriptionId, addonInstanceId])
            expect(html).not.toContain(id);
    });

    it.each([
        ['signup empty payload', 'billing.signup-declined', {}],
        [
            'invalid signup vertical',
            'billing.signup-declined',
            { subscriptionId, vertical: 42, declineReason: null }
        ],
        ['grace empty payload', 'billing.grace-started', {}],
        ['payment empty payload', 'billing.payment-credited', {}],
        [
            'date without instant shape',
            'billing.grace-started',
            { subscriptionId, vertical: 'accommodation', graceEndsAt: '2026-10-20' }
        ],
        [
            'fractional amount',
            'billing.payment-credited',
            {
                paymentId,
                subscriptionId,
                amountMinor: 18000.5,
                currency: 'ARS',
                receiptId,
                receiptNumber: 42
            }
        ],
        [
            'zero receipt number',
            'billing.payment-credited',
            {
                paymentId,
                subscriptionId,
                amountMinor: 18000,
                currency: 'ARS',
                receiptId,
                receiptNumber: 0
            }
        ],
        [
            'both payment owners',
            'billing.payment-credited',
            {
                paymentId,
                subscriptionId,
                addonInstanceId,
                amountMinor: 18000,
                currency: 'ARS',
                receiptId,
                receiptNumber: 42
            }
        ],
        [
            'no payment owner',
            'billing.payment-credited',
            { paymentId, amountMinor: 18000, currency: 'ARS', receiptId, receiptNumber: 42 }
        ]
    ])('rejects %s', async (_case, template, payload) => {
        await expect(render(template, payload)).rejects.toBeInstanceOf(TypeError);
    });
});
