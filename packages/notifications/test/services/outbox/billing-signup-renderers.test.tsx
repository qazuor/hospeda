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

    it('AC:B7:31 — renders the inherited Tourist VIP cancellation: no further charge, no refund, no ids', async () => {
        // Arrange
        const template = 'billing.tourist-vip-inherited-cancel';

        // Act
        const result = await renderers[template]!({
            row: row({ template, payload: { subscriptionId } })
        });
        const html = renderToStaticMarkup(result.react);

        // Assert
        expect(result.subject).toBe('Cancelamos tu suscripción a Turista VIP');
        expect(html).toContain('Tu plan ya te da los beneficios de Turista VIP');
        expect(html).toContain('cancelamos la suscripción que pagabas por separado');
        expect(html).toContain('No se te va a volver a cobrar');
        expect(html).toContain('lo ya pagado no se reembolsa');
        expect(html).toContain('Mercado Pago');
        expect(html).not.toContain(subscriptionId);
    });

    it('AC:B7:30 — renders the card arrears suspension with promo, Tourist VIP and addon days', async () => {
        const result = await renderers['billing.arrears-suspension']!({
            row: row({
                template: 'billing.arrears-suspension',
                payload: {
                    subscriptionId,
                    vertical: 'accommodation',
                    paymentMethod: 'CARD',
                    touristVipLost: true,
                    oneTimeAddons: [
                        { name: 'Destacado', remainingDays: 10 },
                        { name: 'Impulso', remainingDays: 1 }
                    ],
                    promoLost: true
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe('Tu suscripción se suspendió');
        expect(html).toContain('Alojamiento');
        expect(html).toContain(
            'Tu suscripción se suspendió y ya no se te va a cobrar —tampoco tus addons recurrentes, que quedan pausados y vuelven cuando vuelvas—; para reactivarla, volvé a suscribirte con una tarjeta que funcione.'
        );
        expect(html).toContain('Si tenías una promo, al volver la perdés.');
        expect(html).toContain('También perdés los beneficios de Turista VIP que te daba tu plan.');
        expect(html).toContain('a «Destacado» le quedan 10 días.');
        expect(html).toContain('a «Impulso» le quedan 1 día.');
        expect(html).not.toContain('cuota adeudada');
        expect(html).not.toContain(subscriptionId);
    });

    it('AC:B7:30 — renders the manual arrears suspension with the owed instalment and nothing else', async () => {
        const result = await renderers['billing.arrears-suspension']!({
            row: row({
                template: 'billing.arrears-suspension',
                payload: {
                    subscriptionId,
                    vertical: 'gastronomy',
                    paymentMethod: 'MANUAL',
                    touristVipLost: false,
                    oneTimeAddons: [],
                    promoLost: false
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('Gastronomía');
        expect(html).toContain('Para volver, registrá el pago de la cuota adeudada.');
        expect(html).not.toContain('volvé a suscribirte');
        expect(html).not.toContain('promo');
        expect(html).not.toContain('Turista VIP');
        expect(html).not.toContain('addons de única vez');
        expect(html).not.toContain(subscriptionId);
    });

    it('AC:B7:30 — a card suspension without promo has no promo line', async () => {
        const result = await renderers['billing.arrears-suspension']!({
            row: row({
                template: 'billing.arrears-suspension',
                payload: {
                    subscriptionId,
                    vertical: 'experience',
                    paymentMethod: 'CARD',
                    touristVipLost: false,
                    oneTimeAddons: [],
                    promoLost: false
                }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(html).toContain('volvé a suscribirte');
        expect(html).not.toContain('Si tenías una promo');
    });

    const validArrears = {
        subscriptionId,
        vertical: 'accommodation',
        paymentMethod: 'CARD',
        touristVipLost: true,
        oneTimeAddons: [{ name: 'Destacado', remainingDays: 3 }],
        promoLost: false
    };

    it.each([
        ['without subscriptionId', { ...validArrears, subscriptionId: undefined }],
        ['with an unknown payment method', { ...validArrears, paymentMethod: 'CASH' }],
        ['without touristVipLost', { ...validArrears, touristVipLost: undefined }],
        ['with a non-boolean promoLost', { ...validArrears, promoLost: 'yes' }],
        ['without the addon list', { ...validArrears, oneTimeAddons: undefined }],
        ['with an addon without days', { ...validArrears, oneTimeAddons: [{ name: 'Destacado' }] }],
        [
            'with a fractional addon day count',
            { ...validArrears, oneTimeAddons: [{ name: 'Destacado', remainingDays: 1.5 }] }
        ],
        [
            'with a zero addon day count',
            { ...validArrears, oneTimeAddons: [{ name: 'x', remainingDays: 0 }] }
        ]
    ])('rejects an arrears suspension payload %s', (_label, payload) => {
        expect(() =>
            renderers['billing.arrears-suspension']!({
                row: row({ template: 'billing.arrears-suspension', payload })
            })
        ).toThrow(TypeError);
    });

    it('HOS-1545 AC:B5:27 — renders the orphaned addon cancellation: no further charge, no ids', async () => {
        // Arrange
        const template = 'billing.addon-cancelled';

        // Act
        const result = await renderers[template]!({
            row: row({ template, payload: { subscriptionId } })
        });
        const html = renderToStaticMarkup(result.react);

        // Assert
        expect(result.subject).toBe('Cancelamos el cobro de tu addon');
        expect(html).toContain(
            'Lo que este addon complementaba ya no está activo, así que cancelamos su cobro.'
        );
        expect(html).toContain('No se te va a volver a cobrar.');
        expect(html).toContain('Puede llegarte un correo de Mercado Pago avisando la cancelación.');
        expect(html).not.toContain(subscriptionId);
    });

    it.each([
        ['billing.signup-confirmed', { subscriptionId }],
        ['billing.before-cancel', {}],
        ['billing.signup-incomplete', { subscriptionId, vertical: 'accommodation' }],
        ['billing.tourist-vip-inherited-cancel', {}],
        ['billing.tourist-vip-inherited-cancel', { subscriptionId: 42 }],
        ['billing.addon-cancelled', {}],
        ['billing.addon-cancelled', { subscriptionId: 42 }]
    ])('rejects invalid payloads for %s', (template, payload) => {
        expect(() => renderers[template]!({ row: row({ template, payload }) })).toThrow(TypeError);
    });
});
