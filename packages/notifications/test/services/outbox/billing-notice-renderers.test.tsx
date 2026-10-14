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
        'cc_rejected_call_for_authorize',
        null
    ])('renders generic signup decline for declineReason %s without identifiers', async (declineReason) => {
        const { subject, html } = await render('billing.signup-declined', {
            subscriptionId,
            vertical: 'accommodation',
            declineReason,
            successionPredecessor: false
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
            {
                subscriptionId,
                vertical: 42,
                declineReason: null,
                successionPredecessor: false
            }
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

describe('TEST:B13a:4b AC:B13a:5 the declined-signup mail says why and what to do', () => {
    async function signupMail(
        declineReason: string | null,
        successionPredecessor = false
    ): Promise<string> {
        const { html } = await render('billing.signup-declined', {
            subscriptionId,
            vertical: 'accommodation',
            declineReason,
            successionPredecessor
        });
        return html;
    }

    it('explains provider risk without asking the person to check a working card', async () => {
        const html = await signupMail('cc_rejected_high_risk');
        expect(html).toContain('tu tarjeta está bien');
        expect(html).not.toContain('Revisá tu tarjeta');
    });

    it('asks to check the payment method for a measured card failure', async () => {
        const html = await signupMail('cc_rejected_insufficient_amount');
        expect(html).toContain('Revisá tu tarjeta');
        expect(html).not.toContain('tu tarjeta está bien');
    });

    it.each([
        'cc_rejected_call_for_authorize',
        null
    ] as const)('keeps the generic copy for unmapped status_detail %s', async (declineReason) => {
        const html = await signupMail(declineReason);
        expect(html).not.toContain('Revisá tu tarjeta');
        expect(html).not.toContain('tu tarjeta está bien');
        expect(html).toContain('No se te cobró nada');
        expect(html).toContain('Si estabas en tu período de prueba en esta vertical');
    });

    it('keeps the no-charge and trial copy in mapped branches', async () => {
        for (const declineReason of ['cc_rejected_high_risk', 'cc_rejected_insufficient_amount']) {
            const html = await signupMail(declineReason);
            expect(html).toContain('No se te cobró nada');
            expect(html).toContain('Si estabas en tu período de prueba en esta vertical');
        }
    });

    it('finishes the already open successor checkout instead of starting another signup', async () => {
        const html = await signupMail('cc_rejected_high_risk', true);
        expect(html).toContain('terminalo desde Mi Suscripción');
        expect(html).not.toContain('empezá un alta nueva');
    });

    it('offers a new signup when there is no successor', async () => {
        const html = await signupMail('cc_rejected_high_risk', false);
        expect(html).toContain('empezá un alta nueva');
    });

    it('rejects payloads without successionPredecessor', async () => {
        await expect(
            render('billing.signup-declined', {
                subscriptionId,
                vertical: 'accommodation',
                declineReason: 'cc_rejected_high_risk'
            })
        ).rejects.toThrow(TypeError);
    });
});
